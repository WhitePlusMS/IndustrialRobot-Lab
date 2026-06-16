// src/components/GLBRobotArm.tsx
// 从GLB模型动态构建六轴可动机械臂
// 根据GLB节点名称自动识别关节位置和层级，所有参数动态计算
import { useMemo, useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { JointAngles } from '@/types/robot';
import { KUKA_LIKE } from '@/lib/robot-config';
import { forwardKinematics, dhTransform } from '@/lib/kinematics';
import { Matrix4x4 } from '@/lib/matrix4x4';

interface GLBRobotArmProps {
  joints: JointAngles;
  onTrajectoryPoint?: (pos: [number, number, number]) => void;
  selectedTool?: string;
  onToolList?: (tools: string[]) => void;
}

// 关节名称列表（KUKA标准六轴）
const JOINT_NAMES = ['转台', '大臂', '小臂', '回转机构', '末端关节', '快拆机器人端口'];

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

/** 在场景中按名称递归查找节点 */
function findNode(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let result: THREE.Object3D | null = null;
  root.traverse((child) => { if (child.name === name) result = child; });
  return result;
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
    offsetY = -baseBBox.min.y; // 基座底部在y方向的最小值
  } else {
    // 降级：计算整个模型的包围盒
    const fullBBox = new THREE.Box3().setFromObject(clone);
    offsetY = -fullBBox.min.y;
  }

  console.log(`[GLBRobotArm] 基座底部偏移: ${offsetY.toFixed(2)}`);

  // 计算缩放后的偏移量（基座底部需要对齐到原点）
  // raw offsetY = -baseBBox.min.y > 0 (基座底部在原点上方的距离)
  // 缩放后：baseBottom = baseBBox.min.y * MODEL_SCALE
  // 需要偏移 -baseBottom 来让基座底部对齐原点 = offsetY * MODEL_SCALE
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
  // 注意：只有找到所有关节节点才进行操作
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

    // 从父节点移除节点
    parent.remove(node);

    // 设置PivotGroup的位置为节点原本的位置
    pivot.position.copy(pos);
    pivot.quaternion.copy(quat);

    // 将节点重设为PivotGroup的子节点，位置归零
    // （因为PivotGroup已经承担了位置/旋转）
    node.position.set(0, 0, 0);
    node.quaternion.identity();
    node.scale.copy(scale); // 保持缩放

    pivot.add(node);
    parent.add(pivot);
  }

  // 应用初始关节角度
  applyJointAngles(root, joints);

  return root;
}

/** 查找并应用关节角度到PivotGroup */
function applyJointAngles(root: THREE.Group, joints: JointAngles) {
  JOINT_NAMES.forEach((name, i) => {
    const pivot = findNode(root, `Pivot_${name}`) as THREE.Group | null;
    if (!pivot) return;

    const axis = JOINT_AXES[name];
    if (!axis) return;

    const angleRad = (joints[i] * Math.PI) / 180;

    // 使用setFromAxisAngle设置旋转
    // 注意：这里覆盖了PivotGroup原本的旋转（来自原节点的quat）
    // 但插入PivotGroup时已经将原节点quat设为了identity，
    // 且PivotGroup的quat是从原节点复制的 = identity(几乎所有节点都是)
    pivot.quaternion.setFromAxisAngle(axis, angleRad);
  });
}

export default function GLBRobotArm({ joints, onTrajectoryPoint, selectedTool = '无', onToolList }: GLBRobotArmProps) {
  const { scene } = useGLTF('/models/KUKA_V1.glb');

  // 使用ref保存构建好的机械臂，避免重复构建
  const armRef = useRef<THREE.Group | null>(null);
  const previousJointsRef = useRef<JointAngles | null>(null);

  // 构建关节层级（模型加载后仅执行一次）
  const arm = useMemo(() => {
    if (!scene) return null;
    if (armRef.current) return armRef.current;

    console.log('[GLBRobotArm] 构建关节层级...');
    const built = buildArticulated(scene as THREE.Group, joints);
    armRef.current = built;

    // 输出关节信息
    JOINT_NAMES.forEach((name) => {
      const pivot = findNode(built, `Pivot_${name}`);
      if (pivot) {
        const worldPos = new THREE.Vector3();
        pivot.getWorldPosition(worldPos);
        console.log(`[GLBRobotArm] ${name}: 世界位置 [${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)}, ${worldPos.z.toFixed(1)}]`);
      }
    });

    previousJointsRef.current = [...joints];
    return built;
  }, [scene]);

  // ===== DH 标定：归零后测量 GLB 模型各关节世界坐标 =====
  const calibratedRef = useRef(false);
  useEffect(() => {
    if (!arm || calibratedRef.current) return;
    calibratedRef.current = true;

    // 保存当前关节旋转
    const savedQuats: THREE.Quaternion[] = [];
    JOINT_NAMES.forEach((name) => {
      const pivot = findNode(arm, `Pivot_${name}`) as THREE.Group | null;
      if (pivot) savedQuats.push(pivot.quaternion.clone());
      else savedQuats.push(new THREE.Quaternion());
    });

    // 归零所有关节
    JOINT_NAMES.forEach((name) => {
      const pivot = findNode(arm, `Pivot_${name}`) as THREE.Group | null;
      if (pivot) pivot.quaternion.identity();
    });

    arm.updateMatrixWorld(true);

    // 读取各关节世界坐标
    const worldPositions: { name: string; pos: [number, number, number] }[] = [];
    JOINT_NAMES.forEach((name) => {
      const pivot = findNode(arm, `Pivot_${name}`) as THREE.Group | null;
      if (pivot) {
        const wp = new THREE.Vector3();
        pivot.getWorldPosition(wp);
        worldPositions.push({ name, pos: [wp.x, wp.y, wp.z] });
      }
    });

    // 法兰位置
    const flange = findNode(arm, '快拆机器人端口');
    const flangePos = new THREE.Vector3();
    if (flange) flange.getWorldPosition(flangePos);

    // 基座底部
    const baseNode = findNode(arm, '固定底座');
    let baseBottomY = 0;
    if (baseNode) {
      const baseBBox = new THREE.Box3().setFromObject(baseNode);
      baseBottomY = baseBBox.min.y;
    }

    // ===== FK 帧位置 vs GLB 枢轴位置逐帧对比 =====
    const ZERO_JOINTS: JointAngles = [0, 0, 0, 0, 0, 0];
    const dhVals = Object.values(KUKA_LIKE.dhParams);

    // 计算DH各帧在归零时的世界位置 (mm)
    const fkFrames: [number, number, number][] = [];
    let T = new Matrix4x4([[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]);
    for (let i = 0; i < 6; i++) {
      const dh = dhVals[i];
      const Ti = dhTransform(0, dh.d, dh.a, dh.alpha);
      T = T.multiply(Ti);
      fkFrames.push([T.data[0][3], T.data[1][3], T.data[2][3]]);
    }
    // 额外算一个"末端" = J6 帧再往前 d6
    const T6Ext = T.multiply(dhTransform(0, 0, 0, 0)); // no additional - J6 frame IS the flange
    fkFrames.push([T6Ext.data[0][3], T6Ext.data[1][3], T6Ext.data[2][3]]);

    // GLB 世界位置 → sceneToDH (×1000 回 mm)
    const glbInMM = worldPositions.map(({ name, pos }) => ({
      name,
      mm: [pos[0] * 1000, pos[1] * 1000, pos[2] * 1000] as [number, number, number],
    }));
    glbInMM.push({
      name: '法兰末端',
      mm: [flangePos.x * 1000, flangePos.y * 1000, flangePos.z * 1000],
    });

    console.log('\n========== FK vs GLB 逐帧对比 (θ=0, 单位mm) ==========');
    console.log('MODEL_SCALE:', MODEL_SCALE);

    const frameNames = [...JOINT_NAMES, '法兰末端'];
    for (let i = 0; i < 7; i++) {
      const fk = fkFrames[i];
      const glb = glbInMM[i];
      const errX = fk[0] - glb.mm[0], errY = fk[1] - glb.mm[1], errZ = fk[2] - glb.mm[2];
      const errDist = Math.sqrt(errX*errX + errY*errY + errZ*errZ);
      console.log(`\n${frameNames[i]}:`);
      console.log(`  FK:  [${fk[0].toFixed(1)}, ${fk[1].toFixed(1)}, ${fk[2].toFixed(1)}] mm`);
      console.log(`  GLB: [${glb.mm[0].toFixed(1)}, ${glb.mm[1].toFixed(1)}, ${glb.mm[2].toFixed(1)}] mm`);
      console.log(`  误差: [${errX.toFixed(1)}, ${errY.toFixed(1)}, ${errZ.toFixed(1)}] mm → ${errDist.toFixed(1)} mm`);
    }

    // DH 连杆长度 vs GLB 连杆长度
    console.log('\n--- DH 连杆参数 vs GLB 实测 ---');
    // DH link lengths from parameters
    const dhLinks = [
      { name: 'J1.d (基座高)', dh: dhVals[0].d, glb: 'J1世界Y' },
      { name: 'J2.a (肩偏置)', dh: dhVals[1].a, glb: 'J1→J2水平距' },
      { name: 'J3.a (大臂长)', dh: dhVals[2].a, glb: 'J2→J3距' },
      { name: 'J4.d (小臂长)', dh: dhVals[3].d, glb: 'J3→J4距' },
      { name: 'J6.d (法兰高)', dh: dhVals[5].d, glb: 'J5→J6距' },
    ];
    const glbLinks = [0, 0, 0, 0, 0];
    for (let i = 0; i < glbInMM.length - 1; i++) {
      const a = glbInMM[i].mm, b = glbInMM[i+1].mm;
      glbLinks[i] = Math.sqrt((b[0]-a[0])**2 + (b[1]-a[1])**2 + (b[2]-a[2])**2);
    }
    // Remap: J1.d → glbLinks[0] is J1→J2 (includes both d and a), use simplified
    // Actually just show raw GLB distances
    for (let i = 0; i < glbInMM.length - 1; i++) {
      const a = glbInMM[i].mm, b = glbInMM[i+1].mm;
      const dx = b[0]-a[0], dy = b[1]-a[1], dz = b[2]-a[2];
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      console.log(`  ${glbInMM[i].name}→${glbInMM[i+1].name}: GLB=${dist.toFixed(1)}mm`);
    }

    // 关键：各DH参数应该匹配的GLB实测值
    console.log('\n--- 建议 DH 修正值 ---');
    console.log(`  J1.d: ${glbInMM[0].mm[1].toFixed(1)} (当前 ${dhVals[0].d})`);
    // J1→J2 in XZ (horizontal offset from J1 center)
    const j1x = glbInMM[0].mm[0], j1z = glbInMM[0].mm[2];
    const j2x = glbInMM[1].mm[0], j2z = glbInMM[1].mm[2];
    const j2HorizOffset = Math.sqrt((j2x-j1x)**2 + (j2z-j1z)**2);
    console.log(`  J2.a (J1→J2水平偏置): ${j2HorizOffset.toFixed(1)} (当前 ${dhVals[1].a})`);
    // J2→J3
    const j2j3 = Math.sqrt((glbInMM[2].mm[0]-glbInMM[1].mm[0])**2 + (glbInMM[2].mm[1]-glbInMM[1].mm[1])**2 + (glbInMM[2].mm[2]-glbInMM[1].mm[2])**2);
    console.log(`  J3.a (大臂 J2→J3): ${j2j3.toFixed(1)} (当前 ${dhVals[2].a})`);
    // J3→J4
    const j3j4 = Math.sqrt((glbInMM[3].mm[0]-glbInMM[2].mm[0])**2 + (glbInMM[3].mm[1]-glbInMM[2].mm[1])**2 + (glbInMM[3].mm[2]-glbInMM[2].mm[2])**2);
    console.log(`  J4.d (小臂 J3→J4): ${j3j4.toFixed(1)} (当前 ${dhVals[3].d})`);
    // J4→J5
    const j4j5 = Math.sqrt((glbInMM[4].mm[0]-glbInMM[3].mm[0])**2 + (glbInMM[4].mm[1]-glbInMM[3].mm[1])**2 + (glbInMM[4].mm[2]-glbInMM[3].mm[2])**2);
    console.log(`  J4→J5 (腕部): ${j4j5.toFixed(1)} ← 仅供参考`);
    // J5→J6
    const j5j6 = Math.sqrt((glbInMM[5].mm[0]-glbInMM[4].mm[0])**2 + (glbInMM[5].mm[1]-glbInMM[4].mm[1])**2 + (glbInMM[5].mm[2]-glbInMM[4].mm[2])**2);
    console.log(`  J6.d (法兰 J5→J6): ${j5j6.toFixed(1)} (当前 ${dhVals[5].d})`);
    // 总臂展
    const glbReach = Math.sqrt((flangePos.x*1000 - glbInMM[0].mm[0])**2 + (flangePos.y*1000 - glbInMM[0].mm[1])**2 + (flangePos.z*1000 - glbInMM[0].mm[2])**2);
    const fkReach = Math.sqrt(fkFrames[6][0]**2 + fkFrames[6][1]**2 + fkFrames[6][2]**2);
    console.log(`\nGLB 总臂展: ${glbReach.toFixed(1)} mm`);
    console.log(`FK  总臂展: ${fkReach.toFixed(1)} mm`);
    console.log(`FK 末端帧: [${fkFrames[6][0].toFixed(1)}, ${fkFrames[6][1].toFixed(1)}, ${fkFrames[6][2].toFixed(1)}] mm`);
    console.log(`FK 各段: J1→J2=${(fkFrames[1][0]-fkFrames[0][0]).toFixed(0)}, J2→J3=${(fkFrames[2][0]-fkFrames[1][0]).toFixed(0)}, J3→J4 Y=${(fkFrames[3][1]-fkFrames[2][1]).toFixed(0)} Z=${(fkFrames[3][2]-fkFrames[2][2]).toFixed(0)}, J4→J5=${(fkFrames[4][0]-fkFrames[3][0]).toFixed(0)}, J5→J6=${(fkFrames[5][2]-fkFrames[4][2]).toFixed(0)}`);
    console.log('==========================================================\n');

    // 恢复关节旋转
    JOINT_NAMES.forEach((name, i) => {
      const pivot = findNode(arm, `Pivot_${name}`) as THREE.Group | null;
      if (pivot) pivot.quaternion.copy(savedQuats[i]);
    });
  }, [arm]);

  // 关节角度变化时更新（原有逻辑）
  useEffect(() => {
    if (!arm) return;

    if (previousJointsRef.current) {
      const same = previousJointsRef.current.every((v, i) => v === joints[i]);
      if (same) return;
    }

    applyJointAngles(arm, joints);
    previousJointsRef.current = [...joints];
  }, [arm, joints]);

  // 单独的useEffect：关节更新后读取末端世界位置用于轨迹
  // 与关节控制逻辑完全解耦，不会影响关节运动
  useEffect(() => {
    if (!arm || !onTrajectoryPoint) return;

    // 只在关节变化时记录（避免初始状态重复记录）
    if (previousJointsRef.current) {
      arm.updateMatrixWorld(true);
      const flangeNode = findNode(arm, '快拆机器人端口');
      if (flangeNode) {
        const worldPos = new THREE.Vector3();
        flangeNode.getWorldPosition(worldPos);
        onTrajectoryPoint([worldPos.x, worldPos.y, worldPos.z]);
      }
    }
  }, [arm, joints, onTrajectoryPoint]);

  // 工具节点发现：在原始场景中扫描快拆端口下的子节点，上报工具列表
  // 过滤掉 GLTFLoader 自动生成的 mesh_N 子节点，只保留命名节点
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

  // 工具可见性控制：selectedTool === '无' 隐藏所有工具节点，否则显示匹配节点
  // 只控制命名节点，跳过 GLTFLoader 自动生成的 mesh_N 子节点（法兰自身几何体）
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

  // 暴露 GLB 模型接口供 IK 使用
  useEffect(() => {
    if (!arm) return;
    const armRef = arm;
    (window as any).__GLB_getFlangeMatrix = () => {
      armRef.updateMatrixWorld(true);
      const flange = findNode(armRef, '快拆机器人端口');
      if (!flange) return null;
      const m = new THREE.Matrix4();
      flange.getWorldPosition(new THREE.Vector3()); // needed for matrix update
      flange.updateMatrixWorld();
      m.copy(flange.matrixWorld);
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      m.decompose(pos, quat, new THREE.Vector3());
      return {
        position: [pos.x, pos.y, pos.z] as [number, number, number],
        rotation: [
          [m.elements[0], m.elements[1], m.elements[2]],
          [m.elements[4], m.elements[5], m.elements[6]],
          [m.elements[8], m.elements[9], m.elements[10]],
        ] as number[][],
      };
    };
    (window as any).__GLB_applyJoints = (angles: number[]) => {
      applyJointAngles(armRef, angles as JointAngles);
      armRef.updateMatrixWorld(true);
    };
    return () => {
      delete (window as any).__GLB_getFlangePos;
      delete (window as any).__GLB_applyJoints;
    };
  }, [arm]);

  if (!arm) return null;

  return <primitive object={arm} />;
}
