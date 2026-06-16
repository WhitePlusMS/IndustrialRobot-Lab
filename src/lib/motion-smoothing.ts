// src/lib/motion-smoothing.ts
import type { MotionConfig  } from '@/types/robot';

export const DEFAULT_MOTION_CONFIG: MotionConfig = {
  jointSpeedLimit: 120,
  ikAnimDuration: 400,
  snapThreshold: 0.1,
  longPressThrottle: 50,
};

/** 角速度限制插值（长按/关节微调用） */
export function updateJointAngles(
  current: number[],
  target: number[],
  deltaTime: number, // 毫秒
  speedLimit: number
): number[] {
  const maxStep = (speedLimit * deltaTime) / 1000;
  const next = [...current];
  for (let i = 0; i < 6; i++) {
    const diff = target[i] - current[i];
    if (Math.abs(diff) < 0.1) {
      next[i] = target[i];
    } else {
      next[i] += Math.sign(diff) * Math.min(Math.abs(diff), maxStep);
    }
  }
  return next;
}

/** easeInOutCubic 缓动函数 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** 缓动插值（单击用） */
export function lerpJoints(start: number[], end: number[], t: number): number[] {
  const eased = easeInOutCubic(t);
  return start.map((s, i) => s + (end[i] - s) * eased);
}
