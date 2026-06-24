// src/hooks/useRobot.ts
// 机器人状态与命令式控制 Hook：状态壳负责聚合，命令执行下沉到 useRobotCommandCenter

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CoordinateSystem,
  JointAngles,
  RobotConfig,
} from '@/types/robot';
import { KUKA_LIKE, DEFAULT_JOINTS } from '@/lib/robot-config';
import { useRobotPoseAPI } from './useRobotPoseAPI';
import { SceneKinematicModel } from '@/lib/scene-kinematic-model';
import { GLBRobotModel } from '@/lib/glb-robot-model';
import { robotPoseBridge } from '@/lib/robot-pose-bridge';
import type { CalibrationData } from '@/lib/robot-pose-bridge';
import type { RobotModel } from '@/lib/robot-model';
import { radToDeg } from '@/lib/math/angle';
import { useMotion } from './useMotion';
import { useRobotCommandCenter } from './useRobotCommandCenter';

/** 记忆点类型（供动作序列系统使用） */
export interface Waypoint {
  name: string;
  joints: JointAngles;
}

/** 末端位姿展示结构（位置 mm，欧拉角 °） */
interface EndEffectorPose {
  position: [number, number, number];
  euler: [number, number, number];
  rotation: number[][];
}

/** 把关节角限制到配置行程 */
function clampJointsToRanges(joints: JointAngles, config: RobotConfig): JointAngles {
  const ranges = Object.values(config.dhParams).map((p) => p.thetaRange);
  return joints.map((value, i) => Math.max(ranges[i][0], Math.min(ranges[i][1], value))) as JointAngles;
}

export function useRobot(externalTargetRef?: React.MutableRefObject<JointAngles>) {
  const config = KUKA_LIKE;
  const ranges = useMemo(() => Object.values(config.dhParams).map((p) => p.thetaRange) as [number, number][], [config]);

  const [joints, setJointsState] = useState<JointAngles>(DEFAULT_JOINTS);
  const [displayJoints, setDisplayJointsState] = useState<JointAngles>(DEFAULT_JOINTS);
  const [originJoints, setOriginJoints] = useState<JointAngles | null>(null);
  const [coordinateSystem, setCoordinateSystem] = useState<CoordinateSystem>('World');
  const [jointStep, setJointStep] = useState(1);
  const [posStep, setPosStep] = useState(1);
  const [rotStep, setRotStep] = useState(1);
  const [selectedTool, setSelectedTool] = useState('无');
  const [toolList, setToolList] = useState<string[]>([]);
  const [status, setStatus] = useState<'ready' | 'moving' | 'complete' | 'nearSingularity' | 'jointLimited' | 'unreachable' | 'jointOutOfRange' | 'jointLimitExceeded'>('ready');
  const [trajectory, setTrajectory] = useState<[number, number, number][]>([]);

  const jointsRef = useRef<JointAngles>(DEFAULT_JOINTS);
  const displayJointsRef = useRef<JointAngles>(DEFAULT_JOINTS);

  useEffect(() => {
    jointsRef.current = joints;
    displayJointsRef.current = displayJoints;
  }, [joints, displayJoints]);

  useEffect(() => {
    if (externalTargetRef) {
      externalTargetRef.current = [...displayJoints];
    }
  }, [displayJoints, externalTargetRef]);

  const poseApi = useRobotPoseAPI();

  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(() => robotPoseBridge.getCalibration());
  useEffect(() => {
    const unsub = robotPoseBridge.subscribeCalibration(setCalibrationData);
    return unsub;
  }, []);

  const model = useMemo(() => {
    if (calibrationData) return new SceneKinematicModel(calibrationData);
    return new GLBRobotModel(poseApi);
  }, [calibrationData, poseApi]);

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

  const {
    gizmoIKRef,
    flushNextGoToPositionWaypoint,
    isMotionQueueIdle,
    goToJoints,
    goToPoseMm,
    goToPosition,
    moveDirection,
    stopRobotAnimation,
    currentScenePosition,
  } = useRobotCommandCenter({
    config,
    model,
    ranges,
    getCurrentJoints,
    applyJoints,
    coordinateSystem,
    posStep,
    rotStep,
    setStatus,
    startEasedAnimation,
    startCoordinatedAnimation,
    startCartesianAnimation,
    stopAnimation,
    isAnimatingRef,
  });

  useEffect(() => {
    if (status !== 'complete') return;
    flushNextGoToPositionWaypoint();
  }, [flushNextGoToPositionWaypoint, status]);

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
  }, [joints, model]);

  const glbPosition = useMemo<[number, number, number] | null>(() => currentScenePosition(), [currentScenePosition, joints, model]);

  const addTrajectoryPoint = useCallback((pos: [number, number, number]) => {
    setTrajectory((prev) => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        const dist = Math.sqrt((pos[0] - last[0]) ** 2 + (pos[1] - last[1]) ** 2 + (pos[2] - last[2]) ** 2);
        if (dist < 0.001) return prev;
      }
      const next = [...prev, pos];
      if (next.length > 200) next.shift();
      return next;
    });
  }, []);

  const adjustJoint = useCallback(
    (index: number, delta: number, isContinuous = false) => {
      const current = displayJointsRef.current;
      const nextValue = Math.max(ranges[index][0], Math.min(ranges[index][1], current[index] + delta * jointStep));
      const rounded = Math.round(nextValue * 10) / 10;
      const next = [...current] as JointAngles;
      next[index] = rounded;

      if (isContinuous) {
        startSpeedLimitedAnimation(next);
      } else {
        startEasedAnimation(next);
      }
    },
    [jointStep, ranges, startEasedAnimation, startSpeedLimitedAnimation]
  );

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
    [applyJoints, ranges]
  );

  const saveOrigin = useCallback(() => {
    setOriginJoints([...displayJointsRef.current]);
  }, []);

  const goToOrigin = useCallback(() => {
    if (!originJoints) return;
    startEasedAnimation([...originJoints]);
  }, [originJoints, startEasedAnimation]);

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
    goToPoseMm,
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
    model: model as RobotModel,
  };
}
