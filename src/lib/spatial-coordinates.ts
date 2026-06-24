// src/lib/spatial-coordinates.ts
// 场景米 <-> 机器人内部毫米的唯一换算入口

import type {
  RobotPointMm,
  RobotScalarMm,
  ScenePointM,
  SceneScalarM,
} from '@/types/robot';

const MILLIMETERS_PER_METER = 1000;
const ROUND_EPSILON = 1e-9;

function roundMmCoordinate(valueMm: number): number {
  return Math.round((valueMm + ROUND_EPSILON) * MILLIMETERS_PER_METER) / MILLIMETERS_PER_METER;
}

function roundSceneCoordinate(valueM: number): number {
  return Math.round((valueM + ROUND_EPSILON) * 1_000_000) / 1_000_000;
}

export function sceneToRobotMm(positionM: ScenePointM): RobotPointMm {
  return [
    roundMmCoordinate(positionM[0] * MILLIMETERS_PER_METER),
    roundMmCoordinate(positionM[1] * MILLIMETERS_PER_METER),
    roundMmCoordinate(positionM[2] * MILLIMETERS_PER_METER),
  ];
}

export function robotToSceneM(positionMm: RobotPointMm): ScenePointM {
  return [
    roundSceneCoordinate(positionMm[0] / MILLIMETERS_PER_METER),
    roundSceneCoordinate(positionMm[1] / MILLIMETERS_PER_METER),
    roundSceneCoordinate(positionMm[2] / MILLIMETERS_PER_METER),
  ];
}

export function sceneScalarToRobotMm(valueM: SceneScalarM): RobotScalarMm {
  return roundMmCoordinate(valueM * MILLIMETERS_PER_METER);
}

export function robotScalarToSceneM(valueMm: RobotScalarMm): SceneScalarM {
  return roundSceneCoordinate(valueMm / MILLIMETERS_PER_METER);
}
