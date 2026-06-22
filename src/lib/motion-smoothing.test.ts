// src/lib/motion-smoothing.test.ts
import { describe, it, expect } from 'vitest';
import { updateJointAngles, easeInOutCubic, lerpJoints } from './motion-smoothing';

describe('updateJointAngles', () => {
  it('静止时不变化', () => {
    const r = updateJointAngles([10, 20, 30, 40, 50, 60], [10, 20, 30, 40, 50, 60], 16, 120);
    expect(r).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it('向目标方向步进', () => {
    const r = updateJointAngles([0, 0, 0, 0, 0, 0], [10, 0, 0, 0, 0, 0], 16, 120);
    // maxStep = 120°/s * 0.016s = 1.92°
    expect(r[0]).toBeGreaterThan(0);
    expect(r[0]).toBeLessThan(10);
    expect(r[1]).toBe(0);
  });

  it('小偏差直接到位', () => {
    const r = updateJointAngles([0, 0, 0, 0, 0, 0], [0.05, 0, 0, 0, 0, 0], 16, 120);
    expect(r[0]).toBeCloseTo(0.05, 10);
  });
});

describe('easeInOutCubic', () => {
  it('t=0 → 0', () => expect(easeInOutCubic(0)).toBe(0));
  it('t=1 → 1', () => expect(easeInOutCubic(1)).toBe(1));
  it('t=0.5 → 0.5', () => expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5));
  it('单调递增', () => {
    let prev = -Infinity;
    for (let t = 0; t <= 1; t += 0.01) {
      const v = easeInOutCubic(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('lerpJoints', () => {
  it('t=0 → start', () => {
    expect(lerpJoints([1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12], 0)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('t=1 → end', () => {
    expect(lerpJoints([1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12], 1)).toEqual([7, 8, 9, 10, 11, 12]);
  });
});
