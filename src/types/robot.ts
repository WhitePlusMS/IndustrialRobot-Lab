// src/types/robot.ts

export interface DHParams {
  a: number;
  alpha: number;
  d: number;
  thetaRange: [number, number];
}

export interface RobotConfig {
  name: string;
  dhParams: {
    joint1: DHParams;
    joint2: DHParams;
    joint3: DHParams;
    joint4: DHParams;
    joint5: DHParams;
    joint6: DHParams;
  };
  baseHeight: number;
  linkColors: string[];
}

export type JointAngles = [number, number, number, number, number, number];

export interface Pose {
  position: [number, number, number];
  euler: [number, number, number];
  rotation: number[][];
}

export type CoordinateSystem = 'World' | 'Tool';

export type StatusType =
  | 'ready'
  | 'moving'
  | 'complete'
  | 'nearSingularity'
  | 'jointLimited'
  | 'unreachable'
  | 'jointOutOfRange'
  | 'jointLimitExceeded';

export interface MotionConfig {
  jointSpeedLimit: number;
  ikAnimDuration: number;
  snapThreshold: number;
  longPressThrottle: number;
}

export interface IKSolverConfig {
  maxIterations: number;
  tolerance: number;
  damping: number;
  lambdaDecay: number;
}
