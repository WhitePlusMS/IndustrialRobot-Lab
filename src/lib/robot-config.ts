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
    joint2: { a: 354, alpha: -Math.PI / 2, d: 0, thetaOffset: 0, thetaSign: 1, thetaRange: [-190, 45] },
    joint3: { a: 941, alpha: 0, d: 0, thetaOffset: 0, thetaSign: 1, thetaRange: [-120, 156] },
    // J4 起，真实 GLB 的后腕三轴约定不再与原先的简化腕部链一致。
    // 通过真实 pivot 轴向扫描确认：把 J4 扭转改为 +90°，并在零位补一个 -90° 偏置，
    // 能显著降低 J4/J5/J6 在零位下的几何中心误差，同时让三轴方向与 GLB 更一致。
    joint4: { a: 0, alpha: Math.PI / 2, d: 705, thetaOffset: -Math.PI / 2, thetaSign: 1, thetaRange: [-185, 185] },
    joint5: { a: 272, alpha: Math.PI / 2, d: 0, thetaOffset: 0, thetaSign: 1, thetaRange: [-120, 120] },
    joint6: { a: 0, alpha: -Math.PI / 2, d: 201, thetaOffset: 0, thetaSign: 1, thetaRange: [-350, 350] },
  },
  baseHeight: 150,
  linkColors: ['#2563EB', '#2563EB', '#2563EB', '#9CA3AF', '#9CA3AF', '#9CA3AF'],
};

/** 初始姿态: 肩微垂、肘微屈，呈现有意义的工业机器人初始状态 */
export const DEFAULT_JOINTS: JointAngles = [0, -30, 60, 0, 0, 0];
