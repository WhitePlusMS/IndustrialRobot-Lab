import type {
  GoalJointSolution,
  JointAngles,
  JointPathPlan,
  JointPathPlanSegment,
  Pose,
  RobotConfig,
  TaskPoseConstraintProfile,
} from '@/types/robot';
import type { RobotModel } from './robot-model';
import { solveIK, solvePositionOnlyIK } from './ik-solver';
import { orientationError } from './math/rotation3d';
import {
  GOAL_SOLVE_FULL_POSE_PRESET,
  GOAL_SOLVE_POSITION_ONLY_PRESET,
  GOAL_SOLVE_REFINED_MAX_ITERATIONS,
} from './ik-config';

const AUTO_DIRECT_MAX_DELTA_DEG = 35;
const AUTO_DIRECT_SUM_DELTA_DEG = 140;
const AUTO_SAFE_TRANSIT_JOINTS: JointAngles = [0, -20, 40, 0, 65, 0];
const AUTO_SETTLE_BLEND = 0.7;

export function normalizeJointAngleDeg(angle: number): number {
  let normalized = angle;
  while (normalized > 180) normalized -= 360;
  while (normalized < -180) normalized += 360;
  return normalized;
}

function buildPositionOnlyAltSeeds(
  seedJoints: JointAngles,
  targetPosition: [number, number, number]
): JointAngles[] {
  const [j1, , , j4, , j6] = seedJoints;
  const targetHeadingDeg = normalizeJointAngleDeg(
    (Math.atan2(targetPosition[1], targetPosition[0]) * 180) / Math.PI
  );
  const headingCandidates = [
    targetHeadingDeg,
    normalizeJointAngleDeg(targetHeadingDeg + 20),
    normalizeJointAngleDeg(targetHeadingDeg - 20),
    j1,
    normalizeJointAngleDeg(j1 + 20),
    normalizeJointAngleDeg(j1 - 20),
  ];
  const uniqueHeadingCandidates = Array.from(
    new Set(headingCandidates.map((angle) => Math.round(angle * 10) / 10))
  );

  const seeds: JointAngles[] = [];
  uniqueHeadingCandidates.forEach((heading) => {
    seeds.push([heading, -30, 60, j4, 0, j6]);
    seeds.push([heading, -45, 90, j4, 0, j6]);
    seeds.push([heading, -15, 45, j4, 30, j6]);
  });

  return [
    ...seeds,
    [targetHeadingDeg, -35, 70, j4, 20, j6],
    [normalizeJointAngleDeg(targetHeadingDeg + 35), -45, 90, j4, 20, j6],
    [normalizeJointAngleDeg(targetHeadingDeg - 35), -45, 90, j4, 20, j6],
  ] as JointAngles[];
}

export function dedupeJointSeeds(seeds: JointAngles[]): JointAngles[] {
  const seen = new Set<string>();
  return seeds.filter((seed) => {
    const key = seed.map((value) => Math.round(value * 10) / 10).join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildGoalPoseSeedCandidates(
  currentJoints: JointAngles,
  targetPosition: [number, number, number]
): JointAngles[] {
  const baseSeeds = dedupeJointSeeds([
    currentJoints,
    ...buildPositionOnlyAltSeeds(currentJoints, targetPosition),
  ]);
  const wristCandidates: Array<[number, number, number]> = [
    [currentJoints[3], currentJoints[4], currentJoints[5]],
    [0, 0, 0],
    [0, 45, 0],
    [90, 45, -90],
    [-90, 45, 90],
  ];

  const candidates: JointAngles[] = [];
  baseSeeds.forEach((base) => {
    wristCandidates.forEach(([j4, j5, j6]) => {
      candidates.push([base[0], base[1], base[2], j4, j5, j6]);
    });
  });

  return dedupeJointSeeds(candidates);
}

function jointDistance(a: JointAngles, b: JointAngles): number {
  return Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0));
}

function jointLimitMargin(joints: JointAngles, ranges: [number, number][]): number {
  return Math.min(
    ...joints.map((value, index) => {
      const [min, max] = ranges[index];
      return Math.min(Math.abs(value - min), Math.abs(max - value));
    })
  );
}

function wristTurnMagnitude(joints: JointAngles): number {
  return Math.abs(joints[3]) + Math.abs(joints[4]) + Math.abs(joints[5]);
}

function pushJointPathSegment(
  segments: JointPathPlanSegment[],
  joints: JointAngles,
  type: JointPathPlanSegment['type']
) {
  const last = segments[segments.length - 1];
  if (last && last.joints.every((value, index) => Math.abs(value - joints[index]) < 0.01)) {
    return;
  }
  segments.push({ type, joints });
}

function clampJointsToRanges(joints: JointAngles, config: RobotConfig): JointAngles {
  const ranges = Object.values(config.dhParams).map((p) => p.thetaRange);
  return joints.map((value, i) => Math.max(ranges[i][0], Math.min(ranges[i][1], value))) as JointAngles;
}

function blendJointAngles(a: JointAngles, b: JointAngles, t: number): JointAngles {
  return a.map((value, index) => value + (b[index] - value) * t) as JointAngles;
}

export function getPoseError(
  currentPose: Pose,
  targetPose: Pose
): { poseErrorMm: number; orientationErrorRad: number } {
  const poseErrorMm = Math.hypot(
    targetPose.position[0] - currentPose.position[0],
    targetPose.position[1] - currentPose.position[1],
    targetPose.position[2] - currentPose.position[2]
  );
  const orientationErrorRad = Math.hypot(
    ...orientationError(targetPose.rotation, currentPose.rotation)
  );
  return { poseErrorMm, orientationErrorRad };
}

export function matchesTaskProfile(
  poseErrorMm: number,
  orientationErrorRad: number,
  profile: TaskPoseConstraintProfile
): boolean {
  if (poseErrorMm > profile.positionToleranceMm) {
    return false;
  }
  if (profile.orientationMode === 'ignore') {
    return true;
  }
  return orientationErrorRad <= profile.orientationToleranceRad;
}

function buildTransitJoints(
  referenceJoints: JointAngles,
  headingDeg: number,
  config: RobotConfig
): JointAngles {
  const template = [...AUTO_SAFE_TRANSIT_JOINTS] as JointAngles;
  template[0] = normalizeJointAngleDeg(headingDeg);
  template[5] = normalizeJointAngleDeg(referenceJoints[5]);
  return clampJointsToRanges(template, config);
}

interface SolveGoalJointsForPoseParams {
  targetPose: Pose;
  profile: TaskPoseConstraintProfile;
  currentJoints: JointAngles;
  model: RobotModel;
  jointRanges: [number, number][];
}

export function solveGoalJointsForPose({
  targetPose,
  profile,
  currentJoints,
  model,
  jointRanges,
}: SolveGoalJointsForPoseParams): GoalJointSolution | null {
  const seedCandidates = buildGoalPoseSeedCandidates(currentJoints, targetPose.position);
  const acceptedSolutions: GoalJointSolution[] = [];
  const seenSolutions = new Set<string>();

  const fullPoseConfig = {
    ...GOAL_SOLVE_FULL_POSE_PRESET,
    posTolerance: Math.max(
      GOAL_SOLVE_FULL_POSE_PRESET.posTolerance,
      Math.min(profile.positionToleranceMm, 2)
    ),
    oriTolerance: Math.max(
      GOAL_SOLVE_FULL_POSE_PRESET.oriTolerance,
      profile.orientationMode === 'ignore' ? Math.PI : profile.orientationToleranceRad
    ),
  };

  const positionOnlyConfig = {
    ...GOAL_SOLVE_POSITION_ONLY_PRESET,
    posTolerance: Math.max(
      GOAL_SOLVE_POSITION_ONLY_PRESET.posTolerance,
      Math.min(profile.positionToleranceMm, 2)
    ),
  };

  const collectSolution = (
    jointsCandidate: JointAngles | null,
    seed: JointAngles,
    source: GoalJointSolution['source']
  ) => {
    if (!jointsCandidate) return;
    const pose = model.forwardKinematics(jointsCandidate);
    if (!pose) return;
    const { poseErrorMm, orientationErrorRad } = getPoseError(pose, targetPose);
    if (!matchesTaskProfile(poseErrorMm, orientationErrorRad, profile)) {
      return;
    }

    const key = jointsCandidate.map((value) => Math.round(value * 100) / 100).join(',');
    if (seenSolutions.has(key)) {
      return;
    }
    seenSolutions.add(key);
    acceptedSolutions.push({
      joints: jointsCandidate,
      poseErrorMm,
      orientationErrorRad,
      source,
      seed,
      profile,
    });
  };

  for (const seed of seedCandidates) {
    if (profile.orientationMode === 'ignore') {
      const positionOnlySolution = solvePositionOnlyIK(
        targetPose.position,
        seed,
        model,
        positionOnlyConfig,
        jointRanges
      );
      collectSolution(positionOnlySolution, seed, 'position_only');
      continue;
    }

    const fullPoseSolution = solveIK(
      targetPose,
      seed,
      model,
      fullPoseConfig,
      jointRanges
    );
    collectSolution(fullPoseSolution, seed, 'full_pose');

    if (!profile.allowPositionFallback) {
      continue;
    }

    const positionSeedSolution = solvePositionOnlyIK(
      targetPose.position,
      seed,
      model,
      positionOnlyConfig,
      jointRanges
    );
    if (!positionSeedSolution) {
      continue;
    }

    const refinedSolution = solveIK(
      targetPose,
      positionSeedSolution,
      model,
      {
        ...fullPoseConfig,
        maxIterations: GOAL_SOLVE_REFINED_MAX_ITERATIONS,
      },
      jointRanges
    );
    collectSolution(refinedSolution, seed, 'position_fallback');
    collectSolution(positionSeedSolution, seed, 'position_fallback');
  }

  if (acceptedSolutions.length === 0) {
    return null;
  }

  acceptedSolutions.sort((a, b) => {
    const aWithinTolerance = matchesTaskProfile(a.poseErrorMm, a.orientationErrorRad, profile) ? 0 : 1;
    const bWithinTolerance = matchesTaskProfile(b.poseErrorMm, b.orientationErrorRad, profile) ? 0 : 1;
    if (aWithinTolerance !== bWithinTolerance) return aWithinTolerance - bWithinTolerance;

    const distanceDelta = jointDistance(a.joints, currentJoints) - jointDistance(b.joints, currentJoints);
    if (Math.abs(distanceDelta) > 1e-6) return distanceDelta;

    const limitMarginDelta =
      jointLimitMargin(b.joints, jointRanges) -
      jointLimitMargin(a.joints, jointRanges);
    if (Math.abs(limitMarginDelta) > 1e-6) return limitMarginDelta;

    return wristTurnMagnitude(a.joints) - wristTurnMagnitude(b.joints);
  });

  return acceptedSolutions[0];
}

export function planJointPath(
  fromJoints: JointAngles,
  toJoints: JointAngles,
  profile: TaskPoseConstraintProfile,
  config: RobotConfig
): JointPathPlan | null {
  if (profile.orientationMode !== 'ignore') {
    const segments: JointPathPlanSegment[] = [];
    pushJointPathSegment(segments, [...toJoints] as JointAngles, 'direct_joint_path');
    return {
      planType: 'direct_joint_path',
      segments,
      waypointJoints: segments.map((segment) => [...segment.joints] as JointAngles),
    };
  }

  const deltas = toJoints.map((joint, index) => joint - fromJoints[index]);
  const maxAbsDelta = Math.max(...deltas.map((delta) => Math.abs(delta)));
  const totalAbsDelta = deltas.reduce((sum, delta) => sum + Math.abs(delta), 0);

  const directPlanAllowed =
    maxAbsDelta <= AUTO_DIRECT_MAX_DELTA_DEG &&
    totalAbsDelta <= AUTO_DIRECT_SUM_DELTA_DEG;

  const segments: JointPathPlanSegment[] = [];
  if (directPlanAllowed) {
    pushJointPathSegment(segments, [...toJoints] as JointAngles, 'direct_joint_path');
    return {
      planType: 'direct_joint_path',
      segments,
      waypointJoints: segments.map((segment) => [...segment.joints] as JointAngles),
    };
  }

  const currentTransit = buildTransitJoints(fromJoints, fromJoints[0], config);
  const targetTransit = buildTransitJoints(toJoints, toJoints[0], config);

  pushJointPathSegment(segments, currentTransit, 'lift_then_move_then_settle');
  pushJointPathSegment(segments, targetTransit, 'lift_then_move_then_settle');

  if (profile.orientationMode !== 'ignore' && jointDistance(targetTransit, toJoints) > AUTO_DIRECT_MAX_DELTA_DEG) {
    const settleJoints = clampJointsToRanges(
      blendJointAngles(targetTransit, toJoints, AUTO_SETTLE_BLEND),
      config
    );
    pushJointPathSegment(segments, settleJoints, 'orientation_settle_at_goal');
  }

  pushJointPathSegment(segments, [...toJoints] as JointAngles, 'lift_then_move_then_settle');

  if (segments.length === 0) {
    return null;
  }

  return {
    planType: 'lift_then_move_then_settle',
    segments,
    waypointJoints: segments.map((segment) => [...segment.joints] as JointAngles),
  };
}
