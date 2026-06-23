import { describe, expect, it } from 'vitest';
import type { JointAngles, Pose } from '@/types/robot';
import type { RobotModel } from './robot-model';
import {
  buildGoalPoseSeedCandidates,
  dedupeJointSeeds,
  matchesTaskProfile,
  planJointPath,
  solveGoalJointsForPose,
} from './goal-planner';
import { forwardKinematics, extractPose } from './kinematics';
import { KUKA_LIKE, DEFAULT_JOINTS } from './robot-config';
import { orientationError } from './math/rotation3d';
import {
  HOLD_ORIENTATION_TASK_PROFILE,
  MANUAL_STRICT_TASK_PROFILE,
  POSITION_ONLY_TASK_PROFILE,
} from './grasp-planning';

const toRad = (deg: number) => (deg * Math.PI) / 180;

function createMockRobotModel(): RobotModel {
  return {
    isAvailable: () => true,
    forwardKinematics: (jointsDeg: JointAngles): Pose | null => {
      const jointsRad = jointsDeg.map(toRad) as JointAngles;
      const matrix = forwardKinematics(jointsRad, KUKA_LIKE);
      const { position, eulerZYX } = extractPose(matrix);
      return { position, euler: eulerZYX, rotation: matrix.getRotation() };
    },
    estimateJacobian: (jointsDeg: JointAngles, stepDeg = 0.4): number[][] | null => {
      const basePose = createMockRobotModel().forwardKinematics(jointsDeg);
      if (!basePose) return null;

      const jacobian = Array.from({ length: 6 }, () => Array(6).fill(0));
      for (let jointIndex = 0; jointIndex < 6; jointIndex++) {
        const offsetJoints = [...jointsDeg] as JointAngles;
        offsetJoints[jointIndex] += stepDeg;
        const offsetPose = createMockRobotModel().forwardKinematics(offsetJoints);
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
    },
  };
}

describe('goal-planner', () => {
  it('dedupeJointSeeds 会移除重复 seed', () => {
    const seeds: JointAngles[] = [
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [10, 0, 0, 0, 0, 0],
    ];
    expect(dedupeJointSeeds(seeds)).toEqual([
      [0, 0, 0, 0, 0, 0],
      [10, 0, 0, 0, 0, 0],
    ]);
  });

  it('buildGoalPoseSeedCandidates 生成稳定且去重后的 seed 集', () => {
    const candidates = buildGoalPoseSeedCandidates(DEFAULT_JOINTS, [-1000, 800, 0]);
    const uniqueKeys = new Set(candidates.map((seed) => seed.join(',')));
    expect(candidates.length).toBe(uniqueKeys.size);
    expect(candidates.length).toBeGreaterThan(5);
    expect(candidates.some((seed) => seed.every((value, index) => value === DEFAULT_JOINTS[index]))).toBe(true);
  });

  it('matchesTaskProfile 能区分 strict 与 ignore 策略', () => {
    expect(matchesTaskProfile(1, 0.05, MANUAL_STRICT_TASK_PROFILE)).toBe(true);
    expect(matchesTaskProfile(1, 0.2, MANUAL_STRICT_TASK_PROFILE)).toBe(false);
    expect(matchesTaskProfile(1, Math.PI / 2, POSITION_ONLY_TASK_PROFILE)).toBe(true);
  });

  it('solveGoalJointsForPose 会优先返回最接近当前关节的可行解', () => {
    const model = createMockRobotModel();
    const currentJoints = DEFAULT_JOINTS;
    const currentPose = model.forwardKinematics(currentJoints);
    expect(currentPose).not.toBeNull();

    const result = solveGoalJointsForPose({
      targetPose: currentPose!,
      profile: HOLD_ORIENTATION_TASK_PROFILE,
      currentJoints,
      model,
      jointRanges: Object.values(KUKA_LIKE.dhParams).map((param) => param.thetaRange) as [number, number][],
    });

    expect(result).not.toBeNull();
    expect(result!.source).toBe('full_pose');
    expect(result!.poseErrorMm).toBeLessThan(1);
    expect(result!.orientationErrorRad).toBeLessThan(0.01);
    result!.joints.forEach((value, index) => {
      expect(value).toBeCloseTo(currentJoints[index], 3);
    });
  });

  it('planJointPath 对小幅 position-only 位移给出 direct 路径', () => {
    const plan = planJointPath(
      [0, -20, 40, 0, 65, 0],
      [5, -18, 42, 0, 64, 0],
      POSITION_ONLY_TASK_PROFILE,
      KUKA_LIKE
    );

    expect(plan).not.toBeNull();
    expect(plan!.planType).toBe('direct_joint_path');
    expect(plan!.waypointJoints).toHaveLength(1);
  });

  it('planJointPath 对大幅 position-only 位移给出 transit 路径', () => {
    const plan = planJointPath(
      [0, -20, 40, 0, 65, 0],
      [120, -80, 110, 60, -30, 45],
      POSITION_ONLY_TASK_PROFILE,
      KUKA_LIKE
    );

    expect(plan).not.toBeNull();
    expect(plan!.planType).toBe('lift_then_move_then_settle');
    expect(plan!.waypointJoints.length).toBeGreaterThan(1);
  });
});
