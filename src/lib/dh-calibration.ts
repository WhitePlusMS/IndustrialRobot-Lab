// src/lib/dh-calibration.ts
// DH 标定纯函数集 — 从 GLBRobotArm.tsx 提取
// 负责：GLB 模型零位标定、关节 Frame 采样、DH 参数候选推导、FK 链与 GLB 对齐
//
// 所有函数均为纯函数或仅依赖 Three.js 的只读场景树遍历，
// 不依赖 React 状态或 R3F。

import * as THREE from 'three';
import { Matrix, SingularValueDecomposition } from 'ml-matrix';
import type { JointAngles } from '@/types/robot';
import { KUKA_LIKE } from '@/lib/robot-config';
import { dhTransform } from '@/lib/kinematics';
import { Matrix4x4 } from '@/lib/matrix4x4';

// ============================================================
// 常量
// ============================================================

/** 关节名称列表（KUKA 标准六轴） */
export const JOINT_NAMES = ['转台', '大臂', '小臂', '回转机构', '末端关节', '快拆机器人端口'] as const;

/** 标定相关节点名称（含固定底座） */
export const CALIBRATION_NODE_NAMES = ['固定底座', ...JOINT_NAMES] as const;

// ============================================================
// 基础数学工具
// ============================================================

export function roundValue(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function roundTuple(tuple: [number, number, number], digits = 3): [number, number, number] {
  return [
    roundValue(tuple[0], digits),
    roundValue(tuple[1], digits),
    roundValue(tuple[2], digits),
  ];
}

export function normalizeTuple(tuple: [number, number, number]): [number, number, number] {
  const length = Math.hypot(tuple[0], tuple[1], tuple[2]);
  if (length < 1e-9) return [0, 0, 0];
  return [tuple[0] / length, tuple[1] / length, tuple[2] / length];
}

export function dotTuple(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function crossTuple(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function subTuple(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function distanceMm(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

// ============================================================
// Three.js 辅助
// ============================================================

function toTuple(vec: THREE.Vector3): [number, number, number] {
  return [vec.x, vec.y, vec.z];
}

function toMmTuple(vec: THREE.Vector3): [number, number, number] {
  return [vec.x * 1000, vec.y * 1000, vec.z * 1000];
}

function getObjectPath(object: THREE.Object3D): string {
  const parts: string[] = [];
  let current: THREE.Object3D | null = object;
  while (current) {
    parts.push(current.name || current.type);
    current = current.parent;
  }
  return parts.reverse().join('/');
}

// ============================================================
// 场景节点快照
// ============================================================

export interface NodeSnapshot {
  name: string;
  type: string;
  path: string;
  parent: string | null;
  localPosition: [number, number, number];
  localQuaternion: [number, number, number, number];
  localScale: [number, number, number];
  worldPositionMeters: [number, number, number];
  worldPositionMm: [number, number, number];
  worldQuaternion: [number, number, number, number];
  worldScale: [number, number, number];
  geometryCenterLocal: [number, number, number] | null;
  geometryCenterWorldMm: [number, number, number] | null;
  boundingBoxSizeWorldMm: [number, number, number] | null;
}

export function captureNodeSnapshot(node: THREE.Object3D): NodeSnapshot {
  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();
  node.matrixWorld.decompose(worldPos, worldQuat, worldScale);

  let geometryCenterLocal: [number, number, number] | null = null;
  let geometryCenterWorldMm: [number, number, number] | null = null;
  let boundingBoxSizeWorldMm: [number, number, number] | null = null;

  if (node instanceof THREE.Mesh && node.geometry) {
    if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
    const bbox = node.geometry.boundingBox;
    if (bbox) {
      const localCenter = bbox.getCenter(new THREE.Vector3());
      geometryCenterLocal = roundTuple(toTuple(localCenter));

      const worldCenter = localCenter.clone().applyMatrix4(node.matrixWorld);
      geometryCenterWorldMm = roundTuple(toMmTuple(worldCenter), 1);

      const size = bbox.getSize(new THREE.Vector3());
      const worldSize = size.multiply(worldScale);
      boundingBoxSizeWorldMm = roundTuple(toMmTuple(worldSize), 1);
    }
  }

  return {
    name: node.name || node.type,
    type: node.type,
    path: getObjectPath(node),
    parent: node.parent?.name || node.parent?.type || null,
    localPosition: roundTuple(toTuple(node.position)),
    localQuaternion: [
      roundValue(node.quaternion.x),
      roundValue(node.quaternion.y),
      roundValue(node.quaternion.z),
      roundValue(node.quaternion.w),
    ] as [number, number, number, number],
    localScale: roundTuple(toTuple(node.scale)),
    worldPositionMeters: roundTuple(toTuple(worldPos)),
    worldPositionMm: roundTuple(toMmTuple(worldPos), 1),
    worldQuaternion: [
      roundValue(worldQuat.x),
      roundValue(worldQuat.y),
      roundValue(worldQuat.z),
      roundValue(worldQuat.w),
    ] as [number, number, number, number],
    worldScale: roundTuple(toTuple(worldScale)),
    geometryCenterLocal,
    geometryCenterWorldMm,
    boundingBoxSizeWorldMm,
  };
}

export interface PivotSnapshot {
  name: string;
  pivotName: string;
  path: string;
  worldPositionMeters: [number, number, number];
  worldPositionMm: [number, number, number];
  localAxis: [number, number, number];
  worldAxis: [number, number, number];
  worldQuaternion: [number, number, number, number];
  worldScale: [number, number, number];
}

export function capturePivotSnapshot(name: string, pivot: THREE.Object3D, axis: THREE.Vector3): PivotSnapshot {
  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();
  pivot.matrixWorld.decompose(worldPos, worldQuat, worldScale);

  const worldAxis = axis.clone().applyQuaternion(worldQuat).normalize();

  return {
    name,
    pivotName: pivot.name || pivot.type,
    path: getObjectPath(pivot),
    worldPositionMeters: roundTuple(toTuple(worldPos)),
    worldPositionMm: roundTuple(toMmTuple(worldPos), 1),
    localAxis: roundTuple(toTuple(axis)),
    worldAxis: roundTuple(toTuple(worldAxis)),
    worldQuaternion: [
      roundValue(worldQuat.x),
      roundValue(worldQuat.y),
      roundValue(worldQuat.z),
      roundValue(worldQuat.w),
    ] as [number, number, number, number],
    worldScale: roundTuple(toTuple(worldScale)),
  };
}

/** 在场景中按名称递归查找节点 */
export function findNode(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let result: THREE.Object3D | null = null;
  root.traverse((child) => {
    if (child.name === name) result = child;
  });
  return result;
}

/** 关节旋转轴定义（相对于节点局部坐标系） */
export const JOINT_AXES: Record<string, THREE.Vector3> = {
  '转台': new THREE.Vector3(0, 0, 1),
  '大臂': new THREE.Vector3(0, 1, 0),
  '小臂': new THREE.Vector3(0, 1, 0),
  '回转机构': new THREE.Vector3(1, 0, 0),
  '末端关节': new THREE.Vector3(0, 1, 0),
  '快拆机器人端口': new THREE.Vector3(0, 0, 1),
};

export function collectJointDebugSnapshots(root: THREE.Group): PivotSnapshot[] {
  return JOINT_NAMES
    .map((name) => {
      const pivot = findNode(root, `Pivot_${name}`);
      const axis = JOINT_AXES[name];
      if (!pivot || !axis) return null;
      return capturePivotSnapshot(name, pivot, axis);
    })
    .filter((item): item is PivotSnapshot => item !== null);
}

// ============================================================
// DH 候选推导
// ============================================================

export interface DhCandidate {
  from: string;
  to: string;
  localTranslationMm: [number, number, number];
  candidateLink: {
    a: number;
    d: number;
    alphaDeg: number;
    thetaOffsetDeg: number;
  };
  derivedAxes: {
    x: [number, number, number];
    y: [number, number, number];
    z: [number, number, number];
  };
}

export function deriveDhCandidatesFromPivots(
  jointPivots: PivotSnapshot[]
): DhCandidate[] {
  if (jointPivots.length !== JOINT_NAMES.length) return [];

  const frames: {
    name: string;
    originMm: [number, number, number];
    x: [number, number, number];
    y: [number, number, number];
    z: [number, number, number];
  }[] = [];

  jointPivots.forEach((pivot, index) => {
    const z = normalizeTuple(pivot.worldAxis);
    let x: [number, number, number] | null = null;

    if (index < jointPivots.length - 1) {
      const toNext = subTuple(
        jointPivots[index + 1].worldPositionMm,
        pivot.worldPositionMm
      );
      const projected = subTuple(toNext, [
        z[0] * dotTuple(toNext, z),
        z[1] * dotTuple(toNext, z),
        z[2] * dotTuple(toNext, z),
      ]);
      if (Math.hypot(projected[0], projected[1], projected[2]) > 1e-6) {
        x = normalizeTuple(projected);
      }
    }

    if (!x && index > 0) x = frames[index - 1].x;
    if (!x) {
      const fallback: [number, number, number] = Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      const projected = subTuple(fallback, [
        z[0] * dotTuple(fallback, z),
        z[1] * dotTuple(fallback, z),
        z[2] * dotTuple(fallback, z),
      ]);
      x = normalizeTuple(projected);
    }

    const y = normalizeTuple(crossTuple(z, x));
    x = normalizeTuple(crossTuple(y, z));

    frames.push({ name: pivot.name, originMm: pivot.worldPositionMm, x, y, z });
  });

  return frames.slice(1).map((frame, index) => {
    const prev = frames[index];
    const delta = subTuple(frame.originMm, prev.originMm);
    const localTranslation: [number, number, number] = [
      dotTuple(delta, prev.x),
      dotTuple(delta, prev.y),
      dotTuple(delta, prev.z),
    ];

    const relativeColumns = [
      [dotTuple(frame.x, prev.x), dotTuple(frame.x, prev.y), dotTuple(frame.x, prev.z)],
      [dotTuple(frame.y, prev.x), dotTuple(frame.y, prev.y), dotTuple(frame.y, prev.z)],
      [dotTuple(frame.z, prev.x), dotTuple(frame.z, prev.y), dotTuple(frame.z, prev.z)],
    ];

    const alphaDeg = (Math.atan2(-localTranslation[1], localTranslation[2]) * 180) / Math.PI;
    const thetaOffsetDeg = (Math.atan2(-relativeColumns[0][1], relativeColumns[0][0]) * 180) / Math.PI;

    return {
      from: prev.name,
      to: frame.name,
      localTranslationMm: roundTuple(localTranslation, 1),
      candidateLink: {
        a: roundValue(localTranslation[0], 1),
        d: roundValue(Math.hypot(localTranslation[1], localTranslation[2]), 1),
        alphaDeg: roundValue(alphaDeg, 1),
        thetaOffsetDeg: roundValue(thetaOffsetDeg, 1),
      },
      derivedAxes: { x: roundTuple(frame.x), y: roundTuple(frame.y), z: roundTuple(frame.z) },
    };
  });
}

// ============================================================
// 快照收集
// ============================================================

export function collectInterestingMeshSnapshots(root: THREE.Object3D): NodeSnapshot[] {
  const snapshots: NodeSnapshot[] = [];
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (!child.name) return;
    snapshots.push(captureNodeSnapshot(child));
  });
  return snapshots;
}

export function collectNamedNodeSnapshots(root: THREE.Object3D): NodeSnapshot[] {
  return CALIBRATION_NODE_NAMES
    .map((name) => {
      const node = findNode(root, name);
      return node ? captureNodeSnapshot(node) : null;
    })
    .filter((item): item is NodeSnapshot => item !== null);
}

// ============================================================
// FK 帧计算
// ============================================================

export function applyBasisToPoint(
  basis: {
    x: [number, number, number];
    y: [number, number, number];
    z: [number, number, number];
    originMm: [number, number, number];
  },
  pointMm: [number, number, number]
): [number, number, number] {
  return [
    basis.originMm[0] + basis.x[0] * pointMm[0] + basis.y[0] * pointMm[1] + basis.z[0] * pointMm[2],
    basis.originMm[1] + basis.x[1] * pointMm[0] + basis.y[1] * pointMm[1] + basis.z[1] * pointMm[2],
    basis.originMm[2] + basis.x[2] * pointMm[0] + basis.y[2] * pointMm[1] + basis.z[2] * pointMm[2],
  ];
}

export function computeDhFramesMm(jointsDeg: JointAngles) {
  const dhVals = Object.values(KUKA_LIKE.dhParams);
  const jointsRad = jointsDeg.map((value) => (value * Math.PI) / 180) as JointAngles;
  const frames: { name: string; positionMm: [number, number, number] }[] = [];

  let transform = new Matrix4x4([
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ]);

  JOINT_NAMES.forEach((name, index) => {
    const dh = dhVals[index];
    const theta = jointsRad[index] * (dh.thetaSign ?? 1) + (dh.thetaOffset ?? 0);
    transform = transform.multiply(dhTransform(theta, dh.d, dh.a, dh.alpha));
    frames.push({
      name,
      positionMm: [
        roundValue(transform.data[0][3], 1),
        roundValue(transform.data[1][3], 1),
        roundValue(transform.data[2][3], 1),
      ],
    });
  });

  return frames;
}

// ============================================================
// 最佳拟合刚体对齐
// ============================================================

function matrixToTuple3(matrix: Matrix): [number, number, number] {
  return [matrix.get(0, 0), matrix.get(1, 0), matrix.get(2, 0)];
}

function determinant3(matrix: Matrix): number {
  const a = matrix.get(0, 0);
  const b = matrix.get(0, 1);
  const c = matrix.get(0, 2);
  const d = matrix.get(1, 0);
  const e = matrix.get(1, 1);
  const f = matrix.get(1, 2);
  const g = matrix.get(2, 0);
  const h = matrix.get(2, 1);
  const i = matrix.get(2, 2);
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

export function buildBestFitRigidAlignment(
  dhFrames: { name: string; positionMm: [number, number, number] }[],
  jointPivots: PivotSnapshot[]
) {
  if (dhFrames.length !== jointPivots.length || dhFrames.length < 3) return null;

  const sourceCentroid = [0, 0, 0] as [number, number, number];
  const targetCentroid = [0, 0, 0] as [number, number, number];

  dhFrames.forEach((frame, index) => {
    const target = jointPivots[index].worldPositionMm;
    sourceCentroid[0] += frame.positionMm[0];
    sourceCentroid[1] += frame.positionMm[1];
    sourceCentroid[2] += frame.positionMm[2];
    targetCentroid[0] += target[0];
    targetCentroid[1] += target[1];
    targetCentroid[2] += target[2];
  });

  sourceCentroid[0] /= dhFrames.length;
  sourceCentroid[1] /= dhFrames.length;
  sourceCentroid[2] /= dhFrames.length;
  targetCentroid[0] /= dhFrames.length;
  targetCentroid[1] /= dhFrames.length;
  targetCentroid[2] /= dhFrames.length;

  const covariance = Matrix.zeros(3, 3);
  dhFrames.forEach((frame, index) => {
    const source = subTuple(frame.positionMm, sourceCentroid);
    const target = subTuple(jointPivots[index].worldPositionMm, targetCentroid);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        covariance.set(row, col, covariance.get(row, col) + source[row] * target[col]);
      }
    }
  });

  const svd = new SingularValueDecomposition(covariance);
  const u = svd.leftSingularVectors;
  const v = svd.rightSingularVectors;
  let rotation = v.mmul(u.transpose());

  if (determinant3(rotation) < 0) {
    const correction = Matrix.eye(3);
    correction.set(2, 2, -1);
    rotation = v.mmul(correction).mmul(u.transpose());
  }

  const rotatedCentroid = matrixToTuple3(
    rotation.mmul(Matrix.columnVector(sourceCentroid))
  );
  const translation = subTuple(targetCentroid, rotatedCentroid);

  return {
    rotation,
    translationMm: roundTuple(translation, 1),
    sourceCentroidMm: roundTuple(sourceCentroid, 1),
    targetCentroidMm: roundTuple(targetCentroid, 1),
  };
}

export function alignDhFramesToWorld(
  frameAlignment:
    | NonNullable<ReturnType<typeof buildZeroPoseFrameAlignment>>
    | NonNullable<ReturnType<typeof buildBestFitRigidAlignment>>,
  dhFrames: ReturnType<typeof computeDhFramesMm>
) {
  if ('basisAxesDhToWorld' in frameAlignment) {
    return dhFrames.map((frame) => ({
      name: frame.name,
      positionMm: roundTuple(
        applyBasisToPoint(frameAlignment.basisAxesDhToWorld, frame.positionMm),
        1
      ),
    }));
  }

  return dhFrames.map((frame) => {
    const rotated = matrixToTuple3(
      frameAlignment.rotation.mmul(Matrix.columnVector(frame.positionMm))
    );
    return {
      name: frame.name,
      positionMm: roundTuple([
        rotated[0] + frameAlignment.translationMm[0],
        rotated[1] + frameAlignment.translationMm[1],
        rotated[2] + frameAlignment.translationMm[2],
      ], 1),
    };
  });
}

export function buildZeroPoseFrameAlignment(
  jointPivots: PivotSnapshot[],
  fkFrames: { name: string; positionMm: [number, number, number] }[]
) {
  if (jointPivots.length < 2 || fkFrames.length < 1) return null;

  const worldXFromDhY = normalizeTuple(jointPivots[1].worldAxis);
  const worldYFromDhZ = normalizeTuple(jointPivots[0].worldAxis);
  let worldZFromDhX = normalizeTuple(crossTuple(worldXFromDhY, worldYFromDhZ));
  if (Math.hypot(...worldZFromDhX) < 1e-6) return null;

  const orthoWorldY = normalizeTuple(crossTuple(worldZFromDhX, worldXFromDhY));
  worldZFromDhX = normalizeTuple(crossTuple(worldXFromDhY, orthoWorldY));

  const dhJoint1 = fkFrames[0].positionMm;
  const alignedDhJoint1 = [
    worldZFromDhX[0] * dhJoint1[0] + worldXFromDhY[0] * dhJoint1[1] + orthoWorldY[0] * dhJoint1[2],
    worldZFromDhX[1] * dhJoint1[0] + worldXFromDhY[1] * dhJoint1[1] + orthoWorldY[1] * dhJoint1[2],
    worldZFromDhX[2] * dhJoint1[0] + worldXFromDhY[2] * dhJoint1[1] + orthoWorldY[2] * dhJoint1[2],
  ] as [number, number, number];

  const originMm = roundTuple(
    subTuple(jointPivots[0].worldPositionMm, alignedDhJoint1),
    1
  );

  const basis = {
    x: roundTuple(worldZFromDhX),
    y: roundTuple(worldXFromDhY),
    z: roundTuple(orthoWorldY),
    originMm,
  };

  const preciseBasis = {
    x: worldZFromDhX,
    y: worldXFromDhY,
    z: orthoWorldY,
    originMm,
  };

  const alignedFkFramesMm = fkFrames.map((frame) => ({
    name: frame.name,
    positionMm: roundTuple(applyBasisToPoint(preciseBasis, frame.positionMm), 1),
  }));

  return { basisAxesDhToWorld: basis, alignedFkFramesMm };
}

// ============================================================
// Pivot 状态保存/恢复（校准和位姿采样共用）
// ============================================================

export function captureCurrentPivotQuaternions(root: THREE.Group): THREE.Quaternion[] {
  return JOINT_NAMES.map((name) => {
    const pivot = findNode(root, `Pivot_${name}`) as THREE.Group | null;
    return pivot ? pivot.quaternion.clone() : new THREE.Quaternion();
  });
}

export function restorePivotQuaternions(root: THREE.Group, quaternions: THREE.Quaternion[]) {
  JOINT_NAMES.forEach((name, index) => {
    const pivot = findNode(root, `Pivot_${name}`) as THREE.Group | null;
    if (pivot) pivot.quaternion.copy(quaternions[index]);
  });
  root.updateMatrixWorld(true);
}

// ============================================================
// 主标定函数
// ============================================================

export interface CalibrationReport {
  modelScale: number;
  jointCentersMm: { name: string; worldPositionMm: [number, number, number] }[];
  jointPivots: PivotSnapshot[];
  adjacentDistancesMm: { from: string; to: string; distanceMm: number }[];
  candidateDhFromPivots: DhCandidate[];
  fkFramesMm: { name: string; positionMm: [number, number, number] }[];
  fkErrorsMm: {
    name: string;
    measuredPositionMm: [number, number, number] | null;
    errorMm: [number, number, number] | null;
    errorNormMm: number | null;
  }[];
  zeroPoseFrameAlignment: ReturnType<typeof buildZeroPoseFrameAlignment>;
  alignedFkErrorsMm: {
    name: string;
    measuredPositionMm: [number, number, number] | null;
    errorMm: [number, number, number] | null;
    errorNormMm: number | null;
  }[] | null;
  bestFitRigidAlignment: ReturnType<typeof buildBestFitRigidAlignment>;
  bestFitAlignedFkErrorsMm: {
    name: string;
    measuredPositionMm: [number, number, number] | null;
    errorMm: [number, number, number] | null;
    errorNormMm: number | null;
  }[] | null;
  suggestedDh: {
    joint1d: number;
    joint2a: number;
    joint3a: number;
    joint4d: number;
    joint5a: number;
    joint6d: number;
  };
  namedNodes: NodeSnapshot[];
  meshNodes: NodeSnapshot[];
}

/**
 * 采集完整的零位标定报告
 * @param arm 构建完成的机械臂 Group
 * @param modelScale 模型缩放因子
 */
export function buildCalibrationReport(arm: THREE.Group, modelScale: number): CalibrationReport {
  const savedQuats = JOINT_NAMES.map((name) => {
    const pivot = findNode(arm, `Pivot_${name}`) as THREE.Group | null;
    return pivot ? pivot.quaternion.clone() : new THREE.Quaternion();
  });

  // 归零所有关节
  JOINT_NAMES.forEach((name) => {
    const pivot = findNode(arm, `Pivot_${name}`) as THREE.Group | null;
    if (pivot) pivot.quaternion.identity();
  });
  arm.updateMatrixWorld(true);

  const zeroNamedNodes = collectNamedNodeSnapshots(arm);
  const meshSnapshots = collectInterestingMeshSnapshots(arm);
  const jointPivots = collectJointDebugSnapshots(arm);

  const jointCentersMm = zeroNamedNodes.map((node) => ({
    name: node.name,
    worldPositionMm: node.worldPositionMm,
  }));

  const nodeMmMap = new Map<string, [number, number, number]>();
  jointCentersMm.forEach((node) => {
    nodeMmMap.set(node.name, node.worldPositionMm);
  });

  const fkFrames = computeDhFramesMm([0, 0, 0, 0, 0, 0]);

  const fkErrorsMm = fkFrames.map((frame) => {
    const measured = nodeMmMap.get(frame.name);
    if (!measured) {
      return { name: frame.name, measuredPositionMm: null, errorMm: null, errorNormMm: null };
    }
    const error: [number, number, number] = [
      roundValue(frame.positionMm[0] - measured[0], 1),
      roundValue(frame.positionMm[1] - measured[1], 1),
      roundValue(frame.positionMm[2] - measured[2], 1),
    ];
    return {
      name: frame.name,
      measuredPositionMm: measured,
      errorMm: error,
      errorNormMm: roundValue(distanceMm(frame.positionMm, measured), 1),
    };
  });

  const zeroPoseFrameAlignment = buildZeroPoseFrameAlignment(jointPivots, fkFrames);
  const alignedFkErrorsMm = zeroPoseFrameAlignment?.alignedFkFramesMm.map((frame) => {
    const measured = nodeMmMap.get(frame.name);
    if (!measured) {
      return { name: frame.name, measuredPositionMm: null, errorMm: null, errorNormMm: null };
    }
    const error: [number, number, number] = [
      roundValue(frame.positionMm[0] - measured[0], 1),
      roundValue(frame.positionMm[1] - measured[1], 1),
      roundValue(frame.positionMm[2] - measured[2], 1),
    ];
    return {
      name: frame.name,
      measuredPositionMm: measured,
      errorMm: error,
      errorNormMm: roundValue(distanceMm(frame.positionMm, measured), 1),
    };
  }) ?? null;

  const bestFitRigidAlignment = buildBestFitRigidAlignment(fkFrames, jointPivots);
  const bestFitAlignedFkFramesMm = bestFitRigidAlignment
    ? alignDhFramesToWorld(bestFitRigidAlignment, fkFrames)
    : null;
  const bestFitAlignedFkErrorsMm = bestFitAlignedFkFramesMm?.map((frame) => {
    const measured = nodeMmMap.get(frame.name);
    if (!measured) {
      return { name: frame.name, measuredPositionMm: null, errorMm: null, errorNormMm: null };
    }
    const error: [number, number, number] = [
      roundValue(frame.positionMm[0] - measured[0], 1),
      roundValue(frame.positionMm[1] - measured[1], 1),
      roundValue(frame.positionMm[2] - measured[2], 1),
    ];
    return {
      name: frame.name,
      measuredPositionMm: measured,
      errorMm: error,
      errorNormMm: roundValue(distanceMm(frame.positionMm, measured), 1),
    };
  }) ?? null;

  const suggestedDh = {
    joint1d: roundValue(nodeMmMap.get('转台')?.[1] ?? 0, 1),
    joint2a: roundValue(distanceMm(
      nodeMmMap.get('转台') ?? [0, 0, 0],
      [nodeMmMap.get('大臂')?.[0] ?? 0, nodeMmMap.get('转台')?.[1] ?? 0, nodeMmMap.get('大臂')?.[2] ?? 0]
    ), 1),
    joint3a: roundValue(distanceMm(
      nodeMmMap.get('大臂') ?? [0, 0, 0],
      nodeMmMap.get('小臂') ?? [0, 0, 0]
    ), 1),
    joint4d: roundValue(distanceMm(
      nodeMmMap.get('小臂') ?? [0, 0, 0],
      nodeMmMap.get('回转机构') ?? [0, 0, 0]
    ), 1),
    joint5a: roundValue(distanceMm(
      nodeMmMap.get('回转机构') ?? [0, 0, 0],
      nodeMmMap.get('末端关节') ?? [0, 0, 0]
    ), 1),
    joint6d: roundValue(distanceMm(
      nodeMmMap.get('末端关节') ?? [0, 0, 0],
      nodeMmMap.get('快拆机器人端口') ?? [0, 0, 0]
    ), 1),
  };

  const adjacentDistancesMm = [
    ['固定底座', '转台'],
    ['转台', '大臂'],
    ['大臂', '小臂'],
    ['小臂', '回转机构'],
    ['回转机构', '末端关节'],
    ['末端关节', '快拆机器人端口'],
  ].map(([from, to]) => ({
    from,
    to,
    distanceMm: roundValue(
      distanceMm(
        nodeMmMap.get(from) ?? [0, 0, 0],
        nodeMmMap.get(to) ?? [0, 0, 0]
      ),
      1
    ),
  }));

  // 恢复关节角度
  JOINT_NAMES.forEach((name, index) => {
    const pivot = findNode(arm, `Pivot_${name}`) as THREE.Group | null;
    if (pivot) pivot.quaternion.copy(savedQuats[index]);
  });
  arm.updateMatrixWorld(true);

  return {
    modelScale,
    jointCentersMm,
    jointPivots,
    adjacentDistancesMm,
    candidateDhFromPivots: deriveDhCandidatesFromPivots(jointPivots),
    fkFramesMm: fkFrames,
    fkErrorsMm,
    zeroPoseFrameAlignment,
    alignedFkErrorsMm,
    bestFitRigidAlignment,
    bestFitAlignedFkErrorsMm,
    suggestedDh,
    namedNodes: zeroNamedNodes,
    meshNodes: meshSnapshots,
  };
}
