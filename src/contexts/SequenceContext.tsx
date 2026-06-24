// src/contexts/SequenceContext.tsx
// 动作序列状态 Context：封装 useActionSequence，依赖 Robot/Sucker/VirtualCamera
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useActionSequence, buildSequenceRobotAPI } from '@/hooks/useActionSequence';
import { useWaypoints } from '@/hooks/useWaypoints';
import { useRobotActionsContext, useRobotStateContext } from './RobotContext';
import { useSuckerContext } from './SuckerContext';
import { useVirtualCameraContext } from './VirtualCameraContext';
import type { Waypoint } from '@/hooks/useRobot';
import type { SequenceRobotAPI } from '@/lib/sequence-runtime';

type SequenceContextValue = ReturnType<typeof useActionSequence>;

const SequenceContext = createContext<SequenceContextValue | null>(null);

export function SequenceProvider({ children }: { children: ReactNode }) {
  const robotState = useRobotStateContext();
  const robotActions = useRobotActionsContext();
  const sucker = useSuckerContext();
  const camera = useVirtualCameraContext();

  const { waypoints: waypointRecords } = useWaypoints();
  const waypoints: Waypoint[] = useMemo(
    () => waypointRecords.map((wp) => ({ name: wp.name, joints: [...wp.joints] })),
    [waypointRecords]
  );

  const robotAPI: SequenceRobotAPI = buildSequenceRobotAPI({
    joints: robotState.joints,
    model: robotState.model,
    goToJoints: robotActions.goToJoints,
    goToPosition: robotActions.goToPosition,
    goToPoseMm: robotActions.goToPoseMm,
    isMotionQueueIdle: robotActions.isMotionQueueIdle,
    stopAnimation: robotActions.stopAnimation,
    isAnimating: robotState.isAnimating,
    isAnimatingRef: robotActions.isAnimatingRef,
  });

  const sequence = useActionSequence(
    robotAPI,
    camera.cameraState,
    sucker.turnSuckerOn,
    sucker.turnSuckerOff,
    sucker.spawnBox,
    sucker.resetBox,
    sucker.resetBox,
    sucker.getBoxState,
    sucker.isBoxAttachedStable,
    waypoints
  );

  // 同步序列箱子位置到场景
  useEffect(() => {
    if (
      sequence.ctx.boxPose &&
      sucker.boxState === 'FREE'
    ) {
      sucker.setBoxPositionExternal(sequence.ctx.boxPose.position);
    }
  }, [sequence.ctx.boxPose, sucker]);

  return <SequenceContext.Provider value={sequence}>{children}</SequenceContext.Provider>;
}

export function useSequenceContext(): SequenceContextValue {
  const ctx = useContext(SequenceContext);
  if (!ctx) {
    throw new Error('useSequenceContext must be used within SequenceProvider');
  }
  return ctx;
}
