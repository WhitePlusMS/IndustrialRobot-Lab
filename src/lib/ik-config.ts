import type { IKSolverConfig } from '@/types/robot';

export const MANUAL_ROTATION_IK_PRESET = {
  maxIterations: 100,
  posTolerance: 0.3,
  oriTolerance: 0.005,
  damping: 0.15,
  maxStepRad: 0.05,
  orientationScale: 300,
} as const satisfies Partial<IKSolverConfig>;

export const GOAL_SOLVE_FULL_POSE_PRESET = {
  maxIterations: 160,
  posTolerance: 0.8,
  oriTolerance: 0.01,
  damping: 0.15,
  maxStepRad: 0.06,
  orientationScale: 300,
} as const satisfies Partial<IKSolverConfig>;

export const GOAL_SOLVE_REFINED_MAX_ITERATIONS = 180;

export const GOAL_SOLVE_POSITION_ONLY_PRESET = {
  maxIterations: 160,
  posTolerance: 0.8,
  damping: 0.15,
  maxStepRad: 0.06,
} as const satisfies Partial<IKSolverConfig>;

export const GIZMO_IK_PRESET = {
  maxIterations: 30,
  posTolerance: 2.0,
  oriTolerance: 0.02,
  damping: 0.15,
  maxStepRad: 0.15,
  orientationScale: 200,
} as const satisfies Partial<IKSolverConfig>;

export interface CartesianPositionOnlyStepPreset {
  damping: number;
  maxStepDeg: number;
  toleranceMm: number;
}

export interface CartesianStepPreset extends CartesianPositionOnlyStepPreset {
  orientationScale: number;
  positionClampMm: number;
  orientationClampRad: number;
  oriToleranceRad: number;
}

export const CARTESIAN_POSITION_ONLY_IK_PRESET: CartesianPositionOnlyStepPreset = {
  damping: 0.5,
  maxStepDeg: 2,
  toleranceMm: 1,
};

export const CARTESIAN_STEP_IK_PRESET: CartesianStepPreset = {
  damping: 0.5,
  maxStepDeg: 2,
  orientationScale: 300,
  positionClampMm: 10,
  orientationClampRad: 0.1,
  toleranceMm: 1,
  oriToleranceRad: 0.03,
};
