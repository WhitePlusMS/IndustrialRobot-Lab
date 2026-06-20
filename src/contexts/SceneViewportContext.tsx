// src/contexts/SceneViewportContext.tsx
// 3D 场景视口状态：显示开关、场景相机位姿
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

const DEFAULT_SCENE_CAMERA_POSITION: [number, number, number] = [3, 2, 3];

interface SceneViewportContextValue {
  showGrid: boolean;
  showAxes: boolean;
  showTrajectory: boolean;
  showDH: boolean;
  showDataOverlay: boolean;
  showCoordinateSystems: boolean;
  toggleGrid: () => void;
  toggleAxes: () => void;
  toggleTrajectory: () => void;
  toggleDH: () => void;
  toggleDataOverlay: () => void;
  toggleCoordinateSystems: () => void;
  cameraPosition: [number, number, number];
  setCameraPosition: (pos: [number, number, number]) => void;
  setCameraPositionAxis: (axis: 0 | 1 | 2, value: number) => void;
  setCameraView: (view: 'front' | 'side' | 'top' | 'free') => void;
  resetCamera: () => void;
}

const SceneViewportContext = createContext<SceneViewportContextValue | null>(null);

export function SceneViewportProvider({ children }: { children: ReactNode }) {
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [showDH, setShowDH] = useState(false);
  const [showDataOverlay, setShowDataOverlay] = useState(true);
  const [showCoordinateSystems, setShowCoordinateSystems] = useState(true);
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>(DEFAULT_SCENE_CAMERA_POSITION);

  const toggleGrid = useCallback(() => setShowGrid((v) => !v), []);
  const toggleAxes = useCallback(() => setShowAxes((v) => !v), []);
  const toggleTrajectory = useCallback(() => setShowTrajectory((v) => !v), []);
  const toggleDH = useCallback(() => setShowDH((v) => !v), []);
  const toggleDataOverlay = useCallback(() => setShowDataOverlay((v) => !v), []);
  const toggleCoordinateSystems = useCallback(() => setShowCoordinateSystems((v) => !v), []);

  const setCameraPositionAxis = useCallback((axis: 0 | 1 | 2, value: number) => {
    setCameraPosition((prev) => {
      const next: [number, number, number] = [...prev] as [number, number, number];
      next[axis] = Math.round(value * 1000) / 1000;
      return next;
    });
  }, []);

  const setCameraView = useCallback((view: 'front' | 'side' | 'top' | 'free') => {
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
        showAxes,
        showTrajectory,
        showDH,
        showDataOverlay,
        showCoordinateSystems,
        toggleGrid,
        toggleAxes,
        toggleTrajectory,
        toggleDH,
        toggleDataOverlay,
        toggleCoordinateSystems,
        cameraPosition,
        setCameraPosition,
        setCameraPositionAxis,
        setCameraView,
        resetCamera,
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
