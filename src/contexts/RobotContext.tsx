// src/contexts/RobotContext.tsx
// 机器人控制 Context：将 useRobot 拆为“状态面 + 命令面”
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRobot } from '@/hooks/useRobot';
import { DEFAULT_JOINTS } from '@/lib/robot-config';
import type { JointAngles } from '@/types/robot';

type UseRobotReturn = ReturnType<typeof useRobot>;

type RobotStateValue = Pick<
  UseRobotReturn,
  | 'joints'
  | 'endEffectorPose'
  | 'originJoints'
  | 'trajectory'
  | 'coordinateSystem'
  | 'jointStep'
  | 'posStep'
  | 'rotStep'
  | 'selectedTool'
  | 'toolList'
  | 'status'
  | 'isAnimating'
  | 'glbPosition'
  | 'config'
  | 'model'
> & {
  highlightedJoint: number | null;
};

type RobotActionsValue = Pick<
  UseRobotReturn,
  | 'addTrajectoryPoint'
  | 'adjustJoint'
  | 'setJoint'
  | 'moveDirection'
  | 'saveOrigin'
  | 'goToOrigin'
  | 'goToZero'
  | 'resetJoints'
  | 'randomJoints'
  | 'goToJoints'
  | 'goToPoseMm'
  | 'goToPosition'
  | 'isMotionQueueIdle'
  | 'stopAnimation'
  | 'setCoordinateSystem'
  | 'setJointStep'
  | 'setPosStep'
  | 'setRotStep'
  | 'setSelectedTool'
  | 'setToolList'
  | 'setStatus'
  | 'isAnimatingRef'
  | 'gizmoIKRef'
> & {
  sliderTargetRef: React.MutableRefObject<JointAngles>;
  setHighlightedJoint: (index: number | null) => void;
};

const RobotStateContext = createContext<RobotStateValue | null>(null);
const RobotActionsContext = createContext<RobotActionsValue | null>(null);

export function RobotProvider({ children }: { children: ReactNode }) {
  const sliderTargetRef = useRef<JointAngles>([...DEFAULT_JOINTS]);
  const robot = useRobot(sliderTargetRef);
  const [highlightedJoint, setHighlightedJoint] = useState<number | null>(null);

  const stateValue = useMemo<RobotStateValue>(() => ({
    joints: robot.joints,
    endEffectorPose: robot.endEffectorPose,
    originJoints: robot.originJoints,
    trajectory: robot.trajectory,
    coordinateSystem: robot.coordinateSystem,
    jointStep: robot.jointStep,
    posStep: robot.posStep,
    rotStep: robot.rotStep,
    selectedTool: robot.selectedTool,
    toolList: robot.toolList,
    status: robot.status,
    isAnimating: robot.isAnimating,
    glbPosition: robot.glbPosition,
    config: robot.config,
    model: robot.model,
    highlightedJoint,
  }), [
    highlightedJoint,
    robot.config,
    robot.coordinateSystem,
    robot.endEffectorPose,
    robot.glbPosition,
    robot.isAnimating,
    robot.jointStep,
    robot.joints,
    robot.model,
    robot.originJoints,
    robot.posStep,
    robot.rotStep,
    robot.selectedTool,
    robot.status,
    robot.toolList,
    robot.trajectory,
  ]);

  const actionsValue = useMemo<RobotActionsValue>(() => ({
    addTrajectoryPoint: robot.addTrajectoryPoint,
    adjustJoint: robot.adjustJoint,
    setJoint: robot.setJoint,
    moveDirection: robot.moveDirection,
    saveOrigin: robot.saveOrigin,
    goToOrigin: robot.goToOrigin,
    goToZero: robot.goToZero,
    resetJoints: robot.resetJoints,
    randomJoints: robot.randomJoints,
    goToJoints: robot.goToJoints,
    goToPoseMm: robot.goToPoseMm,
    goToPosition: robot.goToPosition,
    isMotionQueueIdle: robot.isMotionQueueIdle,
    stopAnimation: robot.stopAnimation,
    setCoordinateSystem: robot.setCoordinateSystem,
    setJointStep: robot.setJointStep,
    setPosStep: robot.setPosStep,
    setRotStep: robot.setRotStep,
    setSelectedTool: robot.setSelectedTool,
    setToolList: robot.setToolList,
    setStatus: robot.setStatus,
    isAnimatingRef: robot.isAnimatingRef,
    gizmoIKRef: robot.gizmoIKRef,
    sliderTargetRef,
    setHighlightedJoint,
  }), [
    robot.addTrajectoryPoint,
    robot.adjustJoint,
    robot.gizmoIKRef,
    robot.goToJoints,
    robot.goToOrigin,
    robot.goToPoseMm,
    robot.goToPosition,
    robot.goToZero,
    robot.isAnimatingRef,
    robot.isMotionQueueIdle,
    robot.moveDirection,
    robot.randomJoints,
    robot.resetJoints,
    robot.saveOrigin,
    robot.setCoordinateSystem,
    robot.setJoint,
    robot.setJointStep,
    robot.setPosStep,
    robot.setRotStep,
    robot.setSelectedTool,
    robot.setStatus,
    robot.setToolList,
    robot.stopAnimation,
  ]);

  return (
    <RobotActionsContext.Provider value={actionsValue}>
      <RobotStateContext.Provider value={stateValue}>{children}</RobotStateContext.Provider>
    </RobotActionsContext.Provider>
  );
}

export function useRobotStateContext(): RobotStateValue {
  const ctx = useContext(RobotStateContext);
  if (!ctx) {
    throw new Error('useRobotStateContext must be used within RobotProvider');
  }
  return ctx;
}

export function useRobotActionsContext(): RobotActionsValue {
  const ctx = useContext(RobotActionsContext);
  if (!ctx) {
    throw new Error('useRobotActionsContext must be used within RobotProvider');
  }
  return ctx;
}
