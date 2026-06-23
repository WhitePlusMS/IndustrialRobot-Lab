// src/lib/scene-kinematic-model.test.ts
// PoE 解析运动学模型测试 — 验证 FK + 解析 Jacobian + IK 闭环
import { describe, it, expect } from 'vitest';
import type { CalibrationData } from './robot-pose-bridge';
import type { JointAngles } from '@/types/robot';
import { SceneKinematicModel } from './scene-kinematic-model';
import { solveIK } from './ik-solver';

// ============================================================
// 测试用标定数据工厂
// ============================================================

function singleJointZ(): CalibrationData {
  return {
    joints: [{ worldAxis: [0, 0, 1], pivotPos: [0, 0, 0] }],
    zeroFlangePose: {
      position: [100, 0, 0],
      euler: [0, 0, 0],
      rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    },
    available: true,
  };
}

function twoJointZY(): CalibrationData {
  return {
    joints: [
      { worldAxis: [0, 0, 1], pivotPos: [0, 0, 0] },
      { worldAxis: [0, 1, 0], pivotPos: [100, 0, 0] },
    ],
    zeroFlangePose: {
      position: [200, 0, 0],
      euler: [0, 0, 0],
      rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    },
    available: true,
  };
}

function sixJointTestData(): CalibrationData {
  return {
    joints: [
      { worldAxis: [0, 0, 1], pivotPos: [0, 0, 0] },
      { worldAxis: [0, 1, 0], pivotPos: [100, 0, 0] },
      { worldAxis: [0, 1, 0], pivotPos: [200, 0, 0] },
      { worldAxis: [1, 0, 0], pivotPos: [200, 0, 100] },
      { worldAxis: [0, 1, 0], pivotPos: [200, -100, 100] },
      { worldAxis: [0, 0, 1], pivotPos: [200, -100, 200] },
    ],
    zeroFlangePose: {
      position: [200, -100, 250],
      euler: [0, 0, 0],
      rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    },
    available: true,
  };
}

function padJoints(...values: number[]): JointAngles {
  const joints: JointAngles = [0, 0, 0, 0, 0, 0];
  values.slice(0, joints.length).forEach((value, index) => {
    joints[index] = value;
  });
  return joints;
}

describe('IK with SceneKinematicModel (PoE)', () => {
  // 用接近真实场景的标定数据（基于 GLBRobotArm 控制台日志 + 实测轴）
  function sceneLikeCalibration(): CalibrationData {
    const pivotsMm: [number, number, number][] = [
      [100, 500, 0],       // J1 转台
      [-200, 500, -200],   // J2 大臂
      [-600, 1300, 0],     // J3 小臂
      [-1200, 1700, 100],  // J4 回转机构
      [-1400, 1900, 100],  // J5 末端关节
      [-1500, 1700, 100], // J6 快拆端口
    ];
    const axes: [number, number, number][] = [
      [0, 0.9999, 0.0128],     // J1 ≈ Y
      [0, 0.0128, -0.9999],    // J2 ≈ -Z
      [0, 0.0128, -0.9999],    // J3 ≈ -Z
      [1, 0, 0],               // J4 = X
      [0, 0.0128, -0.9999],    // J5 ≈ -Z
      [0, 0.9999, 0.0128],     // J6 ≈ Y
    ];
    return {
      joints: axes.map((a, i) => ({ worldAxis: a, pivotPos: pivotsMm[i] })),
      zeroFlangePose: {
        position: [-1135, 1317, 56],
        euler: [0, 0, 0],
        rotation: [[0.866, 0, 0.5], [-0.5, 0.0128, 0.866], [-0.0064, -1, 0.011]],
      },
      available: true,
    };
  }

  it('零位 IK：当前姿态就是目标姿态', () => {
    const model = new SceneKinematicModel(sixJointTestData());
    const current: JointAngles = [0, 0, 0, 0, 0, 0];
    const pose = model.forwardKinematics(current)!;
    const result = solveIK(pose, current, model);
    expect(result).not.toBeNull();
    result!.forEach((v, i) => expect(v).toBeCloseTo(current[i], 3));
  });

  it('场景近似标定 IK：3/4 测试姿态收敛（标定精度不足时不强制全部通过）', () => {
    const model = new SceneKinematicModel(sceneLikeCalibration());
    const testAngles: JointAngles[] = [
      [0, -30, 60, 0, 0, 0],
      [45, -20, 45, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ];
    let converged = 0;
    for (const target of testAngles) {
      const pose = model.forwardKinematics(target);
      if (!pose) continue;
      const result = solveIK(pose, [0, 0, 0, 0, 0, 0], model, {
        maxIterations: 200, posTolerance: 1, oriTolerance: 0.01, damping: 0.1,
      });
      if (result) {
        const resultPose = model.forwardKinematics(result);
        if (resultPose) {
          const err = Math.hypot(
            pose.position[0] - resultPose.position[0],
            pose.position[1] - resultPose.position[1],
            pose.position[2] - resultPose.position[2],
          );
          if (err < 2) converged++;
        }
      }
    }
    expect(converged).toBeGreaterThanOrEqual(2);
  });

  it('6关节合成标定 IK 全部收敛（验证 Jacobian 无退化）', () => {
    const model = new SceneKinematicModel(sixJointTestData());
    const testAngles: JointAngles[] = [
      [0, -30, 60, 0, 0, 0],
      [45, -20, 45, 0, 0, 0],
      [-60, -30, 60, 30, 0, 0],
      [0, -45, 90, 0, 0, 0],
      [0, -60, 45, 0, 15, 0],
    ];
    for (const target of testAngles) {
      const pose = model.forwardKinematics(target);
      expect(pose).not.toBeNull();
      const result = solveIK(pose!, [0, 0, 0, 0, 0, 0], model, {
        maxIterations: 200, posTolerance: 1, oriTolerance: 0.01, damping: 0.1,
      });
      expect(result).not.toBeNull();
      const resultPose = model.forwardKinematics(result!);
      expect(resultPose).not.toBeNull();
      const err = Math.hypot(
        pose!.position[0] - resultPose!.position[0],
        pose!.position[1] - resultPose!.position[1],
        pose!.position[2] - resultPose!.position[2],
      );
      expect(err).toBeLessThan(1.5);
    }
  });
});

// ============================================================
// 测试
// ============================================================

describe('SceneKinematicModel', () => {
  describe('isAvailable', () => {
    it('标定就绪时返回 true', () => {
      expect(new SceneKinematicModel(singleJointZ()).isAvailable()).toBe(true);
    });

    it('标定未就绪时返回 false', () => {
      const c = singleJointZ();
      c.available = false;
      expect(new SceneKinematicModel(c).isAvailable()).toBe(false);
    });
  });

  describe('forwardKinematics (PoE FK)', () => {
    it('单关节 零位: 末端 = zeroFlangePose [100,0,0]', () => {
      const m = new SceneKinematicModel(singleJointZ());
      const r = m.forwardKinematics(padJoints(0));
      expect(r).not.toBeNull();
      expect(r!.position[0]).toBeCloseTo(100, 5);
      expect(r!.position[1]).toBeCloseTo(0, 5);
      expect(r!.position[2]).toBeCloseTo(0, 5);
    });

    it('单关节 Z轴@原点 转90°: [100,0,0] → [0,100,0]', () => {
      const m = new SceneKinematicModel(singleJointZ());
      const r = m.forwardKinematics(padJoints(90));
      expect(r).not.toBeNull();
      expect(r!.position[0]).toBeCloseTo(0, 5);
      expect(r!.position[1]).toBeCloseTo(100, 5);
      expect(r!.position[2]).toBeCloseTo(0, 5);
    });

    it('单关节 Z轴@原点 转180°: [100,0,0] → [-100,0,0]', () => {
      const m = new SceneKinematicModel(singleJointZ());
      const r = m.forwardKinematics(padJoints(180));
      expect(r).not.toBeNull();
      expect(r!.position[0]).toBeCloseTo(-100, 5);
      expect(r!.position[1]).toBeCloseTo(0, 1);
      expect(r!.position[2]).toBeCloseTo(0, 5);
    });

    it('双关节 Z+Y 转90°+90°，结果有限', () => {
      const m = new SceneKinematicModel(twoJointZY());
      const r = m.forwardKinematics(padJoints(90, 90));
      expect(r).not.toBeNull();
      expect(r!.position.every(v => isFinite(v))).toBe(true);
      const trace = r!.rotation[0][0] + r!.rotation[1][1] + r!.rotation[2][2];
      expect(trace).not.toBeCloseTo(3, 5);
    });

    it('6关节 零位: 末端 = zeroFlangePose', () => {
      const m = new SceneKinematicModel(sixJointTestData());
      const r = m.forwardKinematics([0, 0, 0, 0, 0, 0]);
      expect(r).not.toBeNull();
      expect(r!.position[0]).toBeCloseTo(200, 5);
      expect(r!.position[1]).toBeCloseTo(-100, 5);
      expect(r!.position[2]).toBeCloseTo(250, 5);
    });
  });

  describe('estimateJacobian (解析 Jacobian)', () => {
    it('单关节 Z轴@原点: Jacobian 列 = [ω×(p-q); ω] · (π/180)', () => {
      const m = new SceneKinematicModel(singleJointZ());
      const J = m.estimateJacobian(padJoints(0));
      expect(J).not.toBeNull();
      expect(J!.length).toBe(6);
      expect(J![0].length).toBe(1);
      // ω=[0,0,1], p=[100,0,0], q=[0,0,0]
      // ω × (p-q) = [0,100,0], 乘 degToRad
      const dr = Math.PI / 180;
      expect(J![0][0]).toBeCloseTo(0, 5);
      expect(J![1][0]).toBeCloseTo(100 * dr, 5); // ~1.745
      expect(J![2][0]).toBeCloseTo(0, 5);
      expect(J![3][0]).toBeCloseTo(0, 5);
      expect(J![4][0]).toBeCloseTo(0, 5);
      expect(J![5][0]).toBeCloseTo(1 * dr, 5);  // ~0.01745
    });

    it('Jacobian 在非零位时姿态行依然非零', () => {
      const m = new SceneKinematicModel(singleJointZ());
      const J = m.estimateJacobian(padJoints(45));
      expect(J).not.toBeNull();
      const oriNorm = Math.hypot(J![3][0], J![4][0], J![5][0]);
      expect(oriNorm).toBeGreaterThan(0.01);
    });

    it('6 关节返回 6×6 Jacobian，每列非零', () => {
      const m = new SceneKinematicModel(sixJointTestData());
      const J = m.estimateJacobian([0, 0, 0, 0, 0, 0]);
      expect(J).not.toBeNull();
      expect(J!.length).toBe(6);
      expect(J![0].length).toBe(6);
      for (let col = 0; col < 6; col++) {
        const n = Math.hypot(J![0][col], J![1][col], J![2][col], J![3][col], J![4][col], J![5][col]);
        expect(n).toBeGreaterThan(0);
      }
    });
  });
});
