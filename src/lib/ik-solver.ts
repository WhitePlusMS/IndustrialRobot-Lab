// src/lib/ik-solver.ts
import { Matrix4x4, eulerZYXToMatrix } from './matrix4x4';
import { forwardKinematics, dhTransform } from './kinematics';
import type { RobotConfig, JointAngles, IKSolverConfig  } from '@/types/robot';

export const DEFAULT_IK_CONFIG: IKSolverConfig = {
  maxIterations: 200,
  tolerance: 1e-3,
  damping: 0.1,
  lambdaDecay: 0.98,
};

/** 核心IK求解: Jacobian DLS */
export function solveIK(
  targetPos: [number, number, number], // mm
  targetEulerZYX: [number, number, number], // rad
  initialJoints: JointAngles, // rad
  config: RobotConfig,
  solverConfig: Partial<IKSolverConfig> = {}
): JointAngles | null {
  const cfg = { ...DEFAULT_IK_CONFIG, ...solverConfig };
  let theta = [...initialJoints] as number[];
  let lambda = cfg.damping;

  const Rd = eulerZYXToMatrix(targetEulerZYX);

  for (let iter = 0; iter < cfg.maxIterations; iter++) {
    const T = forwardKinematics(theta as JointAngles, config);
    const pc = T.getPosition();
    const Rc = T.getRotation();

    const ePos = [targetPos[0] - pc[0], targetPos[1] - pc[1], targetPos[2] - pc[2]];

    // 姿态误差: skew⁻¹(Rd·Rcᵀ - Rc·Rdᵀ)/2
    const Re = Matrix4x4.mat3Mul(Rd, Matrix4x4.mat3Transpose(Rc));
    const eOri = [(Re[2][1] - Re[1][2]) / 2, (Re[0][2] - Re[2][0]) / 2, (Re[1][0] - Re[0][1]) / 2];

    const error = [...ePos, ...eOri];
    const errNorm = Math.sqrt(error.reduce((s, v) => s + v * v, 0));
    if (errNorm < cfg.tolerance) return theta as JointAngles;

    const J = computeJacobian(theta, config);

    // DLS: Δθ = Jᵀ(JJᵀ + λ²I)⁻¹ · e
    const JJt = Matrix4x4.mat6Mul(J, Matrix4x4.mat6Transpose(J));
    for (let i = 0; i < 6; i++) JJt[i][i] += lambda * lambda;
    const JJtInv = Matrix4x4.mat6Inverse(JJt);
    if (!JJtInv) {
      lambda *= 2;
      if (lambda > 100) return null;
      continue;
    }
    const Jt = Matrix4x4.mat6Transpose(J);
    const dTheta = Matrix4x4.mat6Vec6Mul(Matrix4x4.mat6Mul(Jt, JJtInv), error);

    for (let i = 0; i < 6; i++) {
      theta[i] += dTheta[i];
      const range = Object.values(config.dhParams)[i].thetaRange;
      theta[i] = Math.max(
        (range[0] * Math.PI) / 180,
        Math.min((range[1] * Math.PI) / 180, theta[i])
      );
    }

    lambda = Math.max(lambda * cfg.lambdaDecay, 1e-4);
  }

  return null;
}

/** 计算空间Jacobian: J_i = [z_i×(p_n-p_i), z_i]  (Modified DH convention) */
export function computeJacobian(joints: number[], config: RobotConfig): number[][] {
  const J: number[][] = Array(6)
    .fill(0)
    .map(() => Array(6).fill(0));

  // 计算累积变换 T_0^1, T_0^2, ..., T_0^6
  const T0i: Matrix4x4[] = [Matrix4x4.identity()];
  const dhParams = Object.values(config.dhParams);
  for (let i = 0; i < 6; i++) {
    const Ti = dhTransform(joints[i], dhParams[i].d, dhParams[i].a, dhParams[i].alpha);
    T0i.push(T0i[i].multiply(Ti));
  }

  const T06 = T0i[6];
  const pe = T06.getPosition();

  for (let i = 0; i < 6; i++) {
    // Modified DH: joint i+1 uses T_0^{i+1}
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

/** 位置-only IK (3DOF): 当6DOF位姿IK失败时使用 */
export function solvePositionOnlyIK(
  targetPos: [number, number, number],
  initialJoints: JointAngles,
  config: RobotConfig,
  solverConfig: Partial<IKSolverConfig> = {}
): JointAngles | null {
  const cfg = { ...DEFAULT_IK_CONFIG, ...solverConfig, tolerance: 1e-3 };
  let theta = [...initialJoints] as number[];
  let lambda = cfg.damping;

  // 3x3矩阵求逆
  const mat3Inverse = (A: number[][]): number[][] | null => {
    const n = 3;
    const aug = A.map((row, i) => [
      ...row,
      ...Array(n).fill(0).map((_, j) => (i === j ? 1 : 0)),
    ]);
    for (let i = 0; i < n; i++) {
      let pivot = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(aug[r][i]) > Math.abs(aug[pivot][i])) pivot = r;
      if (Math.abs(aug[pivot][i]) < 1e-14) return null;
      [aug[i], aug[pivot]] = [aug[pivot], aug[i]];
      const d = aug[i][i];
      for (let j = 0; j < 2 * n; j++) aug[i][j] /= d;
      for (let r = 0; r < n; r++) {
        if (r === i) continue;
        const f = aug[r][i];
        for (let j = 0; j < 2 * n; j++) aug[r][j] -= f * aug[i][j];
      }
    }
    return aug.map((row) => row.slice(n));
  };

  // 3x3 × 3x3
  const mat3Mul = (A: number[][], B: number[][]): number[][] => {
    const r = [[0,0,0],[0,0,0],[0,0,0]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i][j] += A[i][k] * B[k][j];
    return r;
  };

  // 6x3 × 3x3
  const mat63Mul33 = (A: number[][], B: number[][]): number[][] => {
    const r = Array(6).fill(0).map(() => Array(3).fill(0));
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i][j] += A[i][k] * B[k][j];
    return r;
  };

  // 6x3 × 3x1
  const mat63Vec3 = (A: number[][], v: number[]): number[] => {
    return A.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
  };

  // 3x6 转置为 6x3
  const transpose36 = (A: number[][]): number[][] => {
    return A[0].map((_, c) => A.map((r) => r[c]));
  };

  for (let iter = 0; iter < cfg.maxIterations; iter++) {
    const T = forwardKinematics(theta as JointAngles, config);
    const pc = T.getPosition();

    const ePos = [targetPos[0] - pc[0], targetPos[1] - pc[1], targetPos[2] - pc[2]];
    const errNorm = Math.sqrt(ePos.reduce((s, v) => s + v * v, 0));
    if (errNorm < cfg.tolerance) return theta as JointAngles;

    // 3x6 Jacobian (position only)
    const J6 = computeJacobian(theta, config);
    const J: number[][] = [J6[0], J6[1], J6[2]];

    // DLS: Δθ = J^T(JJ^T + λ²I)^-1 · e
    const Jt = transpose36(J); // 6x3
    const JJt = mat3Mul(J, Jt); // 3x3
    for (let i = 0; i < 3; i++) JJt[i][i] += lambda * lambda;
    const JJtInv = mat3Inverse(JJt);
    if (!JJtInv) {
      lambda *= 2;
      if (lambda > 100) return null;
      continue;
    }
    const dThetaMatrix = mat63Mul33(Jt, JJtInv); // 6x3
    const dTheta = mat63Vec3(dThetaMatrix, ePos); // 6x1

    for (let i = 0; i < 6; i++) {
      theta[i] += dTheta[i];
      const range = Object.values(config.dhParams)[i].thetaRange;
      theta[i] = Math.max(
        (range[0] * Math.PI) / 180,
        Math.min((range[1] * Math.PI) / 180, theta[i])
      );
    }

    lambda = Math.max(lambda * cfg.lambdaDecay, 1e-4);
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
