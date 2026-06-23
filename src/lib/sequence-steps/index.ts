// src/lib/sequence-steps/index.ts
// 序列步骤执行器注册表 — 唯一的 seam，ten 个步骤模块
import type { StepExecutorParams, StepResult } from './types';
import { executeWait, executeSuctionOn, executeSuctionOff, executeGoHome } from './basic-steps';
import { executeMoveAboveBox, executeDescendToBox, executeLift, executeMoveToWaypoint } from './move-steps';
import { executeSpawnBox, executeCapture, executeDeleteAllBoxes } from './scene-steps';

type StepExecutor = (params: StepExecutorParams) => Promise<StepResult>;

const registry: Record<string, StepExecutor> = {
  '删除所有箱子': executeDeleteAllBoxes,
  '生成箱子': executeSpawnBox,
  '拍照': executeCapture,
  '移动到箱子上方': executeMoveAboveBox,
  '下降到箱面': executeDescendToBox,
  '吸盘开启': executeSuctionOn,
  '吸盘关闭': executeSuctionOff,
  '抬升': executeLift,
  '移动到目标位姿': executeMoveToWaypoint,
  '归位': executeGoHome,
  '等待': executeWait,
};

/** 根据步骤类型分发执行器 */
export function dispatchStep(type: string, params: StepExecutorParams): Promise<StepResult> {
  const executor = registry[type];
  if (!executor) {
    params.callbacks.log('error', `未知步骤类型: ${type}`);
    return Promise.resolve(false);
  }
  return executor(params);
}

export { type StepExecutorParams, type StepResult } from './types';
