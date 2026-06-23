// src/lib/sequence-steps/types.ts
// 序列步骤执行器的共享类型
// 每个步骤模块的 interface：接收 StepContext，返回 StepResult

import type { SeqContext, ActionStep, SequenceLog } from '@/types/sequence';
import type { RobotPoseAPI } from '@/lib/robot-pose-bridge';
import type { SceneRendererAPI } from '@/contexts/SceneRendererContext';
import type { CameraState } from '@/types/camera';
import type { Waypoint } from '@/hooks/useRobot';
import type { SequenceRobotAPI } from '@/hooks/useActionSequence';
import type { BoxState } from '@/hooks/useSuckerControl';

/** 每个步骤执行器的最小化依赖集合 */
export interface StepDeps {
  robot: SequenceRobotAPI;
  cameraState: CameraState;
  robotPoseApi: RobotPoseAPI;
  sceneRendererApi: SceneRendererAPI | null;
}

/** 步骤执行器的可变上下文（通过 ref 传递以支持中止） */
export interface StepContext {
  ctxRef: React.MutableRefObject<SeqContext>;
  setCtx: React.Dispatch<React.SetStateAction<SeqContext>>;
  abortRef: React.MutableRefObject<boolean>;
  waypoints: Waypoint[];
}

/** 步骤执行器的回调集合 */
export interface StepCallbacks {
  log: (level: SequenceLog['level'], message: string) => void;
  onStepStatusChange: (index: number, status: ActionStep['execStatus'], message?: string) => void;
  onSuckerOn: () => void;
  onSuckerOff: () => void;
  onSpawnBox: (pos: [number, number, number], restingHeight?: number) => void;
  onDeleteAllBoxes: () => void;
  onResetBox: () => void;
  onCaptureSave: (result: { color?: string; segmentation?: string; depth?: string }) => void;
  getBoxState: () => BoxState;
  isBoxAttachedStable: () => boolean;
}

/** 完整步骤执行器接口 */
export interface StepExecutorParams {
  step: ActionStep;
  stepIndex: number;
  deps: StepDeps;
  ctx: StepContext;
  callbacks: StepCallbacks;
}

/** 执行结果 */
export type StepResult = boolean; // true=成功继续, false=失败停止序列
