import { useCallback, useEffect, useRef } from 'react';
import type {
  CoordinateSystem,
  GizmoIKHandle,
  GoalJointSolution,
  JointAngles,
  JointPathPlan,
  Pose,
  RobotConfig,
  StatusType,
  TaskPoseConstraintProfile,
  TaskTargetPoseMm,
} from '@/types/robot';
import type { RobotModel } from '@/lib/robot-model';
import { isReachable } from '@/lib/ik-solver';
import { solveIKWithGizmoConfig } from '@/lib/transform-gizmo-utils';
import { degToRad } from '@/lib/math/angle';
import {
  buildRotationFromEuler,
} from '@/lib/math/rotation3d';
import {
  HOLD_ORIENTATION_TASK_PROFILE,
  MANUAL_STRICT_TASK_PROFILE,
} from '@/lib/grasp-planning';
import { planJointPath, solveGoalJointsForPose } from '@/lib/goal-planner';
import { robotToSceneM, sceneToRobotMm } from '@/lib/spatial-coordinates';
import {
  buildAxisDelta,
  createIdleLongPressSession,
  executeDirectionalMove,
  updateLongPressSession,
  type DirectionalAxis,
  type MoveDirectionResult,
} from '@/lib/robot-direction-control';

interface UseRobotCommandCenterParams {
  config: RobotConfig;
  model: RobotModel;
  ranges: [number, number][];
  getCurrentJoints: () => JointAngles;
  applyJoints: (next: JointAngles) => void;
  coordinateSystem: CoordinateSystem;
  posStep: number;
  rotStep: number;
  setStatus: (status: StatusType) => void;
  startEasedAnimation: (target: JointAngles, duration?: number) => void;
  startCoordinatedAnimation: (target: JointAngles) => void;
  startCartesianAnimation: (
    targetPose: Pose,
    options?: { duration?: number; orientationMode?: 'position_only' | 'hold_current_orientation' | 'full_pose' }
  ) => void;
  stopAnimation: () => void;
  isAnimatingRef: React.MutableRefObject<boolean>;
}

export function useRobotCommandCenter({
  config,
  model,
  ranges,
  getCurrentJoints,
  applyJoints,
  coordinateSystem,
  posStep,
  rotStep,
  setStatus,
  startEasedAnimation,
  startCoordinatedAnimation,
  startCartesianAnimation,
  stopAnimation,
  isAnimatingRef,
}: UseRobotCommandCenterParams) {
  const goToPositionQueueRef = useRef<JointAngles[]>([]);
  const longPressSessionRef = useRef(createIdleLongPressSession());
  const gizmoIKRef = useRef<GizmoIKHandle | null>(null);

  const markUnreachable = useCallback(() => {
    setStatus('unreachable');
    setTimeout(() => setStatus('ready'), 1500);
  }, [setStatus]);

  const flushNextGoToPositionWaypoint = useCallback(() => {
    const next = goToPositionQueueRef.current.shift();
    if (!next) return false;
    startCoordinatedAnimation(next);
    return true;
  }, [startCoordinatedAnimation]);

  const isMotionQueueIdle = useCallback(() => {
    return !isAnimatingRef.current && goToPositionQueueRef.current.length === 0;
  }, [isAnimatingRef]);

  useEffect(() => {
    gizmoIKRef.current = {
      solveAndApply: (targetPose: Pose) => {
        const current = getCurrentJoints();
        const result = solveIKWithGizmoConfig(targetPose, current, model, ranges);
        if (!result) return false;
        applyJoints(result);
        return true;
      },
    };
  }, [applyJoints, getCurrentJoints, model, ranges]);

  const solveGoalPose = useCallback(
    (
      targetPose: Pose,
      profile: TaskPoseConstraintProfile,
      currentJoints: JointAngles
    ): GoalJointSolution | null => {
      const bestSolution = solveGoalJointsForPose({
        targetPose,
        profile,
        currentJoints,
        model,
        jointRanges: ranges,
      });
      if (!bestSolution) {
        console.error('[useRobot] goal solve failed', {
          targetPoseMm: targetPose.position,
          targetPoseEulerRad: targetPose.euler,
          profile: profile.name,
          currentJointsDeg: currentJoints,
        });
        return null;
      }

      const jointDistanceDeg = Math.sqrt(
        bestSolution.joints.reduce((sum, value, index) => sum + (value - currentJoints[index]) ** 2, 0)
      );
      console.log('[useRobot] goal solve success', {
        profile: profile.name,
        source: bestSolution.source,
        poseErrorMm: Number(bestSolution.poseErrorMm.toFixed(3)),
        orientationErrorRad: Number(bestSolution.orientationErrorRad.toFixed(5)),
        jointDistanceDeg: Number(jointDistanceDeg.toFixed(3)),
      });
      return bestSolution;
    },
    [model, ranges]
  );

  const executeJointPath = useCallback(
    (plan: JointPathPlan): boolean => {
      const [firstWaypoint, ...remainingWaypoints] = plan.waypointJoints;
      if (!firstWaypoint) {
        return false;
      }

      goToPositionQueueRef.current = remainingWaypoints.map((waypoint) => [...waypoint] as JointAngles);
      stopAnimation();
      startCoordinatedAnimation(firstWaypoint);
      return true;
    },
    [startCoordinatedAnimation, stopAnimation]
  );

  const goToJoints = useCallback(
    (target: JointAngles) => {
      goToPositionQueueRef.current = [];
      startEasedAnimation([...target]);
    },
    [startEasedAnimation]
  );

  const goToPoseMm = useCallback(
    (target: TaskTargetPoseMm): boolean => {
      const currentJoints = getCurrentJoints();
      const currentPose = model.forwardKinematics(currentJoints);
      if (!currentPose) {
        console.warn('[useRobot] goToPoseMm currentPose unavailable', {
          currentJointsDeg: currentJoints,
        });
        setStatus('unreachable');
        setTimeout(() => setStatus('ready'), 1500);
        return false;
      }

      const orientationDeg = target.orientationDeg;
      const targetEuler: [number, number, number] = orientationDeg
        ? [degToRad(orientationDeg[0]), degToRad(orientationDeg[1]), degToRad(orientationDeg[2])]
        : currentPose.euler;
      const targetRot = orientationDeg
        ? buildRotationFromEuler(targetEuler)
        : currentPose.rotation;
      const targetPose: Pose = {
        position: target.positionMm,
        euler: targetEuler,
        rotation: targetRot,
      };

      console.log('[useRobot] goToPoseMm start', {
        targetPoseMm: target.positionMm,
        targetPoseEulerDeg: target.orientationDeg ?? null,
        profile: target.profile.name,
        currentJointsDeg: currentJoints,
      });

      const reachable = isReachable(target.positionMm, model);
      if (!reachable) {
        console.warn('[useRobot] goToPoseMm isReachable() precheck failed, continue with goal solve', {
          targetPoseMm: target.positionMm,
        });
      }

      const goalSolution = solveGoalPose(targetPose, target.profile, currentJoints);
      if (!goalSolution) {
        setStatus('unreachable');
        setTimeout(() => setStatus('ready'), 1500);
        return false;
      }

      const jointPathPlan = planJointPath(currentJoints, goalSolution.joints, target.profile, config);
      if (!jointPathPlan) {
        console.error('[useRobot] joint path plan failed', {
          profile: target.profile.name,
          fromJointsDeg: currentJoints,
          toJointsDeg: goalSolution.joints,
        });
        setStatus('unreachable');
        setTimeout(() => setStatus('ready'), 1500);
        return false;
      }

      console.log('[useRobot] joint path plan ready', {
        profile: target.profile.name,
        planType: jointPathPlan.planType,
        segmentCount: jointPathPlan.segments.length,
        waypointCount: jointPathPlan.waypointJoints.length,
        firstWaypointDeg: jointPathPlan.waypointJoints[0],
      });

      const started = executeJointPath(jointPathPlan);
      if (!started) {
        console.error('[useRobot] execution aborted', {
          profile: target.profile.name,
          planType: jointPathPlan.planType,
        });
        setStatus('unreachable');
        setTimeout(() => setStatus('ready'), 1500);
        return false;
      }

      return true;
    },
    [config, executeJointPath, getCurrentJoints, model, setStatus, solveGoalPose]
  );

  const goToPosition = useCallback(
    (
      x: number,
      y: number,
      z: number,
      rx?: number,
      ry?: number,
      rz?: number,
      profile?: TaskPoseConstraintProfile
    ): boolean => {
      const currentJoints = getCurrentJoints();
      const currentPose = model.forwardKinematics(currentJoints);
      if (!currentPose) {
        setStatus('unreachable');
        setTimeout(() => setStatus('ready'), 1500);
        return false;
      }

      const hasExplicitOrientation = rx !== undefined && ry !== undefined && rz !== undefined;
      const effectiveProfile = profile ?? (hasExplicitOrientation ? MANUAL_STRICT_TASK_PROFILE : HOLD_ORIENTATION_TASK_PROFILE);
      return goToPoseMm({
        positionMm: sceneToRobotMm([x, y, z]),
        orientationDeg: hasExplicitOrientation ? [rx, ry, rz] : undefined,
        profile: effectiveProfile,
      });
    },
    [getCurrentJoints, goToPoseMm, model, setStatus]
  );

  const moveDirection = useCallback(
    (axis: DirectionalAxis, sign: 1 | -1, isLongPress = false): MoveDirectionResult => {
      const step = ['x', 'y', 'z'].includes(axis) ? posStep : rotStep;
      const delta = step * sign;
      const currentJoints = getCurrentJoints();
      const currentPose = model.forwardKinematics(currentJoints);
      if (!currentPose) {
        return { success: false };
      }

      const baseMove = buildAxisDelta({
        axis,
        delta,
        coordinateSystem,
        currentPose,
      });

      let targetPose = baseMove.targetPose;
      if (isLongPress) {
        const nextMove = updateLongPressSession({
          axis,
          sign,
          delta,
          coordinateSystem,
          isAnimating: isAnimatingRef.current,
          currentPose,
          targetPose,
          session: longPressSessionRef.current,
        });
        longPressSessionRef.current = nextMove.nextSession;
        targetPose = nextMove.targetPose;
      } else {
        longPressSessionRef.current = createIdleLongPressSession();
      }

      return executeDirectionalMove({
        targetPose,
        currentJoints,
        isPositionAxis: baseMove.isPositionAxis,
        model,
        config,
        ranges,
        startCartesianAnimation,
        startCoordinatedAnimation,
        markUnreachable,
      });
    },
    [
      config,
      coordinateSystem,
      getCurrentJoints,
      isAnimatingRef,
      markUnreachable,
      model,
      posStep,
      ranges,
      rotStep,
      startCartesianAnimation,
      startCoordinatedAnimation,
    ]
  );

  const stopRobotAnimation = useCallback(() => {
    goToPositionQueueRef.current = [];
    stopAnimation();
  }, [stopAnimation]);

  const currentScenePosition = useCallback(() => {
    const currentPose = model.forwardKinematics(getCurrentJoints());
    return currentPose ? robotToSceneM(currentPose.position) : null;
  }, [getCurrentJoints, model]);

  return {
    gizmoIKRef,
    flushNextGoToPositionWaypoint,
    isMotionQueueIdle,
    goToJoints,
    goToPoseMm,
    goToPosition,
    moveDirection,
    stopRobotAnimation,
    currentScenePosition,
  };
}
