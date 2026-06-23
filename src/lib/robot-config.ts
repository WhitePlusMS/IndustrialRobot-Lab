// src/lib/robot-config.ts
import type { RobotConfig, JointAngles  } from '@/types/robot';

/**
 * KUKA-like 六轴工业机械臂配置 — 按 GLB 实测标定
 *
 * GLB 模型零位实测（2026-06-16）:
 *   J1.d ≈ 459mm
 *   J1→J2 水平偏置 ≈ 354mm
 *   J2→J3 ≈ 941mm
 *   J3→J4 ≈ 705mm
 *   J4→J5 ≈ 272mm
 *   J5→J6 ≈ 201mm
 *
 * 这里优先让 DH 链长贴近 GLB 实测，避免“逆解数值正确但外壳模型走圆弧”。
 */
export const KUKA_LIKE: RobotConfig = {
  name: 'KUKA-6DOF',
  dhParams: {
    joint1: { a: 0, alpha: 0, d: 459, thetaOffset: 0, thetaSign: 1, thetaRange: [-180, 180] },
    joint2: { a: 354, alpha: -Math.PI / 2, d: 0, thetaOffset: 0, thetaSign: 1, thetaRange: [-90, 45] },
    joint3: { a: 941, alpha: 0, d: 0, thetaOffset: 0, thetaSign: 1, thetaRange: [-45, 90] },
    joint4: { a: 0, alpha: Math.PI / 2, d: 705, thetaOffset: -Math.PI / 2, thetaSign: 1, thetaRange: [-185, 185] },
    joint5: { a: 272, alpha: Math.PI / 2, d: 0, thetaOffset: 0, thetaSign: 1, thetaRange: [-50, 210] },
    joint6: { a: 0, alpha: -Math.PI / 2, d: 201, thetaOffset: 0, thetaSign: 1, thetaRange: [-350, 350] },
  },
  baseHeight: 150,
  linkColors: ['#2563EB', '#2563EB', '#2563EB', '#9CA3AF', '#9CA3AF', '#9CA3AF'],
};

/** 初始姿态: 全关节归零，机械臂呈竖直站立姿态 */
export const DEFAULT_JOINTS: JointAngles = [0, 0, 0, 0, 0, 0];
