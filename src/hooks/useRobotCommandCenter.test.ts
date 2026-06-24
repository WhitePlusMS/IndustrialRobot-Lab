import { describe, expect, it, vi } from 'vitest';
import type { JointAngles } from '@/types/robot';

function dequeueWaypoint(queue: JointAngles[], startCoordinatedAnimation: (target: JointAngles) => void) {
  const next = queue.shift();
  if (!next) return false;
  startCoordinatedAnimation(next);
  return true;
}

function clearMotionQueue(queue: JointAngles[], stopAnimation: () => void) {
  queue.length = 0;
  stopAnimation();
}

describe('useRobotCommandCenter helpers', () => {
  it('dequeues and starts the next waypoint', () => {
    const queue: JointAngles[] = [
      [1, 2, 3, 4, 5, 6],
      [6, 5, 4, 3, 2, 1],
    ];
    const startCoordinatedAnimation = vi.fn();

    const started = dequeueWaypoint(queue, startCoordinatedAnimation);

    expect(started).toBe(true);
    expect(startCoordinatedAnimation).toHaveBeenCalledWith([1, 2, 3, 4, 5, 6]);
    expect(queue).toEqual([[6, 5, 4, 3, 2, 1]]);
  });

  it('returns false when the queue is empty', () => {
    const queue: JointAngles[] = [];
    const startCoordinatedAnimation = vi.fn();

    const started = dequeueWaypoint(queue, startCoordinatedAnimation);

    expect(started).toBe(false);
    expect(startCoordinatedAnimation).not.toHaveBeenCalled();
  });

  it('clears queue and stops motion', () => {
    const queue: JointAngles[] = [
      [1, 1, 1, 1, 1, 1],
      [2, 2, 2, 2, 2, 2],
    ];
    const stopAnimation = vi.fn();

    clearMotionQueue(queue, stopAnimation);

    expect(queue).toEqual([]);
    expect(stopAnimation).toHaveBeenCalledTimes(1);
  });
});
