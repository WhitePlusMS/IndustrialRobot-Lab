// src/lib/robot-pose-bridge.ts
// GLB 位姿能力的应用级桥接：替代 window.__GLB_* 全局注入。
// GLBRobotArm 在就绪后将 API 注册到这里，外部 Hook/模块通过此处获取。

import type { Pose } from '@/types/robot';

export interface RobotPoseAPI {
  /** 判断 GLB 位姿采样能力是否已就绪 */
  isAvailable: () => boolean;
  /** 获取当前法兰在世界坐标系中的位姿（GLB 场景坐标，单位米） */
  getFlangeMatrix: () => { position: [number, number, number]; rotation: number[][] } | null;
  /** 获取真实吸盘下表面中心与其从法兰指向接触面的方向（GLB 场景坐标，单位米） */
  getSuckerContactPose: () => {
    position: [number, number, number];
    direction: [number, number, number];
  } | null;
  /** 给定关节角，采样 GLB 模型对应的末端位姿 */
  capturePoseForJoints: (angles: number[]) => Pose | null;
}

// ===== 标定数据：PoE 运动学模型的构造参数 =====

/** 单个关节的零位标定信息（世界坐标系，长度单位 mm） */
export interface JointCalibData {
  /** 关节旋转轴在世界坐标系中的单位方向向量 */
  worldAxis: [number, number, number];
  /** 关节中心（pivot）在世界坐标系中的位置 */
  pivotPos: [number, number, number];
}

/** 场景完整标定数据：由 GLBRobotArm 挂载时一次性提取 */
export interface CalibrationData {
  /** 6 个关节的标定信息，索引 0=J1, 5=J6 */
  joints: JointCalibData[];
  /** 零位（所有关节角=0）时末端法兰在世界坐标系中的位姿（位置 mm，旋转矩阵） */
  zeroFlangePose: Pose;
  /** 标定数据是否已就绪 */
  available: boolean;
}

class RobotPoseBridge {
  private api: RobotPoseAPI | null = null;
  private listeners = new Set<(api: RobotPoseAPI | null) => void>();

  setAPI(api: RobotPoseAPI | null) {
    this.api = api;
    this.listeners.forEach((cb) => cb(api));
  }

  getAPI(): RobotPoseAPI | null {
    return this.api;
  }

  subscribe(callback: (api: RobotPoseAPI | null) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  // ===== 标定数据（PoE 模型构造参数）=====

  private calibration: CalibrationData | null = null;
  private calibListeners = new Set<(data: CalibrationData | null) => void>();

  setCalibration(data: CalibrationData | null) {
    this.calibration = data;
    this.calibListeners.forEach((cb) => cb(data));
  }

  getCalibration(): CalibrationData | null {
    return this.calibration;
  }

  subscribeCalibration(callback: (data: CalibrationData | null) => void): () => void {
    this.calibListeners.add(callback);
    return () => {
      this.calibListeners.delete(callback);
    };
  }
}

export const robotPoseBridge = new RobotPoseBridge();

// 暴露到 window 供浏览器调试（与 import 实例无关）
if (typeof window !== 'undefined') {
  (window as Record<string, unknown>).__robotPoseBridge = robotPoseBridge;
}
