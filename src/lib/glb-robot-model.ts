// src/lib/glb-robot-model.ts
// GLB 机器人模型实现：基于 RobotPoseAPI 采样 FK 与数值 Jacobian

import type { RobotModel } from './robot-model';
import type { RobotPoseAPI } from '@/lib/robot-pose-bridge';
import type { JointAngles, Pose } from '@/types/robot';
import { orientationError } from './math/rotation3d';
import { sceneToRobotMm } from './spatial-coordinates';

const DEFAULT_JACOBIAN_STEP_DEG = 0.2;

export class GLBRobotModel implements RobotModel {
  private api: RobotPoseAPI;

  constructor(api: RobotPoseAPI) {
    this.api = api;
  }

  isAvailable(): boolean {
    return this.api.isAvailable();
  }

  forwardKinematics(jointsDeg: JointAngles): Pose | null {
    const captured = this.api.capturePoseForJoints([...jointsDeg]);
    if (!captured) return null;
    return {
      position: sceneToRobotMm(captured.position),
      euler: captured.euler,
      rotation: captured.rotation,
    };
  }

  estimateJacobian(jointsDeg: JointAngles, stepDeg = DEFAULT_JACOBIAN_STEP_DEG): number[][] | null {
    const basePose = this.forwardKinematics(jointsDeg);
    if (!basePose) return null;

    const jacobian = Array.from({ length: 6 }, () => Array(6).fill(0));

    for (let jointIndex = 0; jointIndex < 6; jointIndex++) {
      const offsetJoints = [...jointsDeg] as JointAngles;
      offsetJoints[jointIndex] += stepDeg;
      const offsetPose = this.forwardKinematics(offsetJoints);
      if (!offsetPose) return null;

      for (let axis = 0; axis < 3; axis++) {
        jacobian[axis][jointIndex] =
          (offsetPose.position[axis] - basePose.position[axis]) / stepDeg;
      }

      const orientationDelta = orientationError(offsetPose.rotation, basePose.rotation);
      for (let axis = 0; axis < 3; axis++) {
        jacobian[axis + 3][jointIndex] = orientationDelta[axis] / stepDeg;
      }
    }

    return jacobian;
  }
}
