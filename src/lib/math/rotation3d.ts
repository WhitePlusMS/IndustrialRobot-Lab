// src/lib/math/rotation3d.ts
// 三维旋转表示转换：旋转矩阵、欧拉角 ZYX、四元数、轴角

import { Matrix4x4, eulerZYXToMatrix } from '@/lib/matrix4x4';

export type RotationMatrix = number[][];
export type Quaternion = [number, number, number, number];
export type EulerZYX = [number, number, number];

/** 3×3 矩阵乘法 */
export function mat3Mul(a: RotationMatrix, b: RotationMatrix): RotationMatrix {
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

/** 3×3 矩阵转置 */
export function mat3Transpose(matrix: RotationMatrix): RotationMatrix {
  return [
    [matrix[0][0], matrix[1][0], matrix[2][0]],
    [matrix[0][1], matrix[1][1], matrix[2][1]],
    [matrix[0][2], matrix[1][2], matrix[2][2]],
  ];
}

/** 四元数 → 旋转矩阵 */
export function quaternionToRotationMatrix(quaternion: Quaternion): RotationMatrix {
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

/** 旋转矩阵 → ZYX 欧拉角（弧度） */
export function rotationMatrixToEulerZYX(rotation: RotationMatrix): EulerZYX {
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

/** ZYX 欧拉角（弧度） → 旋转矩阵 */
export function buildRotationFromEuler(euler: EulerZYX): RotationMatrix {
  const [rx, ry, rz] = euler;
  return mat3Mul(
    mat3Mul(
      [
        [Math.cos(rz), -Math.sin(rz), 0],
        [Math.sin(rz), Math.cos(rz), 0],
        [0, 0, 1],
      ],
      [
        [Math.cos(ry), 0, Math.sin(ry)],
        [0, 1, 0],
        [-Math.sin(ry), 0, Math.cos(ry)],
      ]
    ),
    [
      [1, 0, 0],
      [0, Math.cos(rx), -Math.sin(rx)],
      [0, Math.sin(rx), Math.cos(rx)],
    ]
  );
}

/** 绕指定轴旋转 angleRad 的旋转矩阵 */
export function buildAxisRotation(
  axis: 'x' | 'y' | 'z',
  angleRad: number
): RotationMatrix {
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

/** 姿态误差：从目标旋转到当前旋转的相对旋转的轴角表示（在基坐标系） */
export function orientationError(
  targetRotation: RotationMatrix,
  currentRotation: RotationMatrix
): [number, number, number] {
  const relative = mat3Mul(targetRotation, mat3Transpose(currentRotation));
  return [
    (relative[2][1] - relative[1][2]) / 2,
    (relative[0][2] - relative[2][0]) / 2,
    (relative[1][0] - relative[0][1]) / 2,
  ];
}

/** 在当前旋转上叠加一个局部轴增量 */
export function applyRotationIncrement(
  currentRotation: RotationMatrix,
  axis: 'rx' | 'ry' | 'rz',
  deltaRad: number,
  coordinateSystem: 'World' | 'Tool'
): RotationMatrix {
  const localAxis = axis === 'rx' ? 'x' : axis === 'ry' ? 'y' : 'z';
  const deltaRotation = buildAxisRotation(localAxis, deltaRad);
  return coordinateSystem === 'Tool'
    ? mat3Mul(currentRotation, deltaRotation)
    : mat3Mul(deltaRotation, currentRotation);
}

/** 工具坐标增量 → 世界坐标增量 */
export function toolToWorldDelta(
  dpTool: [number, number, number],
  dEulerTool: EulerZYX,
  currentRotation: RotationMatrix
): { dPosWorld: [number, number, number]; dRotWorld: RotationMatrix } {
  const dPosWorld = Matrix4x4.mat3Vec3Mul(currentRotation, dpTool) as [number, number, number];
  const dRt = eulerZYXToMatrix(dEulerTool);
  const dRwIntermediate = mat3Mul(currentRotation, dRt);
  const dRotWorld = mat3Mul(dRwIntermediate, mat3Transpose(currentRotation));
  return { dPosWorld, dRotWorld };
}
