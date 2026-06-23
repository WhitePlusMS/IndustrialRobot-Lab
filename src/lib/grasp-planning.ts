import { APPROACH_HEIGHT, BOX_HALF_SIZE, SUCKER_LENGTH } from '@/hooks/useSuckerControl';

export const GRASP_APPROACH_ORIENTATION_DEG = {
  rx: -89.4,
  ry: 0.4,
  // 真空吸盘对绕自身吸附轴的扭转不敏感。
  // 之前固定为 -30° 会把“移动到箱子上方”变成过约束位姿 IK，
  // 日志显示位置已到达，但姿态阶段持续失败，因此这里收敛到更自然的 0°。
  rz: 0.0,
} as const;

export interface GraspApproachPose {
  targetXM: number;
  targetYM: number;
  targetZM: number;
  targetYMm: number;
  rx: number;
  ry: number;
  rz: number;
}

export function buildGraspApproachPose(
  boxPositionMm: [number, number, number],
  approachHeightMm = APPROACH_HEIGHT
): GraspApproachPose {
  const [bx, by, bz] = boxPositionMm;
  const targetYMm = by + BOX_HALF_SIZE + SUCKER_LENGTH + approachHeightMm;
  return {
    targetXM: bx / 1000,
    targetYM: targetYMm / 1000,
    targetZM: bz / 1000,
    targetYMm,
    rx: GRASP_APPROACH_ORIENTATION_DEG.rx,
    ry: GRASP_APPROACH_ORIENTATION_DEG.ry,
    rz: GRASP_APPROACH_ORIENTATION_DEG.rz,
  };
}

export function buildGraspContactPose(boxPositionMm: [number, number, number]): GraspApproachPose {
  return buildGraspApproachPose(boxPositionMm, 0);
}
