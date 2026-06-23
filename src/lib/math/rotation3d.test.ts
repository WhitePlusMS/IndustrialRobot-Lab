// src/lib/math/rotation3d.test.ts
import { describe, it, expect } from 'vitest';
import {
  mat3Mul,
  quaternionToRotationMatrix, rotationMatrixToEulerZYX,
  buildRotationFromEuler, buildAxisRotation,
  orientationError, applyRotationIncrement,
} from './rotation3d';

const PI = Math.PI;

describe('mat3Mul', () => {
  it('单位阵乘单位阵 = 单位阵', () => {
    const I = [[1,0,0],[0,1,0],[0,0,1]];
    expect(mat3Mul(I, I)).toEqual(I);
  });
});

describe('quaternionToRotationMatrix', () => {
  it('单位四元数 → 单位矩阵', () => {
    const R = quaternionToRotationMatrix([0, 0, 0, 1]);
    expect(R[0][0]).toBeCloseTo(1, 10);
    expect(R[1][1]).toBeCloseTo(1, 10);
    expect(R[2][2]).toBeCloseTo(1, 10);
  });

  it('绕 X 轴 90°', () => {
    // q = [sin(45°), 0, 0, cos(45°)]
    const s = Math.sin(PI / 4);
    const c = Math.cos(PI / 4);
    const R = quaternionToRotationMatrix([s, 0, 0, c]);
    expect(R[0][0]).toBeCloseTo(1, 5);
    expect(R[1][1]).toBeCloseTo(0, 5);
    expect(R[1][2]).toBeCloseTo(-1, 5);
    expect(R[2][1]).toBeCloseTo(1, 5);
  });
});

describe('rotationMatrixToEulerZYX', () => {
  it('单位矩阵 → [0,0,0]', () => {
    const e = rotationMatrixToEulerZYX([[1,0,0],[0,1,0],[0,0,1]]);
    expect(e[0]).toBeCloseTo(0, 5);
    expect(e[1]).toBeCloseTo(0, 5);
    expect(e[2]).toBeCloseTo(0, 5);
  });

  it('绕 Z 90° → rz=π/2', () => {
    const Rz = [[0,-1,0],[1,0,0],[0,0,1]];
    const e = rotationMatrixToEulerZYX(Rz);
    expect(e[0]).toBeCloseTo(0, 5);
    expect(e[1]).toBeCloseTo(0, 5);
    expect(e[2]).toBeCloseTo(PI / 2, 5);
  });
});

describe('buildRotationFromEuler / buildAxisRotation 往返', () => {
  it('Euler → Matrix → Euler 一致', () => {
    const euler: [number, number, number] = [0.3, -0.2, 0.5];
    const R = buildRotationFromEuler(euler);
    const back = rotationMatrixToEulerZYX(R);
    for (let i = 0; i < 3; i++) expect(back[i]).toBeCloseTo(euler[i], 5);
  });

  it('buildAxisRotation Z 90°', () => {
    const R = buildAxisRotation('z', PI / 2);
    expect(R[0][0]).toBeCloseTo(0, 5);
    expect(R[0][1]).toBeCloseTo(-1, 5);
    expect(R[1][0]).toBeCloseTo(1, 5);
  });
});

describe('orientationError', () => {
  it('相同姿态误差为零', () => {
    const I = [[1,0,0],[0,1,0],[0,0,1]];
    const err = orientationError(I, I);
    expect(err[0]).toBeCloseTo(0, 10);
    expect(err[1]).toBeCloseTo(0, 10);
    expect(err[2]).toBeCloseTo(0, 10);
  });

  it('小角度偏差符号正确', () => {
    const I = [[1,0,0],[0,1,0],[0,0,1]];
    const Rz = [[Math.cos(0.1), -Math.sin(0.1), 0], [Math.sin(0.1), Math.cos(0.1), 0], [0,0,1]];
    const err = orientationError(Rz, I);
    expect(err[2]).toBeGreaterThan(0); // 正 Z 轴偏差
  });
});

describe('applyRotationIncrement (World frame)', () => {
  it('世界 Z 轴增量绕单位姿态', () => {
    const I = [[1,0,0],[0,1,0],[0,0,1]];
    const R = applyRotationIncrement(I, 'rz', PI / 2, 'World');
    const e = rotationMatrixToEulerZYX(R);
    expect(e[2]).toBeCloseTo(PI / 2, 5);
  });
});
