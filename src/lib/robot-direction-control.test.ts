import { describe, expect, it, vi } from 'vitest';
import type { JointAngles, Pose } from '@/types/robot';
import type { RobotModel } from './robot-model';
import {
  buildAxisDelta,
  createIdleLongPressSession,
  executeDirectionalMove,
  updateLongPressSession,
} from './robot-direction-control';

const basePose: Pose = {
  position: [100, 200, 300],
  euler: [0, 0, 0],
  rotation: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
};

function createModel(overrides: Partial<RobotModel> = {}): RobotModel {
  return {
    forwardKinematics: vi.fn(() => basePose),
    estimateJacobian: vi.fn(() => Array.from({ length: 6 }, () => Array(6).fill(0))),
    isAvailable: vi.fn(() => true),
    ...overrides,
  };
}

describe('robot-direction-control', () => {
  it('builds world-space position deltas in robot mm', () => {
    const result = buildAxisDelta({
      axis: 'x',
      delta: 10,
      coordinateSystem: 'World',
      currentPose: basePose,
    });

    expect(result.isPositionAxis).toBe(true);
    expect(result.targetPose.position).toEqual([110, 200, 300]);
  });

  it('accumulates long-press position targets across repeated calls', () => {
    const firstMove = buildAxisDelta({
      axis: 'z',
      delta: 5,
      coordinateSystem: 'World',
      currentPose: basePose,
    });

    const firstSession = updateLongPressSession({
      axis: 'z',
      sign: 1,
      delta: 5,
      coordinateSystem: 'World',
      isAnimating: false,
      currentPose: basePose,
      targetPose: firstMove.targetPose,
      session: createIdleLongPressSession(),
    });

    const secondSession = updateLongPressSession({
      axis: 'z',
      sign: 1,
      delta: 5,
      coordinateSystem: 'World',
      isAnimating: true,
      currentPose: basePose,
      targetPose: firstMove.targetPose,
      session: firstSession.nextSession,
    });

    expect(secondSession.targetPose.position).toEqual([100, 200, 310]);
  });

  it('rebuilds long-press session when coordinate system changes', () => {
    const targetPose = buildAxisDelta({
      axis: 'rx',
      delta: 5,
      coordinateSystem: 'World',
      currentPose: basePose,
    }).targetPose;

    const worldSession = updateLongPressSession({
      axis: 'rx',
      sign: 1,
      delta: 5,
      coordinateSystem: 'World',
      isAnimating: false,
      currentPose: basePose,
      targetPose,
      session: createIdleLongPressSession(),
    });

    const toolSession = updateLongPressSession({
      axis: 'rx',
      sign: 1,
      delta: 5,
      coordinateSystem: 'Tool',
      isAnimating: true,
      currentPose: basePose,
      targetPose,
      session: worldSession.nextSession,
    });

    expect(toolSession.nextSession.key).toBe('rx:1:Tool');
    expect(toolSession.targetPose.euler).toEqual(targetPose.euler);
  });

  it('starts cartesian animation for reachable position moves', () => {
    const startCartesianAnimation = vi.fn();
    const startCoordinatedAnimation = vi.fn();

    const result = executeDirectionalMove({
      targetPose: {
        ...basePose,
        position: [150, 210, 320],
      },
      currentJoints: [0, 0, 0, 0, 0, 0],
      isPositionAxis: true,
      model: createModel(),
      config: { dhParams: {} as never } as never,
      ranges: [[-180, 180], [-180, 180], [-180, 180], [-180, 180], [-180, 180], [-180, 180]],
      startCartesianAnimation,
      startCoordinatedAnimation,
      markUnreachable: vi.fn(),
    });

    expect(result.success).toBe(true);
    expect(startCartesianAnimation).toHaveBeenCalledTimes(1);
    expect(startCoordinatedAnimation).not.toHaveBeenCalled();
  });

  it('marks unreachable when position target is not reachable', () => {
    const markUnreachable = vi.fn();
    const result = executeDirectionalMove({
      targetPose: {
        ...basePose,
        position: [100000, 100000, 100000],
      },
      currentJoints: [0, 0, 0, 0, 0, 0] as JointAngles,
      isPositionAxis: true,
      model: createModel({
        forwardKinematics: vi.fn(() => null),
      }),
      config: {
        dhParams: {
          joint1: { thetaRange: [-180, 180] },
          joint2: { thetaRange: [-180, 180] },
          joint3: { thetaRange: [-180, 180] },
          joint4: { thetaRange: [-180, 180] },
          joint5: { thetaRange: [-180, 180] },
          joint6: { thetaRange: [-180, 180] },
        },
      } as never,
      ranges: [[-180, 180], [-180, 180], [-180, 180], [-180, 180], [-180, 180], [-180, 180]],
      startCartesianAnimation: vi.fn(),
      startCoordinatedAnimation: vi.fn(),
      markUnreachable,
    });

    expect(result.success).toBe(false);
    expect(markUnreachable).toHaveBeenCalledTimes(1);
  });
});
