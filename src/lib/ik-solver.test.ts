import { describe, it, expect } from 'vitest';
import { solveIK, solvePositionOnlyIK, isReachable } from './ik-solver';
import { forwardKinematics, extractPose } from './kinematics';
import { KUKA_LIKE, DEFAULT_JOINTS } from './robot-config';
import type { JointAngles, Pose } from '@/types/robot';
import type { RobotModel } from './robot-model';

import { orientationError } from './math/rotation3d';

const toRad = (deg: number) => (deg * Math.PI) / 180;
const jointsRad = DEFAULT_JOINTS.map(toRad) as JointAngles;

/** 测试用确定性 RobotModel：使用 DH 正运动学模拟 GLB 采样 */
function createMockRobotModel(): RobotModel {
  return {
    isAvailable: () => true,
    forwardKinematics: (jointsDeg: JointAngles): Pose | null => {
      const jointsRad = jointsDeg.map(toRad) as JointAngles;
      const T = forwardKinematics(jointsRad, KUKA_LIKE);
      const { position, eulerZYX } = extractPose(T);
      return {
        position,
        euler: eulerZYX,
        rotation: T.getRotation(),
      };
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

describe('IK solver', () => {
  const model = createMockRobotModel();

  it('returns current joints when target equals current pose', () => {
    const T = forwardKinematics(jointsRad, KUKA_LIKE);
    const { position, eulerZYX } = extractPose(T);
    const pose: Pose = { position, euler: eulerZYX, rotation: T.getRotation() };
    const result = solveIK(pose, DEFAULT_JOINTS, model);
    expect(result).not.toBeNull();
    for (let i = 0; i < 6; i++) {
      expect(result![i]).toBeCloseTo(DEFAULT_JOINTS[i], 3);
    }
  });

  it('solves a small position offset', () => {
    const T = forwardKinematics(jointsRad, KUKA_LIKE);
    const { position } = extractPose(T);
    const target: [number, number, number] = [position[0] + 10, position[1], position[2]];
    const result = solvePositionOnlyIK(target, DEFAULT_JOINTS, model);
    expect(result).not.toBeNull();
    const T2 = forwardKinematics(result!.map(toRad) as JointAngles, KUKA_LIKE);
    const p2 = T2.getPosition();
    const err = Math.hypot(p2[0] - target[0], p2[1] - target[1], p2[2] - target[2]);
    expect(err).toBeLessThan(1.0);
  });

  it('solves a small orientation offset', () => {
    const T = forwardKinematics(jointsRad, KUKA_LIKE);
    const { position, eulerZYX } = extractPose(T);
    const targetEuler: [number, number, number] = [eulerZYX[0], eulerZYX[1], eulerZYX[2] + 0.1];
    const pose: Pose = {
      position,
      euler: targetEuler,
      rotation: T.getRotation(),
    };
    const result = solveIK(pose, DEFAULT_JOINTS, model);
    expect(result).not.toBeNull();
  });

  it('rejects far unreachable targets via workspace check', () => {
    const farTarget: [number, number, number] = [100000, 0, 0];
    expect(isReachable(farTarget, model)).toBe(false);
  });
});
