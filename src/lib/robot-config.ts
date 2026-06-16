// src/lib/robot-config.ts
import type { RobotConfig, JointAngles  } from '@/types/robot';

/**
 * KUKA-like 六轴工业机械臂配置 — 按 GLB 实测标定
 *
 * GLB 模型数据 (MODEL_SCALE=0.0943):
 *   J1→J2: 358mm, J2→J3: 941mm, J3→J4: 705mm
 *   J4→J5: 272mm, J5→J6: 201mm, 总臂展: 1500mm
 *
 * 腕部非球腕: a5 偏移补偿 J4→J5 距离
 * 最终 FK 各段: J2→J3=890mm, J4→J5=218mm, 总臂展=1500mm
 */
export const KUKA_LIKE: RobotConfig = {
  name: 'KUKA-6DOF',
  dhParams: {
    joint1: { a: 0, alpha: 0, d: 459, thetaRange: [-180, 180] },
    joint2: { a: 358, alpha: -Math.PI / 2, d: 0, thetaRange: [-190, 45] },
    joint3: { a: 856, alpha: 0, d: 0, thetaRange: [-120, 156] },
    joint4: { a: 0, alpha: -Math.PI / 2, d: 705, thetaRange: [-185, 185] },
    joint5: { a: 218, alpha: Math.PI / 2, d: 0, thetaRange: [-120, 120] },
    joint6: { a: 0, alpha: -Math.PI / 2, d: 201, thetaRange: [-350, 350] },
  },
  baseHeight: 150,
  linkColors: ['#2563EB', '#2563EB', '#2563EB', '#9CA3AF', '#9CA3AF', '#9CA3AF'],
};

/** 初始姿态: 肩微垂、肘微屈，呈现有意义的工业机器人初始状态 */
export const DEFAULT_JOINTS: JointAngles = [0, -30, 60, 0, 0, 0];
