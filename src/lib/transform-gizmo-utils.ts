// src/lib/transform-gizmo-utils.ts
// TransformGizmo 工具函数：Gizmo 场景坐标 → IK Pose + 轻量 IK 封装（独立纯函数模块）

import type { JointAngles, Pose } from '@/types/robot';
import type { RobotModel } from './robot-model';
import { solveIK } from './ik-solver';
import {
  quaternionToRotationMatrix,
  rotationMatrixToEulerZYX,
} from './math/rotation3d';
import { KUKA_LIKE } from './robot-config';
import { GIZMO_IK_PRESET } from './ik-config';
import { sceneToRobotMm } from './spatial-coordinates';

/**
 * Gizmo 场景坐标(米) + 四元数 → IK 输入 Pose(mm + 旋转矩阵)
 */
export function gizmoToTargetPose(
  position: [number, number, number],
  quaternion: [number, number, number, number],
): Pose {
  const rotation = quaternionToRotationMatrix(quaternion);
  return {
    position: sceneToRobotMm(position),
    euler: rotationMatrixToEulerZYX(rotation),
    rotation,
  };
}

/**
 * Gizmo 专用的轻量 IK 求解封装（更快速收敛，更适合拖拽场景）
 */
export function solveIKWithGizmoConfig(
  targetPose: Pose,
  currentJoints: JointAngles,
  model: RobotModel,
  jointRanges?: [number, number][],
): JointAngles | null {
  if (!model.isAvailable()) return null;
  if (!jointRanges) {
    jointRanges = Object.values(KUKA_LIKE.dhParams).map((p) => p.thetaRange) as [number, number][];
  }
  return solveIK(targetPose, currentJoints, model, GIZMO_IK_PRESET, jointRanges);
}
