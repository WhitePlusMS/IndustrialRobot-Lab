// src/lib/robot-model.ts
// RobotModel 接口：将 FK 与 Jacobian 来源抽象，本应用仅使用 GLB 实现

import type { JointAngles, Pose } from '@/types/robot';

export interface RobotModel {
  /** FK：返回末端位姿（位置 mm，欧拉角 rad） */
  forwardKinematics(jointsDeg: JointAngles): Pose | null;
  /** 数值 Jacobian（6×6），行顺序 [vx, vy, vz, wx, wy, wz]，单位 mm/deg 与 rad/deg */
  estimateJacobian(jointsDeg: JointAngles, stepDeg?: number): number[][] | null;
  /** 模型是否已就绪 */
  isAvailable(): boolean;
}
