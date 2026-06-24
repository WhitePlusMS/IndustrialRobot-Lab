// src/contexts/SuckerContext.tsx
// 吸盘/箱子状态 Context：封装 useSuckerControl，依赖 RobotContext
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, type ReactNode } from 'react';
import { useSuckerControl, INITIAL_BOX_POSITION } from '@/hooks/useSuckerControl';
import { useRobotStateContext } from './RobotContext';

type SuckerContextValue = ReturnType<typeof useSuckerControl>;

const SuckerContext = createContext<SuckerContextValue | null>(null);

export function SuckerProvider({ children }: { children: ReactNode }) {
  const robot = useRobotStateContext();
  const sucker = useSuckerControl({
    joints: robot.joints,
    model: robot.model,
    initialBoxPosition: INITIAL_BOX_POSITION,
  });
  return <SuckerContext.Provider value={sucker}>{children}</SuckerContext.Provider>;
}

export function useSuckerContext(): SuckerContextValue {
  const ctx = useContext(SuckerContext);
  if (!ctx) {
    throw new Error('useSuckerContext must be used within SuckerProvider');
  }
  return ctx;
}
