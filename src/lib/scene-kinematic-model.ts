// src/lib/scene-kinematic-model.ts
// Product of Exponentials 解析运动学模型
// 基于挂载时一次性提取的场景标定数据（世界坐标系，mm），
// 提供不依赖 Three.js 的 FK 和解析 Jacobian
//
// PoE 公式: T(θ) = ∏_{i=1}^{n} e^{[ξ_i]·θ_i} · M
// 其中 ξ_i = [ω_i; v_i], v_i = -ω_i × q_i

import type { JointAngles, Pose } from '@/types/robot';
import type { RobotModel } from './robot-model';
import type { CalibrationData } from './robot-pose-bridge';
import { rotationMatrixToEulerZYX } from './math/rotation3d';

// ========== 内部纯函数 ==========

/** Rodrigues 公式：绕单位轴旋转 angleRad，返回 3×3 旋转矩阵 */
function rodrigues(axis: [number, number, number], angleRad: number): number[][] {
  const [x, y, z] = axis;
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  const v = 1 - c;
  return [
    [c + x * x * v, x * y * v - z * s, x * z * v + y * s],
    [y * x * v + z * s, c + y * y * v, y * z * v - x * s],
    [z * x * v - y * s, z * y * v + x * s, c + z * z * v],
  ];
}

/** 3×3 矩阵 × 3维向量 */
function mat3vec3Mul(A: number[][], v: [number, number, number]): [number, number, number] {
  return [
    A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2],
    A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2],
    A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2],
  ];
}

/** 3×3 矩阵乘法 */
function mat3Mul(A: number[][], B: number[][]): number[][] {
  const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) r[i][j] += A[i][k] * B[k][j];
  return r;
}

/** 向量叉积 */
function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** 向量减法 */
function sub(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** 向量加法 */
function add(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

// ========== 4×4 齐次变换（纯函数式） ==========

interface SE3 {
  rotation: number[][];
  translation: [number, number, number];
}

function identitySE3(): SE3 {
  return {
    rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    translation: [0, 0, 0],
  };
}

/** 旋量指数映射：绕 worldAxis 过 pivotPos 转 angleRad */
function screwExp(
  worldAxis: [number, number, number],
  pivotPos: [number, number, number],
  angleRad: number,
): SE3 {
  const R = rodrigues(worldAxis, angleRad);
  // 绕 pivot 点旋转: p' = R·(p - q) + q = R·p + (q - R·q)
  const Rq = mat3vec3Mul(R, pivotPos);
  const t: [number, number, number] = [pivotPos[0] - Rq[0], pivotPos[1] - Rq[1], pivotPos[2] - Rq[2]];
  return { rotation: R, translation: t };
}

/** 组合两个变换 T = A·B（先 B 后 A） */
function composeSE3(A: SE3, B: SE3): SE3 {
  const rot = mat3Mul(A.rotation, B.rotation);
  const trans = add(mat3vec3Mul(A.rotation, B.translation), A.translation);
  return { rotation: rot, translation: trans };
}

/** 变换作用于点 */
function transformPoint(T: SE3, p: [number, number, number]): [number, number, number] {
  return add(mat3vec3Mul(T.rotation, p), T.translation);
}

// ========== 核心类 ==========

export class SceneKinematicModel implements RobotModel {
  private calib: CalibrationData;

  constructor(calib: CalibrationData) {
    this.calib = calib;
  }

  isAvailable(): boolean {
    return this.calib.available;
  }

  // ---- 正运动学 ----

  forwardKinematics(jointsDeg: JointAngles): Pose | null {
    const calib = this.calib;
    if (!calib.available || jointsDeg.length < calib.joints.length) return null;

    let T = identitySE3();

    for (let i = 0; i < calib.joints.length; i++) {
      const j = calib.joints[i];
      const θ = (jointsDeg[i] * Math.PI) / 180; // deg → rad
      if (Math.abs(θ) < 1e-12) continue;
      const Ti = screwExp(j.worldAxis, j.pivotPos, θ);
      T = composeSE3(T, Ti);
    }

    const pos = transformPoint(T, calib.zeroFlangePose.position);
    const rot = mat3Mul(T.rotation, calib.zeroFlangePose.rotation);
    const euler = rotationMatrixToEulerZYX(rot);

    return { position: pos, euler, rotation: rot };
  }

  // ---- 解析空间 Jacobian (6×n, 单位: mm/deg 和 rad/deg) ----

  estimateJacobian(jointsDeg: JointAngles, _stepDeg?: number): number[][] | null {
    const calib = this.calib;
    if (!calib.available) return null;

    const n = calib.joints.length;
    const J = Array.from({ length: 6 }, () => Array(n).fill(0));

    // 计算当前末端位姿
    const currentPose = this.forwardKinematics(jointsDeg);
    if (!currentPose) return null;
    const p = currentPose.position; // 末端世界位置 (mm)

    // 对每个关节，计算它在当前姿态下对末端的贡献
    // 使用 forward-propagation 世界 frame 下的 Jacobian 列:
    //   J_col_i = [ω_i × (p - p_i); ω_i]
    //   其中 ω_i = 当前姿态下第 i 关节轴在世界系中的方向
    //   p_i = 第 i 关节 pivot 在链式旋转+平移后的世界位置

    let T = identitySE3();

    for (let i = 0; i < n; i++) {
      const calibJoint = calib.joints[i];
      const θ = (jointsDeg[i] * Math.PI) / 180;

      // 该关节 pivot 的当前世界位置：T 将零位的 pivot 变换到当前位置
      const p_i = transformPoint(T, calibJoint.pivotPos);
      // 该关节轴在当前世界系中的方向：只受 T 的旋转部分影响
      const ω_i = mat3vec3Mul(T.rotation, calibJoint.worldAxis);

      // 与后关节构成链式传播：T = T · screwExp(joint i)
      if (Math.abs(θ) > 1e-12) {
        const Ti = screwExp(calibJoint.worldAxis, calibJoint.pivotPos, θ);
        T = composeSE3(T, Ti);
      }

      // 空间 Jacobian 列：ω_i × (p - p_i) 和 ω_i
      const d = sub(p, p_i);
      const v = cross(ω_i, d);

      // 单位转换: Jacobian 的位移行 = mm/deg
      const degToRad = Math.PI / 180;
      J[0][i] = v[0] * degToRad;
      J[1][i] = v[1] * degToRad;
      J[2][i] = v[2] * degToRad;
      // 姿态行 = rad/deg
      J[3][i] = ω_i[0] * degToRad;
      J[4][i] = ω_i[1] * degToRad;
      J[5][i] = ω_i[2] * degToRad;
    }

    return J;
  }
}
