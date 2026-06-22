// src/lib/matrix4x4.test.ts
import { describe, it, expect } from 'vitest';
import { Matrix4x4, eulerZYXToMatrix } from './matrix4x4';

describe('Matrix4x4', () => {
  describe('constructor', () => {
    it('默认构造单位矩阵', () => {
      const m = new Matrix4x4();
      expect(m.data[0][0]).toBe(1);
      expect(m.data[1][1]).toBe(1);
      expect(m.data[2][2]).toBe(1);
      expect(m.data[3][3]).toBe(1);
      expect(m.data[0][1]).toBe(0);
      expect(m.data[1][0]).toBe(0);
    });

    it('可传入自定义值', () => {
      const m = new Matrix4x4([
        [1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11, 12],
        [13, 14, 15, 16],
      ]);
      expect(m.data[0][0]).toBe(1);
      expect(m.data[0][3]).toBe(4);
      expect(m.data[2][1]).toBe(10);
    });
  });

  describe('multiply', () => {
    it('单位矩阵乘任何矩阵 = 自身', () => {
      const I = Matrix4x4.identity();
      const A = new Matrix4x4([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]);
      const result = I.multiply(A);
      expect(result.data[0][0]).toBe(1);
      expect(result.data[0][3]).toBe(4);
    });

    it('两个 DH 变换矩阵的乘积', () => {
      // 平移 [100, 0, 0]
      const T1 = new Matrix4x4([
        [1, 0, 0, 100],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ]);
      // 旋转 Z 90°
      const rad = Math.PI / 2;
      const T2 = new Matrix4x4([
        [Math.cos(rad), -Math.sin(rad), 0, 0],
        [Math.sin(rad), Math.cos(rad), 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ]);
      const result = T1.multiply(T2);
      // 先转 Z 90°，再沿 X 平移 100 → 点在 [100, 0, 0] 处 → 实际位置在 [0, 100, 0]
      expect(result.data[0][3]).toBeCloseTo(100, 5);
      expect(result.data[1][3]).toBeCloseTo(0, 5);
      expect(result.data[0][0]).toBeCloseTo(0, 5); // cos 90
      expect(result.data[1][0]).toBeCloseTo(1, 5); // sin 90
    });
  });

  describe('getPosition', () => {
    it('返回平移列', () => {
      const m = new Matrix4x4([
        [1, 0, 0, 42],
        [0, 1, 0, -7],
        [0, 0, 1, 3.14],
        [0, 0, 0, 1],
      ]);
      expect(m.getPosition()).toEqual([42, -7, 3.14]);
    });
  });

  describe('getRotation', () => {
    it('返回 3×3 旋转子矩阵', () => {
      const m = new Matrix4x4([
        [0, -1, 0, 10],
        [1, 0, 0, 20],
        [0, 0, 1, 30],
        [0, 0, 0, 1],
      ]);
      const R = m.getRotation();
      expect(R[0][0]).toBe(0);
      expect(R[0][1]).toBe(-1);
      expect(R[1][0]).toBe(1);
      expect(R[2][2]).toBe(1);
    });
  });
});

describe('Matrix4x4 static (mat3)', () => {
  it('mat3Mul: 两个旋转矩阵相乘', () => {
    const rad = Math.PI / 2;
    const Rz = [
      [Math.cos(rad), -Math.sin(rad), 0],
      [Math.sin(rad), Math.cos(rad), 0],
      [0, 0, 1],
    ];
    const Rx = [
      [1, 0, 0],
      [0, Math.cos(rad), -Math.sin(rad)],
      [0, Math.sin(rad), Math.cos(rad)],
    ];
    const result = Matrix4x4.mat3Mul(Rz, Rx);
    // Z90·X90 = 先绕 X 再绕 Z
    // Z90·X90 = [[0,0,1],[1,0,0],[0,1,0]]
    expect(result[0][0]).toBeCloseTo(0, 5);
    expect(result[0][1]).toBeCloseTo(0, 5);
    expect(result[0][2]).toBeCloseTo(1, 5);
    expect(result[1][0]).toBeCloseTo(1, 5);
  });

  it('mat3Transpose: 转置矩阵', () => {
    const A = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
    const AT = Matrix4x4.mat3Transpose(A);
    expect(AT[0][1]).toBe(4);
    expect(AT[1][0]).toBe(2);
    expect(AT[2][2]).toBe(9);
  });

  it('mat3Vec3Mul: 矩阵乘向量', () => {
    const R = [[0, -1, 0], [1, 0, 0], [0, 0, 1]];
    const v = [10, 0, 0];
    const result = Matrix4x4.mat3Vec3Mul(R, v);
    expect(result[0]).toBeCloseTo(0, 5);
    expect(result[1]).toBeCloseTo(10, 5);
    expect(result[2]).toBeCloseTo(0, 5);
  });
});

describe('Matrix4x4 static (mat6)', () => {
  it('mat6Mul: 任意矩阵乘积维度正确', () => {
    const A = Array.from({ length: 6 }, (_, i) =>
      Array.from({ length: 6 }, (_, j) => (i === j ? 1 : 0))
    );
    const B = Array.from({ length: 6 }, (_, i) =>
      Array.from({ length: 6 }, (_, j) => (i === j ? 2 : 0))
    );
    const result = Matrix4x4.mat6Mul(A, B);
    expect(result[0][0]).toBe(2);
    expect(result[1][2]).toBe(0);
  });

  it('mat6Inverse: 单位阵的逆 = 单位阵', () => {
    const I = Array.from({ length: 6 }, (_, i) =>
      Array.from({ length: 6 }, (_, j) => (i === j ? 1 : 0))
    );
    const inv = Matrix4x4.mat6Inverse(I);
    expect(inv).not.toBeNull();
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        expect(inv![i][j]).toBeCloseTo(i === j ? 1 : 0, 10);
      }
    }
  });

  it('mat6Inverse: 奇异矩阵返回 null', () => {
    const S = Array.from({ length: 6 }, () => Array(6).fill(1));
    const inv = Matrix4x4.mat6Inverse(S);
    expect(inv).toBeNull();
  });

  it('mat6Vec6Mul: 矩阵乘向量', () => {
    const I = Array.from({ length: 6 }, (_, i) =>
      Array.from({ length: 6 }, (_, j) => (i === j ? 1 : 0))
    );
    const v = [1, 2, 3, 4, 5, 6];
    const result = Matrix4x4.mat6Vec6Mul(I, v);
    expect(result).toEqual(v);
  });
});

describe('eulerZYXToMatrix', () => {
  it('全零欧拉角 → 单位矩阵', () => {
    const R = eulerZYXToMatrix([0, 0, 0]);
    expect(R[0][0]).toBeCloseTo(1, 5);
    expect(R[1][1]).toBeCloseTo(1, 5);
    expect(R[2][2]).toBeCloseTo(1, 5);
    expect(R[0][1]).toBeCloseTo(0, 5);
  });

  it('绕 Z 轴 90°', () => {
    const R = eulerZYXToMatrix([0, 0, Math.PI / 2]);
    expect(R[0][0]).toBeCloseTo(0, 5);
    expect(R[0][1]).toBeCloseTo(-1, 5);
    expect(R[1][0]).toBeCloseTo(1, 5);
    expect(R[2][2]).toBeCloseTo(1, 5);
  });

  it('绕 X 轴 90°', () => {
    const R = eulerZYXToMatrix([Math.PI / 2, 0, 0]);
    expect(R[0][0]).toBeCloseTo(1, 5);
    expect(R[1][1]).toBeCloseTo(0, 5);
    expect(R[1][2]).toBeCloseTo(-1, 5);
    expect(R[2][1]).toBeCloseTo(1, 5);
  });
});
