import { APPROACH_HEIGHT, BOX_HALF_SIZE, SUCKER_LENGTH } from '@/hooks/useSuckerControl';
import type { TaskPoseConstraintProfile, TaskTargetPoseMm } from '@/types/robot';
import { sceneToRobotMm } from './spatial-coordinates';

export const GRASP_APPROACH_ORIENTATION_DEG = {
  rx: -89.4,
  ry: 0.4,
  // 真空吸盘对绕自身吸附轴的扭转不敏感。
  // 之前固定为 -30° 会把“移动到箱子上方”变成过约束位姿 IK，
  // 日志显示位置已到达，但姿态阶段持续失败，因此这里收敛到更自然的 0°。
  rz: 0.0,
} as const;

export const POSITION_ONLY_TASK_PROFILE: TaskPoseConstraintProfile = {
  name: 'position-only',
  positionToleranceMm: 1.5,
  orientationToleranceRad: Math.PI,
  allowPositionFallback: true,
  orientationMode: 'ignore',
};

export const HOLD_ORIENTATION_TASK_PROFILE: TaskPoseConstraintProfile = {
  name: 'hold-orientation',
  positionToleranceMm: 1.5,
  orientationToleranceRad: 0.18,
  allowPositionFallback: true,
  orientationMode: 'relaxed',
};

export const MANUAL_STRICT_TASK_PROFILE: TaskPoseConstraintProfile = {
  name: 'manual-strict',
  positionToleranceMm: 1.5,
  orientationToleranceRad: 0.12,
  allowPositionFallback: true,
  orientationMode: 'strict',
};

export const GRASP_APPROACH_TASK_PROFILE: TaskPoseConstraintProfile = {
  name: 'grasp-approach',
  positionToleranceMm: 2.0,
  orientationToleranceRad: 0.22,
  allowPositionFallback: true,
  orientationMode: 'relaxed',
};

export const GRASP_CONTACT_TASK_PROFILE: TaskPoseConstraintProfile = {
  name: 'grasp-contact',
  positionToleranceMm: 1.0,
  orientationToleranceRad: 0.08,
  allowPositionFallback: true,
  orientationMode: 'strict',
};

export const PLACE_STRICT_TASK_PROFILE: TaskPoseConstraintProfile = {
  name: 'place-strict',
  positionToleranceMm: 1.5,
  orientationToleranceRad: 0.12,
  allowPositionFallback: true,
  orientationMode: 'strict',
};

export function buildGraspApproachPose(
  boxPositionMm: [number, number, number],
  approachHeightMm = APPROACH_HEIGHT
): TaskTargetPoseMm {
  const [bx, by, bz] = boxPositionMm;
  return {
    positionMm: [bx, by + BOX_HALF_SIZE + SUCKER_LENGTH + approachHeightMm, bz],
    orientationDeg: [
      GRASP_APPROACH_ORIENTATION_DEG.rx,
      GRASP_APPROACH_ORIENTATION_DEG.ry,
      GRASP_APPROACH_ORIENTATION_DEG.rz,
    ],
    profile: GRASP_APPROACH_TASK_PROFILE,
  };
}

export function buildGraspContactPose(boxPositionMm: [number, number, number]): TaskTargetPoseMm {
  return {
    ...buildGraspApproachPose(boxPositionMm, 0),
    profile: GRASP_CONTACT_TASK_PROFILE,
  };
}

export function buildLiftPose(
  currentFlangePositionM: [number, number, number],
  liftHeightMm: number
): TaskTargetPoseMm {
  const currentFlangePositionMm = sceneToRobotMm(currentFlangePositionM);
  return {
    positionMm: [
      currentFlangePositionMm[0],
      currentFlangePositionMm[1] + liftHeightMm,
      currentFlangePositionMm[2],
    ],
    profile: HOLD_ORIENTATION_TASK_PROFILE,
  };
}

export function buildPlacePose(
  positionM: [number, number, number],
  orientationDeg: [number, number, number]
): TaskTargetPoseMm {
  return {
    positionMm: sceneToRobotMm(positionM),
    orientationDeg,
    profile: PLACE_STRICT_TASK_PROFILE,
  };
}
