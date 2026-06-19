// src/lib/ik-solver.ts
// 唯一逆运动学求解器：完全基于 RobotModel（GLB）采样，Levenberg-Marquardt 阻尼最小二乘

import { Matrix, solve } from 'ml-matrix';
import type { JointAngles, IKSolverConfig, Pose } from '@/types/robot';
import type { RobotModel } from './robot-model';
import { clampVectorMagnitude, clampDegStep } from './math/vector';
import { orientationError } from './math/rotation3d';
import { radToDeg } from './math/angle';

export const DEFAULT_IK_CONFIG: IKSolverConfig = {
  maxIterations: 100,
  tolerance: 1e-3,
  posTolerance: 1.0, // mm
  oriTolerance: 0.01, // rad
  damping: 0.1,
  lambdaDecay: 0.7,
  lambdaGrow: 2.0,
  maxLambda: 1000,
  maxStepRad: 0.1, // ~5.7° per iteration
  errorClampPos: 500, // mm
  errorClampOri: 0.5, // rad
  orientationScale: 100, // mm/rad
};

/** 判断目标位置是否可能到达（基于模型最大伸展） */
export function isReachable(
  targetPos: [number, number, number],
  model: RobotModel,
  margin = 50
): boolean {
  if (!model.isAvailable()) return true; // GLB 未就绪时不阻塞
  // 使用一个保守估计：采样零位与几个典型姿态的最大距离
  const seeds: JointAngles[] = [
    [0, 0, 0, 0, 0, 0],
    [0, -30, 60, 0, 0, 0],
    [0, -45, 90, 0, 0, 0],
    [90, -30, 60, 0, 0, 0],
    [-90, -30, 60, 0, 0, 0],
  ];
  let maxReach = 0;
  for (const seed of seeds) {
    const pose = model.forwardKinematics(seed);
    if (pose) {
      maxReach = Math.max(maxReach, Math.hypot(...pose.position));
    }
  }
  return Math.hypot(...targetPos) <= maxReach + margin;
}

/** 把关节角限制到给定行程 */
function clampJoints(joints: JointAngles, ranges: [number, number][] | undefined): JointAngles {
  if (!ranges) return joints;
  return joints.map((value, i) => {
    const [min, max] = ranges[i];
    return Math.max(min, Math.min(max, value));
  }) as JointAngles;
}

/** 6-DOF 位姿 IK */
export function solveIK(
  targetPose: Pose,
  initialJointsDeg: JointAngles,
  model: RobotModel,
  solverConfig: Partial<IKSolverConfig> = {},
  jointRanges?: [number, number][]
): JointAngles | null {
  if (!model.isAvailable()) return null;

  const cfg = { ...DEFAULT_IK_CONFIG, ...solverConfig };
  const joints = clampJoints([...initialJointsDeg] as JointAngles, jointRanges);
  let lambda = cfg.damping;
  const targetRotation = targetPose.rotation;

  for (let iter = 0; iter < cfg.maxIterations; iter++) {
    const currentPose = model.forwardKinematics(joints);
    if (!currentPose) return null;

    let ePos = [
      targetPose.position[0] - currentPose.position[0],
      targetPose.position[1] - currentPose.position[1],
      targetPose.position[2] - currentPose.position[2],
    ];
    ePos = clampVectorMagnitude(ePos, cfg.errorClampPos);

    const eOriRaw = orientationError(targetRotation, currentPose.rotation);
    const eOri = clampVectorMagnitude(eOriRaw, cfg.errorClampOri);

    const posNorm = Math.hypot(
      targetPose.position[0] - currentPose.position[0],
      targetPose.position[1] - currentPose.position[1],
      targetPose.position[2] - currentPose.position[2]
    );
    const oriNorm = Math.hypot(...eOriRaw);

    if (posNorm < cfg.posTolerance && oriNorm < cfg.oriTolerance) {
      return joints;
    }

    const Jarr = model.estimateJacobian(joints);
    if (!Jarr) return null;

    const Jrows = Jarr.map((row, r) =>
      row.map((v) => (r >= 3 ? v * cfg.orientationScale : v))
    );
    const J = new Matrix(Jrows);
    const Jt = J.transpose();

    const eVec = Matrix.columnVector([
      ...ePos,
      eOri[0] * cfg.orientationScale,
      eOri[1] * cfg.orientationScale,
      eOri[2] * cfg.orientationScale,
    ]);

    const lhs = Jt.mmul(J).add(Matrix.eye(6).mul(lambda));
    const rhs = Jt.mmul(eVec);

    const dThetaM = solve(lhs, rhs, true);
    let dTheta = dThetaM.to1DArray();
    dTheta = clampDegStep(dTheta, radToDeg(cfg.maxStepRad));

    const candidate = clampJoints(
      joints.map((t, i) => t + dTheta[i]) as JointAngles,
      jointRanges
    );

    const candidatePose = model.forwardKinematics(candidate);
    if (!candidatePose) return null;

    const ePos2Raw = [
      targetPose.position[0] - candidatePose.position[0],
      targetPose.position[1] - candidatePose.position[1],
      targetPose.position[2] - candidatePose.position[2],
    ];
    const ePos2 = clampVectorMagnitude(ePos2Raw, cfg.errorClampPos);
    const eOri2Raw = orientationError(targetRotation, candidatePose.rotation);
    const eOri2 = clampVectorMagnitude(eOri2Raw, cfg.errorClampOri);

    const err = Math.hypot(
      ...ePos,
      eOri[0] * cfg.orientationScale,
      eOri[1] * cfg.orientationScale,
      eOri[2] * cfg.orientationScale
    );
    const err2 = Math.hypot(
      ...ePos2,
      eOri2[0] * cfg.orientationScale,
      eOri2[1] * cfg.orientationScale,
      eOri2[2] * cfg.orientationScale
    );

    if (err2 < err) {
      for (let i = 0; i < 6; i++) joints[i] = candidate[i];
      lambda = Math.max(lambda * cfg.lambdaDecay, 1e-6);
    } else {
      lambda *= cfg.lambdaGrow;
    }

    if (lambda > cfg.maxLambda) {
      return null;
    }
  }

  return null;
}

/** 3-DOF 位置-only IK */
export function solvePositionOnlyIK(
  targetPos: [number, number, number],
  initialJointsDeg: JointAngles,
  model: RobotModel,
  solverConfig: Partial<IKSolverConfig> = {},
  jointRanges?: [number, number][]
): JointAngles | null {
  if (!model.isAvailable()) return null;

  const cfg = { ...DEFAULT_IK_CONFIG, ...solverConfig };
  const joints = clampJoints([...initialJointsDeg] as JointAngles, jointRanges);
  let lambda = cfg.damping;

  for (let iter = 0; iter < cfg.maxIterations; iter++) {
    const currentPose = model.forwardKinematics(joints);
    if (!currentPose) return null;

    let ePos = [
      targetPos[0] - currentPose.position[0],
      targetPos[1] - currentPose.position[1],
      targetPos[2] - currentPose.position[2],
    ];
    ePos = clampVectorMagnitude(ePos, cfg.errorClampPos);

    const err = Math.hypot(...ePos);
    if (err < cfg.posTolerance) return joints;

    const fullJ = model.estimateJacobian(joints);
    if (!fullJ) return null;
    const Jrows = [fullJ[0], fullJ[1], fullJ[2]];
    const J = new Matrix(Jrows);
    const Jt = J.transpose();

    const eVec = Matrix.columnVector(ePos);
    const lhs = Jt.mmul(J).add(Matrix.eye(6).mul(lambda));
    const rhs = Jt.mmul(eVec);

    const dThetaM = solve(lhs, rhs, true);
    let dTheta = dThetaM.to1DArray();
    dTheta = clampDegStep(dTheta, radToDeg(cfg.maxStepRad));

    const candidate = clampJoints(
      joints.map((t, i) => t + dTheta[i]) as JointAngles,
      jointRanges
    );

    const candidatePose = model.forwardKinematics(candidate);
    if (!candidatePose) return null;
    const ePos2Raw = [
      targetPos[0] - candidatePose.position[0],
      targetPos[1] - candidatePose.position[1],
      targetPos[2] - candidatePose.position[2],
    ];
    const ePos2 = clampVectorMagnitude(ePos2Raw, cfg.errorClampPos);
    const err2 = Math.hypot(...ePos2);

    if (err2 < err) {
      for (let i = 0; i < 6; i++) joints[i] = candidate[i];
      lambda = Math.max(lambda * cfg.lambdaDecay, 1e-6);
    } else {
      lambda *= cfg.lambdaGrow;
    }

    if (lambda > cfg.maxLambda) {
      return null;
    }
  }

  return null;
}
