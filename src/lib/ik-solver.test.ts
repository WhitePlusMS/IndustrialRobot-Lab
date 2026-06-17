import { describe, it, expect } from 'vitest';
import { solveIK, solvePositionOnlyIK, isReachable, computeMaxReach } from './ik-solver';
import { forwardKinematics, extractPose } from './kinematics';
import { KUKA_LIKE, DEFAULT_JOINTS } from './robot-config';
import type { JointAngles } from '@/types/robot';

const toRad = (deg: number) => (deg * Math.PI) / 180;
const jointsRad = DEFAULT_JOINTS.map(toRad) as JointAngles;

describe('IK solver', () => {
  it('returns current joints when target equals current pose', () => {
    const T = forwardKinematics(jointsRad, KUKA_LIKE);
    const { position, eulerZYX } = extractPose(T);
    const result = solveIK(position, eulerZYX, jointsRad, KUKA_LIKE);
    expect(result).not.toBeNull();
    for (let i = 0; i < 6; i++) {
      expect(result![i]).toBeCloseTo(jointsRad[i], 3);
    }
  });

  it('solves a small position offset', () => {
    const T = forwardKinematics(jointsRad, KUKA_LIKE);
    const { position } = extractPose(T);
    const target: [number, number, number] = [position[0] + 10, position[1], position[2]];
    const result = solvePositionOnlyIK(target, jointsRad, KUKA_LIKE);
    expect(result).not.toBeNull();
    const T2 = forwardKinematics(result!, KUKA_LIKE);
    const p2 = T2.getPosition();
    const err = Math.hypot(p2[0] - target[0], p2[1] - target[1], p2[2] - target[2]);
    expect(err).toBeLessThan(1.0);
  });

  it('solves a small orientation offset', () => {
    const T = forwardKinematics(jointsRad, KUKA_LIKE);
    const { position, eulerZYX } = extractPose(T);
    // rotate around tool Z by 0.1 rad to avoid Euler representation singularities
    const targetEuler: [number, number, number] = [eulerZYX[0], eulerZYX[1], eulerZYX[2] + 0.1];
    const result = solveIK(position, targetEuler, jointsRad, KUKA_LIKE);
    expect(result).not.toBeNull();
  });

  it('rejects far unreachable targets via workspace check', () => {
    const maxReach = computeMaxReach(KUKA_LIKE);
    const farTarget: [number, number, number] = [maxReach * 10, 0, 0];
    expect(isReachable(farTarget, KUKA_LIKE)).toBe(false);
  });
});
