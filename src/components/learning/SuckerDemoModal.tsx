// src/components/learning/SuckerDemoModal.tsx
// 真空吸盘原理演示弹窗：mini 3D 场景 + 控制面板，学生手动操作吸盘开关与上下移动，
// 直观体验"接触 -> 抽气 -> 负压 -> 大气压压紧"四阶段
// 吸盘模型复用机械臂 KUKA_V1.glb 中的真实"吸盘"节点
import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { X, ArrowUp, ArrowDown, Power, RotateCcw, Lightbulb } from 'lucide-react';
import { useSceneViewport } from '@/contexts/SceneViewportContext';
import { findNode } from '@/lib/dh-calibration';

// ============================================================
// 场景常量
// ============================================================
const BOX_SIZE = 0.48;          // 箱子边长 (m) —— 与主抓取场景保持一致
const BOX_HALF = BOX_SIZE / 2;  // 箱子半高
const BOX_GROUND_Y = BOX_HALF;  // 箱子着地时中心 Y
const CUP_MOVE_SPEED = 0.3;     // 吸盘连续移动速度 (m/s)
const CUP_NUDGE_STEP = 0.05;    // 吸盘单击微调步长 (m)
const CONTACT_THRESHOLD = 0.02; // 接触判定阈值
const GRAVITY = 5.0;            // 箱子掉落加速度 (m/s^2)
const CUP_TRAVEL_HEIGHT = 0.48; // 吸盘抬升行程（在 0.24 基础上再 *2）

/** 吸盘行程范围（默认值，几何就绪后动态更新） */
const CUP_LIMITS = {
  min: BOX_SIZE + 0.02,   // 默认：箱子顶面 + 半吸盘高
  max: BOX_SIZE + 0.29,   // 默认：+0.27m（兜底值，几何就绪后会覆盖）
};

// ============================================================
// 吸盘 3D 模型 —— 复用机械臂真实吸盘 mesh
// 关键点：
// 1. 必须使用 KUKA_V1.glb 中的真实“吸盘”节点
// 2. 演示时将“最低接触面中心”对齐到 group 原点，确保视觉上位于箱子顶面中心正上方
// ============================================================
interface CupGeometryInfo {
  halfHeight: number;
  tipOffset: number;
  size: [number, number, number];
}

const DEFAULT_CUP_GEOMETRY: CupGeometryInfo = {
  halfHeight: 0.025,
  tipOffset: 0.025,
  size: [0.05, 0.05, 0.05],
};

function analyzeCupGeometry(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(root);
  if (bbox.isEmpty()) {
    return {
      minY: -0.025,
      maxY: 0.025,
      centerY: 0,
      centerX: 0,
      centerZ: 0,
      contactCenterX: 0,
      contactCenterZ: 0,
      contactY: -0.025,
      size: [0.05, 0.05, 0.05] as [number, number, number],
    };
  }
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  bbox.getCenter(center);
  bbox.getSize(size);
  const minY = bbox.min.y;
  const maxY = bbox.max.y;
  const centerY = (minY + maxY) / 2;

  return {
    minY,
    maxY,
    centerY,
    centerX: center.x,
    centerZ: center.z,
    // 按用户要求：使用整个真实吸盘 mesh 的整体包围盒作为整体，
    // 因此 X/Z 对齐用整体包围盒中心，下降接触用整体包围盒底面。
    contactY: minY,
    contactCenterX: center.x,
    contactCenterZ: center.z,
    size: [size.x, size.y, size.z] as [number, number, number],
  };
}

function SuckerCupModel({ suctionOn, onBBoxReady }: {
  suctionOn: boolean;
  onBBoxReady?: (info: CupGeometryInfo) => void;
}) {
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}models/KUKA_V1.glb`);
  const geomReportedRef = useRef(false);
  const suckerData = useMemo(() => {
    const suckerNode = findNode(scene, '吸盘');
    if (!suckerNode) {
      console.warn('[SuckerDemoModal] 未找到 GLB 中的吸盘节点');
      return null;
    }

    const cloned = suckerNode.clone(true);
    cloned.scale.set(0.001, 0.001, 0.001);
    cloned.rotation.set(-Math.PI / 2, 0, 0);

    const tmp = new THREE.Group();
    tmp.add(cloned);
    const geometryInfo = analyzeCupGeometry(tmp);
    tmp.remove(cloned);

    const halfHeight = (geometryInfo.maxY - geometryInfo.minY) / 2;
    const tipOffset = Math.abs(geometryInfo.contactY - geometryInfo.centerY);

    return {
      cloned,
      halfHeight,
      tipOffset,
      bboxSize: geometryInfo.size,
      alignmentOffset: [-geometryInfo.centerX, -geometryInfo.centerY, -geometryInfo.centerZ] as [number, number, number],
    };
  }, [scene]);

  // 副作用：报告几何尺寸给外部（仅首次）
  useEffect(() => {
    if (suckerData && onBBoxReady && !geomReportedRef.current) {
      geomReportedRef.current = true;
      onBBoxReady({
        halfHeight: suckerData.halfHeight,
        tipOffset: suckerData.tipOffset,
        size: suckerData.bboxSize,
      });
    }
  }, [suckerData, onBBoxReady]);

  if (!suckerData) return null;

  const { cloned, alignmentOffset } = suckerData;

  return (
    <group
      position={alignmentOffset}
      scale={suctionOn ? [1.02, 1.02, 1.02] : [1, 1, 1]}
    >
      <primitive object={cloned} />
    </group>
  );
}

// ============================================================
// 箱子 3D 模型
// ============================================================
function DemoBox({ position, attached }: {
  position: [number, number, number];
  attached: boolean;
}) {
  const boxGeo = useMemo(() => new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE), []);
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE)), []);

  const color = attached ? '#43A047' : '#E65100';

  return (
    <group position={position}>
      <mesh geometry={boxGeo} castShadow>
        <meshStandardMaterial color={color} metalness={0.1} roughness={0.7} />
      </mesh>
      <primitive
        object={new THREE.LineSegments(
          edgeGeo,
          new THREE.LineBasicMaterial({ color: '#3E2723', linewidth: 1 })
        )}
      />
      {attached && (
        <mesh position={[0, BOX_HALF + 0.01, 0]}>
          <ringGeometry args={[0.06, 0.08, 32]} />
          <meshStandardMaterial color="#22C55E" emissive="#22C55E" emissiveIntensity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

// ============================================================
// 气流箭头 —— 用动态小箭头可视化吸盘工作原理
// ============================================================
function ArrowMesh({ color, length, thickness }: { color: string; length: number; thickness: number }) {
  return (
    <group>
      <mesh position={[0, length * 0.4, 0]}>
        <cylinderGeometry args={[thickness * 0.4, thickness * 0.4, length * 0.8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} depthTest={false} />
      </mesh>
      <mesh position={[0, length * 0.85, 0]}>
        <coneGeometry args={[thickness * 1.2, length * 0.3, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} depthTest={false} />
      </mesh>
    </group>
  );
}

/** 蓝色向上箭头：在吸盘下表面（海绵）均匀分布，表示向上的吸力 */
function SuctionArrows({
  cupY,
  cupGeometry,
  active,
}: {
  cupY: number;
  cupGeometry: CupGeometryInfo;
  active: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [halfW, halfH, halfD] = useMemo(
    () => [cupGeometry.size[0] / 2, cupGeometry.size[1] / 2, cupGeometry.size[2] / 2],
    [cupGeometry.size]
  );

  // 在吸盘下表面做 4x4 均匀网格分布
  const grid = 4;
  const arrows = useMemo(() => {
    const list: { x: number; z: number; phase: number }[] = [];
    for (let ix = 0; ix < grid; ix++) {
      for (let iz = 0; iz < grid; iz++) {
        const x = -halfW + (halfW * 2 * (ix + 0.5)) / grid;
        const z = -halfD + (halfD * 2 * (iz + 0.5)) / grid;
        list.push({ x, z, phase: (ix * grid + iz) / (grid * grid) });
      }
    }
    return list;
  }, [halfW, halfD]);

  // 箭头更细更小，终点指向吸盘底面
  const arrowLen = Math.max(halfH * 0.6, 0.02);
  const arrowThick = Math.max(Math.min(halfW, halfD) * 0.04, 0.0015);
  const bottomY = cupY - halfH;

  useFrame(({ clock }) => {
    if (!groupRef.current || !active) return;
    const t = clock.getElapsedTime();
    groupRef.current.children.forEach((child, i) => {
      const arrow = child as THREE.Group;
      const { x, z, phase } = arrows[i];
      const progress = (t * 1.0 + phase) % 1;
      // 箭头从底面下方生成，尖端最终到达吸盘底面
      const tipY = bottomY - (1 - progress) * arrowLen;
      arrow.position.set(x, tipY - arrowLen * 0.5, z);
      const alpha = Math.sin(progress * Math.PI);
      arrow.scale.setScalar(0.4 + alpha * 0.9);
      arrow.visible = alpha > 0.05;
    });
  });

  if (!active || cupGeometry.size[0] <= 0 || cupGeometry.size[1] <= 0 || cupGeometry.size[2] <= 0) return null;

  const initialY = bottomY - arrowLen * 0.5;

  return (
    <group ref={groupRef}>
      {arrows.map((a, i) => (
        <group key={i} position={[a.x, initialY, a.z]}>
          <ArrowMesh color="#2563EB" length={arrowLen} thickness={arrowThick} />
        </group>
      ))}
    </group>
  );
}

/** 红色向外箭头：从吸盘一侧（+X）的底边位置向外吹出 */
function BlowArrows({
  cupY,
  cupGeometry,
  active,
}: {
  cupY: number;
  active: boolean;
  cupGeometry: CupGeometryInfo;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [halfW, halfH, halfD] = useMemo(
    () => [cupGeometry.size[0] / 2, cupGeometry.size[1] / 2, cupGeometry.size[2] / 2],
    [cupGeometry.size]
  );

  // 只从 +X 侧面吹出；沿底边到中部、Z 方向均匀分布
  const rows = 3;
  const cols = 2;
  const arrows = useMemo(() => {
    const list: { y: number; z: number; phase: number }[] = [];
    for (let iy = 0; iy < rows; iy++) {
      for (let iz = 0; iz < cols; iz++) {
        const y = -halfH + (halfH * (iy + 0.5)) / rows;
        const z = -halfD + (halfD * 2 * (iz + 0.5)) / cols;
        list.push({ y, z, phase: (iy * cols + iz) / (rows * cols) });
      }
    }
    return list;
  }, [halfH, halfD]);

  // 箭头尺寸与吸盘宽度相匹配
  const arrowLen = Math.max(halfW * 0.8, 0.04);
  const arrowThick = Math.max(halfH * 0.1, 0.003);
  const startX = halfW + arrowLen * 0.1;

  useFrame(({ clock }) => {
    if (!groupRef.current || !active) return;
    const t = clock.getElapsedTime();
    groupRef.current.children.forEach((child, i) => {
      const arrow = child as THREE.Group;
      const { y, z, phase } = arrows[i];
      const progress = (t * 1.2 + phase) % 1;
      // 从 +X 侧面向外水平流动
      arrow.position.set(startX + progress * arrowLen * 1.2, cupY + y, z);
      const alpha = Math.sin(progress * Math.PI);
      arrow.scale.setScalar(0.4 + alpha * 0.9);
      arrow.visible = alpha > 0.05;
    });
  });

  if (!active || cupGeometry.size[0] <= 0 || cupGeometry.size[1] <= 0 || cupGeometry.size[2] <= 0) return null;

  return (
    <group ref={groupRef}>
      {arrows.map((a, i) => (
        <group key={i} position={[startX, cupY + a.y, a.z]} rotation={[0, 0, -Math.PI / 2]}>
          <ArrowMesh color="#EF4444" length={arrowLen} thickness={arrowThick} />
        </group>
      ))}
    </group>
  );
}

// ============================================================
// Mini 3D 场景 —— 可 Orbit 旋转观测
// ============================================================
interface MiniSceneProps {
  cupY: number;
  boxY: number;
  suctionOn: boolean;
  attached: boolean;
  cupGeometry: CupGeometryInfo;
  onCupGeometryReady: (info: CupGeometryInfo) => void;
}

function MiniScene({ cupY, boxY, suctionOn, attached, cupGeometry, onCupGeometryReady }: MiniSceneProps) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 2]} intensity={1.5} castShadow />
      <directionalLight position={[-2, 3, -1]} intensity={0.5} />
      <directionalLight position={[0, -1, 1]} intensity={0.3} />

      <mesh position={[0, -0.015, 0]} receiveShadow>
        <boxGeometry args={[2, 0.03, 2]} />
        <meshStandardMaterial color="#E8E8E8" metalness={0.05} roughness={0.95} />
      </mesh>

      <Grid
        args={[1.5, 1.5]}
        cellSize={0.15}
        cellThickness={0.5}
        cellColor="#CCCCCC"
        sectionSize={0.75}
        sectionThickness={1}
        sectionColor="#AAAAAA"
        fadeDistance={10}
        position={[0, 0.001, 0]}
      />

      {/* 吸盘：模型中心轴固定对准世界原点上方，保证与箱子中心垂直对齐 */}
      <group position={[0, cupY, 0]}>
        <SuckerCupModel suctionOn={suctionOn} onBBoxReady={onCupGeometryReady} />
      </group>

      <DemoBox position={[0, boxY, 0]} attached={attached} />

      {/* 工作原理可视化箭头：蓝色=吸力向上，红色=侧边吹风向外 */}
      <SuctionArrows cupY={cupY} cupGeometry={cupGeometry} active={suctionOn} />
      <BlowArrows cupY={cupY} cupGeometry={cupGeometry} active={suctionOn} />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={true}
        minDistance={0.5}
        maxDistance={5.0}
        target={[0, 0.25, 0]}
      />
    </>
  );
}

// ============================================================
// 阶段指示标签
// ============================================================
const STAGES = [
  { key: 'contact', label: '接触' },
  { key: 'evacuation', label: '抽气' },
  { key: 'vacuum', label: '负压' },
  { key: 'hold', label: '大气压压紧' },
] as const;

function StageIndicator({ cupY, suctionOn, attached, boxY }: {
  cupY: number;
  suctionOn: boolean;
  attached: boolean;
  boxY: number;
}) {
  let activeStage = -1;

  if (cupY <= CUP_LIMITS.min + CONTACT_THRESHOLD && !suctionOn && !attached) {
    activeStage = 0;
  }
  if (cupY <= CUP_LIMITS.min + CONTACT_THRESHOLD && suctionOn) {
    activeStage = attached ? 2 : 1;
  }
  if (attached && boxY > BOX_GROUND_Y + 0.05) {
    activeStage = 3;
  }

  return (
    <div className="flex items-center gap-1">
      {STAGES.map((stage, i) => (
        <div
          key={stage.key}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
            i <= activeStage
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
              : 'bg-white text-slate-400 border border-slate-200'
          }`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${i <= activeStage ? 'bg-white' : 'bg-slate-300'}`} />
          <span>{stage.label}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// 弹窗主组件
// ============================================================
interface SuckerDemoModalProps {
  onClose: () => void;
}

export default function SuckerDemoModal({ onClose }: SuckerDemoModalProps) {
  const [suctionOn, setSuctionOn] = useState(false);
  const [cupY, setCupY] = useState(0); // 初始值在几何就绪后设定
  const [boxY, setBoxY] = useState(BOX_GROUND_Y);
  const [attached, setAttached] = useState(false);
  const [geometryReady, setGeometryReady] = useState(false);
  const [cupGeometry, setCupGeometry] = useState<CupGeometryInfo>(DEFAULT_CUP_GEOMETRY);

  const viewport = useSceneViewport();

  useEffect(() => {
    viewport.setSuppressHUD(true);
    return () => viewport.setSuppressHUD(false);
  }, [viewport.setSuppressHUD]);

  // 吸盘几何信息（由 GLB bbox 计算，唯一定义行程）
  const cupGeometryRef = useRef<CupGeometryInfo>(DEFAULT_CUP_GEOMETRY);

  // 移动方向 ref：+1=上升, -1=下降, 0=停止
  const cupMoveDirRef = useRef(0);
  const fallingSpeedRef = useRef(0);
  const pressStartTimeRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  // 当前帧状态快照（供 useFrame 闭包读取）
  const suctionOnRef = useRef(false);
  const attachedRef = useRef(false);
  const cupYRef = useRef(0);
  const boxYRef = useRef(BOX_GROUND_Y);

  useEffect(() => { suctionOnRef.current = suctionOn; }, [suctionOn]);
  useEffect(() => { attachedRef.current = attached; }, [attached]);
  useEffect(() => { cupYRef.current = cupY; }, [cupY]);
  useEffect(() => { boxYRef.current = boxY; }, [boxY]);

  // GLB 几何就绪回调：用实际尺寸设行程 + 初始位置（仅首次）
  const geomReadyRef = useRef(false);
  const handleCupGeometryReady = useCallback((info: CupGeometryInfo) => {
    cupGeometryRef.current = info;
    setCupGeometry(info);
    // 按用户要求，下降接触基准使用整个吸盘整体包围盒的底面。
    const cupMin = BOX_SIZE + info.tipOffset;
    const cupMax = cupMin + CUP_TRAVEL_HEIGHT;
    CUP_LIMITS.min = cupMin;
    CUP_LIMITS.max = cupMax;

    if (!geomReadyRef.current) {
      geomReadyRef.current = true;
      setCupY(cupMax);
      cupYRef.current = cupMax;
      setGeometryReady(true);
    }
  }, []);

  const syncAttachmentState = useCallback((currentCupY: number) => {
    if (currentCupY <= CUP_LIMITS.min + CONTACT_THRESHOLD && suctionOnRef.current && !attachedRef.current) {
      setAttached(true);
      attachedRef.current = true;
      fallingSpeedRef.current = 0;
    }

    if (!suctionOnRef.current && attachedRef.current) {
      setAttached(false);
      attachedRef.current = false;
    }
  }, []);

  const setCupPositionClamped = useCallback((nextCupY: number) => {
    const clamped = Math.max(CUP_LIMITS.min, Math.min(nextCupY, CUP_LIMITS.max));

    if (Math.abs(clamped - cupYRef.current) > 0.0001) {
      setCupY(clamped);
      cupYRef.current = clamped;
    }

    syncAttachmentState(clamped);
  }, [syncAttachmentState]);

  const nudgeCup = useCallback((deltaY: number) => {
    if (!geometryReady) return;
    setCupPositionClamped(cupYRef.current + deltaY);
  }, [geometryReady, setCupPositionClamped]);

  // useFrame 处理连续移动和物理
  const handleFrame = (_state: { clock: { getDelta: () => number } }, delta: number) => {
    const dt = Math.min(delta, 0.1);
    const dir = cupMoveDirRef.current;

    // 吸盘连续移动（按住即动，松手即停）
    if (dir !== 0) {
      setCupPositionClamped(cupYRef.current + dir * CUP_MOVE_SPEED * dt);
    }

    // 箱子物理（基于真实几何：tipOffset 为杯底到吸盘原点的距离）
    if (attachedRef.current) {
      const { tipOffset } = cupGeometryRef.current;
      const newBoxY = Math.max(BOX_GROUND_Y, cupYRef.current - tipOffset - BOX_HALF);
      setBoxY(newBoxY);
      boxYRef.current = newBoxY;
    } else {
      const bY = boxYRef.current;
      if (Math.abs(bY - BOX_GROUND_Y) > 0.001) {
        fallingSpeedRef.current += GRAVITY * dt;
        const newY = bY - fallingSpeedRef.current * dt;
        if (newY <= BOX_GROUND_Y) {
          setBoxY(BOX_GROUND_Y);
          boxYRef.current = BOX_GROUND_Y;
          fallingSpeedRef.current = 0;
        } else {
          setBoxY(newY);
          boxYRef.current = newY;
        }
      } else {
        fallingSpeedRef.current = 0;
      }
    }
  };

  // 按住连续移动，松手停止
  const beginMove = useCallback((direction: 1 | -1) => {
    if (!geometryReady) return;
    pressStartTimeRef.current = performance.now();
    suppressClickRef.current = false;
    cupMoveDirRef.current = direction;
  }, [geometryReady]);

  const startMoveDown = useCallback(() => { beginMove(-1); }, [beginMove]);
  const startMoveUp = useCallback(() => { beginMove(1); }, [beginMove]);
  const stopMove = useCallback(() => { cupMoveDirRef.current = 0; }, []);

  const finishMove = useCallback(() => {
    const startAt = pressStartTimeRef.current;
    if (startAt !== null) {
      suppressClickRef.current = performance.now() - startAt > 180;
    }
    pressStartTimeRef.current = null;
    stopMove();
  }, [stopMove]);

  const handleMoveButtonClick = useCallback((direction: 1 | -1) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    nudgeCup(direction * CUP_NUDGE_STEP);
  }, [nudgeCup]);

  const toggleSuction = () => {
    const next = !suctionOn;
    setSuctionOn(next);
    suctionOnRef.current = next;
    if (!next && attachedRef.current) {
      setAttached(false);
      attachedRef.current = false;
    }
    if (next && cupYRef.current <= CUP_LIMITS.min + CONTACT_THRESHOLD && !attachedRef.current) {
      setAttached(true);
      attachedRef.current = true;
      fallingSpeedRef.current = 0;
    }
  };
  const reset = () => {
    cupMoveDirRef.current = 0;
    const cupMax = CUP_LIMITS.max;
    setCupY(cupMax);
    cupYRef.current = cupMax;
    setBoxY(BOX_GROUND_Y);
    boxYRef.current = BOX_GROUND_Y;
    setSuctionOn(false);
    suctionOnRef.current = false;
    setAttached(false);
    attachedRef.current = false;
    fallingSpeedRef.current = 0;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        style={{ width: 1100, height: 720 }}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-slate-50/80 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Lightbulb className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">真空吸盘原理演示</h3>
              <p className="text-[11px] text-slate-500">点击微调，按住连续移动，体验真空吸附全过程</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StageIndicator cupY={cupY} suctionOn={suctionOn} attached={attached} boxY={boxY} />
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 transition-colors"
              aria-label="关闭"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* 主体：左 3D + 右面板 */}
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 bg-slate-100 relative">
            <Canvas
              camera={{ position: [1.2, 0.8, 1.5], fov: 45, near: 0.05, far: 10 }}
              shadows={{ type: THREE.PCFShadowMap }}
            >
              <MiniScene
                cupY={cupY}
                boxY={boxY}
                suctionOn={suctionOn}
                attached={attached}
                cupGeometry={cupGeometry}
                onCupGeometryReady={handleCupGeometryReady}
              />
              <FrameLoop onFrame={handleFrame} />
            </Canvas>
            <SceneStatusOverlay cupY={cupY} suctionOn={suctionOn} attached={attached} />
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 bg-white/80 backdrop-blur-sm px-2.5 py-1 rounded-full border border-slate-100">
              拖拽旋转视角 / 滚轮缩放
            </div>
          </div>

          {/* 右侧控制面板 */}
          <div className="w-80 p-5 space-y-3 bg-white border-l border-slate-100 flex flex-col">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500">吸气控制</label>
              <button
                type="button"
                onClick={toggleSuction}
                disabled={!geometryReady}
                className={`w-full py-2.5 text-xs font-semibold rounded-xl border shadow-sm flex items-center justify-center gap-2 transition-all ${
                  suctionOn
                    ? 'bg-green-600 text-white border-green-600 shadow-green-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <Power className="w-4 h-4" />
                {suctionOn ? '吸气中' : '开启吸气'}
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500">吸盘移动（点击微调 / 按住连续移动）</label>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onMouseDown={startMoveUp}
                  onMouseUp={finishMove}
                  onMouseLeave={finishMove}
                  onTouchStart={(event) => {
                    event.preventDefault();
                    startMoveUp();
                  }}
                  onTouchEnd={(event) => {
                    event.preventDefault();
                    finishMove();
                  }}
                  onTouchCancel={finishMove}
                  onClick={() => handleMoveButtonClick(1)}
                  disabled={!geometryReady}
                  className="w-full py-2.5 text-xs font-semibold rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-2 bg-white text-slate-600 hover:bg-slate-50 active:bg-blue-600 active:text-white active:border-blue-600 transition-colors select-none disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowUp className="w-4 h-4" />
                  上升
                </button>
                <button
                  type="button"
                  onMouseDown={startMoveDown}
                  onMouseUp={finishMove}
                  onMouseLeave={finishMove}
                  onTouchStart={(event) => {
                    event.preventDefault();
                    startMoveDown();
                  }}
                  onTouchEnd={(event) => {
                    event.preventDefault();
                    finishMove();
                  }}
                  onTouchCancel={finishMove}
                  onClick={() => handleMoveButtonClick(-1)}
                  disabled={!geometryReady}
                  className="w-full py-2.5 text-xs font-semibold rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-2 bg-white text-slate-600 hover:bg-slate-50 active:bg-blue-600 active:text-white active:border-blue-600 transition-colors select-none disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowDown className="w-4 h-4" />
                  下降
                </button>
              </div>
            </div>

            <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-600">气流图例</label>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-blue-500" />
                  <span className="text-[11px] text-slate-600">蓝色箭头 = 吸气</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-red-500" />
                  <span className="text-[11px] text-slate-600">红色箭头 = 排气</span>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-600">工作原理</label>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                抽气泵工作时，把空气从海绵底部
                <strong className="text-blue-600">吸入</strong>
                （蓝色箭头），再从吸盘侧面
                <strong className="text-red-500">吹出</strong>
                （红色箭头）。海绵处形成负压，大气压把箱子压紧在吸盘上。
              </p>
            </div>

            <div className="text-[10px] text-slate-400 leading-relaxed bg-slate-50 rounded-lg p-2.5 border border-slate-100">
              <p className="font-semibold text-slate-500 mb-1">试试看</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>按住<strong className="text-slate-600">下降</strong>让吸盘接触箱子</li>
                <li>再开<strong className="text-slate-600">吸气</strong>观察吸附</li>
                <li>按住<strong className="text-slate-600">上升</strong>提起箱子</li>
                <li>关<strong className="text-slate-600">吸气</strong>释放</li>
              </ol>
            </div>

            <button
              type="button"
              onClick={reset}
              className="w-full py-2 text-[11px] font-semibold rounded-xl border border-slate-200 bg-white text-slate-500 flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重置演示
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 状态行小组件
// ============================================================
function StatusRow({ dotColor, label, value, highlight, activeColor = 'text-slate-800' }: {
  dotColor: string;
  label: string;
  value: string;
  highlight: boolean;
  activeColor?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-[11px] text-slate-600">{label}</span>
      </div>
      <span className={`text-[11px] font-semibold ${highlight ? activeColor : 'text-slate-400'}`}>
        {value}
      </span>
    </div>
  );
}

// ============================================================
// 3D 场景角落状态浮层
// ============================================================
function SceneStatusOverlay({
  cupY,
  suctionOn,
  attached,
}: {
  cupY: number;
  suctionOn: boolean;
  attached: boolean;
}) {
  const isContact = cupY <= CUP_LIMITS.min + CONTACT_THRESHOLD;

  return (
    <div className="absolute top-3 right-3 z-10 p-2.5 bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm min-w-[110px]">
      <p className="text-[10px] font-semibold text-slate-500 mb-1.5">当前状态</p>
      <div className="space-y-1">
        <StatusRow
          dotColor={isContact ? 'bg-blue-500' : 'bg-slate-300'}
          label="吸盘"
          value={isContact ? '已接触' : '悬空'}
          highlight={isContact}
        />
        <StatusRow
          dotColor={suctionOn ? 'bg-blue-500' : 'bg-slate-300'}
          label="吸气"
          value={suctionOn ? '开启' : '关闭'}
          highlight={suctionOn}
          activeColor="text-blue-600"
        />
        <StatusRow
          dotColor={attached ? 'bg-green-500' : 'bg-slate-300'}
          label="吸附"
          value={attached ? '已吸附' : '未吸附'}
          highlight={attached}
        />
      </div>
    </div>
  );
}

// ============================================================
// useFrame 桥接（Canvas 内部）
// ============================================================
function FrameLoop({ onFrame }: { onFrame: (state: any, delta: number) => void }) {
  useFrame((state, delta) => {
    onFrame(state, delta);
  });
  return null;
}
