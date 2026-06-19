// src/contexts/SequenceContext.tsx
// 动作序列状态 Context：封装 useActionSequence，依赖 Robot/Sucker/VirtualCamera
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useActionSequence, buildSequenceRobotAPI } from '@/hooks/useActionSequence';
import { useWaypoints } from '@/hooks/useWaypoints';
import { useRobotContext } from './RobotContext';
import { useSuckerContext } from './SuckerContext';
import { useVirtualCameraContext } from './VirtualCameraContext';
import type { Waypoint } from '@/hooks/useRobot';

type SequenceContextValue = ReturnType<typeof useActionSequence>;

const SequenceContext = createContext<SequenceContextValue | null>(null);

export function SequenceProvider({ children }: { children: ReactNode }) {
  const robot = useRobotContext();
  const sucker = useSuckerContext();
  const camera = useVirtualCameraContext();

  const { waypoints: waypointRecords } = useWaypoints();
  const waypoints: Waypoint[] = useMemo(
    () => waypointRecords.map((wp) => ({ name: wp.name, joints: [...wp.joints] })),
    [waypointRecords]
  );

  const robotAPI = buildSequenceRobotAPI({
    config: robot.config,
    joints: robot.joints,
    goToJoints: robot.goToJoints,
    goToPosition: robot.goToPosition,
    stopAnimation: robot.stopAnimation,
    isAnimating: robot.isAnimating,
    isAnimatingRef: robot.isAnimatingRef,
  });

  const sequence = useActionSequence(
    robotAPI,
    camera.cameraState,
    sucker.turnSuckerOn,
    sucker.turnSuckerOff,
    sucker.forceAttachBox,
    sucker.spawnBox,
    sucker.resetBox,
    waypoints
  );

  // 同步序列箱子位置到场景
  useEffect(() => {
    if (
      sequence.ctx.boxPose &&
      sucker.boxState !== 'FALLING' &&
      sucker.boxState !== 'ATTACHED'
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
