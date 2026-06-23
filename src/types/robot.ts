// src/types/robot.ts

export interface DHParams {
  a: number;
  alpha: number;
  d: number;
  thetaOffset?: number;
  thetaSign?: 1 | -1;
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

export interface TaskPoseConstraintProfile {
  name: string;
  positionToleranceMm: number;
  orientationToleranceRad: number;
  allowPositionFallback: boolean;
  orientationMode: 'strict' | 'relaxed' | 'ignore';
}

export interface GoalJointSolution {
  joints: JointAngles;
  poseErrorMm: number;
  orientationErrorRad: number;
  source: 'full_pose' | 'position_fallback' | 'position_only';
  seed: JointAngles;
  profile: TaskPoseConstraintProfile;
}

export type JointPathSegmentType =
  | 'direct_joint_path'
  | 'lift_then_move_then_settle'
  | 'orientation_settle_at_goal';

export interface JointPathPlanSegment {
  type: JointPathSegmentType;
  joints: JointAngles;
}

export interface JointPathPlan {
  planType: 'direct_joint_path' | 'lift_then_move_then_settle';
  segments: JointPathPlanSegment[];
  waypointJoints: JointAngles[];
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
  tolerance: number; // backward compatibility
  posTolerance: number; // mm
  oriTolerance: number; // rad
  damping: number; // initial lambda
  lambdaDecay: number;
  lambdaGrow: number;
  maxLambda: number;
  maxStepRad: number;
  errorClampPos: number; // mm
  errorClampOri: number; // rad
  orientationScale: number; // mm/rad
}

/** Gizmo 操作轴 IK 处理器：绕过动画系统，直接求解 + 设置关节 */
export interface GizmoIKHandle {
  solveAndApply: (targetPose: Pose) => boolean;
}
