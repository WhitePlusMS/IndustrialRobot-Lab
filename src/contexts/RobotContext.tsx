// src/contexts/RobotContext.tsx
// 机器人控制状态 Context：封装 useRobot，向面板/场景提供统一的机器人 API
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { useRobot } from '@/hooks/useRobot';
import { DEFAULT_JOINTS } from '@/lib/robot-config';
import type { JointAngles } from '@/types/robot';

type UseRobotReturn = ReturnType<typeof useRobot>;

interface RobotContextValue extends UseRobotReturn {
  sliderTargetRef: React.MutableRefObject<JointAngles>;
  /** 当前要高亮的关节索引（0~5），null 表示不高亮 */
  highlightedJoint: number | null;
  /** 设置要高亮的关节索引 */
  setHighlightedJoint: (index: number | null) => void;
}

const RobotContext = createContext<RobotContextValue | null>(null);

export function RobotProvider({ children }: { children: ReactNode }) {
  const sliderTargetRef = useRef<JointAngles>([...DEFAULT_JOINTS]);
  const robot = useRobot(sliderTargetRef);
  const [highlightedJoint, setHighlightedJoint] = useState<number | null>(null);
  const value: RobotContextValue = {
    ...robot,
    sliderTargetRef,
    highlightedJoint,
    setHighlightedJoint,
  };
  return <RobotContext.Provider value={value}>{children}</RobotContext.Provider>;
}

export function useRobotContext(): RobotContextValue {
  const ctx = useContext(RobotContext);
  if (!ctx) {
    throw new Error('useRobotContext must be used within RobotProvider');
  }
  return ctx;
}
