// src/lib/transform-gizmo-utils.test.ts
// TransformGizmo 工具函数测试
import { describe, it, expect } from 'vitest';
import { gizmoToTargetPose, solveIKWithGizmoConfig } from './transform-gizmo-utils';
import { forwardKinematics, extractPose } from './kinematics';
import { KUKA_LIKE, DEFAULT_JOINTS } from './robot-config';
import { orientationError } from './math/rotation3d';
import type { JointAngles, Pose } from '@/types/robot';
import type { RobotModel } from './robot-model';

const toRad = (deg: number) => (deg * Math.PI) / 180;
const jointsRad = DEFAULT_JOINTS.map(toRad) as JointAngles;

/** 测试用确定性 RobotModel（复用 ik-solver.test.ts 相同模式） */
function createMockRobotModel(): RobotModel {
  return {
    isAvailable: () => true,
    forwardKinematics: (jointsDeg: JointAngles): Pose | null => {
      const jr = jointsDeg.map(toRad) as JointAngles;
      const T = forwardKinematics(jr, KUKA_LIKE);
      const { position, eulerZYX } = extractPose(T);
      return { position, euler: eulerZYX, rotation: T.getRotation() };
    },
    estimateJacobian: (jointsDeg: JointAngles, stepDeg = 0.4): number[][] | null => {
      const basePose = createMockRobotModel().forwardKinematics(jointsDeg);
      if (!basePose) return null;
      const jacobian = Array.from({ length: 6 }, () => Array(6).fill(0));
      for (let i = 0; i < 6; i++) {
        const offset = [...jointsDeg] as JointAngles;
        offset[i] += stepDeg;
        const offsetPose = createMockRobotModel().forwardKinematics(offset);
        if (!offsetPose) return null;
        for (let axis = 0; axis < 3; axis++) {
          jacobian[axis][i] = (offsetPose.position[axis] - basePose.position[axis]) / stepDeg;
        }
        const oriErr = orientationError(offsetPose.rotation, basePose.rotation);
        for (let axis = 0; axis < 3; axis++) {
          jacobian[axis + 3][i] = oriErr[axis] / stepDeg;
        }
      }
      return jacobian;
    },
  };
}

describe('gizmoToTargetPose', () => {
  it('转换身份四元数时返回零旋转', () => {
    const result = gizmoToTargetPose([0.5, 0.3, 0.2], [0, 0, 0, 1]);
    expect(result.position).toEqual([500, 300, 200]); // m → mm
    const identity = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    result.rotation.forEach((row, i) => {
      row.forEach((v, j) => expect(v).toBeCloseTo(identity[i][j], 15));
    });
    result.euler.forEach((v) => expect(v).toBeCloseTo(0, 15));
  });
});

describe('solveIKWithGizmoConfig', () => {
  const model = createMockRobotModel();

  it('对可达位姿返回有效关节角', () => {
    // 使用当前位姿本身 — 一定可达
    const T = forwardKinematics(jointsRad, KUKA_LIKE);
    const { position, eulerZYX } = extractPose(T);
    const pose: Pose = { position, euler: eulerZYX, rotation: T.getRotation() };
    const result = solveIKWithGizmoConfig(pose, DEFAULT_JOINTS, model);
    expect(result).not.toBeNull();
    // 逆解结果应该回到原位姿附近
    if (result) {
      const T2 = forwardKinematics(result.map(toRad) as JointAngles, KUKA_LIKE);
      const p2 = T2.getPosition();
      const err = Math.hypot(p2[0] - position[0], p2[1] - position[1], p2[2] - position[2]);
      expect(err).toBeLessThan(1.0);
    }
  });

  it('对不可达位姿返回 null', () => {
    const farPose: Pose = {
      position: [99999, 0, 0], // 远超机械臂工作范围
      euler: [0, 0, 0],
      rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    };
    const result = solveIKWithGizmoConfig(farPose, DEFAULT_JOINTS, model);
    expect(result).toBeNull();
  });
});
