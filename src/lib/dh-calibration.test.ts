// src/lib/dh-calibration.test.ts
// 标定纯函数的行为锁定测试 — TDD characterization tests
import { describe, it, expect } from 'vitest';
import {
  computeDhFramesMm,
  deriveDhCandidatesFromPivots,
  buildBestFitRigidAlignment,
  roundValue,
  roundTuple,
  normalizeTuple,
  distanceMm,
  subTuple,
  dotTuple,
  crossTuple,
} from './dh-calibration';

// ============================================================
// 基础工具函数
// ============================================================

describe('roundValue', () => {
  it('默认保留 3 位小数', () => {
    expect(roundValue(3.14159)).toBe(3.142);
    expect(roundValue(2.71828)).toBe(2.718);
  });

  it('可指定精度', () => {
    expect(roundValue(3.14159, 1)).toBe(3.1);
    expect(roundValue(3.14159, 5)).toBe(3.14159);
  });

  it('处理零和负数', () => {
    expect(roundValue(0)).toBe(0);
    expect(roundValue(-1.2345, 2)).toBe(-1.23);
  });
});

describe('roundTuple', () => {
  it('对三元组每个分量四舍五入', () => {
    expect(roundTuple([1.2345, 2.3456, 3.4567], 2)).toEqual([1.23, 2.35, 3.46]);
  });
});

describe('normalizeTuple', () => {
  it('归一化后长度≈1', () => {
    const v = normalizeTuple([3, 4, 0]);
    expect(Math.hypot(v[0], v[1], v[2])).toBeCloseTo(1, 5);
    expect(v[0]).toBeCloseTo(0.6, 5);
    expect(v[1]).toBeCloseTo(0.8, 5);
  });

  it('零向量返回 [0,0,0]', () => {
    expect(normalizeTuple([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe('distanceMm', () => {
  it('计算两点欧式距离', () => {
    expect(distanceMm([0, 0, 0], [3, 4, 0])).toBe(5);
    expect(distanceMm([1, 1, 1], [4, 5, 1])).toBe(5);
  });
});

describe('向量基础运算', () => {
  it('subTuple 向量减法', () => {
    expect(subTuple([5, 4, 3], [1, 2, 1])).toEqual([4, 2, 2]);
  });

  it('dotTuple 点积', () => {
    expect(dotTuple([1, 0, 0], [0, 1, 0])).toBe(0);
    expect(dotTuple([1, 2, 3], [1, 2, 3])).toBe(14);
  });

  it('crossTuple 叉积 — X×Y=Z', () => {
    const z = crossTuple([1, 0, 0], [0, 1, 0]);
    expect(z[0]).toBeCloseTo(0, 5);
    expect(z[1]).toBeCloseTo(0, 5);
    expect(z[2]).toBeCloseTo(1, 5);
  });
});

// ============================================================
// DH 帧计算 — 核心纯函数
// ============================================================

describe('computeDhFramesMm', () => {
  it('零位返回 6 个关节帧位置', () => {
    const frames = computeDhFramesMm([0, 0, 0, 0, 0, 0]);
    expect(frames).toHaveLength(6);
    frames.forEach((f) => {
      expect(f.name).toBeTruthy();
      expect(f.positionMm).toHaveLength(3);
      expect(f.positionMm.every((v) => isFinite(v))).toBe(true);
    });
  });

  it('J1 旋转 90° 后 J1 位置不变（原点关节）', () => {
    const zero = computeDhFramesMm([0, 0, 0, 0, 0, 0]);
    const rot90 = computeDhFramesMm([90, 0, 0, 0, 0, 0]);
    // J1 绕原点旋转，位置不变
    expect(rot90[0].positionMm[0]).toBeCloseTo(zero[0].positionMm[0], 1);
    expect(rot90[0].positionMm[1]).toBeCloseTo(zero[0].positionMm[1], 1);
    expect(rot90[0].positionMm[2]).toBeCloseTo(zero[0].positionMm[2], 1);
  });

  it('非零关节产生不同于零位的末端帧', () => {
    const zero = computeDhFramesMm([0, 0, 0, 0, 0, 0]);
    const moved = computeDhFramesMm([10, -20, 30, 0, 0, 0]);
    // 至少有一个帧位置不同
    const anyDiff = moved.some(
      (f, i) => distanceMm(f.positionMm, zero[i].positionMm) > 0.1
    );
    expect(anyDiff).toBe(true);
  });

  it('所有关节角都产生有限结果', () => {
    const frames = computeDhFramesMm([45, -30, 60, 90, -45, 180]);
    frames.forEach((f) => {
      expect(f.positionMm.every((v) => isFinite(v) && !isNaN(v))).toBe(true);
    });
  });
});

// ============================================================
// DH 候选推导
// ============================================================

describe('deriveDhCandidatesFromPivots', () => {
  /** 构造模拟 pivot 快照 — 模拟 KUKA 零位结构 */
  function makeMockPivots(
    positions: [number, number, number][],
    axes: [number, number, number][]
  ) {
    return positions.map((pos, i) => ({
      name: `J${i + 1}`,
      pivotName: `Pivot_J${i + 1}`,
      path: `root/Pivot_J${i + 1}`,
      worldPositionMeters: pos.map((v) => v / 1000) as [number, number, number],
      worldPositionMm: pos,
      localAxis: axes[i],
      worldAxis: axes[i],
      worldQuaternion: [0, 0, 0, 1] as [number, number, number, number],
      worldScale: [1, 1, 1] as [number, number, number],
    }));
  }

  it('6 关节返回 5 组候选 DH（相对相邻关节）', () => {
    const pivots = makeMockPivots(
      [
        [100, 0, 0],
        [200, 0, 0],
        [300, 0, 0],
        [300, 0, 100],
        [200, 0, 100],
        [200, 0, 200],
      ],
      [
        [0, 0, 1],
        [0, 1, 0],
        [0, 1, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ]
    );
    const candidates = deriveDhCandidatesFromPivots(pivots);
    expect(candidates).toHaveLength(5); // 6 joints → 5 inter-joint relations
    candidates.forEach((c) => {
      expect(c.from).toBeTruthy();
      expect(c.to).toBeTruthy();
      expect(c.candidateLink.a).toBeDefined();
      expect(c.candidateLink.d).toBeDefined();
      expect(c.candidateLink.alphaDeg).toBeDefined();
      expect(c.candidateLink.thetaOffsetDeg).toBeDefined();
    });
  });

  it('不足 6 关节时返回空数组', () => {
    const pivots = makeMockPivots(
      [[0, 0, 0], [100, 0, 0]],
      [[0, 0, 1], [0, 1, 0]]
    );
    expect(deriveDhCandidatesFromPivots(pivots)).toEqual([]);
  });
});

// ============================================================
// 最佳拟合刚体对齐
// ============================================================

describe('buildBestFitRigidAlignment', () => {
  it('3 对以上点返回有效对齐', () => {
    // DH 帧
    const dhFrames = [
      { name: 'J1', positionMm: [0, 0, 0] as [number, number, number] },
      { name: 'J2', positionMm: [100, 0, 0] as [number, number, number] },
      { name: 'J3', positionMm: [200, 50, 0] as [number, number, number] },
    ];

    // 模拟 pivot 快照
    const pivots = [
      {
        name: 'J1', pivotName: 'Pivot_J1', path: '',
        worldPositionMeters: [0, 0, 0] as [number, number, number],
        worldPositionMm: [10, 5, 0] as [number, number, number],
        localAxis: [0, 0, 1] as [number, number, number],
        worldAxis: [0, 0, 1] as [number, number, number],
        worldQuaternion: [0, 0, 0, 1] as [number, number, number, number],
        worldScale: [1, 1, 1] as [number, number, number],
      },
      {
        name: 'J2', pivotName: 'Pivot_J2', path: '',
        worldPositionMeters: [0.1, 0, 0] as [number, number, number],
        worldPositionMm: [110, 5, 0] as [number, number, number],
        localAxis: [0, 1, 0] as [number, number, number],
        worldAxis: [0, 1, 0] as [number, number, number],
        worldQuaternion: [0, 0, 0, 1] as [number, number, number, number],
        worldScale: [1, 1, 1] as [number, number, number],
      },
      {
        name: 'J3', pivotName: 'Pivot_J3', path: '',
        worldPositionMeters: [0.2, 0.05, 0] as [number, number, number],
        worldPositionMm: [210, 55, 0] as [number, number, number],
        localAxis: [0, 1, 0] as [number, number, number],
        worldAxis: [0, 1, 0] as [number, number, number],
        worldQuaternion: [0, 0, 0, 1] as [number, number, number, number],
        worldScale: [1, 1, 1] as [number, number, number],
      },
    ];

    const result = buildBestFitRigidAlignment(dhFrames, pivots);
    expect(result).not.toBeNull();
    expect(result!.translationMm).toHaveLength(3);
    expect(result!.rotation).toBeDefined();
  });

  it('不足 3 对返回 null', () => {
    const dhFrames = [
      { name: 'J1', positionMm: [0, 0, 0] as [number, number, number] },
    ];
    const pivots = [
      {
        name: 'J1', pivotName: 'Pivot_J1', path: '',
        worldPositionMeters: [0, 0, 0] as [number, number, number],
        worldPositionMm: [0, 0, 0] as [number, number, number],
        localAxis: [0, 0, 1] as [number, number, number],
        worldAxis: [0, 0, 1] as [number, number, number],
        worldQuaternion: [0, 0, 0, 1] as [number, number, number, number],
        worldScale: [1, 1, 1] as [number, number, number],
      },
    ];
    expect(buildBestFitRigidAlignment(dhFrames, pivots)).toBeNull();
  });
});
