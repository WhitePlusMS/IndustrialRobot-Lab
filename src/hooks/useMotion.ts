// src/hooks/useMotion.ts
// 机器人运动动画循环管理：关节空间缓动、速度限制、笛卡尔空间插补

import { useCallback, useEffect, useRef, useState } from 'react';
import type { JointAngles, Pose, RobotConfig, StatusType } from '@/types/robot';
import type { RobotModel } from '@/lib/robot-model';
import { DEFAULT_MOTION_CONFIG, lerpJoints, updateJointAngles } from '@/lib/motion-smoothing';
import { solveCartesianPositionStep, solveCartesianStep } from '@/lib/motion-planner';

interface CartesianAnimationOptions {
  /** 动画时长（毫秒） */
  duration?: number;
  /** 是否只控制位置（姿态保持当前） */
  positionOnly?: boolean;
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

/**
 * 管理机器人 RAF 动画循环
 *
 * 提供三种动画：
 * - 关节空间缓动：单击 +/- 按钮，400ms easeInOutCubic 到位
 * - 关节空间速度限制：长按连续触发，按最大关节速度平滑追目标
 * - 笛卡尔空间动画：位姿控制，逐帧求解 IK 并更新关节
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

  // 关节动画共享的 refs
  const targetJointsRef = useRef<JointAngles>([0, 0, 0, 0, 0, 0]);
  const startJointsRef = useRef<JointAngles>([0, 0, 0, 0, 0, 0]);
  const startTimeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const animDurationRef = useRef<number>(motionConfig.ikAnimDuration);

  // 笛卡尔动画专用 refs
  const cartesianStartPoseRef = useRef<Pose | null>(null);
  const cartesianTargetPoseRef = useRef<Pose | null>(null);
  const cartesianPositionOnlyRef = useRef(false);

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
    setStatus('complete');
    statusTimerRef.current = setTimeout(() => setStatus('ready'), 500);
  }, [setStatus]);

  const markUnreachable = useCallback(() => {
    animIdRef.current = 0;
    isAnimatingRef.current = false;
    setIsAnimating(false);
    setStatus('unreachable');
    statusTimerRef.current = setTimeout(() => setStatus('ready'), 1500);
  }, [setStatus]);

  /** 停止任何正在运行的动画 */
  const stopAnimation = useCallback(() => {
    cancelAnimationFrame(animIdRef.current);
    animIdRef.current = 0;
    isAnimatingRef.current = false;
    setIsAnimating(false);
    cartesianStartPoseRef.current = null;
    cartesianTargetPoseRef.current = null;
    cartesianPositionOnlyRef.current = false;
    clearStatusTimer();
  }, [clearStatusTimer]);

  /** 关节空间缓动动画循环 */
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

  /** 关节空间速度限制动画循环 */
  const runSpeedLimitedAnimation = useCallback(() => {
    const now = performance.now();
    const deltaTime = lastTimeRef.current ? now - lastTimeRef.current : 16;
    lastTimeRef.current = now;

    const current = getCurrentJoints();
    const next = updateJointAngles(
      [...current],
      targetJointsRef.current,
      deltaTime,
      cfgRef.current.jointSpeedLimit
    );
    setJoints(clampJoints(next as JointAngles, config));

    const cfg = cfgRef.current;
    const allClose = next.every(
      (value, i) => Math.abs(value - targetJointsRef.current[i]) < cfg.snapThreshold
    );
    if (!allClose) {
      animIdRef.current = requestAnimationFrame(runSpeedLimitedAnimation);
    } else {
      finishAnimation();
    }
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

    if (cartesianPositionOnlyRef.current) {
      nextJoints = solveCartesianPositionStep(targetPose.position, currentJoints, model, {
        damping: 0.5,
        maxStepDeg: 2,
        toleranceMm: 1,
        jointRanges,
      });
    } else {
      const result = solveCartesianStep(targetPose, currentJoints, model, {
        damping: 0.5,
        maxStepDeg: 2,
        orientationScale: 300,
        positionClampMm: 10,
        orientationClampRad: 0.1,
        toleranceMm: 1,
        oriToleranceRad: 0.03,
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

  /** 启动关节空间缓动动画 */
  const startEasedAnimation = useCallback(
    (target: JointAngles, duration = cfgRef.current.ikAnimDuration) => {
      cancelAnimationFrame(animIdRef.current);
      clearStatusTimer();
      targetJointsRef.current = [...target] as JointAngles;
      startJointsRef.current = [...getCurrentJoints()] as JointAngles;
      startTimeRef.current = performance.now();
      animDurationRef.current = duration;
      // 关闭笛卡尔动画上下文
      cartesianStartPoseRef.current = null;
      cartesianTargetPoseRef.current = null;
      cartesianPositionOnlyRef.current = false;
      isAnimatingRef.current = true;
      setIsAnimating(true);
      setStatus('moving');
      animIdRef.current = requestAnimationFrame(runEasedAnimation);
    },
    [getCurrentJoints, setStatus, runEasedAnimation, clearStatusTimer]
  );

  /** 启动关节空间速度限制动画（长按连续触发） */
  const startSpeedLimitedAnimation = useCallback(
    (target: JointAngles) => {
      cancelAnimationFrame(animIdRef.current);
      clearStatusTimer();
      targetJointsRef.current = [...target] as JointAngles;
      lastTimeRef.current = 0;
      // 关闭笛卡尔动画上下文
      cartesianStartPoseRef.current = null;
      cartesianTargetPoseRef.current = null;
      cartesianPositionOnlyRef.current = false;
      isAnimatingRef.current = true;
      setIsAnimating(true);
      setStatus('moving');
      animIdRef.current = requestAnimationFrame(runSpeedLimitedAnimation);
    },
    [setStatus, runSpeedLimitedAnimation, clearStatusTimer]
  );

  /** 启动笛卡尔空间动画 */
  const startCartesianAnimation = useCallback(
    (targetPose: Pose, options: CartesianAnimationOptions = {}) => {
      const duration = options.duration ?? cfgRef.current.ikAnimDuration;
      cancelAnimationFrame(animIdRef.current);
      clearStatusTimer();

      const currentJoints = getCurrentJoints();
      const startPose = model.forwardKinematics(currentJoints);
      if (!startPose) {
        markUnreachable();
        return;
      }

      cartesianStartPoseRef.current = startPose;
      cartesianTargetPoseRef.current = targetPose;
      cartesianPositionOnlyRef.current = options.positionOnly ?? false;
      startTimeRef.current = performance.now();
      animDurationRef.current = duration;
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
    startSpeedLimitedAnimation,
    startCartesianAnimation,
  };
}
