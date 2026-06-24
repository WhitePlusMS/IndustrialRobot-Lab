import type { RobotPointMm, ScenePointM } from '@/types/robot';
import { robotScalarToSceneM, sceneToRobotMm } from './spatial-coordinates';

export type SuckerBoxState =
  | 'NONE'
  | 'FREE'
  | 'FALLING'
  | 'ATTACHED'
  | 'PLACED'
  | 'RESTING';

interface SuckerContactPoseLike {
  position: ScenePointM;
  direction: [number, number, number];
}

interface BoxVerticalMotionParams {
  boxState: SuckerBoxState;
  boxPosition: RobotPointMm;
  velocityY: number;
  deltaTime: number;
  groundY: number;
}

const GRAVITY_MM_PER_S2 = -9.8 * 1000;

export function canAttachBox(boxState: SuckerBoxState): boolean {
  return boxState === 'FREE' || boxState === 'RESTING';
}

export function buildBoxTopCenter(
  boxPosition: RobotPointMm,
  boxHalfSizeMm: number,
): RobotPointMm {
  return [
    boxPosition[0],
    boxPosition[1] + boxHalfSizeMm,
    boxPosition[2],
  ];
}

export function computeAttachedBoxPositionFromContact(
  contactPose: SuckerContactPoseLike,
  boxHalfSizeMm: number,
): RobotPointMm {
  const [sx, sy, sz] = contactPose.position;
  const [dx, dy, dz] = contactPose.direction;

  return sceneToRobotMm([
    sx + dx * robotScalarToSceneM(boxHalfSizeMm),
    sy + dy * robotScalarToSceneM(boxHalfSizeMm),
    sz + dz * robotScalarToSceneM(boxHalfSizeMm),
  ]);
}

export function simulateBoxVerticalMotion({
  boxState,
  boxPosition,
  velocityY,
  deltaTime,
  groundY,
}: BoxVerticalMotionParams): {
  boxState: SuckerBoxState;
  boxPosition: RobotPointMm;
  velocityY: number;
} {
  if (boxState !== 'FALLING' && boxState !== 'PLACED') {
    return {
      boxState,
      boxPosition: [...boxPosition] as RobotPointMm,
      velocityY,
    };
  }

  const dt = Math.min(deltaTime, 0.05);
  let nextVelocityY = velocityY + GRAVITY_MM_PER_S2 * dt;
  let nextY = boxPosition[1] + nextVelocityY * dt;
  let nextState: SuckerBoxState = boxState;

  if (nextY <= groundY) {
    nextY = groundY;
    nextVelocityY = 0;
    nextState = boxState === 'FALLING' ? 'FREE' : 'RESTING';
  }

  return {
    boxState: nextState,
    boxPosition: [boxPosition[0], nextY, boxPosition[2]],
    velocityY: nextVelocityY,
  };
}
