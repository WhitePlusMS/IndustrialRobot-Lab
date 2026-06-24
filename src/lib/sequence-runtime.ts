import type { MutableRefObject } from 'react';
import type {
  JointAngles,
  RobotConfig,
  TaskPoseConstraintProfile,
  TaskTargetPoseMm,
} from '@/types/robot';

export interface SequenceRobotAPI {
  config: RobotConfig;
  goToJoints: (joints: JointAngles) => void;
  /** GLB 场景坐标定位（m）：优先 GLB 数值 IK，降级 DH 位置 IK */
  goToPosition: (
    x: number,
    y: number,
    z: number,
    rx?: number,
    ry?: number,
    rz?: number,
    profile?: TaskPoseConstraintProfile,
  ) => boolean;
  goToPoseMm: (target: TaskTargetPoseMm) => boolean;
  isMotionQueueIdle: () => boolean;
  stopAnimation: () => void;
  isAnimating: boolean;
  isAnimatingRef: MutableRefObject<boolean>;
  getCurrentJointsDeg: () => JointAngles;
  getCurrentJointsRad: () => JointAngles;
  getCurrentRotation: () => number[][];
}

export interface SequenceStepRuntime {
  waitForAnimation: () => Promise<void>;
}
