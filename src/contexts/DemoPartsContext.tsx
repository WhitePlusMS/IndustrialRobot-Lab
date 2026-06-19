// src/contexts/DemoPartsContext.tsx
// 演示零件状态 Context：封装 useDemoParts
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, type ReactNode } from 'react';
import { useDemoParts } from '@/hooks/useDemoParts';

type DemoPartsContextValue = ReturnType<typeof useDemoParts>;

const DemoPartsContext = createContext<DemoPartsContextValue | null>(null);

export function DemoPartsProvider({ children }: { children: ReactNode }) {
  const demoParts = useDemoParts();
  return <DemoPartsContext.Provider value={demoParts}>{children}</DemoPartsContext.Provider>;
}

export function useDemoPartsContext(): DemoPartsContextValue {
  const ctx = useContext(DemoPartsContext);
  if (!ctx) {
    throw new Error('useDemoPartsContext must be used within DemoPartsProvider');
  }
  return ctx;
}
