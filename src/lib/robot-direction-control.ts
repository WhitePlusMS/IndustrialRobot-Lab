import type {
  CoordinateSystem,
  EulerRad,
  JointAngles,
  Pose,
  RobotConfig,
  RobotPointMm,
} from '@/types/robot';
import type { RobotModel } from './robot-model';
import { Matrix4x4 } from './matrix4x4';
import { degToRad } from './math/angle';
import {
  applyRotationIncrement,
  buildRotationFromEuler,
  rotationMatrixToEulerZYX,
} from './math/rotation3d';
import { DEFAULT_MOTION_CONFIG } from './motion-smoothing';
import { MANUAL_ROTATION_IK_PRESET } from './ik-config';
import { isReachable, solveIK } from './ik-solver';

export type DirectionalAxis = 'x' | 'y' | 'z' | 'rx' | 'ry' | 'rz';

export interface MoveDirectionResult {
  success: boolean;
}

export interface LongPressSessionState {
  key: string;
  targetPos: RobotPointMm | null;
  targetEuler: EulerRad | null;
  targetRotation: number[][] | null;
}

interface BuildAxisDeltaParams {
  axis: DirectionalAxis;
  delta: number;
  coordinateSystem: CoordinateSystem;
  currentPose: Pose;
}

interface UpdateLongPressSessionParams {
  axis: DirectionalAxis;
  sign: 1 | -1;
  delta: number;
  coordinateSystem: CoordinateSystem;
  isAnimating: boolean;
  currentPose: Pose;
  targetPose: Pose;
  session: LongPressSessionState;
}

interface ExecuteDirectionalMoveParams {
  targetPose: Pose;
  currentJoints: JointAngles;
  isPositionAxis: boolean;
  model: RobotModel;
  config: RobotConfig;
  ranges: [number, number][];
  startCartesianAnimation: (
    targetPose: Pose,
    options?: { duration?: number; orientationMode?: 'position_only' | 'hold_current_orientation' | 'full_pose' },
  ) => void;
  startCoordinatedAnimation: (target: JointAngles) => void;
  markUnreachable: () => void;
}

function cloneRotation(rotation: number[][]): number[][] {
  return rotation.map((row) => [...row]);
}

function clampJointsToRanges(joints: JointAngles, config: RobotConfig): JointAngles {
  const jointRanges = Object.values(config.dhParams).map((p) => p.thetaRange);
  return joints.map((value, i) => Math.max(jointRanges[i][0], Math.min(jointRanges[i][1], value))) as JointAngles;
}

export function createIdleLongPressSession(): LongPressSessionState {
  return {
    key: '',
    targetPos: null,
    targetEuler: null,
    targetRotation: null,
  };
}

export function buildAxisDelta({
  axis,
  delta,
  coordinateSystem,
  currentPose,
}: BuildAxisDeltaParams): { isPositionAxis: boolean; targetPose: Pose } {
  const isPositionAxis = axis === 'x' || axis === 'y' || axis === 'z';

  if (isPositionAxis) {
    const axisIndexMap: Record<'x' | 'y' | 'z', number> = { x: 0, y: 1, z: 2 };
    const axisIndex = axisIndexMap[axis as 'x' | 'y' | 'z'];
    const offset: RobotPointMm = [0, 0, 0];
    offset[axisIndex] = delta;

    const worldOffset = coordinateSystem === 'Tool'
      ? Matrix4x4.mat3Vec3Mul(currentPose.rotation, offset)
      : offset;

    return {
      isPositionAxis: true,
      targetPose: {
        position: [
          currentPose.position[0] + worldOffset[0],
          currentPose.position[1] + worldOffset[1],
          currentPose.position[2] + worldOffset[2],
        ],
        euler: [...currentPose.euler] as EulerRad,
        rotation: cloneRotation(currentPose.rotation),
      },
    };
  }

  const targetRotation = applyRotationIncrement(
    currentPose.rotation,
    axis as 'rx' | 'ry' | 'rz',
    degToRad(delta),
    coordinateSystem,
  );

  return {
    isPositionAxis: false,
    targetPose: {
      position: [...currentPose.position] as RobotPointMm,
      euler: rotationMatrixToEulerZYX(targetRotation),
      rotation: targetRotation,
    },
  };
}

export function updateLongPressSession({
  axis,
  sign,
  delta,
  coordinateSystem,
  isAnimating,
  currentPose,
  targetPose,
  session,
}: UpdateLongPressSessionParams): { nextSession: LongPressSessionState; targetPose: Pose } {
  const isPositionAxis = axis === 'x' || axis === 'y' || axis === 'z';
  const pressKey = `${axis}:${sign}:${coordinateSystem}`;
  const isNewSession = session.key !== pressKey || !isAnimating;
  const nextSession: LongPressSessionState = {
    key: session.key,
    targetPos: session.targetPos ? [...session.targetPos] as RobotPointMm : null,
    targetEuler: session.targetEuler ? [...session.targetEuler] as EulerRad : null,
    targetRotation: session.targetRotation ? cloneRotation(session.targetRotation) : null,
  };

  if (isPositionAxis) {
    if (!isNewSession && nextSession.targetPos) {
      const axisIndexMap: Record<'x' | 'y' | 'z', number> = { x: 0, y: 1, z: 2 };
      const axisIndex = axisIndexMap[axis as 'x' | 'y' | 'z'];
      const offsetLocal: RobotPointMm = [0, 0, 0];
      offsetLocal[axisIndex] = delta;
      const worldOffset = coordinateSystem === 'Tool'
        ? Matrix4x4.mat3Vec3Mul(nextSession.targetRotation ?? currentPose.rotation, offsetLocal)
        : offsetLocal;

      nextSession.targetPos = [
        nextSession.targetPos[0] + worldOffset[0],
        nextSession.targetPos[1] + worldOffset[1],
        nextSession.targetPos[2] + worldOffset[2],
      ];
    } else {
      nextSession.key = pressKey;
      nextSession.targetPos = [...targetPose.position] as RobotPointMm;
      nextSession.targetEuler = [...targetPose.euler] as EulerRad;
      nextSession.targetRotation = cloneRotation(targetPose.rotation);
    }

    return {
      nextSession,
      targetPose: {
        position: nextSession.targetPos!,
        euler: nextSession.targetEuler ?? [...targetPose.euler] as EulerRad,
        rotation: nextSession.targetRotation ?? cloneRotation(targetPose.rotation),
      },
    };
  }

  if (!isNewSession && nextSession.targetEuler) {
    const baseRotation = buildRotationFromEuler(nextSession.targetEuler);
    const nextRotation = applyRotationIncrement(
      baseRotation,
      axis as 'rx' | 'ry' | 'rz',
      degToRad(delta),
      coordinateSystem,
    );
    nextSession.targetEuler = rotationMatrixToEulerZYX(nextRotation);
    nextSession.targetRotation = nextRotation;
  } else {
    nextSession.key = pressKey;
    nextSession.targetEuler = [...targetPose.euler] as EulerRad;
    nextSession.targetRotation = cloneRotation(targetPose.rotation);
    nextSession.targetPos = [...currentPose.position] as RobotPointMm;
  }

  return {
    nextSession,
    targetPose: {
      position: [...currentPose.position] as RobotPointMm,
      euler: nextSession.targetEuler!,
      rotation: nextSession.targetRotation!,
    },
  };
}

export function executeDirectionalMove({
  targetPose,
  currentJoints,
  isPositionAxis,
  model,
  config,
  ranges,
  startCartesianAnimation,
  startCoordinatedAnimation,
  markUnreachable,
}: ExecuteDirectionalMoveParams): MoveDirectionResult {
  if (isPositionAxis) {
    if (!isReachable(targetPose.position, model)) {
      markUnreachable();
      return { success: false };
    }

    startCartesianAnimation(targetPose, {
      duration: DEFAULT_MOTION_CONFIG.ikAnimDuration,
      orientationMode: 'hold_current_orientation',
    });
    return { success: true };
  }

  const solved = solveIK(targetPose, currentJoints, model, MANUAL_ROTATION_IK_PRESET, ranges);
  if (!solved) {
    markUnreachable();
    return { success: false };
  }

  startCoordinatedAnimation(clampJointsToRanges(solved, config));
  return { success: true };
}
