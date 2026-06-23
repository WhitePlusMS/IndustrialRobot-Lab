// src/lib/sequence-steps/move-steps.ts
// 运动相关序列步骤：移动到箱子上方、下降、抬升、移动到记忆点
import type { StepExecutorParams } from './types';
import type { JointAngles } from '@/types/robot';
import { buildGraspApproachPose, buildGraspContactPose, buildLiftPose, buildPlacePose } from '@/lib/grasp-planning';
import { ATTACH_THRESHOLD, BOX_HALF_SIZE } from '@/hooks/useSuckerControl';
import {
  DEFAULT_SEQUENCE_PLACE_ORIENTATION_DEG,
  DEFAULT_SEQUENCE_PLACE_POSITION_M,
  DEFAULT_SEQUENCE_PLACE_PRESET_LABEL,
  DEFAULT_SEQUENCE_PLACE_PRESET_NAME,
} from '@/types/sequence';

function distanceMm(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 +
    (a[1] - b[1]) ** 2 +
    (a[2] - b[2]) ** 2
  );
}

export async function executeMoveAboveBox({ step, stepIndex, deps, ctx, callbacks }: StepExecutorParams): Promise<boolean> {
  const { robot } = deps;
  const { ctxRef, abortRef } = ctx;
  const { log, onStepStatusChange } = callbacks;

  if (!ctxRef.current.boxPose) {
    log('error', '未生成箱子，无法移动');
    onStepStatusChange(stepIndex, 'error', '未生成箱子');
    return false;
  }

  log('info', '移动到箱子上方...');
  const bp = ctxRef.current.boxPose.position;
  log('info', `[移动到箱子上方] 使用序列目标箱坐标: (${bp[0]}, ${bp[1]}, ${bp[2]}) mm`);
  const appH = (step.params as { approachHeight?: number }).approachHeight ?? 50;
  const approachPose = buildGraspApproachPose(bp, appH);

  if (!robot.goToPosition(
    approachPose.targetXM,
    approachPose.targetYM,
    approachPose.targetZM,
    approachPose.rx,
    approachPose.ry,
    approachPose.rz,
    approachPose.profile,
  )) {
    log('error', 'IK 无解：无法到达箱子上方');
    onStepStatusChange(stepIndex, 'error', 'IK 无解');
    return false;
  }
  await robot.waitForAnimation();
  if (abortRef.current) return false;

  log('success', '到达箱子上方');
  onStepStatusChange(stepIndex, 'success');
  return true;
}

export async function executeDescendToBox({ step, stepIndex, deps, ctx, callbacks }: StepExecutorParams): Promise<boolean> {
  const { robot, robotPoseApi } = deps;
  const { ctxRef, abortRef } = ctx;
  const { log, onStepStatusChange } = callbacks;

  if (!ctxRef.current.boxPose) {
    log('error', '未生成箱子，无法下降');
    onStepStatusChange(stepIndex, 'error', '未生成箱子');
    return false;
  }

  log('info', '下降到箱面...');
  const bp = ctxRef.current.boxPose.position;
  const contactPose = buildGraspContactPose(bp);

  if (!robot.goToPosition(
    contactPose.targetXM,
    contactPose.targetYM,
    contactPose.targetZM,
    contactPose.rx,
    contactPose.ry,
    contactPose.rz,
    contactPose.profile,
  )) {
    log('error', 'IK 无解：无法下降到箱面');
    onStepStatusChange(stepIndex, 'error', 'IK 无解');
    return false;
  }
  await robot.waitForAnimation();
  if (abortRef.current) return false;

  const boxTopCenterMm: [number, number, number] = [
    bp[0],
    bp[1] + BOX_HALF_SIZE,
    bp[2],
  ];

  for (let correctionIndex = 0; correctionIndex < 2; correctionIndex++) {
    const suckerContact = robotPoseApi.getSuckerContactPose();
    const flangePose = robotPoseApi.getFlangeMatrix();
    if (!suckerContact?.position || !flangePose?.position) {
      break;
    }

    const suckerContactMm: [number, number, number] = [
      suckerContact.position[0] * 1000,
      suckerContact.position[1] * 1000,
      suckerContact.position[2] * 1000,
    ];
    const offsetMm: [number, number, number] = [
      boxTopCenterMm[0] - suckerContactMm[0],
      boxTopCenterMm[1] - suckerContactMm[1],
      boxTopCenterMm[2] - suckerContactMm[2],
    ];
    const currentDistanceMm = distanceMm(suckerContactMm, boxTopCenterMm);

    log('info', `[下降到箱面] 接触校正检查 ${correctionIndex + 1}: distance=${currentDistanceMm.toFixed(2)}mm`);

    if (currentDistanceMm <= ATTACH_THRESHOLD - 2) {
      log('success', '接触箱面');
      onStepStatusChange(stepIndex, 'success');
      return true;
    }

    const correctedTargetM: [number, number, number] = [
      flangePose.position[0] + offsetMm[0] / 1000,
      flangePose.position[1] + offsetMm[1] / 1000,
      flangePose.position[2] + offsetMm[2] / 1000,
    ];

    log(
      'info',
      `[下降到箱面] 执行接触校正 ${correctionIndex + 1}: offset=(${offsetMm[0].toFixed(2)}, ${offsetMm[1].toFixed(2)}, ${offsetMm[2].toFixed(2)})mm`
    );

    if (!robot.goToPosition(
      correctedTargetM[0],
      correctedTargetM[1],
      correctedTargetM[2],
      contactPose.rx,
      contactPose.ry,
      contactPose.rz,
      contactPose.profile,
    )) {
      log('error', 'IK 无解：接触校正失败');
      onStepStatusChange(stepIndex, 'error', '接触校正失败');
      return false;
    }

    await robot.waitForAnimation();
    if (abortRef.current) return false;
  }

  const finalSuckerContact = robotPoseApi.getSuckerContactPose();
  if (finalSuckerContact?.position) {
    const finalSuckerContactMm: [number, number, number] = [
      finalSuckerContact.position[0] * 1000,
      finalSuckerContact.position[1] * 1000,
      finalSuckerContact.position[2] * 1000,
    ];
    const finalDistanceMm = distanceMm(finalSuckerContactMm, boxTopCenterMm);
    if (finalDistanceMm > ATTACH_THRESHOLD) {
      log('error', `接触箱面失败：真实吸盘接触点距离箱面中心 ${finalDistanceMm.toFixed(2)}mm`);
      onStepStatusChange(stepIndex, 'error', '真实接触点未进入吸附阈值');
      return false;
    }
  }

  log('success', '接触箱面');
  onStepStatusChange(stepIndex, 'success');
  return true;
}

export async function executeLift({ step, stepIndex, deps, ctx, callbacks }: StepExecutorParams): Promise<boolean> {
  const { robot, robotPoseApi } = deps;
  const { abortRef } = ctx;
  const { log, onStepStatusChange } = callbacks;

  log('info', '抬升中...');
  const glbResult = robotPoseApi.getFlangeMatrix();
  if (!glbResult) {
    log('error', '无法读取 GLB 法兰位置');
    onStepStatusChange(stepIndex, 'error', '无法读取 GLB 法兰位置');
    return false;
  }

  const liftH = (step.params as { liftHeight?: number }).liftHeight ?? 100;
  const liftPose = buildLiftPose(glbResult.position, liftH);
  if (!robot.goToPosition(
    liftPose.targetXM,
    liftPose.targetYM,
    liftPose.targetZM,
    liftPose.rx,
    liftPose.ry,
    liftPose.rz,
    liftPose.profile,
  )) {
    log('error', 'IK 无解：无法抬升');
    onStepStatusChange(stepIndex, 'error', 'IK 无解');
    return false;
  }
  await robot.waitForAnimation();
  if (abortRef.current) return false;

  log('success', '抬升完成');
  onStepStatusChange(stepIndex, 'success');
  return true;
}

export async function executeMoveToWaypoint({ step, stepIndex, deps, ctx, callbacks }: StepExecutorParams): Promise<boolean> {
  const { robot } = deps;
  const { abortRef, waypoints } = ctx;
  const { log, onStepStatusChange } = callbacks;

  const name = (step.params as { memoryPointName?: string }).memoryPointName;
  if (!name) {
    log('error', '未选择记忆点');
    onStepStatusChange(stepIndex, 'error', '未选择记忆点');
    return false;
  }

  if (name === DEFAULT_SEQUENCE_PLACE_PRESET_NAME) {
    const placePose = buildPlacePose(
      DEFAULT_SEQUENCE_PLACE_POSITION_M,
      DEFAULT_SEQUENCE_PLACE_ORIENTATION_DEG,
    );
    log(
      'info',
      `移动到目标位姿: ${DEFAULT_SEQUENCE_PLACE_PRESET_LABEL} [${DEFAULT_SEQUENCE_PLACE_POSITION_M[0].toFixed(4)}, ${DEFAULT_SEQUENCE_PLACE_POSITION_M[1].toFixed(4)}, ${DEFAULT_SEQUENCE_PLACE_POSITION_M[2].toFixed(4)}]m · [${DEFAULT_SEQUENCE_PLACE_ORIENTATION_DEG[0].toFixed(1)}, ${DEFAULT_SEQUENCE_PLACE_ORIENTATION_DEG[1].toFixed(1)}, ${DEFAULT_SEQUENCE_PLACE_ORIENTATION_DEG[2].toFixed(1)}]deg`
    );
    const exactPoseMoved = robot.goToPosition(
      placePose.targetXM,
      placePose.targetYM,
      placePose.targetZM,
      placePose.rx,
      placePose.ry,
      placePose.rz,
      placePose.profile,
    );

    if (!exactPoseMoved) {
      log('error', 'IK 无解：无法到达预设放置位姿');
      onStepStatusChange(stepIndex, 'error', 'IK 无解');
      return false;
    }

    await robot.waitForAnimation();
    if (abortRef.current) return false;

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
