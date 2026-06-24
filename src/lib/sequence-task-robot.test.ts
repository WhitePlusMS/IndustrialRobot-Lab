import { describe, expect, it, vi } from 'vitest';
import { createSequenceTaskRobot } from './sequence-task-robot';
import type { SequenceRobotAPI, SequenceStepRuntime } from '@/lib/sequence-runtime';

function createRobot(overrides: Partial<SequenceRobotAPI> = {}): SequenceRobotAPI {
  return {
    goToJoints: vi.fn(),
    goToPoseMm: vi.fn(() => true),
    goToPosition: vi.fn(() => true),
    isMotionQueueIdle: vi.fn(() => true),
    stopAnimation: vi.fn(),
    isAnimating: false,
    isAnimatingRef: { current: false },
    getCurrentJointsDeg: vi.fn(() => [0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number]),
    getCurrentPose: vi.fn(() => null),
    ...overrides,
  };
}

function createRuntime(overrides: Partial<SequenceStepRuntime> = {}): SequenceStepRuntime {
  return {
    waitForAnimation: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('sequence-task-robot', () => {
  it('approaches box through goToPoseMm', async () => {
    const robot = createRobot();
    const taskRobot = createSequenceTaskRobot({
      robot,
      runtime: createRuntime(),
      robotPoseApi: {} as never,
      log: vi.fn(),
    });

    const success = await taskRobot.approachBox([-1000, 350, 0], 50);

    expect(success).toBe(true);
    expect(robot.goToPoseMm).toHaveBeenCalledTimes(1);
  });

  it('fails descend when flange pose is unavailable at final validation', async () => {
    const robot = createRobot();
    const taskRobot = createSequenceTaskRobot({
      robot,
      runtime: createRuntime(),
      robotPoseApi: {
        getSuckerContactPose: vi.fn(() => null),
        getFlangeMatrix: vi.fn(() => null),
      } as never,
      log: vi.fn(),
    });

    const success = await taskRobot.descendToBox([-1000, 350, 0]);

    expect(success).toBe(false);
  });

  it('fails lift when flange pose is missing', async () => {
    const robot = createRobot();
    const taskRobot = createSequenceTaskRobot({
      robot,
      runtime: createRuntime(),
      robotPoseApi: {
        getFlangeMatrix: vi.fn(() => null),
      } as never,
      log: vi.fn(),
    });

    const success = await taskRobot.liftCurrentFlange(100);

    expect(success).toBe(false);
    expect(robot.goToPoseMm).not.toHaveBeenCalled();
  });

  it('fails place when goToPoseMm rejects the target', async () => {
    const robot = createRobot({
      goToPoseMm: vi.fn(() => false),
    });
    const taskRobot = createSequenceTaskRobot({
      robot,
      runtime: createRuntime(),
      robotPoseApi: {} as never,
      log: vi.fn(),
    });

    const success = await taskRobot.moveToPlacePose({
      positionMm: [100, 200, 300],
      orientationDeg: [0, 0, 0],
      profile: {
        name: 'test',
        positionToleranceMm: 1,
        orientationToleranceRad: 0.1,
        allowPositionFallback: true,
        orientationMode: 'strict',
      },
    });

    expect(success).toBe(false);
  });
});
