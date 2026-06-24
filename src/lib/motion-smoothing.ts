// src/lib/motion-smoothing.ts
import type { MotionConfig  } from '@/types/robot';

export const DEFAULT_MOTION_CONFIG: MotionConfig = {
  jointSpeedLimit: 120,
  ikAnimDuration: 400,
  snapThreshold: 0.1,
  longPressThrottle: 50,
};

/** easeInOutCubic 缓动函数 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** 缓动插值（单击用） */
export function lerpJoints(start: number[], end: number[], t: number): number[] {
  const eased = easeInOutCubic(t);
  return start.map((s, i) => s + (end[i] - s) * eased);
}
