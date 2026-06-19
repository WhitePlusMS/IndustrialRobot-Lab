// src/hooks/useRobotPoseAPI.ts
// 获取 GLB 位姿能力：从应用级 bridge 读取。
// 由于 useRobot 等调用方位于 Canvas 之外，而 GLB API 在 Canvas 内的 GLBRobotArm 产生，
// 因此使用 bridge 单例跨 React 子树传递能力，消除对 window.__GLB_* 的依赖。

import { useEffect, useState } from 'react';
import { robotPoseBridge } from '@/lib/robot-pose-bridge';
import type { RobotPoseAPI } from '@/lib/robot-pose-bridge';

export function useRobotPoseAPI(): RobotPoseAPI {
  const [api, setApi] = useState<RobotPoseAPI | null>(() => robotPoseBridge.getAPI());

  useEffect(() => {
    return robotPoseBridge.subscribe(setApi);
  }, []);

  return api ?? createUnavailableAPI();
}

function createUnavailableAPI(): RobotPoseAPI {
  return {
    isAvailable: () => false,
    getFlangeMatrix: () => null,
    capturePoseForJoints: () => null,
  };
}
