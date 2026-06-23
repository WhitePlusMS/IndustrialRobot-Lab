// src/lib/sequence-steps/scene-steps.ts
// 场景相关序列步骤：生成箱子、拍照
import * as THREE from 'three';
import type { StepExecutorParams } from './types';
import { captureColorPhoto, captureSegmentationPhoto } from '@/lib/capture-engine';
import type { SeqContext } from '@/types/sequence';
import {
  DEFAULT_SEQUENCE_BOX_FIXED_POSITION,
  DEFAULT_SEQUENCE_BOX_MAX_HEIGHT,
  DEFAULT_SEQUENCE_BOX_MIN_HEIGHT,
  DEFAULT_SEQUENCE_BOX_RANDOM_CENTER,
  DEFAULT_SEQUENCE_BOX_RANDOM_RANGE_X,
  DEFAULT_SEQUENCE_BOX_RANDOM_RANGE_Z,
  DEFAULT_SEQUENCE_BOX_RESTING_HEIGHT,
} from '@/types/sequence';

export async function executeDeleteAllBoxes({ stepIndex, ctx, callbacks }: StepExecutorParams): Promise<boolean> {
  const { ctxRef, setCtx } = ctx;
  const { log, onStepStatusChange, onDeleteAllBoxes } = callbacks;

  log('info', '删除所有箱子...');
  onDeleteAllBoxes();

  const newCtx: SeqContext = {
    ...ctxRef.current,
    boxPose: null,
    suckerOn: false,
  };
  setCtx(newCtx);
  ctxRef.current = newCtx;

  log('success', '所有箱子已删除');
  onStepStatusChange(stepIndex, 'success');
  return true;
}

export async function executeSpawnBox({ step, stepIndex, deps, ctx, callbacks }: StepExecutorParams): Promise<boolean> {
  const { ctxRef, setCtx } = ctx;
  const { log, onStepStatusChange, onSpawnBox, getBoxState } = callbacks;
  const spawn = (step.params as { boxSpawn?: {
    mode?: 'fixed' | 'random';
    fixedPosition?: [number, number, number];
    randomCenter?: [number, number];
    randomRangeX?: number;
    randomRangeZ?: number;
    minHeight?: number;
    maxHeight?: number;
    restingHeight?: number;
  } }).boxSpawn;

  if (!spawn) {
    log('error', '未配置箱子生成参数');
    onStepStatusChange(stepIndex, 'error', '未配置箱子生成参数');
    return false;
  }

  if (spawn.mode === 'fixed') {
    const pos = spawn.fixedPosition ?? DEFAULT_SEQUENCE_BOX_FIXED_POSITION;
    const restingH = spawn.restingHeight ?? DEFAULT_SEQUENCE_BOX_RESTING_HEIGHT;
    log('info', `生成箱子(固定): (${pos[0]}, ${pos[1]}, ${pos[2]}) mm`);
    onSpawnBox(pos, restingH);
    const newCtx: SeqContext = {
      ...ctxRef.current,
      boxPose: { position: [pos[0], restingH, pos[2]], rotation: [0, 0, 0] },
    };
    setCtx(newCtx);
    ctxRef.current = newCtx;
    const settleStart = performance.now();
    while (performance.now() - settleStart < 3000) {
      const boxState = getBoxState();
      if (boxState === 'FREE' || boxState === 'RESTING') {
        log('success', '箱子已生成（固定位置）');
        onStepStatusChange(stepIndex, 'success');
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    log('error', '箱子生成超时：箱子未稳定落到目标高度');
    onStepStatusChange(stepIndex, 'error', '箱子未稳定');
    return false;
  }

  // random mode
  const cx = spawn.randomCenter?.[0] ?? DEFAULT_SEQUENCE_BOX_RANDOM_CENTER[0];
  const cz = spawn.randomCenter?.[1] ?? DEFAULT_SEQUENCE_BOX_RANDOM_CENTER[1];
  const rx = spawn.randomRangeX ?? DEFAULT_SEQUENCE_BOX_RANDOM_RANGE_X;
  const rz = spawn.randomRangeZ ?? DEFAULT_SEQUENCE_BOX_RANDOM_RANGE_Z;
  const minH = spawn.minHeight ?? DEFAULT_SEQUENCE_BOX_MIN_HEIGHT;
  const maxH = spawn.maxHeight ?? DEFAULT_SEQUENCE_BOX_MAX_HEIGHT;
  const restingH = spawn.restingHeight ?? DEFAULT_SEQUENCE_BOX_RESTING_HEIGHT;

  const randX = cx + (Math.random() * 2 - 1) * rx;
  const randZ = cz + (Math.random() * 2 - 1) * rz;
  const randY = minH + Math.random() * (maxH - minH);
  const dropPos: [number, number, number] = [Math.round(randX), Math.round(randY), Math.round(randZ)];

  log('info', `生成箱子(随机): (${dropPos[0]}, ${dropPos[1]}, ${dropPos[2]}) mm`);
  onSpawnBox(dropPos, restingH);

  const newCtx: SeqContext = {
    ...ctxRef.current,
    boxPose: { position: [dropPos[0], restingH, dropPos[2]], rotation: [0, 0, 0] },
  };
  setCtx(newCtx);
  ctxRef.current = newCtx;
  const settleStart = performance.now();
  while (performance.now() - settleStart < 3000) {
    const boxState = getBoxState();
    if (boxState === 'FREE' || boxState === 'RESTING') {
      log('success', '箱子已生成（随机位置）');
      onStepStatusChange(stepIndex, 'success');
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  log('error', '箱子生成超时：箱子未稳定落到目标高度');
  onStepStatusChange(stepIndex, 'error', '箱子未稳定');
  return false;
}

export async function executeCapture({ stepIndex, deps, callbacks }: StepExecutorParams): Promise<boolean> {
  const { sceneRendererApi, cameraState } = deps;
  const { log, onStepStatusChange, onCaptureSave } = callbacks;

  log('info', '执行拍照...');
  if (!sceneRendererApi) {
    log('error', '渲染器未就绪，无法拍照');
    onStepStatusChange(stepIndex, 'error', '渲染器未就绪');
    return false;
  }

  const { renderer, scene } = sceneRendererApi;
  const captureCamera = new THREE.PerspectiveCamera(
    cameraState.fov, cameraState.resolution[0] / cameraState.resolution[1],
    cameraState.near, cameraState.far,
  );
  captureCamera.position.set(cameraState.position[0], cameraState.position[1], cameraState.position[2]);
  captureCamera.rotation.set(
    (cameraState.rotation[0] * Math.PI) / 180,
    (cameraState.rotation[1] * Math.PI) / 180,
    (cameraState.rotation[2] * Math.PI) / 180,
    'XYZ',
  );
  captureCamera.updateProjectionMatrix();
  captureCamera.updateMatrixWorld();

  const photoScene = scene.clone();
  photoScene.traverse((obj) => { if (obj.userData?.isCameraModel) obj.visible = false; });

  try {
    const colorURL = captureColorPhoto(renderer, photoScene, captureCamera, cameraState.resolution);
    const segResult = captureSegmentationPhoto(renderer, photoScene, captureCamera, cameraState.resolution);
    onCaptureSave({ color: colorURL, segmentation: segResult.dataURL });
    log('success', '拍照完成');
  } catch (e) {
    log('error', `拍照失败: ${e instanceof Error ? e.message : String(e)}`);
    onStepStatusChange(stepIndex, 'error', '拍照失败');
    return false;
  }
  onStepStatusChange(stepIndex, 'success');
  return true;
}
