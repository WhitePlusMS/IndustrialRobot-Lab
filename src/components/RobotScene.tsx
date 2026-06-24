// src/components/RobotScene.tsx
// 使用官方的KUKA GLB模型替换程序化生成的机械臂
// 场景尺度：Three.js单位为米，DH参数（mm）乘以 SCENE_SCALE 转换
import { useMemo, Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import type { JointAngles } from '@/types/robot';
import type { CameraState } from '@/types/camera';
import { useRobotStateContext } from '@/contexts/RobotContext';
import { useSceneViewport } from '@/contexts/SceneViewportContext';
import { createBaseAxes } from '@/lib/robot-axes';
import GLBRobotArm from './GLBRobotArm';
import TransformGizmo from './TransformGizmo';
import type { GizmoIKHandle } from '@/types/robot';
import CameraModel from '@/components/camera/CameraModel';
import CameraGroundProjection from '@/components/camera/CameraGroundProjection';

import GraspableBox from '@/components/GraspableBox';
import SpawnAreaFence from '@/components/SpawnAreaFence';
import DemoPartsRenderer from '@/components/camera/DemoPartsRenderer';
import type { DemoPart } from '@/hooks/useDemoParts';
import type { BoxState } from '@/hooks/useSuckerControl';
import type { BoxSpawnParams } from '@/types/sequence';
import { SceneRendererProvider } from '@/contexts/SceneRendererContext';
import { sceneRendererBridge } from '@/lib/scene-renderer-bridge';
import { robotScalarToSceneM, robotToSceneM } from '@/lib/spatial-coordinates';

// 与 useVirtualCamera.ts 中一致的默认相机状态，用于 3D 层初始化回退
const DEFAULT_CAMERA_STATE: CameraState = {
  position: [-1.135, 3.0, 0.056],
  rotation: [-90, 0, 0],
  fov: 60,
  near: 0.1,
  far: 10,
  showCamera: true,
  showFrustum: true,
  showModel: true,
  resolution: [640, 480],
};

interface RobotSceneProps {
  joints: JointAngles;
  trajectory: [number, number, number][];
  showGrid: boolean;
  showTrajectory: boolean;
  cameraPosition: [number, number, number];
  onTrajectoryPoint?: (pos: [number, number, number]) => void;
  selectedTool?: string;
  onToolList?: (tools: string[]) => void;
  cameraState?: CameraState;
  /** 滑块/输入框直接写入的目标相机状态 ref；3D 层每帧读取，避免 React 高频重绘 */
  cameraSliderTargetRef?: React.MutableRefObject<CameraState>;
  /** 滑块/输入框直接写入的目标关节 ref；3D 层每帧读取，避免 React 高频重绘 */
  sliderTargetRef?: React.MutableRefObject<JointAngles>;
  /** 要高亮的关节索引 */
  highlightedJoint?: number | null;
  /** 是否显示坐标系（基坐标系 + 末端工具坐标系） */
  showCoordinateSystems?: boolean;
  /** HUD 相机可视化总闸 */
  showCamera?: boolean;
  /** 当前位姿控制坐标系，用于高亮对应坐标系 */
  coordinateSystem?: 'World' | 'Tool';
  /** Gizmo IK 处理器 ref */
  gizmoIKRef?: React.MutableRefObject<GizmoIKHandle | null>;
  /** 是否显示操作轴 Gizmo */
  showTransformGizmo?: boolean;
  /** Gizmo 模式 */
  gizmoMode?: 'translate' | 'rotate';
  /** 停止机器人动画（Gizmo 拖拽时调用） */
  onStopAnimation?: () => void;
  // 箱子/吸盘
  boxPosition?: [number, number, number];
  boxState?: BoxState;
  checkAttachment?: (boxPos: [number, number, number]) => void;
  updateBoxFollow?: () => void;
  applyGravity?: (dt: number) => void;
  /** 箱子生成围栏参数 */
  spawnFence?: BoxSpawnParams | null;
  /** 演示零件 */
  demoParts?: DemoPart[];
}

// 工作台
function Workbench() {
  return (
    <mesh position={[0, -0.005, 0]} receiveShadow>
      <boxGeometry args={[3, 0.01, 2]} />
      <meshStandardMaterial color="#D4D4D4" metalness={0.3} roughness={0.8} />
    </mesh>
  );
}

// GLB加载中的占位
function LoadingPlaceholder() {
  return (
    <mesh>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#CCCCCC" wireframe />
    </mesh>
  );
}

// 轨迹线（使用场景空间坐标，不再做任何转换）
function TrajectoryLine({ points, visible }: { points: [number, number, number][]; visible: boolean }) {
  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const positions = new Float32Array(points.length * 3);
    points.forEach((p, i) => {
      positions[i * 3] = p[0];
      positions[i * 3 + 1] = p[1];
      positions[i * 3 + 2] = p[2];
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [points]);

  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: '#F97316',
      opacity: 0.8,
      transparent: true,
    });
  }, []);

  if (!visible || points.length < 2 || !geometry) return null;

  return <primitive object={new THREE.Line(geometry, material)} />;
}

// 向 Context + bridge 同时提供 renderer/scene，供拍照引擎使用
function SceneRendererBridge() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const api = { renderer: gl, scene };
    sceneRendererBridge.setAPI(api);
    return () => {
      sceneRendererBridge.setAPI(null);
    };
  }, [gl, scene]);
  return null;
}

function SceneRendererProviderInner({ children }: { children: React.ReactNode }) {
  const { gl, scene } = useThree();
  return <SceneRendererProvider api={{ renderer: gl, scene }}>{children}</SceneRendererProvider>;
}

// 物理更新循环
function EffectLoop({
  checkAttachment,
  updateBoxFollow,
  applyGravity,
  boxPosition,
}: {
  checkAttachment: (boxPos: [number, number, number]) => void;
  updateBoxFollow: () => void;
  applyGravity: (dt: number) => void;
  boxPosition: [number, number, number];
}) {
  const lastTimeRef = useRef(0);

  useFrame(() => {
    checkAttachment(boxPosition);
    updateBoxFollow();
    const now = performance.now();
    const dt = lastTimeRef.current ? (now - lastTimeRef.current) / 1000 : 0.016;
    lastTimeRef.current = now;
    applyGravity(Math.min(dt, 0.05));
  });

  return null;
}

/**
 * 相机连续值插值（位置/朝向/FOV/裁剪面）。
 * 布尔值与分辨率不插值，直接沿用 current。
 * 提取为纯函数使插值逻辑可独立测试，消除三层状态副本的手动同步。
 */
function interpolateCameraContinuous(
  current: CameraState,
  target: CameraState,
  factor: number
): Pick<CameraState, 'position' | 'rotation' | 'fov' | 'near' | 'far'> {
  const position: [number, number, number] = [...current.position];
  for (let i = 0; i < 3; i++) {
    const diff = target.position[i] - current.position[i];
    position[i] = Math.abs(diff) > 0.0001 ? current.position[i] + diff * factor : target.position[i];
  }

  const rotation: [number, number, number] = [...current.rotation];
  for (let i = 0; i < 3; i++) {
    let diff = target.rotation[i] - current.rotation[i];
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    rotation[i] = Math.abs(diff) > 0.01 ? current.rotation[i] + diff * factor : target.rotation[i];
  }

  const fovDiff = target.fov - current.fov;
  const fov = Math.abs(fovDiff) > 0.01 ? current.fov + fovDiff * factor : target.fov;
  const nearDiff = target.near - current.near;
  const near = Math.abs(nearDiff) > 0.001 ? current.near + nearDiff * factor : target.near;
  const farDiff = target.far - current.far;
  const far = Math.abs(farDiff) > 0.01 ? current.far + farDiff * factor : target.far;

  return { position, rotation, fov, near, far };
}

// 场景内容
function SceneContent({
  joints,
  trajectory,
  showGrid,
  showTrajectory,
  onTrajectoryPoint,
  cameraPosition,
  selectedTool,
  onToolList,
  cameraState,
  cameraSliderTargetRef,
  sliderTargetRef,
  highlightedJoint,
  showCoordinateSystems,
  showCamera = true,
  coordinateSystem = 'World',
  gizmoIKRef,
  showTransformGizmo,
  gizmoMode = 'translate',
  onStopAnimation,
  boxPosition,
  boxState,
  checkAttachment,
  updateBoxFollow,
  applyGravity,
  spawnFence,
  demoParts,
}: RobotSceneProps) {
  // 响应视角切换：平滑过渡相机位置
  const { camera } = useThree();
  const animRef = useRef(0);
  const startPosRef = useRef(new THREE.Vector3());
  const startTimeRef = useRef(0);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    cancelAnimationFrame(animRef.current);

    const target = new THREE.Vector3(...cameraPosition);
    if (prefersReducedMotion) {
      camera.position.copy(target);
      camera.lookAt(0, 1, 0);
      return;
    }

    startPosRef.current.copy(camera.position);
    startTimeRef.current = performance.now();

    const DURATION = 400;

    const animate = () => {
      const elapsed = performance.now() - startTimeRef.current;
      const t = Math.min(elapsed / DURATION, 1);
      // easeInOutCubic
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      camera.position.lerpVectors(startPosRef.current, target, eased);
      camera.lookAt(0, 1, 0);

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animRef.current);
  }, [cameraPosition, camera, prefersReducedMotion]);

  // 虚拟工业相机状态：3D 层使用 ref 做插值，避免滑块拖动时 React 高频重绘导致瞬移
  const cameraRef = useRef<CameraState>(
    cameraState ? { ...cameraState } : { ...DEFAULT_CAMERA_STATE }
  );

  // cameraState 变化时同步 ref（如按钮点击、手动输入、reset）
  useEffect(() => {
    if (cameraState) {
      cameraRef.current = { ...cameraState };
    }
  }, [cameraState]);

  // 每帧向 slider target ref 做连续值插值（位置/朝向/FOV/裁剪面），直接操作 Three.js 对象绕过 React
  useFrame((_, delta) => {
    if (!cameraSliderTargetRef?.current) return;

    const target = cameraSliderTargetRef.current;
    const current = cameraRef.current;
    const factor = Math.min(delta * 60, 1);

    const interpolated = interpolateCameraContinuous(current, target, factor);

    // 任意连续值有变化时才更新 ref
    if (interpolated.position.some((v, i) => v !== current.position[i])
        || interpolated.rotation.some((v, i) => v !== current.rotation[i])
        || interpolated.fov !== current.fov
        || interpolated.near !== current.near
        || interpolated.far !== current.far) {
      cameraRef.current = { ...current, ...interpolated };
    }
  });

  // cameraDisplay = 插值后的连续值 + 从 cameraState prop 直读的布尔值（React 实时，无滞后）
  const cameraDisplay = cameraSliderTargetRef
    ? { ...cameraRef.current, showModel: cameraState?.showModel ?? DEFAULT_CAMERA_STATE.showModel, showFrustum: cameraState?.showFrustum ?? DEFAULT_CAMERA_STATE.showFrustum }
    : cameraState;

  return (
    <SceneRendererProviderInner>
      {/* 注入渲染器/场景到全局，供拍照引擎使用 */}
      <SceneRendererBridge />

      <ambientLight intensity={0.6} />
      <directionalLight
        position={[3, 6, 4]} intensity={1.0}
        castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048}
      />
      <directionalLight position={[-3, 4, -3]} intensity={0.4} />
      <hemisphereLight args={['#B1E1FF', '#FFFFFF', 0.3]} />

      <Workbench />

      {showGrid && (
        <Grid
          position={[0, 0, 0]}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor="#9CA3AF"
          sectionSize={2}
          sectionThickness={1.5}
          sectionColor="#6B7280"
          fadeDistance={30}
          infiniteGrid
        />
      )}

      {showCoordinateSystems && (
        <primitive object={createBaseAxes()} position={[0, 0.05, 0]} />
      )}

      {/* GLB机械臂模型 */}
      <Suspense fallback={<LoadingPlaceholder />}>
        <GLBRobotArm
          joints={joints}
          sliderTargetRef={sliderTargetRef}
          onTrajectoryPoint={onTrajectoryPoint}
          selectedTool={selectedTool}
          onToolList={onToolList}
          highlightedJoint={highlightedJoint}
          showToolAxes={showCoordinateSystems && !showTransformGizmo}
          coordinateSystem={coordinateSystem}
        />
      </Suspense>

      <TrajectoryLine points={trajectory} visible={showTrajectory} />

      {/* 可抓取箱子（NONE 状态表示无箱子，不渲染） */}
      {boxPosition && boxState && boxState !== 'NONE' && (
        <GraspableBox position={robotToSceneM(boxPosition)} state={boxState} />
      )}

      {/* 箱子生成围栏（仅在随机模式显示，DH mm → 场景 m） */}
      {spawnFence && spawnFence.mode === 'random' && (
        <SpawnAreaFence
          center={[
            robotScalarToSceneM(spawnFence.randomCenter?.[0] ?? 300),
            robotScalarToSceneM(spawnFence.randomCenter?.[1] ?? 200),
          ]}
          rangeX={robotScalarToSceneM(spawnFence.randomRangeX ?? 150)}
          rangeZ={robotScalarToSceneM(spawnFence.randomRangeZ ?? 150)}
          restingHeight={robotScalarToSceneM(spawnFence.restingHeight ?? 240)}
          minHeight={robotScalarToSceneM(spawnFence.minHeight ?? 400)}
          maxHeight={robotScalarToSceneM(spawnFence.maxHeight ?? 800)}
          visible={true}
        />
      )}

      {/* 物理更新循环 */}
      {checkAttachment && updateBoxFollow && applyGravity && boxPosition && (
        <EffectLoop
          checkAttachment={checkAttachment}
          updateBoxFollow={updateBoxFollow}
          applyGravity={applyGravity}
          boxPosition={boxPosition}
        />
      )}

      {/* 演示零件 */}
      <DemoPartsRenderer parts={demoParts ?? []} />

      {/* 外部相机模型 */}
      {showCamera && cameraDisplay && (
        <group userData={{ isCameraModel: true }}>
          <CameraModel
            position={cameraDisplay.position}
            rotation={cameraDisplay.rotation}
            fov={cameraDisplay.fov}
            near={cameraDisplay.near}
            far={cameraDisplay.far}
            showModel={cameraDisplay.showModel}
            showFrustum={cameraDisplay.showFrustum}
          />
        </group>
      )}

      {/* 相机视锥体地面投影虚线框 */}
      {showCamera && cameraDisplay && cameraDisplay.showFrustum && (
        <CameraGroundProjection
          position={cameraDisplay.position}
          rotation={cameraDisplay.rotation}
          fov={cameraDisplay.fov}
          near={cameraDisplay.near}
          far={cameraDisplay.far}
        />
      )}

      {/* 操作轴 Gizmo */}
      {showTransformGizmo && gizmoIKRef && (
        <TransformGizmo
          gizmoIKRef={gizmoIKRef}
          mode={gizmoMode}
          stopAnimation={onStopAnimation}
        />
      )}

      <OrbitControls
        makeDefault
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={0.5}
        maxDistance={20}
        target={[0, 1, 0]}
      />
    </SceneRendererProviderInner>
  );
}

export default function RobotScene(props: RobotSceneProps) {
  const { highlightedJoint } = useRobotStateContext();
  const { showCoordinateSystems } = useSceneViewport();
  const showCamera = props.cameraState?.showCamera ?? DEFAULT_CAMERA_STATE.showCamera;

  return (
    <div className="w-full h-full" style={{ touchAction: 'manipulation' }}>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ position: props.cameraPosition, fov: 45, near: 0.01, far: 100 }}
        gl={{ antialias: true }}
        style={{ background: '#E8E8E8', width: '100%', height: '100%', touchAction: 'manipulation' }}
      >
        <SceneContent
          {...props}
          highlightedJoint={highlightedJoint}
          showCoordinateSystems={showCoordinateSystems}
          showCamera={showCamera}
        />
      </Canvas>
    </div>
  );
}
