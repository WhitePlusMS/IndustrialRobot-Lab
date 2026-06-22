// src/hooks/useVirtualCamera.ts
// 虚拟工业相机状态管理（拍照/视锥体/相机模型参数）
import { useState, useCallback, useRef } from 'react';
import type { CameraState, CaptureResult } from '@/types/camera';

const DEFAULT_CAMERA_STATE: CameraState = {
  position: [-1.135, 3.0, 0.056], // m — 工业相机垂直向下，位于机械臂零点法兰正上方
  rotation: [-90, 0, 0],          // deg — 垂直向下（工业相机标准安装方向）
  fov: 60,
  near: 0.1,                    // m
  far: 10,                      // m
  showCamera: true,
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

  /**
   * 滑块/输入框直接写入的目标相机状态 ref。
   * 3D 层在 useFrame 中读取该 ref 做插值，避免拖动时高频触发 React state 导致丢帧/瞬移。
   */
  const cameraSliderTargetRef = useRef<CameraState>({ ...DEFAULT_CAMERA_STATE });

  const setPositionAxis = useCallback((axis: 0 | 1 | 2, value: number) => {
    setCameraState((s) => {
      const newPos: [number, number, number] = [...s.position] as [number, number, number];
      newPos[axis] = Math.round(value * 1000) / 1000;
      const next = { ...s, position: newPos };
      cameraSliderTargetRef.current = next;
      return next;
    });
  }, []);

  const setRotationAxis = useCallback((axis: 0 | 1 | 2, value: number) => {
    setCameraState((s) => {
      const newRot: [number, number, number] = [...s.rotation] as [number, number, number];
      newRot[axis] = Math.round(value * 10) / 10;
      const next = { ...s, rotation: newRot };
      cameraSliderTargetRef.current = next;
      return next;
    });
  }, []);

  const setFov = useCallback((value: number) => {
    setCameraState((s) => {
      const next = { ...s, fov: Math.max(10, Math.min(120, Math.round(value * 10) / 10)) };
      cameraSliderTargetRef.current = next;
      return next;
    });
  }, []);

  const setNear = useCallback((value: number) => {
    setCameraState((s) => {
      const next = { ...s, near: Math.max(0.01, Math.min(1, value)) };
      cameraSliderTargetRef.current = next;
      return next;
    });
  }, []);

  const setFar = useCallback((value: number) => {
    setCameraState((s) => {
      const next = { ...s, far: Math.max(1, Math.min(100, value)) };
      cameraSliderTargetRef.current = next;
      return next;
    });
  }, []);

  /**
   * 直接写 slider target ref，供滑块拖动等高频场景使用。
   * 不触发 React state，3D 层 useFrame 读取 ref 即时更新。
   */
  const setPositionAxisTarget = useCallback((axis: 0 | 1 | 2, value: number) => {
    const current = cameraSliderTargetRef.current;
    const newPos: [number, number, number] = [...current.position] as [number, number, number];
    newPos[axis] = Math.round(value * 1000) / 1000;
    cameraSliderTargetRef.current = { ...current, position: newPos };
  }, []);

  const setRotationAxisTarget = useCallback((axis: 0 | 1 | 2, value: number) => {
    const current = cameraSliderTargetRef.current;
    const newRot: [number, number, number] = [...current.rotation] as [number, number, number];
    newRot[axis] = Math.round(value * 10) / 10;
    cameraSliderTargetRef.current = { ...current, rotation: newRot };
  }, []);

  const setFovTarget = useCallback((value: number) => {
    const current = cameraSliderTargetRef.current;
    cameraSliderTargetRef.current = { ...current, fov: Math.max(10, Math.min(120, Math.round(value * 10) / 10)) };
  }, []);

  const setNearTarget = useCallback((value: number) => {
    const current = cameraSliderTargetRef.current;
    cameraSliderTargetRef.current = { ...current, near: Math.max(0.01, Math.min(1, value)) };
  }, []);

  const setFarTarget = useCallback((value: number) => {
    const current = cameraSliderTargetRef.current;
    cameraSliderTargetRef.current = { ...current, far: Math.max(1, Math.min(100, value)) };
  }, []);

  const toggleFrustum = useCallback(() => {
    setCameraState((s) => {
      const next = { ...s, showFrustum: !s.showFrustum };
      cameraSliderTargetRef.current = next;
      return next;
    });
  }, []);

  const toggleModel = useCallback(() => {
    setCameraState((s) => {
      const next = { ...s, showModel: !s.showModel };
      cameraSliderTargetRef.current = next;
      return next;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    setCameraState((s) => {
      const next = { ...s, showCamera: !s.showCamera };
      cameraSliderTargetRef.current = next;
      return next;
    });
  }, []);

  const setResolution = useCallback((w: number, h: number) => {
    setCameraState((s) => {
      const next = { ...s, resolution: [w, h] as [number, number] };
      cameraSliderTargetRef.current = next;
      return next;
    });
  }, []);

  const resetCamera = useCallback(() => {
    setCameraState(DEFAULT_CAMERA_STATE);
    setCaptureResult(null);
    cameraSliderTargetRef.current = { ...DEFAULT_CAMERA_STATE };
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
    cameraSliderTargetRef,
    setPositionAxis,
    setRotationAxis,
    setFov,
    setNear,
    setFar,
    setPositionAxisTarget,
    setRotationAxisTarget,
    setFovTarget,
    setNearTarget,
    setFarTarget,
    toggleFrustum,
    toggleModel,
    toggleCamera,
    setResolution,
    resetCamera,
    saveCapture,
  };
}
