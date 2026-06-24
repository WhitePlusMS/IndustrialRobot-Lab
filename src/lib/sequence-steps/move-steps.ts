// src/lib/sequence-steps/move-steps.ts
// 运动相关序列步骤：只负责编排与状态流转，抓取细节下沉到 TaskRobotAPI
import type { StepExecutorParams } from './types';
import type { JointAngles } from '@/types/robot';
import { createSequenceTaskRobot } from '@/lib/sequence-task-robot';
import { buildPlacePose } from '@/lib/grasp-planning';
import {
  DEFAULT_SEQUENCE_APPROACH_HEIGHT,
  DEFAULT_SEQUENCE_LIFT_HEIGHT,
  DEFAULT_SEQUENCE_PLACE_ORIENTATION_DEG,
  DEFAULT_SEQUENCE_PLACE_POSITION_M,
  DEFAULT_SEQUENCE_PLACE_PRESET_LABEL,
  DEFAULT_SEQUENCE_PLACE_PRESET_NAME,
} from '@/types/sequence';

export async function executeMoveAboveBox({ step, stepIndex, deps, ctx, callbacks }: StepExecutorParams): Promise<boolean> {
  const { robot, robotPoseApi } = deps;
  const { ctxRef, abortRef } = ctx;
  const { log, onStepStatusChange } = callbacks;

  if (!ctxRef.current.boxPose) {
    log('error', '未生成箱子，无法移动');
    onStepStatusChange(stepIndex, 'error', '未生成箱子');
    return false;
  }

  const taskRobot = createSequenceTaskRobot({
    robot,
    robotPoseApi,
    log: (message) => log('info', message),
  });

  const approachHeight = (step.params as { approachHeight?: number }).approachHeight ?? DEFAULT_SEQUENCE_APPROACH_HEIGHT;
  log('info', '移动到箱子上方...');
  const success = await taskRobot.approachBox(ctxRef.current.boxPose.position, approachHeight);
  if (abortRef.current) return false;
  if (!success) {
    log('error', 'IK 无解：无法到达箱子上方');
    onStepStatusChange(stepIndex, 'error', 'IK 无解');
    return false;
  }

  log('success', '到达箱子上方');
  onStepStatusChange(stepIndex, 'success');
  return true;
}

export async function executeDescendToBox({ stepIndex, deps, ctx, callbacks }: StepExecutorParams): Promise<boolean> {
  const { robot, robotPoseApi } = deps;
  const { ctxRef, abortRef } = ctx;
  const { log, onStepStatusChange } = callbacks;

  if (!ctxRef.current.boxPose) {
    log('error', '未生成箱子，无法下降');
    onStepStatusChange(stepIndex, 'error', '未生成箱子');
    return false;
  }

  const taskRobot = createSequenceTaskRobot({
    robot,
    robotPoseApi,
    log: (message) => log('info', message),
  });

  log('info', '下降到箱面...');
  const success = await taskRobot.descendToBox(ctxRef.current.boxPose.position);
  if (abortRef.current) return false;
  if (!success) {
    log('error', '接触箱面失败');
    onStepStatusChange(stepIndex, 'error', '接触箱面失败');
    return false;
  }

  log('success', '接触箱面');
  onStepStatusChange(stepIndex, 'success');
  return true;
}

export async function executeLift({ step, stepIndex, deps, ctx, callbacks }: StepExecutorParams): Promise<boolean> {
  const { robot, robotPoseApi } = deps;
  const { abortRef } = ctx;
  const { log, onStepStatusChange } = callbacks;

  const taskRobot = createSequenceTaskRobot({
    robot,
    robotPoseApi,
    log: (message) => log('info', message),
  });

  const liftHeight = (step.params as { liftHeight?: number }).liftHeight ?? DEFAULT_SEQUENCE_LIFT_HEIGHT;
  log('info', '抬升中...');
  const success = await taskRobot.liftCurrentFlange(liftHeight);
  if (abortRef.current) return false;
  if (!success) {
    log('error', 'IK 无解：无法抬升');
    onStepStatusChange(stepIndex, 'error', 'IK 无解');
    return false;
  }

  log('success', '抬升完成');
  onStepStatusChange(stepIndex, 'success');
  return true;
}

export async function executeMoveToWaypoint({ step, stepIndex, deps, ctx, callbacks }: StepExecutorParams): Promise<boolean> {
  const { robot, robotPoseApi } = deps;
  const { abortRef, waypoints } = ctx;
  const { log, onStepStatusChange } = callbacks;

  const name = (step.params as { memoryPointName?: string }).memoryPointName;
  if (!name) {
    log('error', '未选择记忆点');
    onStepStatusChange(stepIndex, 'error', '未选择记忆点');
    return false;
  }

  if (name === DEFAULT_SEQUENCE_PLACE_PRESET_NAME) {
    const taskRobot = createSequenceTaskRobot({
      robot,
      robotPoseApi,
      log: (message) => log('info', message),
    });
    const placePose = buildPlacePose(DEFAULT_SEQUENCE_PLACE_POSITION_M, DEFAULT_SEQUENCE_PLACE_ORIENTATION_DEG);
    log(
      'info',
      `移动到目标位姿: ${DEFAULT_SEQUENCE_PLACE_PRESET_LABEL} [${DEFAULT_SEQUENCE_PLACE_POSITION_M[0].toFixed(4)}, ${DEFAULT_SEQUENCE_PLACE_POSITION_M[1].toFixed(4)}, ${DEFAULT_SEQUENCE_PLACE_POSITION_M[2].toFixed(4)}]m · [${DEFAULT_SEQUENCE_PLACE_ORIENTATION_DEG[0].toFixed(1)}, ${DEFAULT_SEQUENCE_PLACE_ORIENTATION_DEG[1].toFixed(1)}, ${DEFAULT_SEQUENCE_PLACE_ORIENTATION_DEG[2].toFixed(1)}]deg`
    );
    const success = await taskRobot.moveToPlacePose(placePose);
    if (abortRef.current) return false;
    if (!success) {
      log('error', 'IK 无解：无法到达预设放置位姿');
      onStepStatusChange(stepIndex, 'error', 'IK 无解');
      return false;
    }

    log('success', `到达目标位姿: ${DEFAULT_SEQUENCE_PLACE_PRESET_LABEL}`);
    onStepStatusChange(stepIndex, 'success');
    return true;
  }

  const wp = waypoints.find((w) => w.name === name);
  if (!wp) {
    log('error', `记忆点"${name}"不存在`);
    onStepStatusChange(stepIndex, 'error', '记忆点不存在');
    return false;
  }

  log('info', `移动到目标位姿: ${name}`);
  robot.goToJoints([...wp.joints] as JointAngles);
  await robot.waitForAnimation();
  if (abortRef.current) return false;

  log('success', `到达目标位姿: ${name}`);
  onStepStatusChange(stepIndex, 'success');
  return true;
}
