// src/hooks/useVirtualCamera.ts
// 虚拟工业相机状态管理：对 UI 隐藏双轨状态，只暴露单一 patch 接口
import { useState, useCallback, useRef } from 'react';
import type { CameraState, CaptureResult } from '@/types/camera';

const DEFAULT_CAMERA_STATE: CameraState = {
  position: [-1.135, 3.0, 0.056],
  rotation: [-90, 0, 0],
  fov: 60,
  near: 0.1,
  far: 10,
  showCamera: false,
  showFrustum: true,
  showModel: true,
  resolution: [640, 480],
};

type CameraContinuousPatch = Partial<Pick<CameraState, 'position' | 'rotation' | 'fov' | 'near' | 'far'>>;

function normalizeCameraState(next: CameraState): CameraState {
  return {
    ...next,
    position: [
      Math.round(next.position[0] * 1000) / 1000,
      Math.round(next.position[1] * 1000) / 1000,
      Math.round(next.position[2] * 1000) / 1000,
    ],
    rotation: [
      Math.round(next.rotation[0] * 10) / 10,
      Math.round(next.rotation[1] * 10) / 10,
      Math.round(next.rotation[2] * 10) / 10,
    ],
    fov: Math.max(10, Math.min(120, Math.round(next.fov * 10) / 10)),
    near: Math.max(0.01, Math.min(1, next.near)),
    far: Math.max(1, Math.min(100, next.far)),
  };
}

function applyNormalizedPatch(base: CameraState, patch: CameraContinuousPatch): CameraState {
  return normalizeCameraState({
    ...base,
    ...patch,
    position: patch.position ?? base.position,
    rotation: patch.rotation ?? base.rotation,
  });
}

export function useVirtualCamera() {
  const [cameraState, setCameraState] = useState<CameraState>(DEFAULT_CAMERA_STATE);
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null);
  const [posStep, setPosStep] = useState(0.05);
  const [rotStep, setRotStep] = useState(5);
  const [fovStep, setFovStep] = useState(5);

  const cameraTargetRef = useRef<CameraState>({ ...DEFAULT_CAMERA_STATE });

  const applyCameraPatch = useCallback((patch: CameraContinuousPatch, options?: { commit?: boolean }) => {
    const commit = options?.commit ?? true;
    const nextTarget = applyNormalizedPatch(cameraTargetRef.current, patch);
    cameraTargetRef.current = nextTarget;

    if (commit) {
      setCameraState((current) => applyNormalizedPatch(current, patch));
    }
  }, []);

  const toggleFrustum = useCallback(() => {
    setCameraState((current) => {
      // 若相机整体未启用，开启视野锥时自动启用相机，避免用户困惑
      const next = { ...current, showFrustum: !current.showFrustum, showCamera: true };
      cameraTargetRef.current = next;
      return next;
    });
  }, []);

  const toggleModel = useCallback(() => {
    setCameraState((current) => {
      // 若相机整体未启用，开启模型时自动启用相机，避免用户困惑
      const next = { ...current, showModel: !current.showModel, showCamera: true };
      cameraTargetRef.current = next;
      return next;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    setCameraState((current) => {
      const next = { ...current, showCamera: !current.showCamera };
      cameraTargetRef.current = next;
      return next;
    });
  }, []);

  const setResolution = useCallback((w: number, h: number) => {
    setCameraState((current) => {
      const next = { ...current, resolution: [w, h] as [number, number] };
      cameraTargetRef.current = next;
      return next;
    });
  }, []);

  const resetCamera = useCallback(() => {
    setCameraState(DEFAULT_CAMERA_STATE);
    setCaptureResult(null);
    cameraTargetRef.current = { ...DEFAULT_CAMERA_STATE };
  }, []);

  const saveCapture = useCallback((result: CaptureResult) => {
    setCaptureResult(result);
  }, []);

  return {
    cameraState,
    captureResult,
    posStep,
    setPosStep,
    rotStep,
    setRotStep,
    fovStep,
    setFovStep,
    cameraTargetRef,
    applyCameraPatch,
    toggleFrustum,
    toggleModel,
    toggleCamera,
    setResolution,
    resetCamera,
    saveCapture,
  };
}
