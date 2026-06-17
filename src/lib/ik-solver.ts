// src/lib/ik-solver.ts
// Levenberg-Marquardt (Damped Least Squares) IK with SVD-backed linear solves.
// Replaces the previous Gauss-Jordan + un-clamped DLS implementation.

import { Matrix, solve } from 'ml-matrix';
import { Matrix4x4, eulerZYXToMatrix } from './matrix4x4';
import { forwardKinematics, dhTransform } from './kinematics';
import type { RobotConfig, JointAngles, IKSolverConfig } from '@/types/robot';

export const DEFAULT_IK_CONFIG: IKSolverConfig = {
  maxIterations: 100,
  tolerance: 1e-3, // kept for backward compatibility; not used directly
  posTolerance: 1.0, // mm
  oriTolerance: 0.01, // rad (~0.57°)
  damping: 0.1,
  lambdaDecay: 0.7,
  lambdaGrow: 2.0,
  maxLambda: 1000,
  maxStepRad: 0.1, // ~5.7° per iteration
  errorClampPos: 500, // mm
  errorClampOri: 0.5, // rad
  orientationScale: 100, // mm/rad — makes position & orientation errors comparable
};

/** Clamp a vector's magnitude to maxNorm. */
function clampVector(v: number[], maxNorm: number): number[] {
  const norm = Math.hypot(...v);
  if (norm <= maxNorm || norm === 0) return v;
  const s = maxNorm / norm;
  return v.map((x) => x * s);
}

/** Scale a joint-step vector so no joint moves more than maxStepRad. */
function clampStep(dTheta: number[], maxStepRad: number): number[] {
  const maxAbs = Math.max(...dTheta.map((x) => Math.abs(x)));
  if (maxAbs <= maxStepRad || maxAbs === 0) return dTheta;
  const s = maxStepRad / maxAbs;
  return dTheta.map((x) => x * s);
}

/** Orientation error as rotation vector (axis * sin(angle)) in base frame. */
function orientationError(Rd: number[][], Rc: number[][]): number[] {
  // Re = Rd * Rc^T
  const Re = Matrix4x4.mat3Mul(Rd, Matrix4x4.mat3Transpose(Rc));
  return [(Re[2][1] - Re[1][2]) / 2, (Re[0][2] - Re[2][0]) / 2, (Re[1][0] - Re[0][1]) / 2];
}

/** Conservative upper bound on reachable radius (sum of link lengths). */
export function computeMaxReach(config: RobotConfig): number {
  return Object.values(config.dhParams).reduce(
    (sum, p) => sum + Math.sqrt(p.a * p.a + p.d * p.d),
    0
  );
}

/** Quick workspace pre-check. */
export function isReachable(
  targetPos: [number, number, number],
  config: RobotConfig,
  margin = 50
): boolean {
  const dist = Math.hypot(targetPos[0], targetPos[1], targetPos[2]);
  return dist <= computeMaxReach(config) + margin;
}

/** Compute spatial Jacobian for this project's DH transform convention.
 *  这里的 dhTransform 实际对应:
 *    T = Tx(a) * Rx(alpha) * Tz(d) * Rz(theta)
 *  关节变量 theta 出现在最后一项，因此第 i 个关节的旋转轴与原点都位于
 *  T0(i) 之后、Rz(theta_i) 之前的位置；由于绕 Z 旋转不会改变原点，也不会改变 Z 轴自身方向，
 *  直接使用 T0(i+1) 读取关节原点与轴向是成立的。
 *
 *  J_i = [ z_i × (p_e - p_i), z_i ]^T
 */
export function computeJacobian(joints: number[], config: RobotConfig): number[][] {
  const J: number[][] = Array(6)
    .fill(0)
    .map(() => Array(6).fill(0));

  const T0i: Matrix4x4[] = [Matrix4x4.identity()];
  const dhParams = Object.values(config.dhParams);
  for (let i = 0; i < 6; i++) {
    const thetaOffset = dhParams[i].thetaOffset ?? 0;
    const thetaSign = dhParams[i].thetaSign ?? 1;
    const Ti = dhTransform(
      joints[i] * thetaSign + thetaOffset,
      dhParams[i].d,
      dhParams[i].a,
      dhParams[i].alpha
    );
    T0i.push(T0i[i].multiply(Ti));
  }

  const pe = T0i[6].getPosition();

  for (let i = 0; i < 6; i++) {
    // 本项目的变换约定下，joint i 轴向/原点可直接从 T0(i+1) 读取
    const Ti = T0i[i + 1];
    const zi = Ti.getColumn(2);
    const pi = Ti.getPosition();

    const dp = [pe[0] - pi[0], pe[1] - pi[1], pe[2] - pi[2]];
    const cross = [
      zi[1] * dp[2] - zi[2] * dp[1],
      zi[2] * dp[0] - zi[0] * dp[2],
      zi[0] * dp[1] - zi[1] * dp[0],
    ];

    J[0][i] = cross[0];
    J[1][i] = cross[1];
    J[2][i] = cross[2];
    J[3][i] = zi[0];
    J[4][i] = zi[1];
    J[5][i] = zi[2];
  }

  return J;
}

/** 6-DOF pose IK using Levenberg-Marquardt. */
export function solveIK(
  targetPos: [number, number, number],
  targetEulerZYX: [number, number, number],
  initialJoints: JointAngles,
  config: RobotConfig,
  solverConfig: Partial<IKSolverConfig> = {}
): JointAngles | null {
  const cfg = { ...DEFAULT_IK_CONFIG, ...solverConfig };
  const theta = [...initialJoints] as number[];
  let lambda = cfg.damping;
  const Rd = eulerZYXToMatrix(targetEulerZYX);

  const ranges = Object.values(config.dhParams).map(
    (p) => [p.thetaRange[0] * (Math.PI / 180), p.thetaRange[1] * (Math.PI / 180)] as [number, number]
  );

  for (let iter = 0; iter < cfg.maxIterations; iter++) {
    const T = forwardKinematics(theta as JointAngles, config);
    const pc = T.getPosition();
    const Rc = T.getRotation();

    let ePos = [targetPos[0] - pc[0], targetPos[1] - pc[1], targetPos[2] - pc[2]];
    ePos = clampVector(ePos, cfg.errorClampPos);

    const eOriRaw = orientationError(Rd, Rc);
    const eOri = clampVector(eOriRaw, cfg.errorClampOri);

    const posNorm = Math.hypot(
      targetPos[0] - pc[0],
      targetPos[1] - pc[1],
      targetPos[2] - pc[2]
    );
    const oriNorm = Math.hypot(...eOriRaw);

    if (posNorm < cfg.posTolerance && oriNorm < cfg.oriTolerance) {
      return theta as JointAngles;
    }

    const Jarr = computeJacobian(theta, config);
    // Weight orientation rows so that position & orientation contribute comparably.
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
    dTheta = clampStep(dTheta, cfg.maxStepRad);

    const thetaCandidate = theta.map((t, i) =>
      Math.max(ranges[i][0], Math.min(ranges[i][1], t + dTheta[i]))
    );

    // Adaptive damping: accept only if error decreases.
    const Tc = forwardKinematics(thetaCandidate as JointAngles, config);
    const pc2 = Tc.getPosition();
    const ePos2Raw = [targetPos[0] - pc2[0], targetPos[1] - pc2[1], targetPos[2] - pc2[2]];
    const ePos2 = clampVector(ePos2Raw, cfg.errorClampPos);
    const eOri2Raw = orientationError(Rd, Tc.getRotation());
    const eOri2 = clampVector(eOri2Raw, cfg.errorClampOri);

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
      for (let i = 0; i < 6; i++) theta[i] = thetaCandidate[i];
      lambda = Math.max(lambda * cfg.lambdaDecay, 1e-6);
    } else {
      lambda *= cfg.lambdaGrow;
    }

    if (lambda > cfg.maxLambda) { console.log("[IK pos] FAILED: lambda exceeded"); return null; }
  }

  return null;
}

/** 3-DOF position-only IK using Levenberg-Marquardt. */
export function solvePositionOnlyIK(
  targetPos: [number, number, number],
  initialJoints: JointAngles,
  config: RobotConfig,
  solverConfig: Partial<IKSolverConfig> = {}
): JointAngles | null {
  const cfg = { ...DEFAULT_IK_CONFIG, ...solverConfig };
  const theta = [...initialJoints] as number[];
  let lambda = cfg.damping;

  const ranges = Object.values(config.dhParams).map(
    (p) => [p.thetaRange[0] * (Math.PI / 180), p.thetaRange[1] * (Math.PI / 180)] as [number, number]
  );

  for (let iter = 0; iter < cfg.maxIterations; iter++) {
    const T = forwardKinematics(theta as JointAngles, config);
    const pc = T.getPosition();

    let ePos = [targetPos[0] - pc[0], targetPos[1] - pc[1], targetPos[2] - pc[2]];
    ePos = clampVector(ePos, cfg.errorClampPos);

    const err = Math.hypot(...ePos);
    console.log(`[IK pos] iter=${iter} err=${err.toFixed(2)} λ=${lambda.toFixed(4)} pos=[${pc.map(v=>v.toFixed(1)).join(',')}] joints=[${theta.map(r=>(r*180/Math.PI).toFixed(1)).join(',')}]°`);
    if (err < cfg.posTolerance) return theta as JointAngles;

    const J6 = computeJacobian(theta, config);
    const Jrows = [J6[0], J6[1], J6[2]];
    const J = new Matrix(Jrows); // 3x6
    const Jt = J.transpose();

    const eVec = Matrix.columnVector(ePos);
    const lhs = Jt.mmul(J).add(Matrix.eye(6).mul(lambda));
    const rhs = Jt.mmul(eVec);

    const dThetaM = solve(lhs, rhs, true);
    let dTheta = dThetaM.to1DArray();
    dTheta = clampStep(dTheta, cfg.maxStepRad);

    const thetaCandidate = theta.map((t, i) =>
      Math.max(ranges[i][0], Math.min(ranges[i][1], t + dTheta[i]))
    );

    const Tc = forwardKinematics(thetaCandidate as JointAngles, config);
    const ePos2Raw = [
      targetPos[0] - Tc.getPosition()[0],
      targetPos[1] - Tc.getPosition()[1],
      targetPos[2] - Tc.getPosition()[2],
    ];
    const ePos2 = clampVector(ePos2Raw, cfg.errorClampPos);
    const err2 = Math.hypot(...ePos2);

    if (err2 < err) {
      for (let i = 0; i < 6; i++) theta[i] = thetaCandidate[i];
      lambda = Math.max(lambda * cfg.lambdaDecay, 1e-6);
    } else {
      lambda *= cfg.lambdaGrow;
    }

    if (lambda > cfg.maxLambda) { console.log("[IK pos] FAILED: lambda exceeded"); return null; }
  }

  return null;
}

/** 世界/工具坐标转换：将工具坐标下的增量转换到世界坐标 */
export function toolToWorldDelta(
  dpTool: [number, number, number],
  dEulerTool: [number, number, number],
  currentRotation: number[][]
): { dPosWorld: [number, number, number]; dRotWorld: number[][] } {
  const dPosWorld = Matrix4x4.mat3Vec3Mul(currentRotation, dpTool) as [number, number, number];

  const dRt = eulerZYXToMatrix(dEulerTool);
  const dRwIntermediate = Matrix4x4.mat3Mul(currentRotation, dRt);
  const dRotWorld = Matrix4x4.mat3Mul(dRwIntermediate, Matrix4x4.mat3Transpose(currentRotation));

  return { dPosWorld, dRotWorld };
}
