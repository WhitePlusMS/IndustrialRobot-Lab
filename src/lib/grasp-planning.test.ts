import { describe, expect, it } from 'vitest';
import {
  buildGraspApproachPose,
  buildGraspContactPose,
  buildLiftPose,
  buildPlacePose,
  GRASP_APPROACH_TASK_PROFILE,
  GRASP_CONTACT_TASK_PROFILE,
  HOLD_ORIENTATION_TASK_PROFILE,
  PLACE_STRICT_TASK_PROFILE,
} from './grasp-planning';

describe('grasp-planning', () => {
  it('builds approach pose in millimeters only', () => {
    const pose = buildGraspApproachPose([-1000, 350, 0], 50);

    expect(pose).toEqual({
      positionMm: [-1000, 765, 0],
      orientationDeg: [-89.4, 0.4, 0],
      profile: GRASP_APPROACH_TASK_PROFILE,
    });
  });

  it('builds contact pose in millimeters only', () => {
    const pose = buildGraspContactPose([-1000, 350, 0]);

    expect(pose.positionMm).toEqual([-1000, 715, 0]);
    expect(pose.orientationDeg).toEqual([-89.4, 0.4, 0]);
    expect(pose.profile).toBe(GRASP_CONTACT_TASK_PROFILE);
  });

  it('builds lift pose from scene meters into millimeters', () => {
    const pose = buildLiftPose([0.25, 1.1, -0.5], 120);

    expect(pose.positionMm).toEqual([250, 1220, -500]);
    expect(pose.profile).toBe(HOLD_ORIENTATION_TASK_PROFILE);
  });

  it('builds place pose from scene meters into millimeters', () => {
    const pose = buildPlacePose([0.1018, 1.1154, 1.1429], [-126.3, 87.8, -38.2]);

    expect(pose.positionMm).toEqual([101.8, 1115.4, 1142.9]);
    expect(pose.orientationDeg).toEqual([-126.3, 87.8, -38.2]);
    expect(pose.profile).toBe(PLACE_STRICT_TASK_PROFILE);
  });
});
