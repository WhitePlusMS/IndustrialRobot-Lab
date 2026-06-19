// src/lib/math/vector.ts
// 三维向量与通用向量工具

/** 向量模长 */
export function vectorNorm(v: number[]): number {
  return Math.hypot(...v);
}

/** 将向量模长限制到 maxNorm */
export function clampVectorMagnitude(vector: number[], maxNorm: number): number[] {
  const norm = vectorNorm(vector);
  if (norm <= maxNorm || norm === 0) return vector;
  const scale = maxNorm / norm;
  return vector.map((value) => value * scale);
}

/** 将向量步进限制到 maxStepDeg（按最大绝对值比例缩放） */
export function clampDegStep(step: number[], maxStepDeg: number): number[] {
  const maxAbs = Math.max(...step.map((value) => Math.abs(value)));
  if (maxAbs <= maxStepDeg || maxAbs === 0) return step;
  const scale = maxStepDeg / maxAbs;
  return step.map((value) => value * scale);
}

/** 将弧度步进限制到 maxStepRad */
export function clampRadStep(step: number[], maxStepRad: number): number[] {
  return clampDegStep(step, maxStepRad);
}

/** 从 current 向 target 沿直线走最大 maxStep 距离 */
export function stepVectorTowardTarget(
  current: [number, number, number],
  target: [number, number, number],
  maxStep: number
): [number, number, number] {
  const delta: [number, number, number] = [
    target[0] - current[0],
    target[1] - current[1],
    target[2] - current[2],
  ];
  const norm = Math.hypot(...delta);
  if (norm <= maxStep || norm === 0) return [...target];
  const scale = maxStep / norm;
  return [
    current[0] + delta[0] * scale,
    current[1] + delta[1] * scale,
    current[2] + delta[2] * scale,
  ];
}
