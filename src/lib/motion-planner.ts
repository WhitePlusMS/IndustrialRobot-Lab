// src/lib/motion-planner.ts
// 笛卡尔空间运动规划：目标生成、姿态锁定、相位管理

import type { Pose, JointAngles } from '@/types/robot';
import { stepVectorTowardTarget, clampVectorMagnitude } from './math/vector';
import {
  buildRotationFromEuler,
  rotationMatrixToEulerZYX,
  applyRotationIncrement,
  orientationError,
} from './math/rotation3d';
import type { RobotModel } from './robot-model';
import { solveIK, solvePositionOnlyIK } from './ik-solver';

export interface CartesianStepConfig {
  posMm: number;
  maxStepDeg: number;
  toleranceMm?: number;
  oriRad?: number;
  orientationScale?: number;
  positionClampMm?: number;
  orientationClampRad?: number;
}

export interface CartesianPlannerState {
  phase: 'idle' | 'position' | 'orientation';
  lastReason: string | null;
  remainingPosMm: number | null;
  remainingOriRad: number | null;
}

export function createIdlePlannerState(): CartesianPlannerState {
  return {
    phase: 'idle',
    lastReason: null,
    remainingPosMm: null,
    remainingOriRad: null,
  };
}

/** 在 current 与 target 之间按 maxStepMm 步进生成中间位置目标 */
export function stepPositionToward(
  current: [number, number, number],
  target: [number, number, number],
  maxStepMm: number
): [number, number, number] {
  return stepVectorTowardTarget(current, target, maxStepMm);
}

/** 在当前姿态上叠加一个局部旋转增量 */
export function applyOrientationIncrement(
  currentEuler: [number, number, number],
  axis: 'rx' | 'ry' | 'rz',
  deltaDeg: number,
  coordinateSystem: 'World' | 'Tool'
): [number, number, number] {
  const currentRotation = buildRotationFromEuler(currentEuler);
  const nextRotation = applyRotationIncrement(
    currentRotation,
    axis,
    (deltaDeg * Math.PI) / 180,
    coordinateSystem
  );
  return rotationMatrixToEulerZYX(nextRotation);
}

/** 求解单步笛卡尔目标（位置 + 姿态） */
export function solveCartesianStep(
  targetPose: Pose,
  currentJoints: JointAngles,
  model: RobotModel,
  config: {
    damping: number;
    maxStepDeg: number;
    orientationScale: number;
    positionClampMm: number;
    orientationClampRad: number;
    toleranceMm: number;
    oriToleranceRad: number;
    jointRanges?: [number, number][];
  }
): { joints: JointAngles; remainingPosMm: number; remainingOriRad: number } | null {
  const currentPose = model.forwardKinematics(currentJoints);
  if (!currentPose) return null;

  const errorPos = [
    targetPose.position[0] - currentPose.position[0],
    targetPose.position[1] - currentPose.position[1],
    targetPose.position[2] - currentPose.position[2],
  ];
  const remainingPosMm = Math.hypot(...errorPos);

  const rawOriError = targetPose.rotation
    ? orientationError(targetPose.rotation, currentPose.rotation)
    : [0, 0, 0];
  const remainingOriRad = Math.hypot(...rawOriError);

  if (remainingPosMm <= config.toleranceMm && remainingOriRad <= config.oriToleranceRad) {
    return {
      joints: [...currentJoints] as JointAngles,
      remainingPosMm,
      remainingOriRad,
    };
  }

  const clampedPos = clampVectorMagnitude(errorPos, config.positionClampMm);
  // clampedOri 保留给后续姿态恢复策略使用，当前简化实现暂未消费
  clampVectorMagnitude(rawOriError, config.orientationClampRad);

  // 构造一个中间目标：位置按 clamp 走，姿态保持最终目标
  const steppedPose: Pose = {
    position: [
      currentPose.position[0] + clampedPos[0],
      currentPose.position[1] + clampedPos[1],
      currentPose.position[2] + clampedPos[2],
    ] as [number, number, number],
    euler: targetPose.euler,
    rotation: targetPose.rotation,
  };

  const solved = solveIK(
    steppedPose,
    currentJoints,
    model,
    {
      maxIterations: 20,
      posTolerance: config.toleranceMm,
      oriTolerance: config.oriToleranceRad,
      damping: config.damping,
      maxStepRad: (config.maxStepDeg * Math.PI) / 180,
      orientationScale: config.orientationScale,
    },
    config.jointRanges
  );

  if (!solved) return null;

  return {
    joints: solved,
    remainingPosMm,
    remainingOriRad,
  };
}

/** 求解单步位置-only 目标 */
export function solveCartesianPositionStep(
  targetPosition: [number, number, number],
  currentJoints: JointAngles,
  model: RobotModel,
  config: {
    damping: number;
    maxStepDeg: number;
    toleranceMm: number;
    jointRanges?: [number, number][];
  }
): JointAngles | null {
  const currentPose = model.forwardKinematics(currentJoints);
  if (!currentPose) return null;

  const errorPos = [
    targetPosition[0] - currentPose.position[0],
    targetPosition[1] - currentPose.position[1],
    targetPosition[2] - currentPose.position[2],
  ];
  const remainingPosMm = Math.hypot(...errorPos);
  if (remainingPosMm <= config.toleranceMm) return currentJoints;

  const steppedTarget = stepVectorTowardTarget(currentPose.position, targetPosition, remainingPosMm * 0.5);

  return solvePositionOnlyIK(
    steppedTarget,
    currentJoints,
    model,
    {
      maxIterations: 20,
      posTolerance: config.toleranceMm,
      damping: config.damping,
      maxStepRad: (config.maxStepDeg * Math.PI) / 180,
    },
    config.jointRanges
  );
}

