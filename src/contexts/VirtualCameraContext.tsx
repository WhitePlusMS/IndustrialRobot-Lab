// src/contexts/VirtualCameraContext.tsx
// 虚拟工业相机状态 Context：封装 useVirtualCamera
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, type ReactNode } from 'react';
import { useVirtualCamera } from '@/hooks/useVirtualCamera';

type VirtualCameraContextValue = ReturnType<typeof useVirtualCamera>;

const VirtualCameraContext = createContext<VirtualCameraContextValue | null>(null);

export function VirtualCameraProvider({ children }: { children: ReactNode }) {
  const camera = useVirtualCamera();
  return <VirtualCameraContext.Provider value={camera}>{children}</VirtualCameraContext.Provider>;
}

export function useVirtualCameraContext(): VirtualCameraContextValue {
  const ctx = useContext(VirtualCameraContext);
  if (!ctx) {
    throw new Error('useVirtualCameraContext must be used within VirtualCameraProvider');
  }
  return ctx;
}
