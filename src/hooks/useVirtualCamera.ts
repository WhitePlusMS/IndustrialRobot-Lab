// src/hooks/useVirtualCamera.ts
// 虚拟工业相机状态管理（拍照/视锥体/相机模型参数）
import { useState, useCallback } from 'react';
import type { CameraState, CaptureResult } from '@/types/camera';

const DEFAULT_CAMERA_STATE: CameraState = {
  position: [-1.135, 3.0, 0.056], // m — 工业相机垂直向下，位于机械臂零点法兰正上方
  rotation: [-90, 0, 0],          // deg — 垂直向下（工业相机标准安装方向）
  fov: 60,
  near: 0.1,                    // m
  far: 10,                      // m
  showFrustum: true,
  showModel: true,
  resolution: [640, 480],
};

export function useVirtualCamera() {
  const [cameraState, setCameraState] = useState<CameraState>(DEFAULT_CAMERA_STATE);
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null);
  const [posStep, setPosStep] = useState(0.05);  // m
  const [rotStep, setRotStep] = useState(5);
  const [fovStep, setFovStep] = useState(5);

  const setPositionAxis = useCallback((axis: 0 | 1 | 2, value: number) => {
    setCameraState((s) => {
      const newPos: [number, number, number] = [...s.position] as [number, number, number];
      newPos[axis] = Math.round(value * 1000) / 1000;
      return { ...s, position: newPos };
    });
  }, []);

  const setRotationAxis = useCallback((axis: 0 | 1 | 2, value: number) => {
    setCameraState((s) => {
      const newRot: [number, number, number] = [...s.rotation] as [number, number, number];
      newRot[axis] = Math.round(value * 10) / 10;
      return { ...s, rotation: newRot };
    });
  }, []);

  const setFov = useCallback((value: number) => {
    setCameraState((s) => ({ ...s, fov: Math.max(10, Math.min(120, Math.round(value * 10) / 10)) }));
  }, []);

  const setNear = useCallback((value: number) => {
    setCameraState((s) => ({ ...s, near: Math.max(0.01, Math.min(1, value)) }));
  }, []);

  const setFar = useCallback((value: number) => {
    setCameraState((s) => ({ ...s, far: Math.max(1, Math.min(100, value)) }));
  }, []);

  const toggleFrustum = useCallback(() => {
    setCameraState((s) => ({ ...s, showFrustum: !s.showFrustum }));
  }, []);

  const toggleModel = useCallback(() => {
    setCameraState((s) => ({ ...s, showModel: !s.showModel }));
  }, []);

  const setResolution = useCallback((w: number, h: number) => {
    setCameraState((s) => ({ ...s, resolution: [w, h] as [number, number] }));
  }, []);

  const resetCamera = useCallback(() => {
    setCameraState(DEFAULT_CAMERA_STATE);
    setCaptureResult(null);
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
    setPositionAxis,
    setRotationAxis,
    setFov,
    setNear,
    setFar,
    toggleFrustum,
    toggleModel,
    setResolution,
    resetCamera,
    saveCapture,
  };
}
