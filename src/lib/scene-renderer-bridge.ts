// src/lib/scene-renderer-bridge.ts
// Three.js renderer/scene 的应用级桥接：替代 window.__R3F_CAPTURE。

import type { SceneRendererAPI } from '@/contexts/SceneRendererContext';

class SceneRendererBridge {
  private api: SceneRendererAPI | null = null;
  private listeners = new Set<(api: SceneRendererAPI | null) => void>();

  setAPI(api: SceneRendererAPI | null) {
    this.api = api;
    this.listeners.forEach((cb) => cb(api));
  }

  getAPI(): SceneRendererAPI | null {
    return this.api;
  }

  subscribe(callback: (api: SceneRendererAPI | null) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const sceneRendererBridge = new SceneRendererBridge();
