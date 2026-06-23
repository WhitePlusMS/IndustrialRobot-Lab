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
const BOX_SIZE = 0.12;          // 箱子边长 (m) —— 与主抓取场景保持一致
const BOX_HALF = BOX_SIZE / 2;  // 箱子半高
const BOX_GROUND_Y = BOX_HALF;  // 箱子着地时中心 Y
const CUP_MOVE_SPEED = 0.3;     // 吸盘连续移动速度 (m/s)
const CUP_NUDGE_STEP = 0.05;    // 吸盘单击微调步长 (m)
const CONTACT_THRESHOLD = 0.02; // 接触判定阈值
const GRAVITY = 5.0;            // 箱子掉落加速度 (m/s^2)
const CUP_TRAVEL_HEIGHT = 0.24; // 抬升上限改为原来的 2 倍

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
  const { scene } = useGLTF('/models/KUKA_V1.glb');
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
// Mini 3D 场景 —— 可 Orbit 旋转观测
// ============================================================
interface MiniSceneProps {
  cupY: number;
  boxY: number;
  suctionOn: boolean;
  attached: boolean;
  onCupGeometryReady: (info: CupGeometryInfo) => void;
}

function MiniScene({ cupY, boxY, suctionOn, attached, onCupGeometryReady }: MiniSceneProps) {
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

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={true}
        minDistance={0.5}
        maxDistance={2.0}
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

  const viewport = useSceneViewport();

  useEffect(() => {
    viewport.setSuppressHUD(true);
    return () => viewport.setSuppressHUD(false);
  }, [viewport.setSuppressHUD]);

  // 吸盘几何信息（由 GLB bbox 计算，唯一定义行程）
  const cupGeometryRef = useRef({ halfHeight: 0.025, tipOffset: 0.025, size: [0.05, 0.05, 0.05] as [number, number, number] });

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
        style={{ width: 920, height: 620 }}
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
              camera={{ position: [0.7, 0.45, 0.85], fov: 45, near: 0.05, far: 10 }}
              shadows
            >
              <MiniScene
                cupY={cupY}
                boxY={boxY}
                suctionOn={suctionOn}
                attached={attached}
                onCupGeometryReady={handleCupGeometryReady}
              />
              <FrameLoop onFrame={handleFrame} />
            </Canvas>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 bg-white/80 backdrop-blur-sm px-2.5 py-1 rounded-full border border-slate-100">
              拖拽旋转视角 / 滚轮缩放
            </div>
          </div>

          {/* 右侧控制面板 */}
          <div className="w-64 p-4 space-y-4 bg-white border-l border-slate-100 flex flex-col">
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

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500">当前状态</label>
              <div className="space-y-1.5">
                <StatusRow
                  dotColor={cupY <= CUP_LIMITS.min + CONTACT_THRESHOLD ? 'bg-blue-500' : 'bg-slate-300'}
                  label="吸盘"
                  value={cupY <= CUP_LIMITS.min + CONTACT_THRESHOLD ? '已接触' : '悬空'}
                  highlight={cupY <= CUP_LIMITS.min + CONTACT_THRESHOLD}
                />
                <StatusRow
                  dotColor={suctionOn ? 'bg-green-500' : 'bg-slate-300'}
                  label="吸气"
                  value={suctionOn ? '开启' : '关闭'}
                  highlight={suctionOn}
                />
                <StatusRow
                  dotColor={attached ? 'bg-green-500' : 'bg-slate-300'}
                  label="吸附"
                  value={attached ? '已吸附' : '未吸附'}
                  highlight={attached}
                />
              </div>
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
function StatusRow({ dotColor, label, value, highlight }: {
  dotColor: string;
  label: string;
  value: string;
  highlight: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-[11px] text-slate-600">{label}</span>
      </div>
      <span className={`text-[11px] font-semibold ${highlight ? 'text-slate-800' : 'text-slate-400'}`}>
        {value}
      </span>
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
