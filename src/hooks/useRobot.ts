// src/hooks/useRobot.ts
// 机器人状态与命令式控制 Hook：关节、坐标系、末端位姿、工具、状态管理

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CoordinateSystem, JointAngles, Pose, RobotConfig, StatusType } from '@/types/robot';
import { KUKA_LIKE, DEFAULT_JOINTS } from '@/lib/robot-config';
import { useRobotPoseAPI } from './useRobotPoseAPI';
import { SceneKinematicModel } from '@/lib/scene-kinematic-model';
import { GLBRobotModel } from '@/lib/glb-robot-model';
import { robotPoseBridge } from '@/lib/robot-pose-bridge';
import type { CalibrationData } from '@/lib/robot-pose-bridge';
import { solveIK, solvePositionOnlyIK, isReachable } from '@/lib/ik-solver';
import { solveIKWithGizmoConfig } from '@/lib/transform-gizmo-utils';
import type { GizmoIKHandle } from '@/types/robot';
import { Matrix4x4 } from '@/lib/matrix4x4';
import { degToRad, radToDeg } from '@/lib/math/angle';
import { applyRotationIncrement, buildRotationFromEuler, rotationMatrixToEulerZYX } from '@/lib/math/rotation3d';
import { DEFAULT_MOTION_CONFIG } from '@/lib/motion-smoothing';
import { useMotion } from './useMotion';

/** 记忆点类型（供动作序列系统使用） */
export interface Waypoint {
  name: string;
  joints: JointAngles;
}

interface MoveDirectionResult {
  success: boolean;
}

/** 末端位姿展示结构（位置 mm，欧拉角 °） */
interface EndEffectorPose {
  position: [number, number, number];
  euler: [number, number, number];
  rotation: number[][];
}

interface GoToPositionPlanResult {
  waypointJoints: JointAngles[];
  depthUsed: number;
}

const POSITION_TRANSIT_LIFT_MM = 250;

function normalizeJointAngleDeg(angle: number): number {
  let normalized = angle;
  while (normalized > 180) normalized -= 360;
  while (normalized < -180) normalized += 360;
  return normalized;
}

function buildPositionOnlyAltSeeds(
  seedJoints: JointAngles,
  targetPosition: [number, number, number]
): JointAngles[] {
  const [j1, , , j4, , j6] = seedJoints;
  const targetHeadingDeg = normalizeJointAngleDeg(
    radToDeg(Math.atan2(targetPosition[1], targetPosition[0]))
  );
  const headingCandidates = [
    targetHeadingDeg,
    normalizeJointAngleDeg(targetHeadingDeg + 20),
    normalizeJointAngleDeg(targetHeadingDeg - 20),
    j1,
    normalizeJointAngleDeg(j1 + 20),
    normalizeJointAngleDeg(j1 - 20),
  ];
  const uniqueHeadingCandidates = Array.from(
    new Set(headingCandidates.map((angle) => Math.round(angle * 10) / 10))
  );

  const seeds: JointAngles[] = [];
  uniqueHeadingCandidates.forEach((heading) => {
    seeds.push([heading, -30, 60, j4, 0, j6]);
    seeds.push([heading, -45, 90, j4, 0, j6]);
    seeds.push([heading, -15, 45, j4, 30, j6]);
  });

  return [
    ...seeds,
    [targetHeadingDeg, -35, 70, j4, 20, j6],
    [normalizeJointAngleDeg(targetHeadingDeg + 35), -45, 90, j4, 20, j6],
    [normalizeJointAngleDeg(targetHeadingDeg - 35), -45, 90, j4, 20, j6],
  ] as JointAngles[];
}

/** 把关节角限制到配置行程 */
function clampJointsToRanges(joints: JointAngles, config: RobotConfig): JointAngles {
  const ranges = Object.values(config.dhParams).map((p) => p.thetaRange);
  return joints.map((value, i) => Math.max(ranges[i][0], Math.min(ranges[i][1], value))) as JointAngles;
}

/** 线性插值标量 */
function lerpScalar(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 在两个欧拉角之间做最短路径插值，避免跨 ±pi 时绕大圈 */
function lerpEulerShortest(
  start: [number, number, number],
  end: [number, number, number],
  t: number
): [number, number, number] {
  return start.map((value, index) => {
    let delta = end[index] - value;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return value + delta * t;
  }) as [number, number, number];
}

/**
 * 机器人核心控制 Hook
 *
 * - 管理关节状态、坐标系、步进、末端位姿、工具列表、运行状态
 * - 所有运动命令最终交给 useMotion 的 RAF 动画循环
 * - 逆运动学完全基于 GLBRobotModel，调用 ik-solver.ts 中的求解器
 */
export function useRobot(externalTargetRef?: React.MutableRefObject<JointAngles>) {
  const config = KUKA_LIKE;
  const ranges = useMemo(() => Object.values(config.dhParams).map((p) => p.thetaRange), [config]);

  const [joints, setJointsState] = useState<JointAngles>(DEFAULT_JOINTS);
  const [displayJoints, setDisplayJointsState] = useState<JointAngles>(DEFAULT_JOINTS);
  const [originJoints, setOriginJoints] = useState<JointAngles | null>(null);
  const [coordinateSystem, setCoordinateSystem] = useState<CoordinateSystem>('World');
  const [jointStep, setJointStep] = useState(1);
  const [posStep, setPosStep] = useState(1);
  const [rotStep, setRotStep] = useState(1);
  const [selectedTool, setSelectedTool] = useState('无');
  const [toolList, setToolList] = useState<string[]>([]);
  const [status, setStatus] = useState<StatusType>('ready');
  const [trajectory, setTrajectory] = useState<[number, number, number][]>([]);

  const jointsRef = useRef<JointAngles>(DEFAULT_JOINTS);
  const displayJointsRef = useRef<JointAngles>(DEFAULT_JOINTS);

  // 同步状态与 ref，保证 RAF 循环和 UI 使用同一数据源
  useEffect(() => {
    jointsRef.current = joints;
    displayJointsRef.current = displayJoints;
  }, [joints, displayJoints]);

  // 同步到外部 slider ref（3D 层 useFrame 直接读取）
  useEffect(() => {
    if (externalTargetRef) {
      externalTargetRef.current = [...displayJoints];
    }
  }, [displayJoints, externalTargetRef]);

  // GLB 位姿采样能力（保留用于轨迹显示等实时需求）
  const poseApi = useRobotPoseAPI();

  // PoE 运动学模型：优先使用 bridge 标定数据，未就绪时退回 GLBRobotModel
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(
    () => robotPoseBridge.getCalibration()
  );
  useEffect(() => {
    const unsub = robotPoseBridge.subscribeCalibration(setCalibrationData);
    return unsub;
  }, []);

  const model = useMemo(() => {
    if (calibrationData) return new SceneKinematicModel(calibrationData);
    // 回退：GLB 模型未加载完成时使用旧的场景采样式模型
    return new GLBRobotModel(poseApi);
  }, [calibrationData, poseApi]);

  // 统一设置关节角：更新 state、refs、外部 ref
  const applyJoints = useCallback(
    (next: JointAngles) => {
      const clamped = clampJointsToRanges(next, config);
      setJointsState(clamped);
      setDisplayJointsState(clamped);
      jointsRef.current = clamped;
      displayJointsRef.current = clamped;
      if (externalTargetRef) {
        externalTargetRef.current = [...clamped];
      }
    },
    [config, externalTargetRef]
  );

  const getCurrentJoints = useCallback(() => displayJointsRef.current, []);

  // goToPosition 自动分段执行队列：单击一次后按规划好的关键关节点顺序跑完整条路径
  const goToPositionQueueRef = useRef<JointAngles[]>([]);

  // 动画循环（直接解构稳定回调，避免整个 motion 对象变化导致 command API 不必要重建）
  const {
    startEasedAnimation,
    startCoordinatedAnimation,
    startSpeedLimitedAnimation,
    startCartesianAnimation,
    stopAnimation,
    isAnimating,
    isAnimatingRef,
  } = useMotion({
    model,
    config,
    getCurrentJoints,
    setJoints: applyJoints,
    setStatus,
  });

  const flushNextGoToPositionWaypoint = useCallback(() => {
    const next = goToPositionQueueRef.current.shift();
    if (!next) return false;
    startCoordinatedAnimation(next);
    return true;
  }, [startCoordinatedAnimation]);

  useEffect(() => {
    if (status !== 'complete') return;
    if (goToPositionQueueRef.current.length === 0) return;
    flushNextGoToPositionWaypoint();
  }, [status, flushNextGoToPositionWaypoint]);

  const isMotionQueueIdle = useCallback(() => {
    return !isAnimatingRef.current && goToPositionQueueRef.current.length === 0;
  }, [isAnimatingRef]);

  // Gizmo IK 处理器（ref 封装，依赖 applyJoints，须在其之后声明）
  const gizmoIKRef = useRef<GizmoIKHandle | null>(null);
  useEffect(() => {
    gizmoIKRef.current = {
      solveAndApply: (targetPose: Pose) => {
        const current = displayJointsRef.current;
        const result = solveIKWithGizmoConfig(targetPose, current, model, ranges as [number, number][]);
        if (!result) return false;
        applyJoints(result);
        return true;
      },
    };
  }, [model, ranges, applyJoints]);

  // 当前末端位姿（GLB 采样，mm / °）
  const endEffectorPose = useMemo<EndEffectorPose>(() => {
    const pose = model.forwardKinematics(joints);
    if (!pose) {
      return {
        position: [0, 0, 0],
        euler: [0, 0, 0],
        rotation: [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ],
      };
    }
    return {
      position: pose.position.map((value) => Math.round(value * 10) / 10) as [number, number, number],
      euler: pose.euler.map((rad) => Math.round(radToDeg(rad) * 10) / 10) as [number, number, number],
      rotation: pose.rotation,
    };
  }, [model, joints]);

  // GLB 场景坐标（米），供 UI 显示/填入当前坐标
  const glbPosition = useMemo<[number, number, number] | null>(() => {
    const pose = model.forwardKinematics(joints);
    if (!pose) return null;
    const [x, y, z] = pose.position;
    return [x / 1000, y / 1000, z / 1000];
  }, [model, joints]);

  // 添加轨迹点（3D 层在关节更新后回调）
  const addTrajectoryPoint = useCallback((pos: [number, number, number]) => {
    setTrajectory((prev) => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        const dist = Math.sqrt(
          (pos[0] - last[0]) ** 2 + (pos[1] - last[1]) ** 2 + (pos[2] - last[2]) ** 2
        );
        if (dist < 0.001) return prev;
      }
      const next = [...prev, pos];
      if (next.length > 200) next.shift();
      return next;
    });
  }, []);

  // ===== 关节微调 =====
  const adjustJoint = useCallback(
    (index: number, delta: number, isContinuous = false) => {
      const current = displayJointsRef.current;
      const nextValue = Math.max(ranges[index][0], Math.min(ranges[index][1], current[index] + delta * jointStep));
      const rounded = Math.round(nextValue * 10) / 10;
      const next = [...current] as JointAngles;
      next[index] = rounded;

      if (isContinuous) {
        // 长按连续触发：速度限制动画平滑追目标
        startSpeedLimitedAnimation(next);
      } else {
        // 单击：400ms 缓动动画
        startEasedAnimation(next);
      }
    },
    [jointStep, ranges, startEasedAnimation, startSpeedLimitedAnimation]
  );

  // ===== 直接设置某个关节（滑块/输入框，无动画）=====
  const setJoint = useCallback(
    (index: number, value: number) => {
      const clamped = Math.max(ranges[index][0], Math.min(ranges[index][1], value));
      const rounded = Math.round(clamped * 100) / 100;
      const current = displayJointsRef.current;
      if (Math.abs(current[index] - rounded) < 0.01) return;

      const next = [...current] as JointAngles;
      next[index] = rounded;
      applyJoints(next);
    },
    [ranges, applyJoints]
  );

  // ===== 位姿方向键 =====
  // 长按会话状态，保证连续触发时目标沿同一基准平滑累加
  const longPressKeyRef = useRef('');
  const longPressTargetRef = useRef<[number, number, number] | null>(null);
  const longPressEulerRef = useRef<[number, number, number] | null>(null);
  const longPressRotationRef = useRef<number[][] | null>(null);

  const moveDirection = useCallback(
    (axis: 'x' | 'y' | 'z' | 'rx' | 'ry' | 'rz', sign: 1 | -1, isLongPress = false): MoveDirectionResult => {
      const step = ['x', 'y', 'z'].includes(axis) ? posStep : rotStep;
      const delta = step * sign;
      const currentJoints = displayJointsRef.current;
      const currentPose = model.forwardKinematics(currentJoints);
      if (!currentPose) {
        return { success: false };
      }

      const currentPos = currentPose.position;
      const currentEuler = currentPose.euler;
      const currentRot = currentPose.rotation;
      const isPositionAxis = ['x', 'y', 'z'].includes(axis);

      let targetPos: [number, number, number] = currentPos;
      let targetEuler: [number, number, number] = currentEuler;
      let targetRot: number[][] = currentRot;

      if (isPositionAxis) {
        const axisIndexMap: Record<string, number> = { x: 0, y: 1, z: 2 };
        const axisIndex = axisIndexMap[axis];
        const offset: [number, number, number] = [0, 0, 0];
        offset[axisIndex] = delta;
        if (coordinateSystem === 'Tool') {
          const worldOffset = Matrix4x4.mat3Vec3Mul(currentRot, offset);
          targetPos = [
            currentPos[0] + worldOffset[0],
            currentPos[1] + worldOffset[1],
            currentPos[2] + worldOffset[2],
          ] as [number, number, number];
        } else {
          targetPos = [
            currentPos[0] + offset[0],
            currentPos[1] + offset[1],
            currentPos[2] + offset[2],
          ] as [number, number, number];
        }
      } else {
        const deltaRad = degToRad(delta);
        targetRot = applyRotationIncrement(currentRot, axis as 'rx' | 'ry' | 'rz', deltaRad, coordinateSystem);
        targetEuler = rotationMatrixToEulerZYX(targetRot);
      }

      // 长按目标累加：在同一按压会话内以上次目标为基准继续扩展
      if (isLongPress) {
        const pressKey = `${axis}:${sign}:${coordinateSystem}`;
        const isNewSession = longPressKeyRef.current !== pressKey || !isAnimatingRef.current;

        if (isPositionAxis) {
          if (!isNewSession && longPressTargetRef.current) {
            const axisIndexMap: Record<string, number> = { x: 0, y: 1, z: 2 };
            const axisIndex = axisIndexMap[axis];
            const offsetLocal: [number, number, number] = [0, 0, 0];
            offsetLocal[axisIndex] = delta;
            if (coordinateSystem === 'Tool') {
              const toolBasis = longPressRotationRef.current ?? currentRot;
              const worldOffset = Matrix4x4.mat3Vec3Mul(toolBasis, offsetLocal);
              longPressTargetRef.current = [
                longPressTargetRef.current[0] + worldOffset[0],
                longPressTargetRef.current[1] + worldOffset[1],
                longPressTargetRef.current[2] + worldOffset[2],
              ];
            } else {
              longPressTargetRef.current = [
                longPressTargetRef.current[0] + offsetLocal[0],
                longPressTargetRef.current[1] + offsetLocal[1],
                longPressTargetRef.current[2] + offsetLocal[2],
              ];
            }
          } else {
            longPressTargetRef.current = [...targetPos];
            longPressEulerRef.current = [...targetEuler];
            longPressRotationRef.current = targetRot.map((row) => [...row]);
            longPressKeyRef.current = pressKey;
          }
          targetPos = longPressTargetRef.current;
          targetEuler = longPressEulerRef.current ?? targetEuler;
          targetRot = longPressRotationRef.current ?? targetRot;
        } else {
          if (!isNewSession && longPressEulerRef.current) {
            const baseRot = buildRotationFromEuler(longPressEulerRef.current);
            const nextRot = applyRotationIncrement(
              baseRot,
              axis as 'rx' | 'ry' | 'rz',
              degToRad(delta),
              coordinateSystem
            );
            longPressEulerRef.current = rotationMatrixToEulerZYX(nextRot);
          } else {
            longPressEulerRef.current = [...targetEuler];
            longPressKeyRef.current = pressKey;
          }
          targetEuler = longPressEulerRef.current;
          targetRot = buildRotationFromEuler(targetEuler);
          targetPos = currentPos;
        }
      } else {
        longPressKeyRef.current = '';
        longPressTargetRef.current = null;
        longPressEulerRef.current = null;
        longPressRotationRef.current = null;
      }

      // 位置移动：工作空间预检 + 笛卡尔动画
      if (isPositionAxis) {
        if (!isReachable(targetPos, model)) {
          setStatus('unreachable');
          setTimeout(() => setStatus('ready'), 1500);
          return { success: false };
        }

        const targetPose: Pose = { position: targetPos, euler: targetEuler, rotation: targetRot };
        // 长按使用与单击相同的时长，配合 useMotion 的同类型不重启优化，连续 tick 仅更新目标 ref，不产生帧间隙
        const duration = DEFAULT_MOTION_CONFIG.ikAnimDuration;
        startCartesianAnimation(targetPose, { duration, positionOnly: true });
        return { success: true };
      }

      // 姿态移动：直接求解目标位姿 IK，再用关节缓动到位
      // 使用更严格的 tolerance 与更精确的 Jacobian 权重，保证每次 10° 步进实际到达误差 < 0.5°
      const targetPose: Pose = { position: targetPos, euler: targetEuler, rotation: targetRot };
      const solved = solveIK(
        targetPose,
        currentJoints,
        model,
        {
          maxIterations: 100,
          posTolerance: 0.3,
          oriTolerance: 0.005,
          damping: 0.15,
          maxStepRad: 0.05,
          orientationScale: 300,
        },
        ranges
      );

      if (!solved) {
        setStatus('unreachable');
        setTimeout(() => setStatus('ready'), 1500);
        return { success: false };
      }

      const clamped = clampJointsToRanges(solved, config);
      // 协调匀速动画：所有关节按同一比例移动，路径不走样，连续调用不重启 RAF
      startCoordinatedAnimation(clamped);
      return { success: true };
    },
    [
      config,
      coordinateSystem,
      model,
      startCoordinatedAnimation,
      startCartesianAnimation,
      posStep,
      rotStep,
      isAnimatingRef,
    ]
  );

  // ===== 原点位姿 =====
  const saveOrigin = useCallback(() => {
    setOriginJoints([...displayJointsRef.current]);
  }, []);

  const goToOrigin = useCallback(() => {
    if (!originJoints) return;
    startEasedAnimation([...originJoints]);
  }, [originJoints, startEasedAnimation]);

  // ===== 回零 / 重置 / 随机 =====
  const goToZero = useCallback(() => {
    const zero: JointAngles = [0, 0, 0, 0, 0, 0];
    startEasedAnimation(zero);
  }, [startEasedAnimation]);

  const resetJoints = useCallback(() => goToZero(), [goToZero]);

  const randomJoints = useCallback(() => {
    const jointRanges = Object.values(config.dhParams).map((p) => p.thetaRange);
    const random = Array.from({ length: 6 }, (_, i) => {
      const [min, max] = jointRanges[i];
      return min + Math.random() * (max - min);
    }) as JointAngles;
    startEasedAnimation(random);
  }, [config, startEasedAnimation]);

  // ===== 指定关节角 =====
  const goToJoints = useCallback(
    (target: JointAngles) => {
      goToPositionQueueRef.current = [];
      startEasedAnimation([...target]);
    },
    [startEasedAnimation]
  );

  const solveDirectGoToPosition = useCallback(
    (targetPose: Pose, seedJoints: JointAngles, hasExplicitOrientation: boolean): JointAngles | null => {
      if (hasExplicitOrientation) {
        return solveIK(
          targetPose,
          seedJoints,
          model,
          {
            maxIterations: 120,
            posTolerance: 0.8,
            oriTolerance: 0.01,
            damping: 0.15,
            maxStepRad: 0.06,
            orientationScale: 300,
          },
          ranges as [number, number][]
        );
      }

      return solvePositionOnlyIK(
        targetPose.position,
        seedJoints,
        model,
        {
          maxIterations: 120,
          posTolerance: 0.8,
          damping: 0.15,
          maxStepRad: 0.06,
        },
        ranges as [number, number][]
      );
    },
    [model, ranges]
  );

  const solveDirectPositionOnly = useCallback(
    (targetPosition: [number, number, number], seedJoints: JointAngles): JointAngles | null => {
      const primarySolution = solvePositionOnlyIK(
        targetPosition,
        seedJoints,
        model,
        {
          maxIterations: 120,
          posTolerance: 0.8,
          damping: 0.15,
          maxStepRad: 0.06,
        },
        ranges as [number, number][]
      );
      if (primarySolution) {
        return primarySolution;
      }

      const altSeeds = buildPositionOnlyAltSeeds(seedJoints, targetPosition);
      for (const altSeed of altSeeds) {
        console.log('[useRobot] goToPosition try position-only alt seed', {
          seed: altSeed,
          targetPositionMm: targetPosition,
        });
        const altSolution = solvePositionOnlyIK(
          targetPosition,
          altSeed,
          model,
          {
            maxIterations: 140,
            posTolerance: 0.8,
            damping: 0.15,
            maxStepRad: 0.06,
          },
          ranges as [number, number][]
        );
        if (altSolution) {
          return altSolution;
        }
      }

      return null;
    },
    [model, ranges]
  );

  const solveDirectOrientationAtCurrentPosition = useCallback(
    (targetPose: Pose, seedJoints: JointAngles): JointAngles | null =>
      solveIK(
        targetPose,
        seedJoints,
        model,
        {
          maxIterations: 120,
          posTolerance: 0.8,
          oriTolerance: 0.01,
          damping: 0.15,
          maxStepRad: 0.06,
          orientationScale: 300,
        },
        ranges as [number, number][]
      ),
    [model, ranges]
  );

  const planPositionOnlyWaypoints = useCallback(
    (
      startPosition: [number, number, number],
      targetPosition: [number, number, number],
      seedJoints: JointAngles,
      depth = 0,
      maxDepth = 5
    ): GoToPositionPlanResult | null => {
      const directSolution = solveDirectPositionOnly(targetPosition, seedJoints);
      if (directSolution) {
        return {
          waypointJoints: [directSolution],
          depthUsed: depth,
        };
      }

      if (depth >= maxDepth) {
        if (depth === maxDepth) {
          console.warn('[useRobot] planPositionOnlyWaypoints hit max depth', {
            startPositionMm: startPosition,
            targetPositionMm: targetPosition,
            seedJointsDeg: seedJoints,
            maxDepth,
          });
        }
        return null;
      }

      const midpointPosition: [number, number, number] = [
        lerpScalar(startPosition[0], targetPosition[0], 0.5),
        lerpScalar(startPosition[1], targetPosition[1], 0.5),
        lerpScalar(startPosition[2], targetPosition[2], 0.5),
      ];

      const firstHalf = planPositionOnlyWaypoints(
        startPosition,
        midpointPosition,
        seedJoints,
        depth + 1,
        maxDepth
      );
      if (!firstHalf) return null;

      const midJoints = firstHalf.waypointJoints[firstHalf.waypointJoints.length - 1];
      const midPoseReached = model.forwardKinematics(midJoints);
      if (!midPoseReached) return null;

      const secondHalf = planPositionOnlyWaypoints(
        midPoseReached.position,
        targetPosition,
        midJoints,
        depth + 1,
        maxDepth
      );
      if (!secondHalf) return null;

      return {
        waypointJoints: [...firstHalf.waypointJoints, ...secondHalf.waypointJoints],
        depthUsed: Math.max(firstHalf.depthUsed, secondHalf.depthUsed),
      };
    },
    [model, solveDirectPositionOnly]
  );

  const planElevatedTransitPositionWaypoints = useCallback(
    (
      startPose: Pose,
      targetPosition: [number, number, number],
      seedJoints: JointAngles,
      maxDepth = 6
    ): GoToPositionPlanResult | null => {
      const transitHeight = Math.max(startPose.position[1], targetPosition[1]) + POSITION_TRANSIT_LIFT_MM;
      const transitPoints: [number, number, number][] = [
        [startPose.position[0], transitHeight, startPose.position[2]],
        [targetPosition[0], transitHeight, targetPosition[2]],
        targetPosition,
      ];

      let currentSeed = seedJoints;
      let currentPosition = startPose.position;
      const allWaypoints: JointAngles[] = [];
      let maxDepthUsed = 0;

      console.warn('[useRobot] planElevatedTransitPositionWaypoints start', {
        startPositionMm: startPose.position,
        targetPositionMm: targetPosition,
        transitHeightMm: transitHeight,
        seedJointsDeg: seedJoints,
      });

      for (const transitPoint of transitPoints) {
        const segmentPlan = planPositionOnlyWaypoints(
          currentPosition,
          transitPoint,
          currentSeed,
          0,
          maxDepth
        );
        if (!segmentPlan) {
          console.error('[useRobot] planElevatedTransitPositionWaypoints segment failed', {
            fromPositionMm: currentPosition,
            toPositionMm: transitPoint,
            seedJointsDeg: currentSeed,
            maxDepth,
          });
          return null;
        }

        allWaypoints.push(...segmentPlan.waypointJoints);
        maxDepthUsed = Math.max(maxDepthUsed, segmentPlan.depthUsed);

        const reachedJoints = segmentPlan.waypointJoints[segmentPlan.waypointJoints.length - 1];
        const reachedPose = model.forwardKinematics(reachedJoints);
        if (!reachedPose) {
          console.error('[useRobot] planElevatedTransitPositionWaypoints forwardKinematics failed', {
            reachedJointsDeg: reachedJoints,
          });
          return null;
        }

        currentSeed = reachedJoints;
        currentPosition = reachedPose.position;
      }

      console.log('[useRobot] planElevatedTransitPositionWaypoints success', {
        waypointCount: allWaypoints.length,
        depthUsed: maxDepthUsed,
      });

      return {
        waypointJoints: allWaypoints,
        depthUsed: maxDepthUsed,
      };
    },
    [model, planPositionOnlyWaypoints]
  );

  const planOrientationWaypoints = useCallback(
    (
      startPose: Pose,
      targetPose: Pose,
      seedJoints: JointAngles,
      depth = 0,
      maxDepth = 3
    ): GoToPositionPlanResult | null => {
      const directSolution = solveDirectOrientationAtCurrentPosition(targetPose, seedJoints);
      if (directSolution) {
        return {
          waypointJoints: [directSolution],
          depthUsed: depth,
        };
      }

      if (depth >= maxDepth) {
        if (depth === maxDepth) {
          console.warn('[useRobot] planOrientationWaypoints hit max depth', {
            currentPositionMm: startPose.position,
            currentEulerRad: startPose.euler,
            targetPositionMm: targetPose.position,
            targetEulerRad: targetPose.euler,
            seedJointsDeg: seedJoints,
            maxDepth,
          });
        }
        return null;
      }

      const midpointEuler = lerpEulerShortest(startPose.euler, targetPose.euler, 0.5);
      const midpointPose: Pose = {
        position: targetPose.position,
        euler: midpointEuler,
        rotation: buildRotationFromEuler(midpointEuler),
      };

      const firstHalf = planOrientationWaypoints(
        startPose,
        midpointPose,
        seedJoints,
        depth + 1,
        maxDepth
      );
      if (!firstHalf) return null;

      const midJoints = firstHalf.waypointJoints[firstHalf.waypointJoints.length - 1];
      const midPoseReached = model.forwardKinematics(midJoints);
      if (!midPoseReached) return null;

      const secondHalf = planOrientationWaypoints(
        midPoseReached,
        targetPose,
        midJoints,
        depth + 1,
        maxDepth
      );
      if (!secondHalf) return null;

      return {
        waypointJoints: [...firstHalf.waypointJoints, ...secondHalf.waypointJoints],
        depthUsed: Math.max(firstHalf.depthUsed, secondHalf.depthUsed),
      };
    },
    [model, solveDirectOrientationAtCurrentPosition]
  );

  const planGoToPositionWaypoints = useCallback(
    (
      startPose: Pose,
      targetPose: Pose,
      seedJoints: JointAngles,
      hasExplicitOrientation: boolean,
      depth = 0,
      maxDepth = 5
    ): GoToPositionPlanResult | null => {
      const directSolution = solveDirectGoToPosition(targetPose, seedJoints, hasExplicitOrientation);
      if (directSolution) {
        return {
          waypointJoints: [directSolution],
          depthUsed: depth,
        };
      }

      if (!hasExplicitOrientation) {
        console.warn('[useRobot] planGoToPositionWaypoints direct position-only solve failed, fallback to split', {
          startPositionMm: startPose.position,
          targetPositionMm: targetPose.position,
          seedJointsDeg: seedJoints,
          depth,
          maxDepth,
        });
        const splitPlan = planPositionOnlyWaypoints(
          startPose.position,
          targetPose.position,
          seedJoints,
          depth,
          maxDepth
        );
        if (splitPlan) {
          return splitPlan;
        }

        console.warn('[useRobot] planGoToPositionWaypoints split position-only failed, try elevated transit', {
          startPositionMm: startPose.position,
          targetPositionMm: targetPose.position,
          seedJointsDeg: seedJoints,
        });
        return planElevatedTransitPositionWaypoints(
          startPose,
          targetPose.position,
          seedJoints,
          Math.max(maxDepth, 6)
        );
      }

      console.warn('[useRobot] planGoToPositionWaypoints direct full-pose solve failed, fallback to position-first plan', {
        startPositionMm: startPose.position,
        startEulerRad: startPose.euler,
        targetPositionMm: targetPose.position,
        targetEulerRad: targetPose.euler,
        seedJointsDeg: seedJoints,
        depth,
        maxDepth,
      });

      const positionPlan = planPositionOnlyWaypoints(
        startPose.position,
        targetPose.position,
        seedJoints,
        depth,
        maxDepth
      ) ?? planElevatedTransitPositionWaypoints(
        startPose,
        targetPose.position,
        seedJoints,
        Math.max(maxDepth, 6)
      );
      if (!positionPlan) {
        console.error('[useRobot] planGoToPositionWaypoints position phase failed', {
          startPositionMm: startPose.position,
          targetPositionMm: targetPose.position,
          seedJointsDeg: seedJoints,
        });
        return null;
      }

      const poseAtTargetPositionJoints =
        positionPlan.waypointJoints[positionPlan.waypointJoints.length - 1];
      const poseAtTargetPosition = model.forwardKinematics(poseAtTargetPositionJoints);
      if (!poseAtTargetPosition) {
        console.error('[useRobot] planGoToPositionWaypoints forwardKinematics failed at target-position waypoint', {
          poseAtTargetPositionJointsDeg: poseAtTargetPositionJoints,
        });
        return null;
      }

      console.log('[useRobot] planGoToPositionWaypoints position phase success', {
        waypointCount: positionPlan.waypointJoints.length,
        depthUsed: positionPlan.depthUsed,
        reachedPositionMm: poseAtTargetPosition.position,
        reachedEulerRad: poseAtTargetPosition.euler,
      });

      const orientationPlan = planOrientationWaypoints(
        poseAtTargetPosition,
        targetPose,
        poseAtTargetPositionJoints,
        0,
        Math.max(2, Math.min(3, maxDepth))
      );
      if (!orientationPlan) {
        console.error('[useRobot] planGoToPositionWaypoints orientation phase failed', {
          reachedPositionMm: poseAtTargetPosition.position,
          reachedEulerRad: poseAtTargetPosition.euler,
          targetPositionMm: targetPose.position,
          targetEulerRad: targetPose.euler,
          poseAtTargetPositionJointsDeg: poseAtTargetPositionJoints,
        });
        return null;
      }

      console.log('[useRobot] planGoToPositionWaypoints orientation phase success', {
        waypointCount: orientationPlan.waypointJoints.length,
        depthUsed: orientationPlan.depthUsed,
      });

      return {
        waypointJoints: [
          ...positionPlan.waypointJoints,
          ...orientationPlan.waypointJoints,
        ],
        depthUsed: Math.max(positionPlan.depthUsed, orientationPlan.depthUsed),
      };
    },
    [
      model,
      planElevatedTransitPositionWaypoints,
      planOrientationWaypoints,
      planPositionOnlyWaypoints,
      solveDirectGoToPosition,
    ]
  );

  // ===== 绝对定位（GLB 视觉 IK，输入为场景坐标米）=====
  const goToPosition = useCallback(
    (x: number, y: number, z: number, rx?: number, ry?: number, rz?: number): boolean => {
      const targetPos: [number, number, number] = [x * 1000, y * 1000, z * 1000];
      const hasExplicitOrientation = rx !== undefined && ry !== undefined && rz !== undefined;
      const reachable = isReachable(targetPos, model);

      console.log('[useRobot] goToPosition start', {
        targetPosMm: targetPos,
        targetPosM: { x, y, z },
        explicitOrientationDeg: hasExplicitOrientation ? { rx, ry, rz } : null,
        reachable,
        currentJointsDeg: displayJointsRef.current,
      });

      if (!reachable) {
        console.warn('[useRobot] goToPosition isReachable() precheck failed, continue with real IK solve', {
          targetPosMm: targetPos,
        });
      }

      const currentJoints = displayJointsRef.current;
      const currentPose = model.forwardKinematics(currentJoints);
      if (!currentPose) {
        console.warn('[useRobot] goToPosition currentPose unavailable', {
          currentJointsDeg: currentJoints,
        });
        setStatus('unreachable');
        setTimeout(() => setStatus('ready'), 1500);
        return false;
      }

      // 若提供了姿态，则使用目标姿态；否则保持当前姿态
      const targetEuler: [number, number, number] =
        rx !== undefined && ry !== undefined && rz !== undefined
          ? [degToRad(rx), degToRad(ry), degToRad(rz)]
          : currentPose.euler;
      const targetRot =
        rx !== undefined && ry !== undefined && rz !== undefined
          ? buildRotationFromEuler(targetEuler)
          : currentPose.rotation;

      const targetPose: Pose = {
        position: targetPos,
        euler: targetEuler,
        rotation: targetRot,
      };

      console.log('[useRobot] goToPosition pose snapshot', {
        currentPoseMm: currentPose.position,
        currentPoseEulerRad: currentPose.euler,
        targetPoseMm: targetPose.position,
        targetPoseEulerRad: targetPose.euler,
        hasExplicitOrientation,
      });

      const directSolution = solveDirectGoToPosition(targetPose, currentJoints, hasExplicitOrientation);
      let waypointPlan: GoToPositionPlanResult | null = null;

      if (directSolution) {
        console.log('[useRobot] goToPosition direct solve success', {
          solutionJointsDeg: directSolution,
        });
        waypointPlan = {
          waypointJoints: [directSolution],
          depthUsed: 0,
        };
      } else {
        console.warn('[useRobot] goToPosition direct solve failed, start staged planning', {
          targetPosMm: targetPos,
          targetEulerRad: targetPose.euler,
          currentJointsDeg: currentJoints,
        });
        waypointPlan = planGoToPositionWaypoints(
          currentPose,
          targetPose,
          currentJoints,
          hasExplicitOrientation,
        );
      }

      if (!waypointPlan) {
        console.error('[useRobot] goToPosition path planning failed', {
          targetPosMm: targetPos,
          hasExplicitOrientation,
          currentJointsDeg: currentJoints,
        });
        setStatus('unreachable');
        setTimeout(() => setStatus('ready'), 1500);
        return false;
      }

      const [firstWaypoint, ...remainingWaypoints] = waypointPlan.waypointJoints;
      goToPositionQueueRef.current = remainingWaypoints.map((waypoint) => [...waypoint] as JointAngles);

      console.log('[useRobot] goToPosition start planned animation', {
        mode: hasExplicitOrientation ? 'pose' : 'position-only',
        directSolved: directSolution !== null,
        waypointCount: waypointPlan.waypointJoints.length,
        splitDepthUsed: waypointPlan.depthUsed,
        firstWaypointDeg: firstWaypoint,
      });
      startCoordinatedAnimation(firstWaypoint);
      return true;
    },
    [model, planGoToPositionWaypoints, solveDirectGoToPosition, startCoordinatedAnimation]
  );

  const stopRobotAnimation = useCallback(() => {
    goToPositionQueueRef.current = [];
    stopAnimation();
  }, [stopAnimation]);

  return {
    joints: displayJoints,
    endEffectorPose,
    originJoints,
    trajectory,
    addTrajectoryPoint,
    adjustJoint,
    setJoint,
    moveDirection,
    saveOrigin,
    goToOrigin,
    goToZero,
    resetJoints,
    randomJoints,
    goToJoints,
    goToPosition,
    isMotionQueueIdle,
    glbPosition,
    stopAnimation: stopRobotAnimation,
    coordinateSystem,
    setCoordinateSystem,
    jointStep,
    setJointStep,
    posStep,
    setPosStep,
    rotStep,
    setRotStep,
    selectedTool,
    setSelectedTool,
    toolList,
    setToolList,
    status,
    setStatus,
    isAnimating,
    isAnimatingRef,
    gizmoIKRef,
    config,
  };
}
