// src/hooks/useRobotKinematics.ts
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Matrix, solve } from 'ml-matrix';
import { forwardKinematics, extractPose } from '@/lib/kinematics';
import { solveIK, computeJacobian, isReachable } from '@/lib/ik-solver';
import { KUKA_LIKE, DEFAULT_JOINTS } from '@/lib/robot-config';
import { Matrix4x4 } from '@/lib/matrix4x4';
import { lerpJoints, updateJointAngles, DEFAULT_MOTION_CONFIG } from '@/lib/motion-smoothing';
import type { CoordinateSystem, StatusType, JointAngles } from '@/types/robot';

/** 记忆点类型（供动作序列系统使用） */
export interface Waypoint {
  name: string;
  joints: JointAngles;
}

interface CartesianPose {
  position: [number, number, number];
  euler: [number, number, number];
  rotation?: number[][];
}

interface VisualPose extends CartesianPose {
  rotation: number[][];
  quaternion: [number, number, number, number];
}

interface VisualPoseCapture {
  jointsDeg: JointAngles;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: [number, number, number];
  rotation: number[][];
}

interface RobotDebugAPI {
  getState: () => {
    jointsDeg: JointAngles;
    jointsRad: JointAngles;
    poseMm: CartesianPose;
    coordinateSystem: CoordinateSystem;
    posStep: number;
    rotStep: number;
    status: StatusType;
    isAnimating: boolean;
  };
  moveDirection: (
    axis: 'x' | 'y' | 'z' | 'rx' | 'ry' | 'rz',
    sign: 1 | -1,
    isLongPress?: boolean
  ) => { success: boolean };
  setCoordinateSystem: (value: CoordinateSystem) => void;
  setPosStep: (value: number) => void;
  setRotStep: (value: number) => void;
  goToJoints: (target: JointAngles) => void;
  goToZero: () => void;
  stopAnimation: () => void;
  getCartesianDebug: () => {
    mode: 'idle' | 'visual' | 'dh';
    phase: 'idle' | 'position' | 'orientation';
    elapsedMs: number;
    timeoutMs: number;
    targetPose: CartesianPose | null;
    remainingPosMm: number | null;
    remainingOriDeg: number | null;
    lastReason: string | null;
  };
}

interface VisualPositionIKConfig {
  maxIterations?: number;
  toleranceMm?: number;
  damping?: number;
  lambdaDecay?: number;
  lambdaGrow?: number;
  maxLambda?: number;
  maxStepDeg?: number;
  jacobianStepDeg?: number;
}

interface VisualPoseIKConfig extends VisualPositionIKConfig {
  oriToleranceRad?: number;
  orientationScale?: number;
  errorClampOri?: number;
  acceptBestEffort?: boolean;
  bestEffortPosToleranceMm?: number;
  bestEffortOriToleranceRad?: number;
}

interface VisualServoStepConfig {
  jacobianStepDeg?: number;
  damping?: number;
  maxDeltaDeg?: number;
  orientationScale?: number;
  orientationClampRad?: number;
  positionClampMm?: number;
  toleranceMm?: number;
  oriToleranceRad?: number;
  maxAllowedPositionMm?: number;
  minOriImprovementRad?: number;
  maxAcceptedPosRegressionMm?: number;
}

function normalizeAngleDelta(delta: number): number {
  let normalized = delta;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

function lerpAngle(start: number, end: number, t: number): number {
  return start + normalizeAngleDelta(end - start) * t;
}

function lerpPose(start: CartesianPose, end: CartesianPose, t: number): CartesianPose {
  return {
    position: [
      start.position[0] + (end.position[0] - start.position[0]) * t,
      start.position[1] + (end.position[1] - start.position[1]) * t,
      start.position[2] + (end.position[2] - start.position[2]) * t,
    ],
    euler: [
      lerpAngle(start.euler[0], end.euler[0], t),
      lerpAngle(start.euler[1], end.euler[1], t),
      lerpAngle(start.euler[2], end.euler[2], t),
    ],
  };
}

function getPoseFromJoints(joints: JointAngles, config: typeof KUKA_LIKE): CartesianPose {
  const jointsRad = joints.map((j) => (j * Math.PI) / 180) as JointAngles;
  const T = forwardKinematics(jointsRad, config);
  const { position, eulerZYX } = extractPose(T);
  return {
    position,
    euler: eulerZYX,
  };
}

function clampVectorMagnitude(vector: number[], maxNorm: number): number[] {
  const norm = Math.hypot(...vector);
  if (norm <= maxNorm || norm === 0) return vector;
  const scale = maxNorm / norm;
  return vector.map((value) => value * scale);
}

function clampDegStep(step: number[], maxStepDeg: number): number[] {
  const maxAbs = Math.max(...step.map((value) => Math.abs(value)));
  if (maxAbs <= maxStepDeg || maxAbs === 0) return step;
  const scale = maxStepDeg / maxAbs;
  return step.map((value) => value * scale);
}

function stepVectorTowardTarget(
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

function stepEulerTowardTarget(
  current: [number, number, number],
  target: [number, number, number],
  maxStepRad: number
): [number, number, number] {
  const delta: [number, number, number] = [
    normalizeAngleDelta(target[0] - current[0]),
    normalizeAngleDelta(target[1] - current[1]),
    normalizeAngleDelta(target[2] - current[2]),
  ];
  const norm = Math.hypot(...delta);
  if (norm <= maxStepRad || norm === 0) return [...target];
  const scale = maxStepRad / norm;
  return [
    current[0] + delta[0] * scale,
    current[1] + delta[1] * scale,
    current[2] + delta[2] * scale,
  ];
}

function quaternionToRotationMatrix(
  quaternion: [number, number, number, number]
): number[][] {
  const [x, y, z, w] = quaternion;
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;

  return [
    [1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy)],
    [2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx)],
    [2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)],
  ];
}

function rotationMatrixToEulerZYX(rotation: number[][]): [number, number, number] {
  const sy = -rotation[2][0];
  const cy = Math.sqrt(rotation[0][0] ** 2 + rotation[1][0] ** 2);
  const ry = Math.atan2(sy, cy);

  let rx: number;
  let rz: number;
  if (Math.abs(cy) > 1e-6) {
    rx = Math.atan2(rotation[2][1], rotation[2][2]);
    rz = Math.atan2(rotation[1][0], rotation[0][0]);
  } else {
    rx = Math.atan2(-rotation[1][2], rotation[1][1]);
    rz = 0;
  }

  return [rx, ry, rz];
}

function buildRotationFromEuler(euler: [number, number, number]): number[][] {
  return Matrix4x4.mat3Mul(
    Matrix4x4.mat3Mul(
      [
        [Math.cos(euler[2]), -Math.sin(euler[2]), 0],
        [Math.sin(euler[2]), Math.cos(euler[2]), 0],
        [0, 0, 1],
      ],
      [
        [Math.cos(euler[1]), 0, Math.sin(euler[1])],
        [0, 1, 0],
        [-Math.sin(euler[1]), 0, Math.cos(euler[1])],
      ]
    ),
    [
      [1, 0, 0],
      [0, Math.cos(euler[0]), -Math.sin(euler[0])],
      [0, Math.sin(euler[0]), Math.cos(euler[0])],
    ]
  );
}

function buildAxisRotation(
  axis: 'x' | 'y' | 'z',
  angleRad: number
): number[][] {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  switch (axis) {
    case 'x':
      return [
        [1, 0, 0],
        [0, c, -s],
        [0, s, c],
      ];
    case 'y':
      return [
        [c, 0, s],
        [0, 1, 0],
        [-s, 0, c],
      ];
    case 'z':
      return [
        [c, -s, 0],
        [s, c, 0],
        [0, 0, 1],
      ];
  }
}

function getTargetRotation(pose: CartesianPose): number[][] {
  return pose.rotation ?? buildRotationFromEuler(pose.euler);
}

function applyRotationIncrement(
  currentRotation: number[][],
  axis: 'rx' | 'ry' | 'rz',
  deltaRad: number,
  coordinateSystem: CoordinateSystem
): number[][] {
  const localAxis = axis === 'rx' ? 'x' : axis === 'ry' ? 'y' : 'z';
  const deltaRotation = buildAxisRotation(localAxis, deltaRad);
  return coordinateSystem === 'Tool'
    ? Matrix4x4.mat3Mul(currentRotation, deltaRotation)
    : Matrix4x4.mat3Mul(deltaRotation, currentRotation);
}

function mat3Mul(a: number[][], b: number[][]): number[][] {
  const result = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      for (let k = 0; k < 3; k++) {
        result[row][col] += a[row][k] * b[k][col];
      }
    }
  }
  return result;
}

function mat3Transpose(matrix: number[][]): number[][] {
  return [
    [matrix[0][0], matrix[1][0], matrix[2][0]],
    [matrix[0][1], matrix[1][1], matrix[2][1]],
    [matrix[0][2], matrix[1][2], matrix[2][2]],
  ];
}

function orientationErrorFromRotation(
  targetRotation: number[][],
  currentRotation: number[][]
): [number, number, number] {
  const relative = mat3Mul(targetRotation, mat3Transpose(currentRotation));
  return [
    (relative[2][1] - relative[1][2]) / 2,
    (relative[0][2] - relative[2][0]) / 2,
    (relative[1][0] - relative[0][1]) / 2,
  ];
}

function getGlbPoseForJoints(jointsDeg: JointAngles): VisualPose | null {
  const capture = (window as typeof window & {
    __GLB_capturePoseForJoints?: (angles: number[]) => VisualPoseCapture | null;
  }).__GLB_capturePoseForJoints;

  const result = capture?.(jointsDeg);
  if (!result) return null;

  const rotation = quaternionToRotationMatrix(result.quaternion);
  return {
    position: [
      result.position[0] * 1000,
      result.position[1] * 1000,
      result.position[2] * 1000,
    ],
    quaternion: result.quaternion,
    rotation,
    euler: rotationMatrixToEulerZYX(rotation),
  };
}

function estimateVisualPoseJacobian(
  jointsDeg: JointAngles,
  stepDeg: number
): number[][] | null {
  const basePose = getGlbPoseForJoints(jointsDeg);
  if (!basePose) return null;

  const jacobian = Array.from({ length: 6 }, () => Array(6).fill(0));

  for (let jointIndex = 0; jointIndex < 6; jointIndex++) {
    const offsetJoints = [...jointsDeg] as JointAngles;
    offsetJoints[jointIndex] += stepDeg;
    const offsetPose = getGlbPoseForJoints(offsetJoints);
    if (!offsetPose) return null;

    for (let axis = 0; axis < 3; axis++) {
      jacobian[axis][jointIndex] =
        (offsetPose.position[axis] - basePose.position[axis]) / stepDeg;
    }

    const orientationDelta = orientationErrorFromRotation(
      offsetPose.rotation,
      basePose.rotation
    );
    for (let axis = 0; axis < 3; axis++) {
      jacobian[axis + 3][jointIndex] = orientationDelta[axis] / stepDeg;
    }
  }

  return jacobian;
}

function solveVisualPoseIK(
  targetPose: CartesianPose,
  initialJointsDeg: JointAngles,
  config: typeof KUKA_LIKE,
  solverConfig: VisualPoseIKConfig = {}
): JointAngles | null {
  const cfg = {
    maxIterations: 30,
    toleranceMm: 1,
    oriToleranceRad: 0.01,
    damping: 0.6,
    lambdaDecay: 0.7,
    lambdaGrow: 2,
    maxLambda: 500,
    maxStepDeg: 4,
    jacobianStepDeg: 0.4,
    orientationScale: 300,
    errorClampOri: 0.3,
    acceptBestEffort: false,
    bestEffortPosToleranceMm: 4,
    bestEffortOriToleranceRad: 0.05,
    ...solverConfig,
  };

  const joints = [...initialJointsDeg] as JointAngles;
  let lambda = cfg.damping;
  const ranges = Object.values(config.dhParams).map((params) => params.thetaRange);
  const targetRotation = getTargetRotation(targetPose);
  let bestJoints: JointAngles | null = null;
  let bestPosNorm = Number.POSITIVE_INFINITY;
  let bestOriNorm = Number.POSITIVE_INFINITY;
  let bestWeightedError = Number.POSITIVE_INFINITY;

  for (let iter = 0; iter < cfg.maxIterations; iter++) {
    const currentPose = getGlbPoseForJoints(joints);
    if (!currentPose) return null;

    const errorPos = [
      targetPose.position[0] - currentPose.position[0],
      targetPose.position[1] - currentPose.position[1],
      targetPose.position[2] - currentPose.position[2],
    ];
    const rawOriError = orientationErrorFromRotation(targetRotation, currentPose.rotation);
    const clampedOriError = clampVectorMagnitude(rawOriError, cfg.errorClampOri) as [number, number, number];
    const posNorm = Math.hypot(...errorPos);
    const oriNorm = Math.hypot(...rawOriError);
    const currentWeightedError = Math.hypot(
      ...errorPos,
      clampedOriError[0] * cfg.orientationScale,
      clampedOriError[1] * cfg.orientationScale,
      clampedOriError[2] * cfg.orientationScale
    );

    if (
      currentWeightedError < bestWeightedError ||
      (Math.abs(currentWeightedError - bestWeightedError) < 1e-6 && posNorm < bestPosNorm)
    ) {
      bestWeightedError = currentWeightedError;
      bestPosNorm = posNorm;
      bestOriNorm = oriNorm;
      bestJoints = [...joints] as JointAngles;
    }

    if (
      posNorm < cfg.toleranceMm &&
      oriNorm < cfg.oriToleranceRad
    ) {
      return joints;
    }

    const jacobian = estimateVisualPoseJacobian(joints, cfg.jacobianStepDeg);
    if (!jacobian) return null;

    const weighted = jacobian.map((row, rowIndex) =>
      row.map((value) => (rowIndex >= 3 ? value * cfg.orientationScale : value))
    );
    const J = new Matrix(weighted);
    const Jt = J.transpose();
    const lhs = Jt.mmul(J).add(Matrix.eye(6).mul(lambda));
    const rhs = Jt.mmul(
      Matrix.columnVector([
        ...clampVectorMagnitude(errorPos, Math.max(100, Math.hypot(...errorPos))),
        clampedOriError[0] * cfg.orientationScale,
        clampedOriError[1] * cfg.orientationScale,
        clampedOriError[2] * cfg.orientationScale,
      ])
    );

    let deltaDeg = solve(lhs, rhs, true).to1DArray();
    deltaDeg = clampDegStep(deltaDeg, cfg.maxStepDeg);

    const candidate = joints.map((angleDeg, index) => {
      const next = angleDeg + deltaDeg[index];
      return Math.max(ranges[index][0], Math.min(ranges[index][1], next));
    }) as JointAngles;

    const candidatePose = getGlbPoseForJoints(candidate);
    if (!candidatePose) return null;
    const candidatePosError = [
      targetPose.position[0] - candidatePose.position[0],
      targetPose.position[1] - candidatePose.position[1],
      targetPose.position[2] - candidatePose.position[2],
    ];
    const candidateOriError = orientationErrorFromRotation(targetRotation, candidatePose.rotation);
    const candidateWeightedError = Math.hypot(
      ...candidatePosError,
      candidateOriError[0] * cfg.orientationScale,
      candidateOriError[1] * cfg.orientationScale,
      candidateOriError[2] * cfg.orientationScale
    );
    const candidatePosNorm = Math.hypot(...candidatePosError);
    const candidateOriNorm = Math.hypot(...candidateOriError);

    if (
      candidateWeightedError < bestWeightedError ||
      (Math.abs(candidateWeightedError - bestWeightedError) < 1e-6 && candidatePosNorm < bestPosNorm)
    ) {
      bestWeightedError = candidateWeightedError;
      bestPosNorm = candidatePosNorm;
      bestOriNorm = candidateOriNorm;
      bestJoints = [...candidate] as JointAngles;
    }

    if (candidateWeightedError < currentWeightedError) {
      for (let index = 0; index < 6; index++) joints[index] = candidate[index];
      lambda = Math.max(lambda * cfg.lambdaDecay, 1e-4);
    } else {
      lambda *= cfg.lambdaGrow;
    }

    if (lambda > cfg.maxLambda) {
      if (
        cfg.acceptBestEffort &&
        bestJoints &&
        bestPosNorm <= cfg.bestEffortPosToleranceMm &&
        bestOriNorm <= cfg.bestEffortOriToleranceRad
      ) {
        return bestJoints;
      }
      return null;
    }
  }

  if (
    cfg.acceptBestEffort &&
    bestJoints &&
    bestPosNorm <= cfg.bestEffortPosToleranceMm &&
    bestOriNorm <= cfg.bestEffortOriToleranceRad
  ) {
    return bestJoints;
  }

  return null;
}

function evaluateVisualPoseError(
  targetPose: CartesianPose,
  jointsDeg: JointAngles,
  orientationScale = 300
): {
  posMm: number;
  oriRad: number;
  weighted: number;
} | null {
  const pose = getGlbPoseForJoints(jointsDeg);
  if (!pose) return null;

  const targetRotation = getTargetRotation(targetPose);
  const posMm = Math.hypot(
    targetPose.position[0] - pose.position[0],
    targetPose.position[1] - pose.position[1],
    targetPose.position[2] - pose.position[2]
  );
  const oriError = orientationErrorFromRotation(targetRotation, pose.rotation);
  const oriRad = Math.hypot(...oriError);

  return {
    posMm,
    oriRad,
    weighted: Math.hypot(posMm, oriRad * orientationScale),
  };
}

function solveVisualPoseIKMultiSeed(
  targetPose: CartesianPose,
  initialJointsDeg: JointAngles,
  config: typeof KUKA_LIKE,
  solverConfig: VisualPoseIKConfig = {}
): JointAngles | null {
  const cfg = {
    orientationScale: 300,
    ...solverConfig,
  };

  const seeds: JointAngles[] = [[...initialJointsDeg] as JointAngles];
  const pushSeed = (mutator: (seed: JointAngles) => void) => {
    const seed = [...initialJointsDeg] as JointAngles;
    mutator(seed);
    seeds.push(seed);
  };

  for (const delta of [-4, 4]) {
    pushSeed((seed) => { seed[3] += delta; });
    pushSeed((seed) => { seed[4] += delta; });
    pushSeed((seed) => { seed[5] += delta; });
  }

  for (const delta of [-3, 3]) {
    pushSeed((seed) => { seed[2] += delta; seed[4] += delta; });
    pushSeed((seed) => { seed[3] += delta; seed[5] -= delta; });
    pushSeed((seed) => { seed[3] += delta; seed[4] -= delta; });
  }

  let bestSolution: JointAngles | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const seed of seeds) {
    const solved = solveVisualPoseIK(targetPose, seed, config, solverConfig);
    if (!solved) continue;

    const error = evaluateVisualPoseError(targetPose, solved, cfg.orientationScale);
    if (!error) continue;

    if (error.weighted < bestScore) {
      bestScore = error.weighted;
      bestSolution = solved;
    }
  }

  return bestSolution;
}

function solveVisualPositionOnlyIK(
  targetPosition: [number, number, number],
  initialJointsDeg: JointAngles,
  config: typeof KUKA_LIKE,
  solverConfig: VisualPositionIKConfig = {}
): JointAngles | null {
  const cfg = {
    maxIterations: 30,
    toleranceMm: 1,
    damping: 0.8,
    lambdaDecay: 0.7,
    lambdaGrow: 2,
    maxLambda: 200,
    maxStepDeg: 3,
    jacobianStepDeg: 0.3,
    ...solverConfig,
  };

  const joints = [...initialJointsDeg] as JointAngles;
  let lambda = cfg.damping;
  const ranges = Object.values(config.dhParams).map((params) => params.thetaRange);

  for (let iter = 0; iter < cfg.maxIterations; iter++) {
    const currentPose = getGlbPoseForJoints(joints);
    if (!currentPose) return null;

    const errorPos = [
      targetPosition[0] - currentPose.position[0],
      targetPosition[1] - currentPose.position[1],
      targetPosition[2] - currentPose.position[2],
    ];
    const posNorm = Math.hypot(...errorPos);
    if (posNorm < cfg.toleranceMm) return joints;

    const fullJacobian = estimateVisualPoseJacobian(joints, cfg.jacobianStepDeg);
    if (!fullJacobian) return null;
    const jacobian = fullJacobian.slice(0, 3);

    const J = new Matrix(jacobian);
    const Jt = J.transpose();
    const lhs = Jt.mmul(J).add(Matrix.eye(6).mul(lambda));
    const rhs = Jt.mmul(
      Matrix.columnVector(clampVectorMagnitude(errorPos, Math.max(100, posNorm)))
    );

    let deltaDeg = solve(lhs, rhs, true).to1DArray();
    deltaDeg = clampDegStep(deltaDeg, cfg.maxStepDeg);

    const candidate = joints.map((angleDeg, index) => {
      const next = angleDeg + deltaDeg[index];
      return Math.max(ranges[index][0], Math.min(ranges[index][1], next));
    }) as JointAngles;

    const candidatePose = getGlbPoseForJoints(candidate);
    if (!candidatePose) return null;
    const candidatePosError = [
      targetPosition[0] - candidatePose.position[0],
      targetPosition[1] - candidatePose.position[1],
      targetPosition[2] - candidatePose.position[2],
    ];
    const candidateNorm = Math.hypot(...candidatePosError);

    if (candidateNorm < posNorm) {
      for (let index = 0; index < 6; index++) joints[index] = candidate[index];
      lambda = Math.max(lambda * cfg.lambdaDecay, 1e-4);
    } else {
      lambda *= cfg.lambdaGrow;
    }

    if (lambda > cfg.maxLambda) return null;
  }

  return null;
}

function solveVisualServoStep(
  targetPose: CartesianPose,
  currentJointsDeg: JointAngles,
  config: typeof KUKA_LIKE,
  stepConfig: VisualServoStepConfig = {}
): {
  joints: JointAngles;
  remainingPosMm: number;
  remainingOriRad: number;
  improved: boolean;
} | null {
  const cfg = {
    jacobianStepDeg: 0.25,
    damping: 0.5,
    maxDeltaDeg: 1.4,
    orientationScale: 220,
    orientationClampRad: 0.12,
    positionClampMm: 15,
    toleranceMm: 1.0,
    oriToleranceRad: 0.03,
    maxAcceptedPosRegressionMm: 0.25,
    ...stepConfig,
  };

  const currentPose = getGlbPoseForJoints(currentJointsDeg);
  if (!currentPose) return null;

  const errorPos = [
    targetPose.position[0] - currentPose.position[0],
    targetPose.position[1] - currentPose.position[1],
    targetPose.position[2] - currentPose.position[2],
  ];
  const remainingPosMm = Math.hypot(...errorPos);

  const targetRotation = getTargetRotation(targetPose);
  const rawOriError = orientationErrorFromRotation(targetRotation, currentPose.rotation);
  const remainingOriRad = Math.hypot(...rawOriError);

  if (remainingPosMm <= cfg.toleranceMm && remainingOriRad <= cfg.oriToleranceRad) {
    return {
      joints: [...currentJointsDeg] as JointAngles,
      remainingPosMm,
      remainingOriRad,
      improved: true,
    };
  }

  const jacobian = estimateVisualPoseJacobian(currentJointsDeg, cfg.jacobianStepDeg);
  if (!jacobian) return null;

  const clampedPos = clampVectorMagnitude(errorPos, cfg.positionClampMm);
  const clampedOri = clampVectorMagnitude(rawOriError, cfg.orientationClampRad) as [number, number, number];
  const weighted = jacobian.map((row, rowIndex) =>
    row.map((value) => (rowIndex >= 3 ? value * cfg.orientationScale : value))
  );
  const J = new Matrix(weighted);
  const Jt = J.transpose();
  const lhs = Jt.mmul(J).add(Matrix.eye(6).mul(cfg.damping));
  const rhs = Jt.mmul(
    Matrix.columnVector([
      ...clampedPos,
      clampedOri[0] * cfg.orientationScale,
      clampedOri[1] * cfg.orientationScale,
      clampedOri[2] * cfg.orientationScale,
    ])
  );

  let deltaDeg = solve(lhs, rhs, true).to1DArray();
  deltaDeg = clampDegStep(deltaDeg, cfg.maxDeltaDeg);

  const ranges = Object.values(config.dhParams).map((params) => params.thetaRange);
  const candidate = currentJointsDeg.map((angleDeg, index) => {
    const next = angleDeg + deltaDeg[index];
    return Math.max(ranges[index][0], Math.min(ranges[index][1], next));
  }) as JointAngles;

  const candidatePose = getGlbPoseForJoints(candidate);
  if (!candidatePose) return null;

  const candidatePosError = [
    targetPose.position[0] - candidatePose.position[0],
    targetPose.position[1] - candidatePose.position[1],
    targetPose.position[2] - candidatePose.position[2],
  ];
  const candidatePosNorm = Math.hypot(...candidatePosError);
  const candidateOriError = orientationErrorFromRotation(targetRotation, candidatePose.rotation);
  const candidateOriNorm = Math.hypot(...candidateOriError);
  const currentWeightedError = Math.hypot(
    ...errorPos,
    rawOriError[0] * cfg.orientationScale,
    rawOriError[1] * cfg.orientationScale,
    rawOriError[2] * cfg.orientationScale
  );
  const candidateWeightedError = Math.hypot(
    ...candidatePosError,
    candidateOriError[0] * cfg.orientationScale,
    candidateOriError[1] * cfg.orientationScale,
    candidateOriError[2] * cfg.orientationScale
  );
  const positionImproved = candidatePosNorm <= remainingPosMm - 0.05;
  const positionAlmostSame =
    candidatePosNorm <= remainingPosMm + cfg.maxAcceptedPosRegressionMm;
  const orientationImproved = candidateOriNorm <= remainingOriRad;

  return {
    joints: candidate,
    remainingPosMm,
    remainingOriRad,
    improved:
      positionImproved ||
      (positionAlmostSame &&
        orientationImproved &&
        candidateWeightedError < currentWeightedError),
  };
}

function solveVisualOrientationNudge(
  targetPose: CartesianPose,
  currentJointsDeg: JointAngles,
  config: typeof KUKA_LIKE,
  stepConfig: VisualServoStepConfig = {}
): {
  joints: JointAngles;
  remainingPosMm: number;
  remainingOriRad: number;
  improved: boolean;
} | null {
  const cfg = {
    jacobianStepDeg: 0.2,
    damping: 0.4,
    maxDeltaDeg: 0.35,
    orientationScale: 650,
    orientationClampRad: 0.1,
    positionClampMm: 0.8,
    toleranceMm: 1.2,
    oriToleranceRad: 0.015,
    maxAllowedPositionMm: 2.5,
    minOriImprovementRad: 0.002,
    ...stepConfig,
  };

  const currentPose = getGlbPoseForJoints(currentJointsDeg);
  if (!currentPose) return null;

  const errorPos = [
    targetPose.position[0] - currentPose.position[0],
    targetPose.position[1] - currentPose.position[1],
    targetPose.position[2] - currentPose.position[2],
  ];
  const remainingPosMm = Math.hypot(...errorPos);

  const targetRotation = getTargetRotation(targetPose);
  const rawOriError = orientationErrorFromRotation(targetRotation, currentPose.rotation);
  const remainingOriRad = Math.hypot(...rawOriError);

  const jacobian = estimateVisualPoseJacobian(currentJointsDeg, cfg.jacobianStepDeg);
  if (!jacobian) return null;

  const clampedPos = clampVectorMagnitude(errorPos, cfg.positionClampMm);
  const clampedOri = clampVectorMagnitude(rawOriError, cfg.orientationClampRad) as [number, number, number];
  const weighted = jacobian.map((row, rowIndex) =>
    row.map((value) => (rowIndex >= 3 ? value * cfg.orientationScale : value))
  );
  const J = new Matrix(weighted);
  const Jt = J.transpose();
  const lhs = Jt.mmul(J).add(Matrix.eye(6).mul(cfg.damping));
  const rhs = Jt.mmul(
    Matrix.columnVector([
      ...clampedPos,
      clampedOri[0] * cfg.orientationScale,
      clampedOri[1] * cfg.orientationScale,
      clampedOri[2] * cfg.orientationScale,
    ])
  );

  let deltaDeg = solve(lhs, rhs, true).to1DArray();
  deltaDeg = clampDegStep(deltaDeg, cfg.maxDeltaDeg);

  const ranges = Object.values(config.dhParams).map((params) => params.thetaRange);
  const candidate = currentJointsDeg.map((angleDeg, index) => {
    const next = angleDeg + deltaDeg[index];
    return Math.max(ranges[index][0], Math.min(ranges[index][1], next));
  }) as JointAngles;

  const candidatePose = getGlbPoseForJoints(candidate);
  if (!candidatePose) return null;

  const candidatePosError = [
    targetPose.position[0] - candidatePose.position[0],
    targetPose.position[1] - candidatePose.position[1],
    targetPose.position[2] - candidatePose.position[2],
  ];
  const candidatePosNorm = Math.hypot(...candidatePosError);
  const candidateOriError = orientationErrorFromRotation(targetRotation, candidatePose.rotation);
  const candidateOriNorm = Math.hypot(...candidateOriError);

  const improved =
    candidateOriNorm < remainingOriRad - cfg.minOriImprovementRad &&
    candidatePosNorm <= cfg.maxAllowedPositionMm;

  return {
    joints: candidate,
    remainingPosMm,
    remainingOriRad,
    improved,
  };
}

function solveVisualNullspaceOrientationStep(
  targetPose: CartesianPose,
  currentJointsDeg: JointAngles,
  config: typeof KUKA_LIKE,
  stepConfig: VisualServoStepConfig = {}
): {
  joints: JointAngles;
  remainingPosMm: number;
  remainingOriRad: number;
  improved: boolean;
} | null {
  const cfg = {
    jacobianStepDeg: 0.2,
    damping: 0.4,
    maxDeltaDeg: 0.35,
    orientationClampRad: 0.1,
    positionClampMm: 0.8,
    maxAllowedPositionMm: 2.5,
    minOriImprovementRad: 0.002,
    ...stepConfig,
  };

  const currentPose = getGlbPoseForJoints(currentJointsDeg);
  if (!currentPose) return null;

  const errorPos = [
    targetPose.position[0] - currentPose.position[0],
    targetPose.position[1] - currentPose.position[1],
    targetPose.position[2] - currentPose.position[2],
  ];
  const remainingPosMm = Math.hypot(...errorPos);
  const targetRotation = getTargetRotation(targetPose);
  const rawOriError = orientationErrorFromRotation(targetRotation, currentPose.rotation);
  const remainingOriRad = Math.hypot(...rawOriError);

  const jacobian = estimateVisualPoseJacobian(currentJointsDeg, cfg.jacobianStepDeg);
  if (!jacobian) return null;

  const Jp = new Matrix(jacobian.slice(0, 3));
  const Jo = new Matrix(jacobian.slice(3, 6));
  const Jpt = Jp.transpose();
  const pinvLeft = Jp.mmul(Jpt).add(Matrix.eye(3).mul(cfg.damping));
  const JpPlus = Jpt.mmul(solve(pinvLeft, Matrix.eye(3), true));
  const nullspace = Matrix.eye(6).sub(JpPlus.mmul(Jp));
  const projectedJo = Jo.mmul(nullspace);

  const clampedOri = clampVectorMagnitude(rawOriError, cfg.orientationClampRad);
  const clampedPos = clampVectorMagnitude(errorPos, cfg.positionClampMm);

  const lhs = projectedJo.transpose().mmul(projectedJo).add(Matrix.eye(6).mul(cfg.damping));
  const rhs = projectedJo.transpose().mmul(Matrix.columnVector(clampedOri));
  const nullspaceStep = solve(lhs, rhs, true).to1DArray();
  const positionStep = JpPlus.mmul(Matrix.columnVector(clampedPos)).to1DArray();

  let deltaDeg = positionStep.map((value, index) => value + nullspaceStep[index]);
  deltaDeg = clampDegStep(deltaDeg, cfg.maxDeltaDeg);

  const ranges = Object.values(config.dhParams).map((params) => params.thetaRange);
  const candidate = currentJointsDeg.map((angleDeg, index) => {
    const next = angleDeg + deltaDeg[index];
    return Math.max(ranges[index][0], Math.min(ranges[index][1], next));
  }) as JointAngles;

  const candidatePose = getGlbPoseForJoints(candidate);
  if (!candidatePose) return null;

  const candidatePosError = [
    targetPose.position[0] - candidatePose.position[0],
    targetPose.position[1] - candidatePose.position[1],
    targetPose.position[2] - candidatePose.position[2],
  ];
  const candidatePosNorm = Math.hypot(...candidatePosError);
  const candidateOriError = orientationErrorFromRotation(targetRotation, candidatePose.rotation);
  const candidateOriNorm = Math.hypot(...candidateOriError);

  return {
    joints: candidate,
    remainingPosMm,
    remainingOriRad,
    improved:
      candidateOriNorm < remainingOriRad - cfg.minOriImprovementRad &&
      candidatePosNorm <= cfg.maxAllowedPositionMm,
  };
}

function solveVisualOrientationNeighborhood(
  targetPose: CartesianPose,
  currentJointsDeg: JointAngles,
  config: typeof KUKA_LIKE,
  stepConfig: VisualServoStepConfig = {}
): {
  joints: JointAngles;
  remainingPosMm: number;
  remainingOriRad: number;
  improved: boolean;
} | null {
  const base = solveVisualOrientationNudge(
    targetPose,
    currentJointsDeg,
    config,
    stepConfig
  );
  if (!base) return null;

  const cfg = {
    maxDeltaDeg: 0.35,
    maxAllowedPositionMm: 2.5,
    minOriImprovementRad: 0.002,
    ...stepConfig,
  };

  const currentPose = getGlbPoseForJoints(currentJointsDeg);
  if (!currentPose) return base;
  const targetRotation = getTargetRotation(targetPose);
  const currentOriError = orientationErrorFromRotation(targetRotation, currentPose.rotation);
  const currentOriNorm = Math.hypot(...currentOriError);
  const currentPosNorm = Math.hypot(
    targetPose.position[0] - currentPose.position[0],
    targetPose.position[1] - currentPose.position[1],
    targetPose.position[2] - currentPose.position[2]
  );

  let best = base.improved ? base : null;
  const jointIndices = [3, 4, 5, 2] as const;
  const deltaValues = [cfg.maxDeltaDeg, cfg.maxDeltaDeg * 0.6];

  const tryCandidate = (candidateJoints: JointAngles) => {
    const pose = getGlbPoseForJoints(candidateJoints);
    if (!pose) return;
    const posNorm = Math.hypot(
      targetPose.position[0] - pose.position[0],
      targetPose.position[1] - pose.position[1],
      targetPose.position[2] - pose.position[2]
    );
    if (posNorm > cfg.maxAllowedPositionMm) return;

    const oriError = orientationErrorFromRotation(targetRotation, pose.rotation);
    const oriNorm = Math.hypot(...oriError);
    const improved = oriNorm < currentOriNorm - cfg.minOriImprovementRad;
    if (!improved) return;

    if (
      !best ||
      oriNorm < best.remainingOriRad - 1e-6 ||
      (Math.abs(oriNorm - best.remainingOriRad) < 1e-6 && posNorm < best.remainingPosMm)
    ) {
      best = {
        joints: candidateJoints,
        remainingPosMm: currentPosNorm,
        remainingOriRad: currentOriNorm,
        improved: true,
      };
    }
  };

  for (const jointIndex of jointIndices) {
    for (const delta of deltaValues) {
      for (const sign of [-1, 1] as const) {
        const candidate = [...currentJointsDeg] as JointAngles;
        candidate[jointIndex] += sign * delta;
        tryCandidate(candidate);
      }
    }
  }

  for (let firstIndex = 0; firstIndex < jointIndices.length; firstIndex++) {
    for (let secondIndex = firstIndex + 1; secondIndex < jointIndices.length; secondIndex++) {
      for (const delta of deltaValues) {
        for (const firstSign of [-1, 1] as const) {
          for (const secondSign of [-1, 1] as const) {
            const candidate = [...currentJointsDeg] as JointAngles;
            candidate[jointIndices[firstIndex]] += firstSign * delta;
            candidate[jointIndices[secondIndex]] += secondSign * delta;
            tryCandidate(candidate);
          }
        }
      }
    }
  }

  return best ?? base;
}

function solveVisualOrientationMultiSeed(
  targetPose: CartesianPose,
  currentJointsDeg: JointAngles,
  config: typeof KUKA_LIKE,
  stepConfig: VisualServoStepConfig = {}
): {
  joints: JointAngles;
  remainingPosMm: number;
  remainingOriRad: number;
  improved: boolean;
} | null {
  const cfg = {
    maxDeltaDeg: 0.35,
    maxAllowedPositionMm: 2.5,
    minOriImprovementRad: 0.002,
    ...stepConfig,
  };

  const currentPose = getGlbPoseForJoints(currentJointsDeg);
  if (!currentPose) return null;
  const targetRotation = getTargetRotation(targetPose);
  const currentPosNorm = Math.hypot(
    targetPose.position[0] - currentPose.position[0],
    targetPose.position[1] - currentPose.position[1],
    targetPose.position[2] - currentPose.position[2]
  );
  const currentOriError = orientationErrorFromRotation(targetRotation, currentPose.rotation);
  const currentOriNorm = Math.hypot(...currentOriError);

  let best: {
    joints: JointAngles;
    remainingPosMm: number;
    remainingOriRad: number;
    improved: boolean;
  } | null = null;

  const seeds: JointAngles[] = [[...currentJointsDeg] as JointAngles];
  const wristSeedIndices = [3, 4, 5] as const;
  for (const jointIndex of wristSeedIndices) {
    for (const sign of [-1, 1] as const) {
      const seed = [...currentJointsDeg] as JointAngles;
      seed[jointIndex] += sign * cfg.maxDeltaDeg;
      seeds.push(seed);
    }
  }

  for (const seed of seeds) {
    const candidate = solveVisualOrientationNeighborhood(
      targetPose,
      seed,
      config,
      cfg
    );
    if (!candidate?.improved) continue;

    const pose = getGlbPoseForJoints(candidate.joints);
    if (!pose) continue;
    const posNorm = Math.hypot(
      targetPose.position[0] - pose.position[0],
      targetPose.position[1] - pose.position[1],
      targetPose.position[2] - pose.position[2]
    );
    if (posNorm > cfg.maxAllowedPositionMm) continue;

    const oriError = orientationErrorFromRotation(targetRotation, pose.rotation);
    const oriNorm = Math.hypot(...oriError);
    if (oriNorm >= currentOriNorm - cfg.minOriImprovementRad) continue;

    if (
      !best ||
      oriNorm < best.remainingOriRad - 1e-6 ||
      (Math.abs(oriNorm - best.remainingOriRad) < 1e-6 && posNorm < best.remainingPosMm)
    ) {
      best = {
        joints: candidate.joints,
        remainingPosMm: currentPosNorm,
        remainingOriRad: currentOriNorm,
        improved: true,
      };
    }
  }

  return best;
}

function pickNextOrientationLock(
  remainingOriRad: number,
  currentEuler: [number, number, number],
  fallbackEuler: [number, number, number] | null
): [number, number, number] {
  // 只有在姿态误差已经很小的时候，才允许用当前姿态覆盖后续位置步进的锁定姿态。
  // 否则继续沿用上一次稳定姿态，避免误把“已漂移姿态”当成新的世界直线基准。
  if (remainingOriRad < 0.02) {
    return [...currentEuler];
  }
  if (fallbackEuler) {
    return [...fallbackEuler];
  }
  return [...currentEuler];
}

function pickNextOrientationRotation(
  remainingOriRad: number,
  currentRotation: number[][],
  fallbackRotation: number[][] | null
): number[][] {
  if (remainingOriRad < 0.02) {
    return currentRotation.map((row) => [...row]);
  }
  if (fallbackRotation) {
    return fallbackRotation.map((row) => [...row]);
  }
  return currentRotation.map((row) => [...row]);
}

export function useRobotKinematics() {
  const config = KUKA_LIKE;

  const [joints, setJoints] = useState<JointAngles>(DEFAULT_JOINTS);
  const [displayJoints, setDisplayJoints] = useState<JointAngles>(DEFAULT_JOINTS);
  const [originJoints, setOriginJoints] = useState<JointAngles | null>(null);
  const [coordinateSystem, setCoordinateSystem] = useState<CoordinateSystem>('World');
  const [jointStep, setJointStep] = useState(1);
  const [posStep, setPosStep] = useState(1);
  const [rotStep, setRotStep] = useState(1);
  const [selectedTool, setSelectedTool] = useState('无');
  const [toolList, setToolList] = useState<string[]>([]);
  const [status, setStatus] = useState<StatusType>('ready');
  const [isAnimating, setIsAnimating] = useState(false);
  const isAnimatingRef = useRef(false);
  // 轨迹记录（直接从模型采样，与缩放无关）
  const [trajectory, setTrajectory] = useState<[number, number, number][]>([]);

  // ===== Refs for real-time access during RAF loops =====
  const jointsRef = useRef<JointAngles>(DEFAULT_JOINTS);
  const displayJointsRef = useRef<JointAngles>(DEFAULT_JOINTS);

  useEffect(() => { jointsRef.current = joints; }, [joints]);
  useEffect(() => { displayJointsRef.current = displayJoints; }, [displayJoints]);

  // 动画 refs
  const animIdRef = useRef<number>(0);
  const targetJointsRef = useRef<number[]>([0, 0, 0, 0, 0, 0]);
  const startJointsRef = useRef<number[]>([0, 0, 0, 0, 0, 0]);
  const startTimeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const isLongPressRef = useRef(false);
  const cartesianStartPoseRef = useRef<CartesianPose | null>(null);
  const cartesianTargetPoseRef = useRef<CartesianPose | null>(null);
  const cartesianDurationRef = useRef<number>(DEFAULT_MOTION_CONFIG.ikAnimDuration);
  const cartesianUseVisualPositionRef = useRef(false);
  const cartesianPreserveOrientationRef = useRef(true);

  // 长按目标累加：追踪长按会话的累积目标，避免每tick从当前位置重新计算
  const longPressDHTargetRef = useRef<[number, number, number] | null>(null);
  const longPressEulerRef = useRef<[number, number, number] | null>(null);
  const longPressToolRotationRef = useRef<number[][] | null>(null);
  const longPressKeyRef = useRef<string>('');
  const positionOrientationLockRef = useRef<[number, number, number] | null>(null);
  const positionOrientationRotationLockRef = useRef<number[][] | null>(null);
  const cartesianVisualTimeoutRef = useRef<number>(0);
  const cartesianPositionOnlyCompleteRef = useRef(false);
  const cartesianPositionOnlyNudgeBudgetRef = useRef(0);
  const cartesianOrientationRecoveryBudgetRef = useRef(0);
  const cartesianPhaseRebalanceBudgetRef = useRef(0);
  const cartesianPhaseRef = useRef<'idle' | 'position' | 'orientation'>('idle');
  const cartesianLastReasonRef = useRef<string | null>(null);
  const cartesianRemainingPosRef = useRef<number | null>(null);
  const cartesianRemainingOriRef = useRef<number | null>(null);

  const visualPose = useMemo<VisualPose | null>(() => {
    return getGlbPoseForJoints(displayJoints);
  }, [displayJoints]);

  // 计算末端位姿（基于当前显示角度）
  const endEffectorPose = useMemo(() => {
    if (visualPose) {
      return {
        position: visualPose.position.map((value) => Math.round(value * 10) / 10) as [number, number, number],
        euler: visualPose.euler.map((rad) => Math.round((rad * 180) / Math.PI * 10) / 10) as [number, number, number],
        rotation: visualPose.rotation,
        matrix: null,
      };
    }

    const jointsRad = displayJoints.map((j) => (j * Math.PI) / 180) as JointAngles;
    const T = forwardKinematics(jointsRad, config);
    const { position, eulerZYX } = extractPose(T);
    return {
      position: position.map((v) => Math.round(v * 10) / 10) as [number, number, number],
      euler: eulerZYX.map((rad) => Math.round((rad * 180) / Math.PI * 10) / 10) as [number, number, number],
      rotation: T.getRotation(),
      matrix: T,
    };
  }, [config, displayJoints, visualPose]);

  // 用真实 GLB 法兰位姿换算为米，供 UI 显示/填入当前坐标
  const glbPosition = useMemo<[number, number, number] | null>(() => {
    if (!visualPose) return null;
    const [x, y, z] = visualPose.position;
    return [x / 1000, y / 1000, z / 1000];
  }, [visualPose]);

  // 添加轨迹点（由 GLBRobotArm 在关节更新后直接回调，使用模型采样坐标）
  const addTrajectoryPoint = useCallback((pos: [number, number, number]) => {
    setTrajectory((prev) => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        const dist = Math.sqrt(
          (pos[0] - last[0]) ** 2 + (pos[1] - last[1]) ** 2 + (pos[2] - last[2]) ** 2
        );
        if (dist < 0.001) return prev;
      }
      const next = [...prev, pos];
      if (next.length > 200) next.shift();
      return next;
    });
  }, []);

  // 停止动画
  const stopAnimation = useCallback(() => {
    cancelAnimationFrame(animIdRef.current);
    animIdRef.current = 0;
    cartesianStartPoseRef.current = null;
    cartesianTargetPoseRef.current = null;
    cartesianDurationRef.current = DEFAULT_MOTION_CONFIG.ikAnimDuration;
    cartesianUseVisualPositionRef.current = false;
    cartesianPreserveOrientationRef.current = true;
    cartesianVisualTimeoutRef.current = 0;
    cartesianPositionOnlyCompleteRef.current = false;
    cartesianPositionOnlyNudgeBudgetRef.current = 0;
    cartesianOrientationRecoveryBudgetRef.current = 0;
    cartesianPhaseRebalanceBudgetRef.current = 0;
    cartesianPhaseRef.current = 'idle';
    setIsAnimating(false); isAnimatingRef.current = false;
  }, []);

  // 缓动动画循环
  const runEasedAnimation = useCallback(() => {
    const now = performance.now();
    const elapsed = now - startTimeRef.current;
    const duration = cartesianDurationRef.current;
    const t = Math.min(elapsed / duration, 1);

    const next = lerpJoints(startJointsRef.current, targetJointsRef.current, t);
    setDisplayJoints(next as JointAngles);
    setJoints(next as JointAngles);
    // 同步 ref，避免 useEffect 延迟导致的竞态
    displayJointsRef.current = next as JointAngles;
    jointsRef.current = next as JointAngles;

    if (t < 1) {
      animIdRef.current = requestAnimationFrame(runEasedAnimation);
    } else {
      animIdRef.current = 0;
      setIsAnimating(false); isAnimatingRef.current = false;
      setStatus('complete');
      setTimeout(() => setStatus('ready'), 500);
    }
  }, []);

  // 速度限制动画循环
  const runSpeedLimitedAnimation = useCallback(() => {
    const now = performance.now();
    const deltaTime = lastTimeRef.current ? now - lastTimeRef.current : 16;
    lastTimeRef.current = now;

    const current = displayJointsRef.current;
    const next = updateJointAngles(
      [...current],
      targetJointsRef.current,
      deltaTime,
      DEFAULT_MOTION_CONFIG.jointSpeedLimit
    );
    setDisplayJoints(next as JointAngles);
    setJoints(next as JointAngles);
    // 同步 ref，避免 useEffect 延迟导致的竞态
    displayJointsRef.current = next as JointAngles;
    jointsRef.current = next as JointAngles;

    const allClose = next.every((v, i) => Math.abs(v - targetJointsRef.current[i]) < 0.1);
    if (!allClose) {
      animIdRef.current = requestAnimationFrame(runSpeedLimitedAnimation);
    } else {
      animIdRef.current = 0;
      setIsAnimating(false); isAnimatingRef.current = false;
      setStatus('complete');
      setTimeout(() => setStatus('ready'), 500);
    }
  }, []);

  // 笛卡尔插补动画：沿世界坐标直线/定姿态推进，再逐帧求解IK
  const runCartesianAnimation = useCallback(() => {
    const startPose = cartesianStartPoseRef.current;
    const targetPose = cartesianTargetPoseRef.current;

    if (!startPose || !targetPose) {
      stopAnimation();
      return;
    }

    const now = performance.now();
    const elapsed = now - startTimeRef.current;
    const duration = cartesianDurationRef.current;
    const t = Math.min(elapsed / duration, 1);
    let nextDeg: JointAngles | null = null;
    let visualRemainingPos = Number.POSITIVE_INFINITY;
    let visualRemainingOri = Number.POSITIVE_INFINITY;
    if (cartesianUseVisualPositionRef.current) {
      const preserveOrientation = cartesianPreserveOrientationRef.current;
      const currentVisualPose =
        getGlbPoseForJoints(displayJointsRef.current) ?? startPose;
      const targetRotation = getTargetRotation(targetPose);
      const remainingPos = Math.hypot(
        targetPose.position[0] - currentVisualPose.position[0],
        targetPose.position[1] - currentVisualPose.position[1],
        targetPose.position[2] - currentVisualPose.position[2]
      );
      const remainingOriError = preserveOrientation
        ? orientationErrorFromRotation(
            targetRotation,
            currentVisualPose.rotation
          )
        : ([0, 0, 0] as [number, number, number]);
      const remainingOri = Math.hypot(...remainingOriError);
      visualRemainingPos = remainingPos;
      visualRemainingOri = remainingOri;
      cartesianRemainingPosRef.current = remainingPos;
      cartesianRemainingOriRef.current = remainingOri;
      const phase = cartesianPhaseRef.current;

      if (
        remainingPos < 1.2 &&
        (!preserveOrientation || remainingOri < 0.03)
      ) {
        if (preserveOrientation) {
          positionOrientationLockRef.current = pickNextOrientationLock(
            remainingOri,
            currentVisualPose.euler,
            positionOrientationLockRef.current
          );
          positionOrientationRotationLockRef.current = pickNextOrientationRotation(
            remainingOri,
            currentVisualPose.rotation,
            positionOrientationRotationLockRef.current
          );
        } else {
          positionOrientationLockRef.current = null;
          positionOrientationRotationLockRef.current = null;
        }
        animIdRef.current = 0;
        cartesianStartPoseRef.current = null;
        cartesianTargetPoseRef.current = null;
        cartesianUseVisualPositionRef.current = false;
        cartesianPreserveOrientationRef.current = true;
        cartesianVisualTimeoutRef.current = 0;
        cartesianPositionOnlyCompleteRef.current = false;
        cartesianLastReasonRef.current = preserveOrientation
          ? 'visual_target_reached'
          : 'visual_position_target_reached';
        setIsAnimating(false); isAnimatingRef.current = false;
        setStatus('complete');
        setTimeout(() => setStatus('ready'), 500);
        return;
      }

      if (preserveOrientation && phase === 'position' && remainingPos < 2.2) {
        cartesianPhaseRef.current = 'orientation';
        cartesianLastReasonRef.current = 'visual_switch_to_orientation_phase';
      }

      if (!preserveOrientation) {
        const stepProfiles = [
          { posMm: 12, toleranceMm: 1.2, maxStepDeg: 1.2 },
          { posMm: 6, toleranceMm: 1.0, maxStepDeg: 0.8 },
          { posMm: 3, toleranceMm: 0.8, maxStepDeg: 0.45 },
          { posMm: 1.5, toleranceMm: 0.6, maxStepDeg: 0.25 },
        ];
        for (const profile of stepProfiles) {
          const steppedTarget = stepVectorTowardTarget(
            currentVisualPose.position,
            targetPose.position,
            profile.posMm
          );
          nextDeg = solveVisualPositionOnlyIK(
            steppedTarget,
            displayJointsRef.current,
            config,
            {
              maxIterations: 18,
              toleranceMm: profile.toleranceMm,
              damping: 0.8,
              maxLambda: 180,
              maxStepDeg: profile.maxStepDeg,
              jacobianStepDeg: 0.3,
            }
          );
          if (nextDeg) {
            cartesianLastReasonRef.current = 'visual_position_only_step';
            break;
          }
        }

        if (!nextDeg && remainingPos < 8) {
          nextDeg = solveVisualPositionOnlyIK(
            targetPose.position,
            displayJointsRef.current,
            config,
            {
              maxIterations: 24,
              toleranceMm: 0.8,
              damping: 0.8,
              maxLambda: 220,
              maxStepDeg: 0.35,
              jacobianStepDeg: 0.3,
            }
          );
          if (nextDeg) {
            cartesianLastReasonRef.current = 'visual_position_only_final_nudge';
          }
        }
      } else if (cartesianPhaseRef.current === 'position') {
        const stepProfiles = [
          { posMm: 8, oriRad: 0.010, maxDeltaDeg: 0.9, orientationScale: 300, positionClampMm: 8 },
          { posMm: 4, oriRad: 0.006, maxDeltaDeg: 0.7, orientationScale: 340, positionClampMm: 5 },
          { posMm: 2, oriRad: 0.003, maxDeltaDeg: 0.5, orientationScale: 380, positionClampMm: 3 },
          { posMm: 1, oriRad: 0.0015, maxDeltaDeg: 0.3, orientationScale: 420, positionClampMm: 1.5 },
        ];
        for (const profile of stepProfiles) {
          const steppedPose: CartesianPose = {
            position: stepVectorTowardTarget(
              currentVisualPose.position,
              targetPose.position,
              profile.posMm
            ),
            euler: targetPose.euler,
            rotation: targetRotation,
          };
          const servo = solveVisualServoStep(
            steppedPose,
            displayJointsRef.current,
            config,
            {
              damping: 0.8,
              jacobianStepDeg: 0.3,
              maxDeltaDeg: profile.maxDeltaDeg,
              orientationScale: profile.orientationScale,
              positionClampMm: profile.positionClampMm,
              orientationClampRad: profile.oriRad,
              toleranceMm: 1.2,
              oriToleranceRad: 0.03,
            }
          );
          if (servo?.improved) {
            nextDeg = servo.joints;
            cartesianLastReasonRef.current = 'visual_servo_step';
            break;
          }
          if (
            !nextDeg &&
            cartesianPositionOnlyNudgeBudgetRef.current > 0 &&
            remainingPos < 18 &&
            remainingOri < 0.06
          ) {
            const nudge = solveVisualPositionOnlyIK(
              steppedPose.position,
              displayJointsRef.current,
              config,
              {
                maxIterations: 10,
                toleranceMm: 1.2,
                damping: 0.8,
                maxLambda: 120,
                maxStepDeg: 0.4,
                jacobianStepDeg: 0.3,
              }
            );
            if (nudge) {
              nextDeg = nudge;
              cartesianPositionOnlyNudgeBudgetRef.current -= 1;
              cartesianLastReasonRef.current = 'visual_midstep_position_nudge';
              break;
            }
          }
          if (!nextDeg && remainingOri < 0.12) {
            const fallback = solveVisualPoseIK(
              {
                position: steppedPose.position,
                euler: targetPose.euler,
                rotation: targetRotation,
              },
              displayJointsRef.current,
              config,
              {
                maxIterations: 16,
                toleranceMm: 1.2,
                oriToleranceRad: 0.02,
                damping: 0.8,
                maxLambda: 150,
                maxStepDeg: 2,
                jacobianStepDeg: 0.3,
                orientationScale: 250,
                errorClampOri: 0.2,
              }
            );
            if (fallback) {
              nextDeg = fallback;
              cartesianLastReasonRef.current = 'visual_midstep_hold_orientation_fallback';
              break;
            }
          }
        }
        if (!nextDeg && remainingPos < 6 && remainingOri < 0.025) {
          nextDeg = solveVisualPositionOnlyIK(
            targetPose.position,
            displayJointsRef.current,
            config,
            {
              maxIterations: 20,
              toleranceMm: 0.8,
              damping: 0.8,
              maxLambda: 200,
              maxStepDeg: 0.25,
              jacobianStepDeg: 0.3,
            }
          );
          if (nextDeg) {
            cartesianLastReasonRef.current = 'visual_position_only_fallback';
            cartesianPositionOnlyCompleteRef.current = true;
          }
        }
      } else {
        const orientationRecoveryProfiles = [
          {
            lastReason: 'visual_orientation_phase_recovery',
            config: {
              damping: 0.6,
              jacobianStepDeg: 0.2,
              maxDeltaDeg: 0.5,
              orientationScale: 760,
              orientationClampRad: 0.08,
              positionClampMm: 1.0,
              toleranceMm: 1.0,
              oriToleranceRad: 0.015,
              maxAllowedPositionMm: 2.2,
              minOriImprovementRad: 0.003,
            },
          },
          {
            lastReason: 'visual_orientation_phase_relaxed_recovery',
            config: {
              damping: 0.6,
              jacobianStepDeg: 0.2,
              maxDeltaDeg: 0.6,
              orientationScale: 560,
              orientationClampRad: 0.1,
              positionClampMm: 2.0,
              toleranceMm: 1.0,
              oriToleranceRad: 0.015,
              maxAllowedPositionMm: 4.0,
              minOriImprovementRad: 0.001,
            },
          },
        ] as const;

        if (!nextDeg && cartesianOrientationRecoveryBudgetRef.current > 0) {
          const nullspaceRecovery = solveVisualNullspaceOrientationStep(
            targetPose,
            displayJointsRef.current,
            config,
            {
              damping: 0.5,
              jacobianStepDeg: 0.2,
              maxDeltaDeg: 0.45,
              orientationClampRad: 0.1,
              positionClampMm: 0.8,
              maxAllowedPositionMm: 2.8,
              minOriImprovementRad: 0.002,
            }
          );
          if (nullspaceRecovery?.improved) {
            nextDeg = nullspaceRecovery.joints;
            cartesianOrientationRecoveryBudgetRef.current = Math.max(
              cartesianOrientationRecoveryBudgetRef.current - 1,
              0
            );
            cartesianLastReasonRef.current = 'visual_orientation_nullspace_recovery';
          }
        }

        for (const recoveryProfile of orientationRecoveryProfiles) {
          if (nextDeg || cartesianOrientationRecoveryBudgetRef.current <= 0) break;
          const orientationNudge = solveVisualOrientationMultiSeed(
            targetPose,
            displayJointsRef.current,
            config,
            recoveryProfile.config
          );
          if (orientationNudge?.improved) {
            nextDeg = orientationNudge.joints;
            cartesianOrientationRecoveryBudgetRef.current = Math.max(
              cartesianOrientationRecoveryBudgetRef.current - 1,
              0
            );
            cartesianLastReasonRef.current = recoveryProfile.lastReason;
          }
        }

        if (!nextDeg && cartesianOrientationRecoveryBudgetRef.current > 0) {
          const poseRecovery = solveVisualPoseIKMultiSeed(
            targetPose,
            displayJointsRef.current,
            config,
            {
              maxIterations: 18,
              toleranceMm: 1.0,
              oriToleranceRad: 0.015,
              damping: 0.6,
              maxLambda: 160,
              maxStepDeg: 0.6,
              jacobianStepDeg: 0.25,
              orientationScale: 540,
              errorClampOri: 0.1,
              acceptBestEffort: true,
              bestEffortPosToleranceMm: 4.2,
              bestEffortOriToleranceRad: 0.05,
            }
          );
          if (poseRecovery) {
            nextDeg = poseRecovery;
            cartesianOrientationRecoveryBudgetRef.current = Math.max(
              cartesianOrientationRecoveryBudgetRef.current - 1,
              0
            );
            cartesianLastReasonRef.current = 'visual_orientation_phase_pose_recovery';
          }
        }
      }
    } else {
      const nextPose = lerpPose(startPose, targetPose, t);
      const currentJointsRad = displayJointsRef.current.map((j) => (j * Math.PI) / 180) as JointAngles;
      const solved = solveIK(nextPose.position, nextPose.euler, currentJointsRad, config);
      if (solved) nextDeg = solved.map((rad) => (rad * 180) / Math.PI) as JointAngles;
    }

    if (!nextDeg) {
      if (
        preserveOrientation &&
        cartesianUseVisualPositionRef.current &&
        cartesianPhaseRef.current === 'orientation' &&
        visualRemainingPos < 2.5 &&
        visualRemainingOri < 0.18 &&
        cartesianOrientationRecoveryBudgetRef.current > 0
      ) {
        const orientationRecovery = solveVisualOrientationMultiSeed(
          targetPose,
          displayJointsRef.current,
          config,
          {
            damping: 0.6,
            jacobianStepDeg: 0.2,
            maxDeltaDeg: 0.5,
            orientationScale: 760,
            orientationClampRad: 0.08,
            positionClampMm: 1.0,
            toleranceMm: 1.0,
            oriToleranceRad: 0.015,
            maxAllowedPositionMm: 2.2,
            minOriImprovementRad: 0.003,
          }
        );
        if (orientationRecovery?.improved) {
          nextDeg = orientationRecovery.joints;
          cartesianOrientationRecoveryBudgetRef.current = Math.max(
            cartesianOrientationRecoveryBudgetRef.current - 1,
            0
          );
          cartesianLastReasonRef.current = 'visual_no_solution_orientation_recovery';
        }
      }
    }

    if (!nextDeg) {
      if (
        cartesianUseVisualPositionRef.current &&
        visualRemainingPos < 1.5 &&
        (!preserveOrientation || visualRemainingOri < 0.04)
      ) {
        if (preserveOrientation) {
          const finalVisualPose =
            getGlbPoseForJoints(displayJointsRef.current) ?? targetPose;
          positionOrientationLockRef.current = pickNextOrientationLock(
            visualRemainingOri,
            finalVisualPose.euler,
            positionOrientationLockRef.current
          );
          positionOrientationRotationLockRef.current = pickNextOrientationRotation(
            visualRemainingOri,
            currentVisualPose.rotation,
            positionOrientationRotationLockRef.current
          );
        } else {
          positionOrientationLockRef.current = null;
          positionOrientationRotationLockRef.current = null;
        }
        animIdRef.current = 0;
        cartesianStartPoseRef.current = null;
        cartesianTargetPoseRef.current = null;
        cartesianUseVisualPositionRef.current = false;
        cartesianPreserveOrientationRef.current = true;
        cartesianVisualTimeoutRef.current = 0;
        cartesianPositionOnlyCompleteRef.current = false;
        cartesianLastReasonRef.current = preserveOrientation
          ? 'visual_close_enough'
          : 'visual_position_close_enough';
        setIsAnimating(false); isAnimatingRef.current = false;
        setStatus('complete');
        setTimeout(() => setStatus('ready'), 500);
        return;
      }
      if (cartesianUseVisualPositionRef.current && elapsed < cartesianVisualTimeoutRef.current) {
        if (
          preserveOrientation &&
          cartesianPhaseRef.current === 'position' &&
          visualRemainingPos < 2.2
        ) {
          cartesianPhaseRef.current = 'orientation';
          cartesianLastReasonRef.current = 'visual_retry_switch_to_orientation_phase';
        } else if (
          preserveOrientation &&
          cartesianUseVisualPositionRef.current &&
          cartesianPhaseRef.current === 'orientation' &&
          cartesianPhaseRebalanceBudgetRef.current > 0 &&
          visualRemainingPos > 2.2 &&
          visualRemainingOri < 0.05
        ) {
          // 只有在姿态恢复阶段已经明显压低姿态误差、但本帧再也找不到更好的姿态步时，
          // 才回到 position 阶段把被暂时放宽的位置误差重新吃回来，避免两个阶段来回抖动。
          cartesianPhaseRef.current = 'position';
          cartesianPhaseRebalanceBudgetRef.current = Math.max(
            cartesianPhaseRebalanceBudgetRef.current - 1,
            0
          );
          cartesianPositionOnlyNudgeBudgetRef.current = Math.max(
            cartesianPositionOnlyNudgeBudgetRef.current,
            4
          );
          cartesianLastReasonRef.current = 'visual_retry_rebalance_to_position_phase';
        } else {
          cartesianLastReasonRef.current = 'visual_retry';
        }
        animIdRef.current = requestAnimationFrame(runCartesianAnimation);
        return;
      }
      stopAnimation();
      cartesianLastReasonRef.current = 'visual_timeout_or_unsolved';
      setStatus('unreachable');
      setTimeout(() => setStatus('ready'), 1500);
      return;
    }
    setDisplayJoints(nextDeg);
    setJoints(nextDeg);
    displayJointsRef.current = nextDeg;
    jointsRef.current = nextDeg;

    if (cartesianUseVisualPositionRef.current) {
      if (elapsed < cartesianVisualTimeoutRef.current) {
        cartesianLastReasonRef.current = 'visual_progress';
        animIdRef.current = requestAnimationFrame(runCartesianAnimation);
      } else {
        stopAnimation();
        cartesianLastReasonRef.current = 'visual_timeout_after_progress';
        setStatus('unreachable');
        setTimeout(() => setStatus('ready'), 1500);
      }
    } else if (t < 1) {
      animIdRef.current = requestAnimationFrame(runCartesianAnimation);
    } else {
      animIdRef.current = 0;
      cartesianStartPoseRef.current = null;
      cartesianTargetPoseRef.current = null;
      cartesianUseVisualPositionRef.current = false;
      cartesianPreserveOrientationRef.current = true;
      setIsAnimating(false); isAnimatingRef.current = false;
      setStatus('complete');
      setTimeout(() => setStatus('ready'), 500);
    }
  }, [config, stopAnimation]);

  // 启动缓动动画
  const startEasedAnimation = useCallback(
    (target: number[]) => {
      cancelAnimationFrame(animIdRef.current);
      targetJointsRef.current = [...target];
      startJointsRef.current = [...displayJointsRef.current];
      startTimeRef.current = performance.now();
      isLongPressRef.current = false;
      setIsAnimating(true); isAnimatingRef.current = true;
      setStatus('moving');
      animIdRef.current = requestAnimationFrame(runEasedAnimation);
    },
    [runEasedAnimation]
  );

  const startCartesianAnimation = useCallback(
    (
      targetPose: CartesianPose,
      duration = DEFAULT_MOTION_CONFIG.ikAnimDuration,
      options?: { useVisualPositionIK?: boolean; preserveOrientation?: boolean }
    ) => {
      cancelAnimationFrame(animIdRef.current);
      const useVisualPositionIK = options?.useVisualPositionIK ?? false;
      const preserveOrientation = options?.preserveOrientation ?? true;
      cartesianStartPoseRef.current =
        useVisualPositionIK
          ? (getGlbPoseForJoints(displayJointsRef.current) ?? getPoseFromJoints(displayJointsRef.current, config))
          : getPoseFromJoints(displayJointsRef.current, config);
      cartesianTargetPoseRef.current = targetPose;
      cartesianDurationRef.current = duration;
      cartesianUseVisualPositionRef.current = useVisualPositionIK;
      cartesianPreserveOrientationRef.current = preserveOrientation;
      cartesianVisualTimeoutRef.current = useVisualPositionIK
        ? Math.max(duration * 10, 4200)
        : 0;
      cartesianPositionOnlyCompleteRef.current = false;
      cartesianPositionOnlyNudgeBudgetRef.current = useVisualPositionIK && preserveOrientation ? 8 : 0;
      cartesianOrientationRecoveryBudgetRef.current = useVisualPositionIK && preserveOrientation ? 18 : 0;
      cartesianPhaseRebalanceBudgetRef.current = useVisualPositionIK && preserveOrientation ? 1 : 0;
      cartesianPhaseRef.current = useVisualPositionIK ? 'position' : 'idle';
      cartesianLastReasonRef.current = useVisualPositionIK
        ? (preserveOrientation ? 'visual_started' : 'visual_position_only_started')
        : 'dh_started';
      cartesianRemainingPosRef.current = null;
      cartesianRemainingOriRef.current = null;
      startTimeRef.current = performance.now();
      isLongPressRef.current = false;
      setIsAnimating(true); isAnimatingRef.current = true;
      setStatus('moving');
      animIdRef.current = requestAnimationFrame(runCartesianAnimation);
    },
    [config, runCartesianAnimation]
  );

  // ===== 关节微调（±按钮）=====
  // 单击：启动缓动动画
  // 长按连续触发：直接累加，不使用动画
  const adjustJoint = useCallback(
    (index: number, delta: number, isContinuous = false) => {
      const range = Object.values(config.dhParams)[index].thetaRange;

      // 使用 ref 获取最新值，避免 stale closure
      const current = jointsRef.current;
      const step = jointStep;
      let newVal = current[index] + delta * step;

      // 限位
      newVal = Math.max(range[0], Math.min(range[1], newVal));

      const newJoints = [...current] as JointAngles;
      newJoints[index] = Math.round(newVal * 10) / 10;

      if (isContinuous) {
        // 连续模式：直接设置，无动画
        setJoints(newJoints);
        setDisplayJoints(newJoints);
      } else {
        // 单击模式：启动缓动动画
        startEasedAnimation([...newJoints]);
      }
    },
    [jointStep, config, startEasedAnimation]
  );

  // ===== 方向键移动（位姿控制）=====
  const moveDirection = useCallback(
    (axis: 'x' | 'y' | 'z' | 'rx' | 'ry' | 'rz', sign: 1 | -1, isLongPress: boolean) => {
      const step = ['x', 'y', 'z'].includes(axis) ? posStep : rotStep;
      const delta = step * sign;

      // 使用 ref 获取最新关节值
      const currentJoints = jointsRef.current;
      const jointsRad = currentJoints.map((j) => (j * Math.PI) / 180) as JointAngles;
      const dhPose = getPoseFromJoints(currentJoints, config);
      const sampledVisualPose = getGlbPoseForJoints(currentJoints);
      const currentPose = sampledVisualPose ?? {
        position: dhPose.position,
        euler: dhPose.euler,
        rotation: forwardKinematics(jointsRad, config).getRotation(),
        quaternion: [0, 0, 0, 1] as [number, number, number, number],
      };
      const currentPos = currentPose.position;
      const currentEuler = currentPose.euler;
      const currentRot = currentPose.rotation;

      const isPos = ['x', 'y', 'z'].includes(axis);
      console.log(`[moveDir] ${coordinateSystem} ${axis}${sign > 0 ? '+' : '−'}  delta=${delta}${isPos ? 'mm' : '°'}  ` +
        `前: pos=[${currentPos.map(v=>v.toFixed(1)).join(',')}] euler=[${currentEuler.map(r=>(r*180/Math.PI).toFixed(1)).join(',')}]°`);

      let targetPos: [number, number, number] = currentPos;
      let targetEuler: [number, number, number] =
        cartesianTargetPoseRef.current?.euler ?? currentEuler;
      let targetRotation: number[][] =
        cartesianTargetPoseRef.current?.rotation ?? currentRot;

      const isPositionAxis = axis === 'x' || axis === 'y' || axis === 'z';

        if (isPositionAxis) {
          const axisIndexMap: Record<string, number> = { x: 0, y: 1, z: 2 };
          const axisIndex = axisIndexMap[axis];
          const offset = [0, 0, 0] as [number, number, number];
        offset[axisIndex] = delta;
        if (coordinateSystem === 'Tool') {
          const worldOffset = Matrix4x4.mat3Vec3Mul(currentRot, offset);
          targetPos = [currentPos[0] + worldOffset[0], currentPos[1] + worldOffset[1], currentPos[2] + worldOffset[2]];
        } else {
          targetPos = [currentPos[0] + offset[0], currentPos[1] + offset[1], currentPos[2] + offset[2]];
        }
          targetEuler = currentEuler;
          targetRotation = currentRot;
        } else {
          const deltaRad = (delta * Math.PI) / 180;
          targetPos = currentPos;
          positionOrientationLockRef.current = null;
          positionOrientationRotationLockRef.current = null;
          targetRotation = applyRotationIncrement(
            currentRot,
            axis as 'rx' | 'ry' | 'rz',
            deltaRad,
            coordinateSystem
          );
          targetEuler = rotationMatrixToEulerZYX(targetRotation);
        }

      // 长按目标累加：每tick在上次 DH 目标基础上扩展
      if (isLongPress) {
        const pressKey = `${axis}:${sign}:${coordinateSystem}`;
        const isNewSession = longPressKeyRef.current !== pressKey || animIdRef.current === 0;

        if (isPositionAxis) {
          if (isNewSession) {
            longPressEulerRef.current = [...targetEuler];
            longPressToolRotationRef.current = currentRot.map((row) => [...row]);
          }
          if (!isNewSession && longPressDHTargetRef.current) {
            const idx = { x: 0, y: 1, z: 2 }[axis]!;
            const dhOffset = [0, 0, 0]; dhOffset[idx] = delta;
            if (coordinateSystem === 'Tool') {
              const toolBasis = longPressToolRotationRef.current ?? currentRot;
              const wo = Matrix4x4.mat3Vec3Mul(toolBasis, dhOffset);
              longPressDHTargetRef.current = [
                longPressDHTargetRef.current[0] + wo[0],
                longPressDHTargetRef.current[1] + wo[1],
                longPressDHTargetRef.current[2] + wo[2],
              ];
            } else {
              longPressDHTargetRef.current = [
                longPressDHTargetRef.current[0] + dhOffset[0],
                longPressDHTargetRef.current[1] + dhOffset[1],
                longPressDHTargetRef.current[2] + dhOffset[2],
              ];
            }
          } else {
            longPressDHTargetRef.current = [...targetPos];
            longPressKeyRef.current = pressKey;
          }
          targetPos = longPressDHTargetRef.current!;
          targetEuler = longPressEulerRef.current ?? targetEuler;
        } else {
          if (!isNewSession && longPressEulerRef.current) {
            const baseRotation = buildRotationFromEuler(longPressEulerRef.current);
            const nextRotation = applyRotationIncrement(
              baseRotation,
              axis as 'rx' | 'ry' | 'rz',
              (delta * Math.PI) / 180,
              coordinateSystem
            );
            longPressEulerRef.current = rotationMatrixToEulerZYX(nextRotation);
          } else {
            longPressEulerRef.current = [...targetEuler];
            longPressKeyRef.current = pressKey;
          }
          targetEuler = longPressEulerRef.current;
          targetRotation = buildRotationFromEuler(targetEuler);
        }
      } else {
        longPressDHTargetRef.current = null;
        longPressEulerRef.current = null;
        longPressToolRotationRef.current = null;
        longPressKeyRef.current = '';
      }

      // 工作空间预检：明显不可达的目标直接拒绝，避免进入大抖动区域
      if (isPositionAxis && !isReachable(targetPos, config)) {
        setStatus('unreachable');
        setTimeout(() => setStatus('ready'), 1500);
        return { success: false };
      }

      // 位置控制不再先用“整步终点视觉 IK”做门卫判断。
      // 真实页面里连续 50mm 点按时，逐帧局部视觉 IK 能稳定收敛，
      // 但单次整步求解会更保守，容易在第二步就误判失败。
      let resultDeg: number[] | null = null;
      if (!isPositionAxis) {
        const result = solveVisualPoseIK(
          {
            position: targetPos,
            euler: targetEuler,
            rotation: targetRotation,
          },
          currentJoints,
          config,
          {
            maxIterations: 14,
            toleranceMm: 1.5,
            oriToleranceRad: 0.02,
            damping: 0.8,
            maxLambda: 80,
            maxStepDeg: 3,
            jacobianStepDeg: 0.3,
            orientationScale: 250,
          }
        );
        if (result) resultDeg = [...result];

        // 姿态按钮优先走真实 GLB 视觉 IK。
        // 但如果当前页面调试接口尚未挂载，视觉位姿采样会直接失败，
        // 这会导致 RX/RY/RZ 在入口处全部 success:false。
        // 这里回退到 DH IK，至少保证姿态按钮仍然可用。
        if (!resultDeg && !sampledVisualPose) {
          const solvedDh = solveIK(
            targetPos,
            targetEuler,
            jointsRad,
            config,
            {
              maxIterations: 60,
              posTolerance: 1.5,
              oriTolerance: 0.02,
              damping: 0.1,
              maxLambda: 100,
              maxStepRad: 0.08,
              orientationScale: 120,
            }
          );
          if (solvedDh) {
            resultDeg = solvedDh.map((rad) => (rad * 180) / Math.PI) as JointAngles;
            console.log(`[moveDir] 视觉位姿不可用，${axis} 改走 DH IK fallback`);
          }
        }
      }

      if (!isPositionAxis) {
        if (!resultDeg) {
          console.log(
            `[moveDir] 解算失败 axis=${axis} targetPos=[${targetPos.map((value) => value.toFixed(1)).join(',')}] ` +
            `targetEuler=[${targetEuler.map((rad) => (rad * 180 / Math.PI).toFixed(1)).join(',')}]° joints=[${currentJoints.join(',')}]`
          );
        }

        if (!resultDeg) {
          setStatus('unreachable');
          setTimeout(() => setStatus('ready'), 1500);
          return { success: false };
        }
      }

      if (isPositionAxis) {
        if (isLongPress) {
          startCartesianAnimation(
            {
              position: targetPos,
              euler: targetEuler,
              rotation: targetRotation,
            },
            DEFAULT_MOTION_CONFIG.longPressThrottle,
            { useVisualPositionIK: true, preserveOrientation: false }
          );
        } else {
          startCartesianAnimation(
            {
              position: targetPos,
              euler: targetEuler,
              rotation: targetRotation,
            },
            DEFAULT_MOTION_CONFIG.ikAnimDuration,
            { useVisualPositionIK: true, preserveOrientation: false }
          );
        }

        return { success: true };
      }

      if (!resultDeg) {
        console.log(
          `[moveDir] 解算失败 axis=${axis} targetPos=[${targetPos.map((value) => value.toFixed(1)).join(',')}] ` +
          `targetEuler=[${targetEuler.map((rad) => (rad * 180 / Math.PI).toFixed(1)).join(',')}]° joints=[${currentJoints.join(',')}]`
        );
      }

      if (!resultDeg) {
        setStatus('unreachable');
        setTimeout(() => setStatus('ready'), 1500);
        return { success: false };
      }

      const targetDeg = resultDeg;

      // 关节限位保护：检查是否接近限位边界
      let wasLimited = false;
      for (let i = 0; i < 6; i++) {
        const range = Object.values(config.dhParams)[i].thetaRange;
        const deg = targetDeg[i];
        if (deg <= range[0] + 0.01 || deg >= range[1] - 0.01) {
          wasLimited = true;
        }
      }

      // 奇异点检测：计算Jacobian可操作度，当 JJ^T 不可逆时处于奇异位姿
      let isSingular = false;
      try {
        const J = computeJacobian(jointsRad, config);
        const JJt = Matrix4x4.mat6Mul(J, Matrix4x4.mat6Transpose(J));
        if (!Matrix4x4.mat6Inverse(JJt)) isSingular = true;
      } catch {
        isSingular = true;
      }

      if (isSingular) {
        setStatus('nearSingularity');
        setTimeout(() => setStatus('ready'), 1500);
      }

      if (isLongPress) {
        startEasedAnimation(targetDeg);
      } else {
        startEasedAnimation(targetDeg);
      }

      if (wasLimited) {
        setStatus('jointLimited');
        setTimeout(() => setStatus('ready'), 1500);
      }

      return { success: true };
    },
    [coordinateSystem, posStep, rotStep, config, startCartesianAnimation]
  );

  // 设置为原点
  const saveOrigin = useCallback(() => {
    setOriginJoints([...jointsRef.current]);
  }, []);

  // 回原点
  const goToOrigin = useCallback(() => {
    if (!originJoints) return;
    positionOrientationLockRef.current = null;
    startEasedAnimation([...originJoints]);
  }, [originJoints, startEasedAnimation]);

  // 回零位
  const goToZero = useCallback(() => {
    const zero: JointAngles = [0, 0, 0, 0, 0, 0];
    positionOrientationLockRef.current = null;
    startEasedAnimation([...zero]);
  }, [startEasedAnimation]);

  // 重置
  const resetJoints = useCallback(() => goToZero(), [goToZero]);

  // 随机配置
  const randomJoints = useCallback(() => {
    const random = Array(6)
      .fill(0)
      .map((_, i) => {
        const range = Object.values(config.dhParams)[i].thetaRange;
        return range[0] + Math.random() * (range[1] - range[0]);
      }) as JointAngles;
    positionOrientationLockRef.current = null;
    startEasedAnimation([...random]);
  }, [config, startEasedAnimation]);

  // 跳转到指定关节角
  const goToJoints = useCallback(
    (target: JointAngles) => {
      positionOrientationLockRef.current = null;
      startEasedAnimation([...target]);
    },
    [startEasedAnimation]
  );

  // 绝对定位：将末端移动到笛卡尔空间指定坐标 (GLB模型坐标，米)
  const goToPosition = useCallback(
    (x: number, y: number, z: number): boolean => {
      const dhTarget: [number, number, number] = [x * 1000, y * 1000, z * 1000];
      if (!isReachable(dhTarget, config)) {
        setStatus('unreachable');
        setTimeout(() => setStatus('ready'), 1500);
        return false;
      }
      const currentJoints = jointsRef.current;
      const result = solveVisualPoseIK(
        {
          position: dhTarget,
          euler:
            (getGlbPoseForJoints(currentJoints) ?? getPoseFromJoints(currentJoints, config)).euler,
        },
        currentJoints,
        config,
        {
          maxIterations: 14,
          toleranceMm: 1.5,
          oriToleranceRad: 0.02,
          damping: 0.8,
          maxLambda: 100,
          maxStepDeg: 3,
          jacobianStepDeg: 0.3,
          orientationScale: 250,
        }
      );
      if (result) {
        positionOrientationLockRef.current = null;
        startCartesianAnimation(
          {
            position: dhTarget,
            euler:
              (getGlbPoseForJoints(currentJoints) ?? getPoseFromJoints(currentJoints, config)).euler,
          },
          DEFAULT_MOTION_CONFIG.ikAnimDuration,
          { useVisualPositionIK: true, preserveOrientation: false }
        );
        return true;
      }
      setStatus('unreachable');
      setTimeout(() => setStatus('ready'), 1500);
      return false;
    },
    [config, startCartesianAnimation, setStatus]
  );

  useEffect(() => {
    const debugApi: RobotDebugAPI = {
      getState: () => {
        const jointsDeg = [...displayJointsRef.current] as JointAngles;
        const jointsRad = jointsDeg.map((j) => (j * Math.PI) / 180) as JointAngles;
        const visual = getGlbPoseForJoints(jointsDeg);
        const poseMm = visual
          ? {
              position: visual.position,
              euler: visual.euler,
            }
          : getPoseFromJoints(jointsDeg, config);
        return {
          jointsDeg,
          jointsRad,
          poseMm,
          coordinateSystem,
          posStep,
          rotStep,
          status,
          isAnimating: isAnimatingRef.current,
        };
      },
      moveDirection: (axis, sign, isLongPress = false) => moveDirection(axis, sign, isLongPress),
      setCoordinateSystem,
      setPosStep,
      setRotStep,
      goToJoints,
      goToZero,
      stopAnimation,
      getCartesianDebug: () => ({
        mode: cartesianUseVisualPositionRef.current
          ? 'visual'
          : cartesianTargetPoseRef.current
            ? 'dh'
            : 'idle',
        phase: cartesianPhaseRef.current,
        elapsedMs: startTimeRef.current ? performance.now() - startTimeRef.current : 0,
        timeoutMs: cartesianVisualTimeoutRef.current,
        targetPose: cartesianTargetPoseRef.current,
        remainingPosMm: cartesianRemainingPosRef.current,
        remainingOriDeg:
          cartesianRemainingOriRef.current === null
            ? null
            : (cartesianRemainingOriRef.current * 180) / Math.PI,
        lastReason: cartesianLastReasonRef.current,
      }),
    };

    (window as typeof window & { __ROBOT_DEBUG?: RobotDebugAPI }).__ROBOT_DEBUG = debugApi;
    return () => {
      delete (window as typeof window & { __ROBOT_DEBUG?: RobotDebugAPI }).__ROBOT_DEBUG;
    };
  }, [
    config,
    coordinateSystem,
    goToJoints,
    goToZero,
    moveDirection,
    posStep,
    rotStep,
    setCoordinateSystem,
    status,
    stopAnimation,
  ]);

  return {
    joints: displayJoints,
    rawJoints: joints,
    endEffectorPose,
    originJoints,
    trajectory,
    addTrajectoryPoint,
    adjustJoint,
    moveDirection,
    saveOrigin,
    goToOrigin,
    goToZero,
    resetJoints,
    randomJoints,
    goToJoints,
    goToPosition,
    glbPosition,
    stopAnimation,
    coordinateSystem,
    setCoordinateSystem,
    jointStep,
    setJointStep,
    posStep,
    setPosStep,
    rotStep,
    setRotStep,
    selectedTool,
    setSelectedTool,
    toolList,
    setToolList,
    status,
    setStatus,
    isAnimating,
    isAnimatingRef,
    config,
  };
}
