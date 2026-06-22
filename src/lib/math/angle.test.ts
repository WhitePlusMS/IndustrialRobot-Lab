// src/lib/math/angle.test.ts
import { describe, it, expect } from 'vitest';
import { degToRad, radToDeg, normalizeAngleDelta, lerpAngle, jointsDegToRad, jointsRadToDeg } from './angle';

describe('degToRad / radToDeg', () => {
  it('180° → π', () => expect(degToRad(180)).toBeCloseTo(Math.PI, 10));
  it('π → 180°', () => expect(radToDeg(Math.PI)).toBeCloseTo(180, 10));
  it('0° → 0', () => expect(degToRad(0)).toBe(0));
  it('90° → π/2', () => expect(degToRad(90)).toBeCloseTo(Math.PI / 2, 10));
});

describe('normalizeAngleDelta', () => {
  it('小角度不变', () => expect(normalizeAngleDelta(1)).toBeCloseTo(1, 10));
  it('超过 π 回卷', () => expect(normalizeAngleDelta(4)).toBeCloseTo(4 - 2 * Math.PI, 10));
  it('小于 -π 回卷', () => expect(normalizeAngleDelta(-4)).toBeCloseTo(-4 + 2 * Math.PI, 10));
  it('刚好 2π → 0', () => expect(normalizeAngleDelta(2 * Math.PI)).toBeCloseTo(0, 10));
});

describe('lerpAngle', () => {
  it('t=0 → start', () => expect(lerpAngle(0, 1, 0)).toBe(0));
  it('t=1 → end', () => expect(lerpAngle(0, 1, 1)).toBeCloseTo(1, 10));
  it('走最短路径', () => {
    // 从 350° 到 10°（最短路径是 +20°，不是 -340°），中点 ≈ 0°/360°
    const r = lerpAngle(degToRad(350), degToRad(10), 0.5);
    // 用 sin/cos 验证，因为 0° 和 360° 的三角函数值相同
    expect(Math.sin(r)).toBeCloseTo(0, 5);
    expect(Math.cos(r)).toBeCloseTo(1, 5);
  });
});

describe('jointsDegToRad / jointsRadToDeg', () => {
  it('往返一致', () => {
    const j = [0, 45, 90, -30, 60, -90] as [number, number, number, number, number, number];
    const rad = jointsDegToRad(j);
    const deg = jointsRadToDeg(rad);
    for (let i = 0; i < 6; i++) expect(deg[i]).toBeCloseTo(j[i], 10);
  });
});
