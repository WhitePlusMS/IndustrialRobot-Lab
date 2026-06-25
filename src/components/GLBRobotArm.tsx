// src/components/GLBRobotArm.tsx
// 从GLB模型动态构建六轴可动机械臂
// 根据GLB节点名称自动识别关节位置和层级，所有参数动态计算
//
// 职责：GLB加载、关节驱动、关节高亮、工具管理
// 位姿注册、工具坐标系、轨迹采样等外围职责已提取到独立 hook

import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { JointAngles } from '@/types/robot';
import { highlightJoint, unhighlightJoint } from '@/lib/joint-highlight';
import { JOINT_AXES, JOINT_NAMES, findNode } from '@/lib/dh-calibration';
import { useDHCalibration } from '@/hooks/useDHCalibration';
import { useRobotPoseRegistrar } from '@/hooks/useRobotPoseRegistrar';
import { useToolAxes } from '@/hooks/useToolAxes';
import { useTrajectorySampler } from '@/hooks/useTrajectorySampler';

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

const MODEL_SCALE = 0.0943;
const PIVOT_OFFSETS_MM: Partial<Record<string, [number, number, number]>> = {};

function mmOffsetToModelUnits(offsetMm: [number, number, number]): [number, number, number] {
  const scale = MODEL_SCALE * 1000;
  return [offsetMm[0] / scale, offsetMm[1] / scale, offsetMm[2] / scale];
}

function buildArticulated(scene: THREE.Group, joints: JointAngles): THREE.Group {
  const clone = scene.clone(true);

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

  applyJointAngles(root, joints);
  return root;
}

function applyJointAngles(
  root: THREE.Group,
  joints: JointAngles,
  axisOverrides?: Partial<Record<string, THREE.Vector3>>,
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
          baseQuaternionArray[3],
        )
      : new THREE.Quaternion();
    const deltaQuaternion = new THREE.Quaternion().setFromAxisAngle(axis, angleRad);
    pivot.quaternion.copy(baseQuaternion).multiply(deltaQuaternion);
  });
}

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
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}models/KUKA_V1.glb`);
  const { scene: r3fScene } = useThree();

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
          `[GLBRobotArm] ${name}: 世界位置 [${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)}, ${worldPos.z.toFixed(1)}]`,
        );
      }
    });

    return built;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  useDHCalibration({ arm, modelScale: MODEL_SCALE });
  useRobotPoseRegistrar(arm);
  useToolAxes({
    arm,
    scene: r3fScene,
    showToolAxes,
    coordinateSystem,
  });
  useTrajectorySampler({ arm, onTrajectoryPoint });

  const currentJointsRef = useRef<JointAngles>([...joints]);
  const targetJointsRef = useRef<JointAngles>([...joints]);
  const jointMeshesRef = useRef<THREE.Mesh[][]>([]);

  useEffect(() => {
    if (!arm) return;
    jointMeshesRef.current = collectJointMeshes(arm);
    console.log(
      '[GLBRobotArm][DEBUG] 收集关节 Mesh:',
      jointMeshesRef.current.map((meshes, i) => `${JOINT_NAMES[i]}:${meshes.length}个mesh`),
    );
  }, [arm]);

  useEffect(() => {
    console.log('[GLBRobotArm][DEBUG] 高亮 effect 触发, highlightedJoint:', highlightedJoint);
    jointMeshesRef.current.forEach((meshes, jointIndex) => {
      const shouldHighlight = highlightedJoint !== null && jointIndex === highlightedJoint;
      if (shouldHighlight) {
        console.log(
          `[GLBRobotArm][DEBUG]   高亮关节 ${jointIndex} (${JOINT_NAMES[jointIndex]}), mesh数:${meshes.length}`,
        );
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

  useEffect(() => {
    targetJointsRef.current = [...joints];
  }, [joints]);

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
    console.log('[GLBRobotArm][DEBUG] 工具可见性 effect 触发, selectedTool:', selectedTool);
    if (!arm) return;
    const flange = findNode(arm, '快拆机器人端口');
    if (!flange) {
      console.log('[GLBRobotArm][DEBUG]   未找到快拆机器人端口!');
      return;
    }
    console.log('[GLBRobotArm][DEBUG]   法兰子节点:', flange.children.map((child) => `${child.name}(visible=${child.visible})`));

    flange.children.forEach((child) => {
      if (child.name && !/^mesh_\d+$/.test(child.name)) {
        child.visible = selectedTool !== '无' && child.name === selectedTool;
      }
    });
  }, [arm, selectedTool]);

  if (!arm) return null;

  return <primitive object={arm} />;
}
