// src/hooks/useMotion.ts
// 机器人运动动画循环管理：关节空间缓动、速度限制、笛卡尔空间插补

import { useCallback, useEffect, useRef, useState } from 'react';
import type { JointAngles, Pose, RobotConfig, StatusType } from '@/types/robot';
import type { RobotModel } from '@/lib/robot-model';
import { DEFAULT_MOTION_CONFIG, lerpJoints } from '@/lib/motion-smoothing';
import { solveCartesianPositionStep, solveCartesianStep } from '@/lib/motion-planner';
import {
  CARTESIAN_POSITION_ONLY_IK_PRESET,
  CARTESIAN_STEP_IK_PRESET,
} from '@/lib/ik-config';

type CartesianOrientationMode =
  | 'position_only'
  | 'hold_current_orientation'
  | 'full_pose';

interface CartesianAnimationOptions {
  /** 动画时长（毫秒） */
  duration?: number;
  /** 笛卡尔动画的姿态约束策略 */
  orientationMode?: CartesianOrientationMode;
}

interface UseMotionOptions {
  /** 机器人运动学模型（GLB 采样） */
  model: RobotModel;
  /** 机器人配置（用于关节限位） */
  config: RobotConfig;
  /** 获取当前关节角（必须使用 ref，避免闭包滞后） */
  getCurrentJoints: () => JointAngles;
  /** 设置关节角并同步内部状态 */
  setJoints: (joints: JointAngles) => void;
  /** 设置机器人状态 */
  setStatus: (status: StatusType) => void;
  /** 运动参数，默认 DEFAULT_MOTION_CONFIG */
  motionConfig?: typeof DEFAULT_MOTION_CONFIG;
}

interface UseMotionReturn {
  isAnimating: boolean;
  isAnimatingRef: React.MutableRefObject<boolean>;
  stopAnimation: () => void;
  startEasedAnimation: (target: JointAngles, duration?: number) => void;
  startCoordinatedAnimation: (target: JointAngles) => void;
  startSpeedLimitedAnimation: (target: JointAngles) => void;
  startCartesianAnimation: (targetPose: Pose, options?: CartesianAnimationOptions) => void;
}

/** 把关节角限制到各轴行程范围内 */
function clampJoints(joints: JointAngles, config: RobotConfig): JointAngles {
  const ranges = Object.values(config.dhParams).map((p) => p.thetaRange);
  return joints.map((value, i) => {
    const [min, max] = ranges[i];
    return Math.max(min, Math.min(max, value));
  }) as JointAngles;
}

/** 活跃的动画类型，用于判断连续调用时是否只需更新目标 */
type AnimType = 'none' | 'joint-eased' | 'joint-speed' | 'joint-coordinated' | 'cartesian';

/**
 * 管理机器人 RAF 动画循环
 *
 * 提供四种动画：
 * - 关节空间缓动（eased）：单击，400ms easeInOutCubic 到位
 * - 关节空间协调匀速（coordinated）：长按/快速连点，所有关节按同一比例匀速移动，路径不走样
 * - 关节空间速度限制（speed-limited）：单关节拖动，各关节独立速度限制
 * - 笛卡尔空间动画（cartesian）：位姿方向键，逐帧求解 IK 并更新关节
 *
 * 连续调用同一类型动画时仅更新目标 ref，避免 cancel+restart 导致帧间隙卡顿。
 */
export function useMotion({
  model,
  config,
  getCurrentJoints,
  setJoints,
  setStatus,
  motionConfig = DEFAULT_MOTION_CONFIG,
}: UseMotionOptions): UseMotionReturn {
  const cfgRef = useRef(motionConfig);
  useEffect(() => {
    cfgRef.current = motionConfig;
  }, [motionConfig]);

  const animIdRef = useRef<number>(0);
  const isAnimatingRef = useRef(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const activeAnimTypeRef = useRef<AnimType>('none');

  // 关节动画共享的 refs
  const targetJointsRef = useRef<JointAngles>([0, 0, 0, 0, 0, 0]);
  const startJointsRef = useRef<JointAngles>([0, 0, 0, 0, 0, 0]);
  const startTimeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const animDurationRef = useRef<number>(motionConfig.ikAnimDuration);

  // 笛卡尔动画专用 refs
  const cartesianStartPoseRef = useRef<Pose | null>(null);
  const cartesianTargetPoseRef = useRef<Pose | null>(null);
  const cartesianOrientationModeRef = useRef<CartesianOrientationMode>('full_pose');

  // 状态恢复定时器，避免旧定时器覆盖新状态
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStatusTimer = useCallback(() => {
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
  }, []);

  const finishAnimation = useCallback(() => {
    animIdRef.current = 0;
    isAnimatingRef.current = false;
    setIsAnimating(false);
    activeAnimTypeRef.current = 'none';
    setStatus('complete');
    statusTimerRef.current = setTimeout(() => setStatus('ready'), 500);
  }, [setStatus]);

  const markUnreachable = useCallback(() => {
    animIdRef.current = 0;
    isAnimatingRef.current = false;
    setIsAnimating(false);
    activeAnimTypeRef.current = 'none';
    setStatus('unreachable');
    statusTimerRef.current = setTimeout(() => setStatus('ready'), 1500);
  }, [setStatus]);

  /** 停止任何正在运行的动画 */
  const stopAnimation = useCallback(() => {
    cancelAnimationFrame(animIdRef.current);
    animIdRef.current = 0;
    isAnimatingRef.current = false;
    setIsAnimating(false);
    activeAnimTypeRef.current = 'none';
    cartesianStartPoseRef.current = null;
    cartesianTargetPoseRef.current = null;
    cartesianOrientationModeRef.current = 'full_pose';
    clearStatusTimer();
  }, [clearStatusTimer]);

  /** 关节空间缓动动画循环（单击用，easeInOutCubic） */
  const runEasedAnimation = useCallback(() => {
    const now = performance.now();
    const elapsed = now - startTimeRef.current;
    const duration = animDurationRef.current;
    const t = Math.min(elapsed / duration, 1);

    const next = lerpJoints(startJointsRef.current, targetJointsRef.current, t);
    setJoints(clampJoints(next as JointAngles, config));

    if (t < 1) {
      animIdRef.current = requestAnimationFrame(runEasedAnimation);
    } else {
      finishAnimation();
    }
  }, [config, setJoints, finishAnimation]);

  /** 关节空间速度限制动画循环（单关节拖动用，各关节独立限速） */
  const runSpeedLimitedAnimation = useCallback(() => {
    const now = performance.now();
    const deltaTime = lastTimeRef.current ? now - lastTimeRef.current : 16;
    lastTimeRef.current = now;

    const current = getCurrentJoints();
    // 各关节独立限速：适合单关节拖动，不适合多关节协调运动
    const maxStep = (cfgRef.current.jointSpeedLimit * deltaTime) / 1000;
    const next = current.map((c, i) => {
      const diff = targetJointsRef.current[i] - c;
      if (Math.abs(diff) < cfgRef.current.snapThreshold) return targetJointsRef.current[i];
      return c + Math.sign(diff) * Math.min(Math.abs(diff), maxStep);
    }) as JointAngles;

    setJoints(clampJoints(next, config));

    const allClose = next.every(
      (v, i) => Math.abs(v - targetJointsRef.current[i]) < cfgRef.current.snapThreshold
    );
    if (!allClose) {
      animIdRef.current = requestAnimationFrame(runSpeedLimitedAnimation);
    } else {
      finishAnimation();
    }
  }, [config, getCurrentJoints, setJoints, finishAnimation]);

  /** 关节空间协调匀速动画循环（长按/快速连点用，所有关节等比例缩放，路径不走样） */
  const runCoordinatedSpeedAnimation = useCallback(() => {
    const now = performance.now();
    const deltaTime = lastTimeRef.current ? now - lastTimeRef.current : 16;
    lastTimeRef.current = now;

    const current = getCurrentJoints();
    const target = targetJointsRef.current;

    // 所有关节按同一比例移动，保留 IK 求解出的姿态协调关系
    const deltas = target.map((t, i) => t - current[i]);
    const maxAbsDelta = Math.max(...deltas.map(Math.abs));

    if (maxAbsDelta < cfgRef.current.snapThreshold) {
      finishAnimation();
      return;
    }

    const maxStep = (cfgRef.current.jointSpeedLimit * deltaTime) / 1000;
    const scale = Math.min(1, maxStep / maxAbsDelta);
    const next = deltas.map((d, i) => current[i] + d * scale) as JointAngles;

    setJoints(clampJoints(next, config));
    animIdRef.current = requestAnimationFrame(runCoordinatedSpeedAnimation);
  }, [config, getCurrentJoints, setJoints, finishAnimation]);

  /** 笛卡尔空间动画循环 */
  const runCartesianAnimation = useCallback(() => {
    const startPose = cartesianStartPoseRef.current;
    const targetPose = cartesianTargetPoseRef.current;
    if (!startPose || !targetPose) {
      stopAnimation();
      return;
    }

    const now = performance.now();
    const elapsed = now - startTimeRef.current;
    const duration = animDurationRef.current;
    const t = Math.min(elapsed / duration, 1);

    const currentJoints = getCurrentJoints();
    let nextJoints: JointAngles | null = null;

    const jointRanges = Object.values(config.dhParams).map((p) => p.thetaRange) as [number, number][];

    if (cartesianOrientationModeRef.current === 'position_only') {
      nextJoints = solveCartesianPositionStep(targetPose.position, currentJoints, model, {
        ...CARTESIAN_POSITION_ONLY_IK_PRESET,
        jointRanges,
      });
    } else {
      const result = solveCartesianStep(targetPose, currentJoints, model, {
        ...CARTESIAN_STEP_IK_PRESET,
        jointRanges,
      });
      nextJoints = result?.joints ?? null;
    }

    if (!nextJoints) {
      markUnreachable();
      return;
    }

    setJoints(clampJoints(nextJoints, config));

    if (t < 1) {
      animIdRef.current = requestAnimationFrame(runCartesianAnimation);
    } else {
      finishAnimation();
    }
  }, [config, getCurrentJoints, setJoints, model, stopAnimation, finishAnimation, markUnreachable]);

  /** 启动关节空间缓动动画 — 同类型重复调用时重置起点为当前值，RAF 不中断 */
  const startEasedAnimation = useCallback(
    (target: JointAngles, duration = cfgRef.current.ikAnimDuration) => {
      targetJointsRef.current = [...target] as JointAngles;

      if (activeAnimTypeRef.current === 'joint-eased') {
        startJointsRef.current = [...getCurrentJoints()] as JointAngles;
        startTimeRef.current = performance.now();
        animDurationRef.current = duration;
        return;
      }

      cancelAnimationFrame(animIdRef.current);
      clearStatusTimer();
      startJointsRef.current = [...getCurrentJoints()] as JointAngles;
      startTimeRef.current = performance.now();
      animDurationRef.current = duration;
      cartesianStartPoseRef.current = null;
      cartesianTargetPoseRef.current = null;
      cartesianOrientationModeRef.current = 'full_pose';
      activeAnimTypeRef.current = 'joint-eased';
      isAnimatingRef.current = true;
      setIsAnimating(true);
      setStatus('moving');
      animIdRef.current = requestAnimationFrame(runEasedAnimation);
    },
    [getCurrentJoints, setStatus, runEasedAnimation, clearStatusTimer]
  );

  /** 启动关节空间速度限制动画 — 同一类型重复调用时只更新目标不重启 */
  const startSpeedLimitedAnimation = useCallback(
    (target: JointAngles) => {
      targetJointsRef.current = [...target] as JointAngles;

      if (activeAnimTypeRef.current === 'joint-speed') {
        return;
      }

      cancelAnimationFrame(animIdRef.current);
      clearStatusTimer();
      lastTimeRef.current = 0;
      cartesianStartPoseRef.current = null;
      cartesianTargetPoseRef.current = null;
      cartesianOrientationModeRef.current = 'full_pose';
      activeAnimTypeRef.current = 'joint-speed';
      isAnimatingRef.current = true;
      setIsAnimating(true);
      setStatus('moving');
      animIdRef.current = requestAnimationFrame(runSpeedLimitedAnimation);
    },
    [setStatus, runSpeedLimitedAnimation, clearStatusTimer]
  );

  /** 启动关节空间协调匀速动画 — 同一类型重复调用时只更新目标不重启 */
  const startCoordinatedAnimation = useCallback(
    (target: JointAngles) => {
      targetJointsRef.current = [...target] as JointAngles;

      if (activeAnimTypeRef.current === 'joint-coordinated') {
        // 同类型已在运行：只更新目标 ref，下一帧自动按新目标匀速移动
        return;
      }

      cancelAnimationFrame(animIdRef.current);
      clearStatusTimer();
      lastTimeRef.current = 0;
      cartesianStartPoseRef.current = null;
      cartesianTargetPoseRef.current = null;
      cartesianOrientationModeRef.current = 'full_pose';
      activeAnimTypeRef.current = 'joint-coordinated';
      isAnimatingRef.current = true;
      setIsAnimating(true);
      setStatus('moving');
      animIdRef.current = requestAnimationFrame(runCoordinatedSpeedAnimation);
    },
    [setStatus, runCoordinatedSpeedAnimation, clearStatusTimer]
  );

  /** 启动笛卡尔空间动画 — 同一类型重复调用时只更新目标不重启 */
  const startCartesianAnimation = useCallback(
    (targetPose: Pose, options: CartesianAnimationOptions = {}) => {
      const duration = options.duration ?? cfgRef.current.ikAnimDuration;

      cartesianTargetPoseRef.current = targetPose;
      cartesianOrientationModeRef.current = options.orientationMode ?? 'full_pose';

      if (activeAnimTypeRef.current === 'cartesian') {
        return;
      }

      cancelAnimationFrame(animIdRef.current);
      clearStatusTimer();

      const currentJoints = getCurrentJoints();
      const startPose = model.forwardKinematics(currentJoints);
      if (!startPose) {
        markUnreachable();
        return;
      }

      cartesianStartPoseRef.current = startPose;
      startTimeRef.current = performance.now();
      animDurationRef.current = duration;
      activeAnimTypeRef.current = 'cartesian';
      isAnimatingRef.current = true;
      setIsAnimating(true);
      setStatus('moving');
      animIdRef.current = requestAnimationFrame(runCartesianAnimation);
    },
    [model, getCurrentJoints, setStatus, runCartesianAnimation, markUnreachable, clearStatusTimer]
  );

  // 卸载时清理动画，防止内存泄漏
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animIdRef.current);
      clearStatusTimer();
    };
  }, [clearStatusTimer]);

  return {
    isAnimating,
    isAnimatingRef,
    stopAnimation,
    startEasedAnimation,
    startCoordinatedAnimation,
    startSpeedLimitedAnimation,
    startCartesianAnimation,
  };
}
