// src/lib/sequence-steps/basic-steps.ts
// 简单序列步骤：等待、吸盘开关、归位
import type { StepExecutorParams } from './types';

export async function executeWait({ step, callbacks, ctx }: StepExecutorParams): Promise<boolean> {
  const { log, onStepStatusChange } = callbacks;
  const { abortRef } = ctx;
  const duration = (step.params as { waitDuration?: number }).waitDuration ?? 1000;

  log('info', `等待 ${duration}ms...`);
  await new Promise((resolve) => setTimeout(resolve, duration));
  if (abortRef.current) return false;

  log('success', '等待结束');
  onStepStatusChange(step.__index ?? 0, 'success');
  return true;
}

export async function executeSuctionOn({ callbacks, ctx, step }: StepExecutorParams): Promise<boolean> {
  const { log, onStepStatusChange, onSuckerOn, onForceAttachBox } = callbacks;
  const { ctxRef, setCtx } = ctx;

  log('info', '吸盘开启...');
  onSuckerOn();
  onForceAttachBox();
  const newCtx = { ...ctxRef.current, suckerOn: true };
  setCtx(newCtx);
  ctxRef.current = newCtx;

  log('success', '吸盘已开启，箱子已吸附');
  onStepStatusChange(step.__index ?? 0, 'success');
  return true;
}

export async function executeSuctionOff({ callbacks, ctx, step }: StepExecutorParams): Promise<boolean> {
  const { log, onStepStatusChange, onSuckerOff } = callbacks;
  const { ctxRef, setCtx } = ctx;

  log('info', '吸盘关闭...');
  onSuckerOff();
  const newCtx = { ...ctxRef.current, suckerOn: false };
  setCtx(newCtx);
  ctxRef.current = newCtx;

  log('success', '吸盘已关闭，箱子释放');
  onStepStatusChange(step.__index ?? 0, 'success');
  return true;
}

export async function executeGoHome({ callbacks, ctx, step, deps }: StepExecutorParams): Promise<boolean> {
  const { log, onStepStatusChange, onResetBox } = callbacks;
  const { robot } = deps;
  const { abortRef } = ctx;

  log('info', '归位中...');
  robot.goToJoints([0, 0, 0, 0, 0, 0]);
  await robot.waitForAnimation();
  if (abortRef.current) return false;

  onResetBox();
  log('success', '归位完成');
  onStepStatusChange(step.__index ?? 0, 'success');
  return true;
}
