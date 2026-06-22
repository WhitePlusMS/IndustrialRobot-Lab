// src/lib/sequence-steps/scene-steps.ts
// 场景相关序列步骤：生成箱子、拍照
import * as THREE from 'three';
import type { StepExecutorParams } from './types';
import { captureColorPhoto, captureSegmentationPhoto } from '@/lib/capture-engine';
import type { SeqContext } from '@/types/sequence';

export async function executeSpawnBox({ step, deps, ctx, callbacks }: StepExecutorParams): Promise<boolean> {
  const { ctxRef, setCtx } = ctx;
  const { log, onStepStatusChange, onSpawnBox } = callbacks;
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
    onStepStatusChange(step.__index ?? 0, 'error', '未配置箱子生成参数');
    return false;
  }

  if (spawn.mode === 'fixed') {
    const pos = spawn.fixedPosition ?? [300, 40, 200];
    log('info', `生成箱子(固定): (${pos[0]}, ${pos[1]}, ${pos[2]}) mm`);
    const newCtx: SeqContext = {
      ...ctxRef.current,
      boxPose: { position: pos, rotation: [0, 0, 0] },
    };
    setCtx(newCtx);
    ctxRef.current = newCtx;
    log('success', '箱子已生成（固定位置）');
    onStepStatusChange(step.__index ?? 0, 'success');
    return true;
  }

  // random mode
  const cx = spawn.randomCenter?.[0] ?? 300;
  const cz = spawn.randomCenter?.[1] ?? 200;
  const rx = spawn.randomRangeX ?? 150;
  const rz = spawn.randomRangeZ ?? 150;
  const minH = spawn.minHeight ?? 200;
  const maxH = spawn.maxHeight ?? 500;
  const restingH = spawn.restingHeight ?? 200;

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
  log('success', '箱子已生成（随机位置）');
  onStepStatusChange(step.__index ?? 0, 'success');
  return true;
}

export async function executeCapture({ step, deps, callbacks }: StepExecutorParams): Promise<boolean> {
  const { sceneRendererApi, cameraState } = deps;
  const { log, onStepStatusChange, onCaptureSave } = callbacks;

  log('info', '执行拍照...');
  if (!sceneRendererApi) {
    log('error', '渲染器未就绪，无法拍照');
    onStepStatusChange(step.__index ?? 0, 'error', '渲染器未就绪');
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
    onStepStatusChange(step.__index ?? 0, 'error', '拍照失败');
    return false;
  }
  onStepStatusChange(step.__index ?? 0, 'success');
  return true;
}
