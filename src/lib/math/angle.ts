// src/lib/math/angle.ts
// 角度与弧度相关工具函数

import type { JointAngles } from '@/types/robot';

/** 将角度差规范化到 [-π, π] */
export function normalizeAngleDelta(delta: number): number {
  let normalized = delta;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

/** 在 start 与 end 之间按 t 进行最短路径角度插值 */
export function lerpAngle(start: number, end: number, t: number): number {
  return start + normalizeAngleDelta(end - start) * t;
}

/** 度 → 弧度 */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 弧度 → 度 */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** 将六维关节角度从度转换为弧度 */
export function jointsDegToRad(jointsDeg: JointAngles): JointAngles {
  return jointsDeg.map(degToRad) as JointAngles;
}

/** 将六维关节角度从弧度转换为度 */
export function jointsRadToDeg(jointsRad: JointAngles): JointAngles {
  return jointsRad.map(radToDeg) as JointAngles;
}
