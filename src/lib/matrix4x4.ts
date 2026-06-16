// src/lib/matrix4x4.ts
export class Matrix4x4 {
  data: number[][];

  constructor(values?: number[][]) {
    this.data = values || [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
  }

  multiply(other: Matrix4x4): Matrix4x4 {
    const res = Array(4)
      .fill(0)
      .map(() => Array(4).fill(0));
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        for (let k = 0; k < 4; k++) res[i][j] += this.data[i][k] * other.data[k][j];
    return new Matrix4x4(res);
  }

  getPosition(): [number, number, number] {
    return [this.data[0][3], this.data[1][3], this.data[2][3]];
  }

  getRotation(): number[][] {
    return this.data.slice(0, 3).map((row) => row.slice(0, 3));
  }

  getColumn(col: number): [number, number, number] {
    return [this.data[0][col], this.data[1][col], this.data[2][col]];
  }

  static identity(): Matrix4x4 {
    return new Matrix4x4();
  }

  // --- 3×3 运算 ---
  static mat3Mul(A: number[][], B: number[][]): number[][] {
    const r = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i][j] += A[i][k] * B[k][j];
    return r;
  }

  static mat3Transpose(A: number[][]): number[][] {
    return [
      [A[0][0], A[1][0], A[2][0]],
      [A[0][1], A[1][1], A[2][1]],
      [A[0][2], A[1][2], A[2][2]],
    ];
  }

  static mat3Vec3Mul(A: number[][], v: number[]): number[] {
    return [
      A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2],
      A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2],
      A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2],
    ];
  }

  // --- 6×6 运算 ---
  static mat6Mul(A: number[][], B: number[][]): number[][] {
    const r = Array(6)
      .fill(0)
      .map(() => Array(6).fill(0));
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 6; j++) for (let k = 0; k < 6; k++) r[i][j] += A[i][k] * B[k][j];
    return r;
  }

  static mat6Transpose(A: number[][]): number[][] {
    return A[0].map((_, c) => A.map((r) => r[c]));
  }

  static mat6Inverse(A: number[][]): number[][] | null {
    const n = 6;
    const aug = A.map((row, i) => [
      ...row,
      ...Array(n)
        .fill(0)
        .map((_, j) => (i === j ? 1 : 0)),
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
  }

  static mat6Vec6Mul(A: number[][], v: number[]): number[] {
    return A.map((row) => row.reduce((s, a, j) => s + a * v[j], 0));
  }
}

// Euler ZYX (intrinsic) → 旋转矩阵
export function eulerZYXToMatrix(euler: [number, number, number]): number[][] {
  const [rx, ry, rz] = euler;
  const crx = Math.cos(rx),
    srx = Math.sin(rx);
  const cry = Math.cos(ry),
    sry = Math.sin(ry);
  const crz = Math.cos(rz),
    srz = Math.sin(rz);

  return [
    [cry * crz, crz * sry * srx - srz * crx, crz * sry * crx + srz * srx],
    [cry * srz, srz * sry * srx + crz * crx, srz * sry * crx - crz * srx],
    [-sry, cry * srx, cry * crx],
  ];
}
