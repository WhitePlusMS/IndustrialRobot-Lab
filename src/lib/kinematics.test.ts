// src/lib/kinematics.test.ts
import { describe, it, expect } from 'vitest';
import { dhTransform, forwardKinematics, extractPose } from './kinematics';
import { KUKA_LIKE, DEFAULT_JOINTS } from './robot-config';

const degToRad = (d: number) => (d * Math.PI) / 180;

describe('dhTransform', () => {
  it('零参数 DH 变换 = 单位阵', () => {
    const T = dhTransform(0, 0, 0, 0);
    expect(T.data[0][0]).toBeCloseTo(1, 10);
    expect(T.data[1][1]).toBeCloseTo(1, 10);
    expect(T.data[2][2]).toBeCloseTo(1, 10);
    expect(T.data[3][3]).toBeCloseTo(1, 10);
  });

  it('纯平移 d=100', () => {
    const T = dhTransform(0, 100, 0, 0);
    expect(T.getPosition()[2]).toBeCloseTo(100, 5);
  });

  it('纯旋转 θ=90°', () => {
    const T = dhTransform(Math.PI / 2, 0, 0, 0);
    const p = T.getPosition();
    expect(p[0]).toBeCloseTo(0, 5);
    expect(p[1]).toBeCloseTo(0, 5);
    expect(p[2]).toBeCloseTo(0, 5);
    expect(T.data[0][0]).toBeCloseTo(0, 5);
    expect(T.data[0][1]).toBeCloseTo(-1, 5);
    expect(T.data[1][0]).toBeCloseTo(1, 5);
  });
});

describe('forwardKinematics', () => {
  it('零位关节 DH FK 返回有效矩阵', () => {
    const jointsRad = [0, 0, 0, 0, 0, 0] as [number,number,number,number,number,number];
    const T = forwardKinematics(jointsRad, KUKA_LIKE);
    expect(T.getPosition()[0]).toBeGreaterThan(0);
  });

  it('默认关节 DH FK 与自身 extractPose 往返一致', () => {
    const jointsRad = DEFAULT_JOINTS.map(degToRad) as [number,number,number,number,number,number];
    const T = forwardKinematics(jointsRad, KUKA_LIKE);
    const { position, eulerZYX } = extractPose(T);
    expect(position.every(v => isFinite(v))).toBe(true);
    expect(eulerZYX.every(v => isFinite(v))).toBe(true);
  });
});
