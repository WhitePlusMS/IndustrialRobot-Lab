// src/components/GLBRobotArm.tsx
// 从GLB模型动态构建六轴可动机械臂
// 根据GLB节点名称自动识别关节位置和层级，所有参数动态计算
import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Matrix, SingularValueDecomposition } from 'ml-matrix';
import type { JointAngles } from '@/types/robot';
import { KUKA_LIKE } from '@/lib/robot-config';
import { dhTransform } from '@/lib/kinematics';
import { Matrix4x4 } from '@/lib/matrix4x4';
import { robotPoseBridge } from '@/lib/robot-pose-bridge';
import type { RobotPoseAPI } from '@/lib/robot-pose-bridge';
import type { Pose } from '@/types/robot';
import { quaternionToRotationMatrix, rotationMatrixToEulerZYX } from '@/lib/math/rotation3d';

interface GLBRobotArmProps {
  joints: JointAngles;
  onTrajectoryPoint?: (pos: [number, number, number]) => void;
  selectedTool?: string;
  onToolList?: (tools: string[]) => void;
  /** 滑块/输入框直接写入的目标关节 ref；存在时 useFrame 直接读 ref，跳过 React 渲染链路 */
  sliderTargetRef?: React.MutableRefObject<JointAngles>;
}

// 关节名称列表（KUKA标准六轴）
const JOINT_NAMES = ['转台', '大臂', '小臂', '回转机构', '末端关节', '快拆机器人端口'];
const CALIBRATION_NODE_NAMES = ['固定底座', ...JOINT_NAMES] as const;

// 模型缩放因子：GLB原始臂展 15.91m，目标臂展 1.5m
// MODEL_SCALE = 1500 / 15912 ≈ 0.0943
const MODEL_SCALE = 0.0943;

// 关节旋转轴定义（相对于节点局部坐标系）
// KUKA标准六轴:
// J1(转台)=Z轴(腰转), J2(大臂)=X轴(肩俯仰), J3(小臂)=X轴(肘俯仰)
// J4(回转机构)=Z轴(腕旋转沿小臂), J5(末端关节)=Y轴(腕摆动), J6(快拆端口)=Z轴(腕旋转2)
const JOINT_AXES: Record<string, THREE.Vector3> = {
  '转台': new THREE.Vector3(0, 0, 1),
  '大臂': new THREE.Vector3(0, 1, 0),
  '小臂': new THREE.Vector3(0, 1, 0),
  '回转机构': new THREE.Vector3(1, 0, 0),
  '末端关节': new THREE.Vector3(0, 1, 0),
  '快拆机器人端口': new THREE.Vector3(0, 0, 1),
};

// 恢复到 GLB 原始节点原点，不再保留上一轮实验性的 pivot 偏移。
// 用户最新实测已经明确指出 J2/J3/J4 的旋转轴线被改坏，
// 这里先回到“原始 mesh 节点 = 旋转中心”的最小实现，避免继续把真实转轴线挪偏。
const PIVOT_OFFSETS_MM: Partial<Record<string, [number, number, number]>> = {};

function mmOffsetToModelUnits(offsetMm: [number, number, number]): [number, number, number] {
  const scale = MODEL_SCALE * 1000;
  return [offsetMm[0] / scale, offsetMm[1] / scale, offsetMm[2] / scale];
}

/** 在场景中按名称递归查找节点 */
function findNode(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let result: THREE.Object3D | null = null;
  root.traverse((child) => {
    if (child.name === name) result = child;
  });
  return result;
}

function toTuple(vec: THREE.Vector3): [number, number, number] {
  return [vec.x, vec.y, vec.z];
}

function toMmTuple(vec: THREE.Vector3): [number, number, number] {
  return [vec.x * 1000, vec.y * 1000, vec.z * 1000];
}

function roundValue(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function roundTuple(tuple: [number, number, number], digits = 3): [number, number, number] {
  return [
    roundValue(tuple[0], digits),
    roundValue(tuple[1], digits),
    roundValue(tuple[2], digits),
  ];
}

function normalizeTuple(tuple: [number, number, number]): [number, number, number] {
  const length = Math.hypot(tuple[0], tuple[1], tuple[2]);
  if (length < 1e-9) return [0, 0, 0];
  return [tuple[0] / length, tuple[1] / length, tuple[2] / length];
}

function dotTuple(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function crossTuple(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function subTuple(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
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

function captureNodeSnapshot(node: THREE.Object3D) {
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

function capturePivotSnapshot(name: string, pivot: THREE.Object3D, axis: THREE.Vector3) {
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

function collectJointDebugSnapshots(root: THREE.Group) {
  return JOINT_NAMES
    .map((name) => {
      const pivot = findNode(root, `Pivot_${name}`);
      const axis = JOINT_AXES[name];
      if (!pivot || !axis) return null;
      return capturePivotSnapshot(name, pivot, axis);
    })
    .filter((item): item is ReturnType<typeof capturePivotSnapshot> => item !== null);
}

function deriveDhCandidatesFromPivots(
  jointPivots: ReturnType<typeof collectJointDebugSnapshots>
) {
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

    frames.push({
      name: pivot.name,
      originMm: pivot.worldPositionMm,
      x,
      y,
      z,
    });
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
      [
        dotTuple(frame.x, prev.x),
        dotTuple(frame.x, prev.y),
        dotTuple(frame.x, prev.z),
      ],
      [
        dotTuple(frame.y, prev.x),
        dotTuple(frame.y, prev.y),
        dotTuple(frame.y, prev.z),
      ],
      [
        dotTuple(frame.z, prev.x),
        dotTuple(frame.z, prev.y),
        dotTuple(frame.z, prev.z),
      ],
    ];

    const alphaDeg =
      (Math.atan2(-localTranslation[1], localTranslation[2]) * 180) / Math.PI;
    const thetaOffsetDeg =
      (Math.atan2(-relativeColumns[0][1], relativeColumns[0][0]) * 180) / Math.PI;

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
      derivedAxes: {
        x: roundTuple(frame.x),
        y: roundTuple(frame.y),
        z: roundTuple(frame.z),
      },
    };
  });
}

function collectInterestingMeshSnapshots(root: THREE.Object3D) {
  const snapshots: ReturnType<typeof captureNodeSnapshot>[] = [];
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (!child.name) return;
    snapshots.push(captureNodeSnapshot(child));
  });
  return snapshots;
}

function collectNamedNodeSnapshots(root: THREE.Object3D) {
  return CALIBRATION_NODE_NAMES
    .map((name) => {
      const node = findNode(root, name);
      return node ? captureNodeSnapshot(node) : null;
    })
    .filter((item): item is ReturnType<typeof captureNodeSnapshot> => item !== null);
}

function distanceMm(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 +
    (a[1] - b[1]) ** 2 +
    (a[2] - b[2]) ** 2
  );
}

function applyBasisToPoint(
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

function computeDhFramesMm(jointsDeg: JointAngles) {
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
    const theta =
      jointsRad[index] * (dh.thetaSign ?? 1) + (dh.thetaOffset ?? 0);
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

function buildBestFitRigidAlignment(
  dhFrames: { name: string; positionMm: [number, number, number] }[],
  jointPivots: ReturnType<typeof collectJointDebugSnapshots>
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

function alignDhFramesToWorld(
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

function buildZeroPoseFrameAlignment(
  jointPivots: ReturnType<typeof collectJointDebugSnapshots>,
  fkFrames: { name: string; positionMm: [number, number, number] }[]
) {
  if (jointPivots.length < 2 || fkFrames.length < 1) return null;

  // 当前 DH 零位下：J2/J3 轴沿 DH +Y，J1/J4/J6 轴沿 DH +Z。
  // 用真实 GLB 零位的 J2 轴 / J1 轴构造世界基向量，便于把 FK 链先对齐到同一零位基座坐标。
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
    // DH +X / +Y / +Z 在真实 GLB 世界零位中的对应方向
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

  return {
    basisAxesDhToWorld: basis,
    alignedFkFramesMm,
  };
}

function buildCalibrationReport(arm: THREE.Group) {
  const savedQuats = JOINT_NAMES.map((name) => {
    const pivot = findNode(arm, `Pivot_${name}`) as THREE.Group | null;
    return pivot ? pivot.quaternion.clone() : new THREE.Quaternion();
  });

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
  const bestFitDhAlignment = buildBestFitRigidAlignment(fkFrames, jointPivots);

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

  const bestFitAlignedFkFramesMm = bestFitDhAlignment
    ? alignDhFramesToWorld(bestFitDhAlignment, fkFrames)
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

  JOINT_NAMES.forEach((name, index) => {
    const pivot = findNode(arm, `Pivot_${name}`) as THREE.Group | null;
    if (pivot) pivot.quaternion.copy(savedQuats[index]);
  });
  arm.updateMatrixWorld(true);

  return {
    modelScale: MODEL_SCALE,
    jointCentersMm,
    jointPivots,
    adjacentDistancesMm,
    candidateDhFromPivots: deriveDhCandidatesFromPivots(jointPivots),
    fkFramesMm: fkFrames,
    fkErrorsMm,
    zeroPoseFrameAlignment,
    alignedFkErrorsMm,
    bestFitRigidAlignment: bestFitDhAlignment,
    bestFitAlignedFkErrorsMm,
    suggestedDh,
    namedNodes: zeroNamedNodes,
    meshNodes: meshSnapshots,
  };
}

function captureCurrentPivotQuaternions(root: THREE.Group): THREE.Quaternion[] {
  return JOINT_NAMES.map((name) => {
    const pivot = findNode(root, `Pivot_${name}`) as THREE.Group | null;
    return pivot ? pivot.quaternion.clone() : new THREE.Quaternion();
  });
}

function restorePivotQuaternions(root: THREE.Group, quaternions: THREE.Quaternion[]) {
  JOINT_NAMES.forEach((name, index) => {
    const pivot = findNode(root, `Pivot_${name}`) as THREE.Group | null;
    if (pivot) pivot.quaternion.copy(quaternions[index]);
  });
  root.updateMatrixWorld(true);
}

/**
 * 构建可动关节层级
 * 对每个关节节点，在其上方插入一个PivotGroup用于旋转
 * 同时计算整个模型的世界包围盒，将基座底部对齐到原点
 */
function buildArticulated(scene: THREE.Group, joints: JointAngles): THREE.Group {
  // 克隆场景，避免修改原始资源
  const clone = scene.clone(true);

  // 查找基座，计算基座底部的位置
  const baseNode = findNode(clone, '固定底座');
  let offsetY = 0;
  if (baseNode) {
    // 计算基座包围盒的最低点 = 基座底部
    const baseBBox = new THREE.Box3().setFromObject(baseNode);
    offsetY = -baseBBox.min.y;
  } else {
    // 降级：计算整个模型的包围盒
    const fullBBox = new THREE.Box3().setFromObject(clone);
    offsetY = -fullBBox.min.y;
  }

  console.log(`[GLBRobotArm] 基座底部偏移: ${offsetY.toFixed(2)}`);

  // 计算缩放后的偏移量（基座底部需要对齐到原点）
  const baseOffset = offsetY * MODEL_SCALE;

  // 创建缩放组
  const scaleGroup = new THREE.Group();
  scaleGroup.name = 'Scale_Group';
  scaleGroup.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);

  // 将原始层级克隆添加到缩放组（不偏移，因为偏移在根组上处理）
  scaleGroup.add(clone);

  // 根组 - 应用缩放后的偏移，使基座底部对齐原点
  const root = new THREE.Group();
  root.name = 'KUKA_Arm_Root';
  root.position.y = baseOffset;
  root.add(scaleGroup);

  // 为每个关节插入PivotGroup
  for (const jointName of JOINT_NAMES) {
    const node = findNode(clone, jointName);
    if (!node) {
      console.warn(`[GLBRobotArm] 关节 "${jointName}" 未找到`);
      continue;
    }

    const parent = node.parent;
    if (!parent) continue;

    // 保存节点的局部变换
    const pos = node.position.clone();
    const quat = node.quaternion.clone();
    const scale = node.scale.clone();

    // 创建PivotGroup，放在节点位置
    const pivot = new THREE.Group();
    pivot.name = `Pivot_${jointName}`;
    pivot.userData.baseQuaternion = quat.toArray();
    const pivotOffsetMm = PIVOT_OFFSETS_MM[jointName];
    const pivotOffset = pivotOffsetMm ? mmOffsetToModelUnits(pivotOffsetMm) : null;

    // 从父节点移除节点
    parent.remove(node);

    // 设置PivotGroup的位置为节点原本的位置
    pivot.position.copy(pos);
    if (pivotOffset) {
      pivot.position.add(new THREE.Vector3(pivotOffset[0], pivotOffset[1], pivotOffset[2]));
    }
    pivot.quaternion.copy(quat);

    // 将节点重设为PivotGroup的子节点，位置归零
    if (pivotOffset) {
      node.position.set(-pivotOffset[0], -pivotOffset[1], -pivotOffset[2]);
    } else {
      node.position.set(0, 0, 0);
    }
    node.quaternion.identity();
    node.scale.copy(scale);

    pivot.add(node);
    parent.add(pivot);
  }

  // 应用初始关节角度
  applyJointAngles(root, joints);

  return root;
}

/** 查找并应用关节角度到PivotGroup */
function applyJointAngles(
  root: THREE.Group,
  joints: JointAngles,
  axisOverrides?: Partial<Record<string, THREE.Vector3>>
) {
  JOINT_NAMES.forEach((name, i) => {
    const pivot = findNode(root, `Pivot_${name}`) as THREE.Group | null;
    if (!pivot) return;

    const axis = axisOverrides?.[name] ?? JOINT_AXES[name];
    if (!axis) return;

    const angleRad = (joints[i] * Math.PI) / 180;
    const baseQuaternionArray = pivot.userData.baseQuaternion as [number, number, number, number] | undefined;
    const baseQuaternion = baseQuaternionArray
      ? new THREE.Quaternion(
          baseQuaternionArray[0],
          baseQuaternionArray[1],
          baseQuaternionArray[2],
          baseQuaternionArray[3]
        )
      : new THREE.Quaternion();
    const deltaQuaternion = new THREE.Quaternion().setFromAxisAngle(axis, angleRad);
    pivot.quaternion.copy(baseQuaternion).multiply(deltaQuaternion);
  });
}

export default function GLBRobotArm({
  joints,
  onTrajectoryPoint,
  selectedTool = '无',
  onToolList,
  sliderTargetRef,
}: GLBRobotArmProps) {
  const { scene } = useGLTF('/models/KUKA_V1.glb');

  // 在渲染路径内一次性构建 Three.js 层级，保证对象在首帧即可挂载到 R3F 场景。
  // useMemo 只依赖 scene，避免 joints 变化时重复构建；初始角度由 buildArticulated 应用一次即可。
  const arm = useMemo(() => {
    if (!scene) return null;
    console.log('[GLBRobotArm] 构建关节层级...');
    const built = buildArticulated(scene as THREE.Group, joints);

    JOINT_NAMES.forEach((name) => {
      const pivot = findNode(built, `Pivot_${name}`);
      if (pivot) {
        const worldPos = new THREE.Vector3();
        pivot.getWorldPosition(worldPos);
        console.log(
          `[GLBRobotArm] ${name}: 世界位置 [${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)}, ${worldPos.z.toFixed(1)}]`
        );
      }
    });

    return built;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  const currentJointsRef = useRef<JointAngles>([...joints]);
  const targetJointsRef = useRef<JointAngles>([...joints]);
  const lastTrajectoryTimeRef = useRef<number>(0);

  // ===== DH 标定：归零后测量 GLB 模型各关节世界坐标（仅日志输出，不再注入 window） =====
  const calibratedRef = useRef(false);
  useEffect(() => {
    if (!arm || calibratedRef.current) return;
    calibratedRef.current = true;
    const report = buildCalibrationReport(arm);
    console.log('[GLBRobotArm] 零位标定报告:', report);
  }, [arm]);

  // 目标关节角度随 props 更新
  useEffect(() => {
    targetJointsRef.current = [...joints];
  }, [joints]);

  // 在渲染循环中把 current 插值到 target，直接操作 Three.js 对象，避免 React 渲染延迟
  useFrame((_, delta) => {
    if (!arm) return;

    const current = currentJointsRef.current;
    // 优先读 slider 直接写入的 ref，避免 React 高频 setState 导致丢帧/瞬移
    const target = sliderTargetRef?.current ?? targetJointsRef.current;
    const factor = Math.min(delta * 60, 1); // 高密度目标更新下几乎即时追上，同时保留一帧级平滑

    let changed = false;
    const next = current.map((c, i) => {
      const diff = target[i] - c;
      if (Math.abs(diff) < 0.005) return target[i];
      changed = true;
      return c + diff * factor;
    }) as JointAngles;

    if (changed) {
      applyJointAngles(arm, next);
      currentJointsRef.current = next;
    }

    // 轨迹采样：每 50ms 或角度变化明显时记录一次
    if (onTrajectoryPoint) {
      const now = performance.now();
      if (now - lastTrajectoryTimeRef.current > 50) {
        lastTrajectoryTimeRef.current = now;
        arm.updateMatrixWorld(true);
        const flangeNode = findNode(arm, '快拆机器人端口');
        if (flangeNode) {
          const worldPos = new THREE.Vector3();
          flangeNode.getWorldPosition(worldPos);
          onTrajectoryPoint([worldPos.x, worldPos.y, worldPos.z]);
        }
      }
    }
  });

  useEffect(() => {
    if (!scene || !onToolList) return;
    const flange = findNode(scene, '快拆机器人端口');
    if (!flange) return;
    const tools: string[] = [];
    flange.children.forEach((child) => {
      if (child.name && !/^mesh_\d+$/.test(child.name)) tools.push(child.name);
    });
    console.log('[GLBRobotArm] 发现末端工具:', tools);
    onToolList(tools);
  }, [scene, onToolList]);

  useEffect(() => {
    if (!arm) return;
    const flange = findNode(arm, '快拆机器人端口');
    if (!flange) return;

    flange.children.forEach((child) => {
      if (child.name && !/^mesh_\d+$/.test(child.name)) {
        child.visible = selectedTool === '无' ? false : child.name === selectedTool;
      }
    });
  }, [arm, selectedTool]);

  // 注册 GLB 位姿能力到应用级 bridge，替代 window.__GLB_* 全局注入
  useEffect(() => {
    if (!arm) {
      robotPoseBridge.setAPI(null);
      return;
    }
    const currentArm = arm;

    const getFlangeMatrix = () => {
      currentArm.updateMatrixWorld(true);
      const flange = findNode(currentArm, '快拆机器人端口');
      if (!flange) return null;
      const m = new THREE.Matrix4();
      flange.updateMatrixWorld(true);
      m.copy(flange.matrixWorld);
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      m.decompose(pos, quat, new THREE.Vector3());
      return {
        position: [pos.x, pos.y, pos.z] as [number, number, number],
        rotation: quaternionToRotationMatrix([quat.x, quat.y, quat.z, quat.w]),
      };
    };

    const capturePoseForJoints = (angles: number[]): Pose | null => {
      const savedQuaternions = captureCurrentPivotQuaternions(currentArm);
      applyJointAngles(currentArm, angles as JointAngles);
      currentArm.updateMatrixWorld(true);
      const flange = findNode(currentArm, '快拆机器人端口');
      if (!flange) {
        restorePivotQuaternions(currentArm, savedQuaternions);
        return null;
      }

      const matrix = new THREE.Matrix4();
      flange.updateMatrixWorld(true);
      matrix.copy(flange.matrixWorld);

      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(pos, quat, scale);

      const rotation = quaternionToRotationMatrix([quat.x, quat.y, quat.z, quat.w]);
      const snapshot: Pose = {
        position: [pos.x, pos.y, pos.z] as [number, number, number],
        euler: rotationMatrixToEulerZYX(rotation),
        rotation,
      };
      restorePivotQuaternions(currentArm, savedQuaternions);
      return snapshot;
    };

    const api: RobotPoseAPI = {
      isAvailable: () => true,
      getFlangeMatrix,
      capturePoseForJoints,
    };

    robotPoseBridge.setAPI(api);
    return () => {
      robotPoseBridge.setAPI(null);
    };
  }, [arm]);

  if (!arm) return null;

  return <primitive object={arm} />;
}
