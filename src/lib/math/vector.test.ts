// src/lib/math/vector.test.ts
import { describe, it, expect } from 'vitest';
import { vectorNorm, clampVectorMagnitude, clampDegStep, stepVectorTowardTarget } from './vector';

describe('vectorNorm', () => {
  it('[3,4] → 5', () => {
    expect(vectorNorm([3, 4])).toBeCloseTo(5, 10);
  });

  it('零向量 → 0', () => {
    expect(vectorNorm([0, 0, 0])).toBe(0);
  });

  it('[1,1,1] → √3', () => {
    expect(vectorNorm([1, 1, 1])).toBeCloseTo(Math.sqrt(3), 10);
  });
});

describe('clampVectorMagnitude', () => {
  it('小于限幅 不变', () => {
    expect(clampVectorMagnitude([1, 0, 0], 5)).toEqual([1, 0, 0]);
  });

  it('大于限幅 等比缩放', () => {
    const r = clampVectorMagnitude([3, 4, 0], 2.5);
    expect(vectorNorm(r)).toBeCloseTo(2.5, 10);
    // 保持方向
    expect(r[0] / r[1]).toBeCloseTo(0.75, 10);
  });

  it('零向量不受影响', () => {
    expect(clampVectorMagnitude([0, 0, 0], 5)).toEqual([0, 0, 0]);
  });
});

describe('clampDegStep', () => {
  it('小于限幅不变', () => {
    expect(clampDegStep([0.5, 0.3, 0.1], 1)).toEqual([0.5, 0.3, 0.1]);
  });

  it('大于限幅等比缩放', () => {
    const r = clampDegStep([4, 2, 0], 2);
    expect(r[0]).toBeCloseTo(2, 10);
    expect(r[1]).toBeCloseTo(1, 10);
    expect(r[2]).toBe(0);
  });
});

describe('stepVectorTowardTarget', () => {
  it('距离小于步长 直接到位', () => {
    expect(stepVectorTowardTarget([0, 0, 0], [1, 0, 0], 5)).toEqual([1, 0, 0]);
  });

  it('距离大于步长 只走一步', () => {
    const r = stepVectorTowardTarget([0, 0, 0], [10, 0, 0], 3);
    expect(r[0]).toBeCloseTo(3, 10);
    expect(r[1]).toBe(0);
    expect(r[2]).toBe(0);
  });

  it('已在目标 不动', () => {
    expect(stepVectorTowardTarget([5, 5, 5], [5, 5, 5], 1)).toEqual([5, 5, 5]);
  });
});
