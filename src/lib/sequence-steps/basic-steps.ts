// src/lib/sequence-steps/basic-steps.ts
// 简单序列步骤：等待、吸盘开关、归位
import type { StepExecutorParams } from './types';

export async function executeWait({ step, stepIndex, callbacks, ctx }: StepExecutorParams): Promise<boolean> {
  const { log, onStepStatusChange } = callbacks;
  const { abortRef } = ctx;
  const duration = (step.params as { waitDuration?: number }).waitDuration ?? 1000;

  log('info', `等待 ${duration}ms...`);
  await new Promise((resolve) => setTimeout(resolve, duration));
  if (abortRef.current) return false;

  log('success', '等待结束');
  onStepStatusChange(stepIndex, 'success');
  return true;
}

export async function executeSuctionOn({ callbacks, ctx, stepIndex }: StepExecutorParams): Promise<boolean> {
  const { log, onStepStatusChange, onSuckerOn, getBoxState, isBoxAttachedStable } = callbacks;
  const { ctxRef, setCtx } = ctx;

  log('info', '吸盘开启...');
  onSuckerOn();
  const newCtx = { ...ctxRef.current, suckerOn: true };
  setCtx(newCtx);
  ctxRef.current = newCtx;

  const start = performance.now();
  let lastBoxState = getBoxState();
  let lastStable = isBoxAttachedStable();
  while (performance.now() - start < 1200) {
    lastBoxState = getBoxState();
    lastStable = isBoxAttachedStable();
    if (lastBoxState === 'ATTACHED' && lastStable) {
      log('success', '吸盘已开启，箱子已吸附');
      onStepStatusChange(stepIndex, 'success');
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  log('error', `吸盘开启失败：吸附未稳定（boxState=${lastBoxState}, stable=${lastStable ? 'true' : 'false'}）`);
  onStepStatusChange(stepIndex, 'error', `吸附未稳定（boxState=${lastBoxState}, stable=${lastStable ? 'true' : 'false'}）`);
  return false;
}

export async function executeSuctionOff({ callbacks, ctx, stepIndex }: StepExecutorParams): Promise<boolean> {
  const { log, onStepStatusChange, onSuckerOff } = callbacks;
  const { ctxRef, setCtx } = ctx;

  log('info', '吸盘关闭...');
  onSuckerOff();
  const newCtx = { ...ctxRef.current, suckerOn: false };
  setCtx(newCtx);
  ctxRef.current = newCtx;

  log('success', '吸盘已关闭，箱子释放');
  onStepStatusChange(stepIndex, 'success');
  return true;
}

export async function executeGoHome({ callbacks, ctx, stepIndex, deps, runtime }: StepExecutorParams): Promise<boolean> {
  const { log, onStepStatusChange } = callbacks;
  const { robot } = deps;
  const { abortRef } = ctx;

  log('info', '归位中...');
  robot.goToJoints([0, 0, 0, 0, 0, 0]);
  await runtime.waitForAnimation();
  if (abortRef.current) return false;

  log('success', '归位完成');
  onStepStatusChange(stepIndex, 'success');
  return true;
}
