// src/lib/robot-pose-bridge.ts
// GLB 位姿能力的应用级桥接：替代 window.__GLB_* 全局注入。
// GLBRobotArm 在就绪后将 API 注册到这里，外部 Hook/模块通过此处获取。

import type { Pose } from '@/types/robot';

export interface RobotPoseAPI {
  /** 判断 GLB 位姿采样能力是否已就绪 */
  isAvailable: () => boolean;
  /** 获取当前法兰在世界坐标系中的位姿（GLB 场景坐标，单位米） */
  getFlangeMatrix: () => { position: [number, number, number]; rotation: number[][] } | null;
  /** 给定关节角，采样 GLB 模型对应的末端位姿 */
  capturePoseForJoints: (angles: number[]) => Pose | null;
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
}

export const robotPoseBridge = new RobotPoseBridge();
