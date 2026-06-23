// src/components/GLBRobotArm.tsx
// 从GLB模型动态构建六轴可动机械臂
// 根据GLB节点名称自动识别关节位置和层级，所有参数动态计算
//
// 职责：GLB加载、关节驱动、useFrame插值、位姿API注册、关节高亮、坐标轴渲染、工具管理
// DH标定逻辑已提取到 src/hooks/useDHCalibration.ts + src/lib/dh-calibration.ts

import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { JointAngles } from '@/types/robot';
import { robotPoseBridge } from '@/lib/robot-pose-bridge';
import type { RobotPoseAPI } from '@/lib/robot-pose-bridge';
import type { Pose } from '@/types/robot';
import { quaternionToRotationMatrix, rotationMatrixToEulerZYX } from '@/lib/math/rotation3d';
import { highlightJoint, unhighlightJoint } from '@/lib/joint-highlight';
import {
  JOINT_NAMES,
  JOINT_AXES,
  findNode,
  captureCurrentPivotQuaternions,
  restorePivotQuaternions,
} from '@/lib/dh-calibration';
import { useDHCalibration } from '@/hooks/useDHCalibration';

interface GLBRobotArmProps {
  joints: JointAngles;
  onTrajectoryPoint?: (pos: [number, number, number]) => void;
  selectedTool?: string;
  onToolList?: (tools: string[]) => void;
  /** 滑块/输入框直接写入的目标关节 ref；存在时 useFrame 直接读 ref，跳过 React 渲染链路 */
  sliderTargetRef?: React.MutableRefObject<JointAngles>;
  /** 要高亮的关节索引（0~5），null 表示不高亮 */
  highlightedJoint?: number | null;
  /** 是否显示坐标系 */
  showToolAxes?: boolean;
  /** 当前位姿控制坐标系，用于高亮对应坐标系 */
  coordinateSystem?: 'World' | 'Tool';
}

// 模型缩放因子：GLB原始臂展 15.91m，目标臂展 1.5m
// MODEL_SCALE = 1500 / 15912 ≈ 0.0943
const MODEL_SCALE = 0.0943;

// 恢复到 GLB 原始节点原点，不再保留上一轮实验性的 pivot 偏移
const PIVOT_OFFSETS_MM: Partial<Record<string, [number, number, number]>> = {};

function mmOffsetToModelUnits(offsetMm: [number, number, number]): [number, number, number] {
  const scale = MODEL_SCALE * 1000;
  return [offsetMm[0] / scale, offsetMm[1] / scale, offsetMm[2] / scale];
}

/**
 * 构建可动关节层级
 * 对每个关节节点，在其上方插入一个PivotGroup用于旋转
 * 同时计算整个模型的世界包围盒，将基座底部对齐到原点
 */
function buildArticulated(scene: THREE.Group, joints: JointAngles): THREE.Group {
  const clone = scene.clone(true);

  // 查找基座，计算基座底部的位置
  const baseNode = findNode(clone, '固定底座');
  let offsetY = 0;
  if (baseNode) {
    const baseBBox = new THREE.Box3().setFromObject(baseNode);
    offsetY = -baseBBox.min.y;
  } else {
    const fullBBox = new THREE.Box3().setFromObject(clone);
    offsetY = -fullBBox.min.y;
  }

  console.log(`[GLBRobotArm] 基座底部偏移: ${offsetY.toFixed(2)}`);

  const baseOffset = offsetY * MODEL_SCALE;

  const scaleGroup = new THREE.Group();
  scaleGroup.name = 'Scale_Group';
  scaleGroup.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
  scaleGroup.add(clone);

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

    const pos = node.position.clone();
    const quat = node.quaternion.clone();
    const scale = node.scale.clone();

    const pivot = new THREE.Group();
    pivot.name = `Pivot_${jointName}`;
    pivot.userData.baseQuaternion = quat.toArray();
    const pivotOffsetMm = PIVOT_OFFSETS_MM[jointName];
    const pivotOffset = pivotOffsetMm ? mmOffsetToModelUnits(pivotOffsetMm) : null;

    parent.remove(node);

    pivot.position.copy(pos);
    if (pivotOffset) {
      pivot.position.add(new THREE.Vector3(pivotOffset[0], pivotOffset[1], pivotOffset[2]));
    }
    pivot.quaternion.copy(quat);

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
    const baseQuaternionArray = pivot.userData.baseQuaternion as
      | [number, number, number, number]
      | undefined;
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

/** 收集每个关节对应连杆的 Mesh（用于关节高亮） */
function collectJointMeshes(root: THREE.Group): THREE.Mesh[][] {
  return JOINT_NAMES.map((name, index) => {
    const pivot = findNode(root, `Pivot_${name}`);
    if (!pivot) return [];
    const meshes: THREE.Mesh[] = [];
    const isLastJoint = index === JOINT_NAMES.length - 1;

    const collect = (node: THREE.Object3D) => {
      if (isLastJoint && node.name === '吸盘') return;
      if (node instanceof THREE.Mesh) meshes.push(node);
      node.children.forEach(collect);
    };

    pivot.children.forEach((child) => {
      if (child instanceof THREE.Mesh) meshes.push(child);
      child.children.forEach((grandChild) => {
        if (isLastJoint && grandChild.name === '吸盘') return;
        collect(grandChild);
      });
    });

    return meshes;
  });
}

function normalizeVector3(vec: THREE.Vector3, fallback: THREE.Vector3): THREE.Vector3 {
  if (vec.lengthSq() < 1e-10) {
    return fallback.clone().normalize();
  }
  return vec.clone().normalize();
}

function computeSuckerContactPose(root: THREE.Group): {
  position: [number, number, number];
  direction: [number, number, number];
} | null {
  const flange = findNode(root, '快拆机器人端口');
  const sucker = findNode(root, '吸盘');
  if (!flange || !sucker) return null;

  flange.updateMatrixWorld(true);
  sucker.updateMatrixWorld(true);

  const bbox = new THREE.Box3().setFromObject(sucker);
  if (bbox.isEmpty()) return null;

  const contactWorld = new THREE.Vector3(
    (bbox.min.x + bbox.max.x) / 2,
    bbox.min.y,
    (bbox.min.z + bbox.max.z) / 2,
  );
  const flangeWorld = new THREE.Vector3();
  flange.getWorldPosition(flangeWorld);

  const flangeToContact = normalizeVector3(
    contactWorld.clone().sub(flangeWorld),
    new THREE.Vector3(0, -1, 0),
  );

  return {
    position: [contactWorld.x, contactWorld.y, contactWorld.z],
    direction: [flangeToContact.x, flangeToContact.y, flangeToContact.z],
  };
}

// ============================================================
// 坐标系
// ============================================================

interface AxesConfig {
  length: number;
  radius: number;
  headRadius: number;
  headHeight: number;
  originRadius: number;
}

const TOOL_AXES_CONFIG: AxesConfig = {
  length: 0.25,
  radius: 0.012,
  headRadius: 0.035,
  headHeight: 0.09,
  originRadius: 0.035,
};

const BASE_AXES_CONFIG: AxesConfig = {
  length: 1.0,
  radius: 0.012,
  headRadius: 0.035,
  headHeight: 0.09,
  originRadius: 0.035,
};

function createAxes(name: string, config: AxesConfig): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  group.renderOrder = 1000;

  const { length, radius, headRadius, headHeight, originRadius } = config;
  const up = new THREE.Vector3(0, 1, 0);

  const axes = [
    { dir: new THREE.Vector3(1, 0, 0), color: 0xff0000 },
    { dir: new THREE.Vector3(0, 1, 0), color: 0x00ff00 },
    { dir: new THREE.Vector3(0, 0, 1), color: 0x0000ff },
  ];

  axes.forEach(({ dir, color }) => {
    const axisGroup = new THREE.Group();

    const shaftGeo = new THREE.CylinderGeometry(radius, radius, length, 16);
    shaftGeo.translate(0, length / 2, 0);
    const shaftMat = new THREE.MeshBasicMaterial({ color, depthTest: false, toneMapped: false });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);

    const headGeo = new THREE.ConeGeometry(headRadius, headHeight, 16);
    headGeo.translate(0, length + headHeight / 2, 0);
    const head = new THREE.Mesh(headGeo, shaftMat);

    axisGroup.add(shaft);
    axisGroup.add(head);

    const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
    axisGroup.setRotationFromQuaternion(q);

    group.add(axisGroup);
  });

  const originGeo = new THREE.SphereGeometry(originRadius, 16, 16);
  const originMat = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    depthTest: false,
    toneMapped: false,
  });
  const origin = new THREE.Mesh(originGeo, originMat);
  group.add(origin);

  return group;
}

/** 导出基坐标系创建函数，供 RobotScene 使用 */
export function createBaseAxes(): THREE.Group {
  return createAxes('BaseAxesHelper', BASE_AXES_CONFIG);
}

// ============================================================
// 主组件
// ============================================================

export default function GLBRobotArm({
  joints,
  onTrajectoryPoint,
  selectedTool = '无',
  onToolList,
  sliderTargetRef,
  highlightedJoint = null,
  showToolAxes = false,
  coordinateSystem = 'World',
}: GLBRobotArmProps) {
  const { scene } = useGLTF('/models/KUKA_V1.glb');
  const { scene: r3fScene } = useThree();

  // 关节高亮（委托给 joint-highlight 模块）
  const highlightMeshRef = useRef<THREE.Mesh | null>(null);

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

  // DH 标定（提取到独立 hook）
  useDHCalibration({ arm, modelScale: MODEL_SCALE });

  const currentJointsRef = useRef<JointAngles>([...joints]);
  const targetJointsRef = useRef<JointAngles>([...joints]);
  const lastTrajectoryTimeRef = useRef<number>(0);

  // 关节高亮相关引用
  const jointPivotsRef = useRef<(THREE.Group | null)[]>([]);
  const jointMeshesRef = useRef<THREE.Mesh[][]>([]);
  const toolAxesRef = useRef<THREE.Group | null>(null);

  // arm 构建完成后收集关节 Pivot、Mesh
  useEffect(() => {
    if (!arm) return;
    const jointPivots = JOINT_NAMES.map(
      (name) => findNode(arm, `Pivot_${name}`) as THREE.Group | null
    );
    jointPivotsRef.current = jointPivots;
    jointMeshesRef.current = collectJointMeshes(arm);
    console.log('[GLBRobotArm][DEBUG] 收集关节 Mesh:', jointMeshesRef.current.map((ms, i) => `${JOINT_NAMES[i]}:${ms.length}个mesh`));
  }, [arm]);

  // 关节高亮
  useEffect(() => {
    console.log('[GLBRobotArm][DEBUG] 高亮 effect 触发, highlightedJoint:', highlightedJoint);
    jointPivotsRef.current.forEach((_pivot, jointIndex) => {
      const shouldHighlight = highlightedJoint !== null && jointIndex === highlightedJoint;
      const meshes = jointMeshesRef.current[jointIndex] ?? [];
      if (shouldHighlight) {
        console.log(`[GLBRobotArm][DEBUG]   高亮关节 ${jointIndex} (${JOINT_NAMES[jointIndex]}), mesh数:${meshes.length}`);
      }

      meshes.forEach((mesh) => {
        if (shouldHighlight) {
          highlightJoint(mesh);
        } else {
          unhighlightJoint(mesh);
        }
      });
    });
  }, [highlightedJoint, arm]);

  // 工具坐标系
  useEffect(() => {
    console.log('[GLBRobotArm][DEBUG] 工具坐标系 effect 触发, showToolAxes:', showToolAxes);
    if (!r3fScene) return;

    const existingHelpers: THREE.Object3D[] = [];
    r3fScene.traverse((child) => {
      if (child.name === 'ToolAxesHelper') existingHelpers.push(child);
    });
    existingHelpers.forEach((h) => {
      if (h.parent) h.parent.remove(h);
    });

    let toolAxes: THREE.Group | undefined;
    if (showToolAxes) {
      toolAxes = createAxes('ToolAxesHelper', TOOL_AXES_CONFIG);
      r3fScene.add(toolAxes);
      toolAxesRef.current = toolAxes;
    } else {
      toolAxesRef.current = null;
    }
  }, [r3fScene, showToolAxes]);

  // 每帧同步工具坐标系
  useFrame(() => {
    if (!arm || !toolAxesRef.current) return;
    const pivot = findNode(arm, 'Pivot_快拆机器人端口');
    if (!pivot) return;

    const worldPos = new THREE.Vector3();
    pivot.getWorldPosition(worldPos);
    toolAxesRef.current.position.copy(worldPos);

    if (coordinateSystem === 'World') {
      toolAxesRef.current.quaternion.identity();
    } else {
      const worldQuat = new THREE.Quaternion();
      pivot.getWorldQuaternion(worldQuat);
      toolAxesRef.current.quaternion.copy(worldQuat);
    }
    toolAxesRef.current.scale.setScalar(1);
  });

  // 目标关节角度随 props 更新
  useEffect(() => {
    targetJointsRef.current = [...joints];
  }, [joints]);

  // 渲染循环：current 插值到 target
  useFrame((_, delta) => {
    if (!arm) return;

    const current = currentJointsRef.current;
    const target = sliderTargetRef?.current ?? targetJointsRef.current;
    const factor = Math.min(delta * 60, 1);

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

    // 轨迹采样：每 50ms 记录一次
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

  // 工具列表发现
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

  // 工具可见性
  useEffect(() => {
    console.log('[GLBRobotArm][DEBUG] 工具可见性 effect 触发, selectedTool:', selectedTool);
    if (!arm) return;
    const flange = findNode(arm, '快拆机器人端口');
    if (!flange) { console.log('[GLBRobotArm][DEBUG]   未找到快拆机器人端口!'); return; }
    console.log('[GLBRobotArm][DEBUG]   法兰子节点:', flange.children.map(c => `${c.name}(visible=${c.visible})`));

    flange.children.forEach((child) => {
      if (child.name && !/^mesh_\d+$/.test(child.name)) {
        child.visible = selectedTool === '无' ? false : child.name === selectedTool;
      }
    });
  }, [arm, selectedTool]);

  // 注册 GLB 位姿能力到 bridge
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
      getSuckerContactPose: () => computeSuckerContactPose(currentArm),
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
