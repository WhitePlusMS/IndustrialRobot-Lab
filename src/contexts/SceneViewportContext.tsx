// src/contexts/SceneViewportContext.tsx
// 3D 场景视口状态：显示开关、场景相机位姿、Gizmo 操作轴
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

const DEFAULT_SCENE_CAMERA_POSITION: [number, number, number] = [3, 2, 3];

type GizmoMode = 'translate' | 'rotate';

interface SceneViewportContextValue {
  showGrid: boolean;
  showTrajectory: boolean;
  showDH: boolean;
  showDataOverlay: boolean;
  showCoordinateSystems: boolean;
  showTransformGizmo: boolean;
  gizmoMode: GizmoMode;
  /** 演示弹窗打开时隐藏视口内所有 HUD */
  suppressHUD: boolean;
  setSuppressHUD: (v: boolean) => void;
  toggleGrid: () => void;
  toggleTrajectory: () => void;
  toggleDH: () => void;
  toggleDataOverlay: () => void;
  toggleCoordinateSystems: () => void;
  toggleTransformGizmo: () => void;
  setGizmoMode: (mode: GizmoMode) => void;
  cameraPosition: [number, number, number];
  setCameraPosition: (pos: [number, number, number]) => void;
  setCameraPositionAxis: (axis: 0 | 1 | 2, value: number) => void;
  setCameraView: (view: 'front' | 'side' | 'top' | 'free') => void;
  resetCamera: () => void;
  /** 当前激活的视角预设 */
  cameraView: 'front' | 'side' | 'top' | 'free';
}

const SceneViewportContext = createContext<SceneViewportContextValue | null>(null);

export function SceneViewportProvider({ children }: { children: ReactNode }) {
  const [showGrid, setShowGrid] = useState(false);
  const [showTrajectory, setShowTrajectory] = useState(false);
  const [showDH, setShowDH] = useState(false);
  const [showDataOverlay, setShowDataOverlay] = useState(false);
  const [showCoordinateSystems, setShowCoordinateSystems] = useState(false);
  const [showTransformGizmo, setShowTransformGizmo] = useState(false);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('translate');
  const [suppressHUD, setSuppressHUD] = useState(false);
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>(DEFAULT_SCENE_CAMERA_POSITION);
  const [cameraView, setCameraViewState] = useState<'front' | 'side' | 'top' | 'free'>('free');

  const toggleGrid = useCallback(() => setShowGrid((v) => !v), []);
  const toggleTrajectory = useCallback(() => setShowTrajectory((v) => !v), []);
  const toggleDH = useCallback(() => setShowDH((v) => !v), []);
  const toggleDataOverlay = useCallback(() => setShowDataOverlay((v) => !v), []);
  const toggleCoordinateSystems = useCallback(() => setShowCoordinateSystems((v) => !v), []);
  const toggleTransformGizmo = useCallback(() => {
    setShowTransformGizmo((v) => !v);
  }, []);

  const setCameraPositionAxis = useCallback((axis: 0 | 1 | 2, value: number) => {
    setCameraPosition((prev) => {
      const next: [number, number, number] = [...prev] as [number, number, number];
      next[axis] = Math.round(value * 1000) / 1000;
      return next;
    });
  }, []);

  const setCameraView = useCallback((view: 'front' | 'side' | 'top' | 'free') => {
    setCameraViewState(view);
    switch (view) {
      case 'front':
        setCameraPosition([0, 1.5, 4]);
        break;
      case 'side':
        setCameraPosition([4, 1.5, 0]);
        break;
      case 'top':
        setCameraPosition([0, 5, 0.01]);
        break;
      case 'free':
      default:
        setCameraPosition([3, 2, 3]);
        break;
    }
  }, []);

  const resetCamera = useCallback(() => {
    setCameraPosition(DEFAULT_SCENE_CAMERA_POSITION);
  }, []);

  return (
    <SceneViewportContext.Provider
      value={{
        showGrid,
        showTrajectory,
        showDH,
        showDataOverlay,
        showCoordinateSystems,
        showTransformGizmo,
        gizmoMode,
        suppressHUD,
        setSuppressHUD,
        toggleGrid,
        toggleTrajectory,
        toggleDH,
        toggleDataOverlay,
        toggleCoordinateSystems,
        toggleTransformGizmo,
        setGizmoMode,
        cameraPosition,
        setCameraPosition,
        setCameraPositionAxis,
        setCameraView,
        resetCamera,
        cameraView,
      }}
    >
      {children}
    </SceneViewportContext.Provider>
  );
}

export function useSceneViewport(): SceneViewportContextValue {
  const ctx = useContext(SceneViewportContext);
  if (!ctx) {
    throw new Error('useSceneViewport must be used within SceneViewportProvider');
  }
  return ctx;
}
