// src/hooks/useSceneRendererAPI.ts
// 获取 Three.js renderer/scene：优先从 SceneRendererContext 读取，否则从 bridge 读取。

import { useEffect, useState } from 'react';
import { useSceneRendererOptional } from '@/contexts/SceneRendererContext';
import { sceneRendererBridge } from '@/lib/scene-renderer-bridge';
import type { SceneRendererAPI } from '@/contexts/SceneRendererContext';

export function useSceneRendererAPI(): SceneRendererAPI | null {
  const contextApi = useSceneRendererOptional();

  const [bridgeApi, setBridgeApi] = useState<SceneRendererAPI | null>(() => sceneRendererBridge.getAPI());

  useEffect(() => {
    if (contextApi) return;
    return sceneRendererBridge.subscribe(setBridgeApi);
  }, [contextApi]);

  return contextApi ?? bridgeApi;
}
