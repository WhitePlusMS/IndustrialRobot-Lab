// src/lib/sequence-steps/move-steps.ts
// 运动相关序列步骤：移动到箱子上方、下降、抬升、移动到记忆点
import type { StepExecutorParams } from './types';
import type { JointAngles } from '@/types/robot';

const BOX_HALF_SIZE = 40;
const SUCKER_LENGTH = 25;

export async function executeMoveAboveBox({ step, deps, ctx, callbacks }: StepExecutorParams): Promise<boolean> {
  const { robot } = deps;
  const { ctxRef, abortRef } = ctx;
  const { log, onStepStatusChange } = callbacks;

  if (!ctxRef.current.boxPose) {
    log('error', '未生成箱子，无法移动');
    onStepStatusChange(step.__index ?? 0, 'error', '未生成箱子');
    return false;
  }

  log('info', '移动到箱子上方...');
  const bp = ctxRef.current.boxPose.position;
  const appH = (step.params as { approachHeight?: number }).approachHeight ?? 50;

  if (!robot.goToPosition(
    bp[0] / 1000, (bp[1] + BOX_HALF_SIZE + SUCKER_LENGTH + appH) / 1000, bp[2] / 1000,
  )) {
    log('error', 'IK 无解：无法到达箱子上方');
    onStepStatusChange(step.__index ?? 0, 'error', 'IK 无解');
    return false;
  }
  await robot.waitForAnimation();
  if (abortRef.current) return false;

  log('success', '到达箱子上方');
  onStepStatusChange(step.__index ?? 0, 'success');
  return true;
}

export async function executeDescendToBox({ step, deps, ctx, callbacks }: StepExecutorParams): Promise<boolean> {
  const { robot } = deps;
  const { ctxRef, abortRef } = ctx;
  const { log, onStepStatusChange } = callbacks;

  if (!ctxRef.current.boxPose) {
    log('error', '未生成箱子，无法下降');
    onStepStatusChange(step.__index ?? 0, 'error', '未生成箱子');
    return false;
  }

  log('info', '下降到箱面...');
  const bp = ctxRef.current.boxPose.position;
  const rot = robot.getCurrentRotation();
  const tz: [number, number, number] = [rot[0][2], rot[1][2], rot[2][2]];

  if (!robot.goToPosition(
    (bp[0] + tz[0] * SUCKER_LENGTH) / 1000,
    (bp[1] + BOX_HALF_SIZE + tz[1] * SUCKER_LENGTH) / 1000,
    (bp[2] + tz[2] * SUCKER_LENGTH) / 1000,
  )) {
    log('error', 'IK 无解：无法下降到箱面');
    onStepStatusChange(step.__index ?? 0, 'error', 'IK 无解');
    return false;
  }
  await robot.waitForAnimation();
  if (abortRef.current) return false;

  log('success', '接触箱面');
  onStepStatusChange(step.__index ?? 0, 'success');
  return true;
}

export async function executeLift({ step, deps, ctx, callbacks }: StepExecutorParams): Promise<boolean> {
  const { robot, robotPoseApi } = deps;
  const { abortRef } = ctx;
  const { log, onStepStatusChange } = callbacks;

  log('info', '抬升中...');
  const glbResult = robotPoseApi.getFlangeMatrix();
  if (!glbResult) {
    log('error', '无法读取 GLB 法兰位置');
    onStepStatusChange(step.__index ?? 0, 'error', '无法读取 GLB 法兰位置');
    return false;
  }

  const liftH = (step.params as { liftHeight?: number }).liftHeight ?? 100;
  if (!robot.goToPosition(glbResult.position[0], glbResult.position[1] + liftH / 1000, glbResult.position[2])) {
    log('error', 'IK 无解：无法抬升');
    onStepStatusChange(step.__index ?? 0, 'error', 'IK 无解');
    return false;
  }
  await robot.waitForAnimation();
  if (abortRef.current) return false;

  log('success', '抬升完成');
  onStepStatusChange(step.__index ?? 0, 'success');
  return true;
}

export async function executeMoveToWaypoint({ step, deps, ctx, callbacks }: StepExecutorParams): Promise<boolean> {
  const { robot } = deps;
  const { abortRef, waypoints } = ctx;
  const { log, onStepStatusChange } = callbacks;

  const name = (step.params as { memoryPointName?: string }).memoryPointName;
  if (!name) {
    log('error', '未选择记忆点');
    onStepStatusChange(step.__index ?? 0, 'error', '未选择记忆点');
    return false;
  }

  const wp = waypoints.find((w) => w.name === name);
  if (!wp) {
    log('error', `记忆点"${name}"不存在`);
    onStepStatusChange(step.__index ?? 0, 'error', '记忆点不存在');
    return false;
  }

  log('info', `移动到目标位姿: ${name}`);
  robot.goToJoints([...wp.joints] as JointAngles);
  await robot.waitForAnimation();
  if (abortRef.current) return false;

  log('success', `到达目标位姿: ${name}`);
  onStepStatusChange(step.__index ?? 0, 'success');
  return true;
}
