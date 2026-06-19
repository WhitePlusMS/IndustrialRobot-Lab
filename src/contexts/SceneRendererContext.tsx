// src/contexts/SceneRendererContext.tsx
// 由 SceneCanvas 提供，向拍照/截图模块暴露 Three.js renderer 与 scene
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, type ReactNode } from 'react';
import type { WebGLRenderer, Scene } from 'three';

export interface SceneRendererAPI {
  renderer: WebGLRenderer;
  scene: Scene;
}

const SceneRendererContext = createContext<SceneRendererAPI | null>(null);

export function SceneRendererProvider({
  children,
  api,
}: {
  children: ReactNode;
  api: SceneRendererAPI;
}) {
  return <SceneRendererContext.Provider value={api}>{children}</SceneRendererContext.Provider>;
}

export function useSceneRenderer(): SceneRendererAPI {
  const ctx = useContext(SceneRendererContext);
  if (!ctx) {
    throw new Error('useSceneRenderer must be used within SceneRendererProvider');
  }
  return ctx;
}

/** 不强制要求 Provider；未挂载时返回 null */
export function useSceneRendererOptional(): SceneRendererAPI | null {
  return useContext(SceneRendererContext);
}
