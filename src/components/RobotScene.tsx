// src/components/RobotScene.tsx
// 使用官方的KUKA GLB模型替换程序化生成的机械臂
// 场景尺度：Three.js单位为米，DH参数（mm）乘以 SCENE_SCALE 转换
import { useMemo, Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import type { JointAngles } from '@/types/robot';
import type { CameraState } from '@/types/camera';
import { useRobotContext } from '@/contexts/RobotContext';
import { useSceneViewport } from '@/contexts/SceneViewportContext';
import { createBaseAxes } from '@/components/GLBRobotArm';
import GLBRobotArm from './GLBRobotArm';
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

// 与 useVirtualCamera.ts 中一致的默认相机状态，用于 3D 层初始化回退
const DEFAULT_CAMERA_STATE: CameraState = {
  position: [-1.135, 3.0, 0.056],
  rotation: [-90, 0, 0],
  fov: 60,
  near: 0.1,
  far: 10,
  showFrustum: true,
  showModel: true,
  resolution: [640, 480],
};

/** DH 坐标(mm) → Three.js GLB 场景坐标(m) 近似转换（DH与GLB坐标系不同，仅用于视觉近似） */
function dhPosToScene(pos: [number, number, number]): [number, number, number] {
  return [pos[0] / 1000, pos[1] / 1000, pos[2] / 1000];
}

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
  /** 当前位姿控制坐标系，用于高亮对应坐标系 */
  coordinateSystem?: 'World' | 'Tool';
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
  coordinateSystem = 'World',
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
  const currentCameraRef = useRef<CameraState>(
    cameraState ? { ...cameraState } : { ...DEFAULT_CAMERA_STATE }
  );
  const displayCameraRef = useRef<CameraState>(
    cameraState ? { ...cameraState } : { ...DEFAULT_CAMERA_STATE }
  );

  // cameraState 变化时同步当前 ref（如按钮点击、手动输入、reset）
  useEffect(() => {
    if (cameraState) {
      currentCameraRef.current = { ...cameraState };
      displayCameraRef.current = { ...cameraState };
    }
  }, [cameraState]);

  // 每帧把 currentCameraRef 向 slider target ref 插值，直接操作 Three.js 对象绕过 React
  useFrame((_, delta) => {
    if (!cameraSliderTargetRef?.current) return;

    const target = cameraSliderTargetRef.current;
    const current = currentCameraRef.current;
    const factor = Math.min(delta * 60, 1); // 高密度目标更新下几乎即时追上，同时保留一帧级平滑

    let changed = false;

    // 位置线性插值
    const nextPos: [number, number, number] = [...current.position];
    for (let i = 0; i < 3; i++) {
      const diff = target.position[i] - current.position[i];
      if (Math.abs(diff) > 0.0001) {
        nextPos[i] = current.position[i] + diff * factor;
        changed = true;
      } else {
        nextPos[i] = target.position[i];
      }
    }

    // 朝向按最短路径插值
    const nextRot: [number, number, number] = [...current.rotation];
    for (let i = 0; i < 3; i++) {
      let diff = target.rotation[i] - current.rotation[i];
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      if (Math.abs(diff) > 0.01) {
        nextRot[i] = current.rotation[i] + diff * factor;
        changed = true;
      } else {
        nextRot[i] = target.rotation[i];
      }
    }

    // FOV / near / far 线性插值
    let nextFov = current.fov;
    const fovDiff = target.fov - current.fov;
    if (Math.abs(fovDiff) > 0.01) {
      nextFov = current.fov + fovDiff * factor;
      changed = true;
    } else {
      nextFov = target.fov;
    }

    let nextNear = current.near;
    const nearDiff = target.near - current.near;
    if (Math.abs(nearDiff) > 0.001) {
      nextNear = current.near + nearDiff * factor;
      changed = true;
    } else {
      nextNear = target.near;
    }

    let nextFar = current.far;
    const farDiff = target.far - current.far;
    if (Math.abs(farDiff) > 0.01) {
      nextFar = current.far + farDiff * factor;
      changed = true;
    } else {
      nextFar = target.far;
    }

    if (changed) {
      const next: CameraState = {
        ...current,
        position: nextPos,
        rotation: nextRot,
        fov: nextFov,
        near: nextNear,
        far: nextFar,
      };
      currentCameraRef.current = next;
      displayCameraRef.current = next;
    }
  });

  // 为避免滑块拖动时 React 每帧重绘导致瞬移，相机状态在 useFrame 中通过 ref 插值更新。
  // 此处读取 ref 仅用于向 UI 展示当前相机参数，属于有意为之的性能优化。
  // eslint-disable-next-line react-hooks/refs
  const displayCameraState = cameraSliderTargetRef ? displayCameraRef.current : cameraState;

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
          showToolAxes={showCoordinateSystems}
          coordinateSystem={coordinateSystem}
        />
      </Suspense>

      <TrajectoryLine points={trajectory} visible={showTrajectory} />

      {/* 可抓取箱子（NONE 状态表示无箱子，不渲染） */}
      {boxPosition && boxState && boxState !== 'NONE' && (
        <GraspableBox position={dhPosToScene(boxPosition)} state={boxState} />
      )}

      {/* 箱子生成围栏（仅在随机模式显示，DH mm → 场景 m） */}
      {spawnFence && spawnFence.mode === 'random' && (
        <SpawnAreaFence
          center={[
            (spawnFence.randomCenter?.[0] ?? 300) / 1000,
            (spawnFence.randomCenter?.[1] ?? 200) / 1000,
          ]}
          rangeX={(spawnFence.randomRangeX ?? 150) / 1000}
          rangeZ={(spawnFence.randomRangeZ ?? 150) / 1000}
          restingHeight={(spawnFence.restingHeight ?? 200) / 1000}
          minHeight={(spawnFence.minHeight ?? 400) / 1000}
          maxHeight={(spawnFence.maxHeight ?? 800) / 1000}
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
      {displayCameraState && (
        <group userData={{ isCameraModel: true }}>
          <CameraModel
            position={displayCameraState.position}
            rotation={displayCameraState.rotation}
            fov={displayCameraState.fov}
            near={displayCameraState.near}
            far={displayCameraState.far}
            showFrustum={displayCameraState.showFrustum}
            showModel={displayCameraState.showModel}
          />
        </group>
      )}

      {/* 相机视锥体地面投影虚线框 */}
      {displayCameraState && displayCameraState.showFrustum && (
        <CameraGroundProjection
          position={displayCameraState.position}
          rotation={displayCameraState.rotation}
          fov={displayCameraState.fov}
          near={displayCameraState.near}
          far={displayCameraState.far}
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
  const { highlightedJoint } = useRobotContext();
  const { showCoordinateSystems } = useSceneViewport();

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
        />
      </Canvas>
    </div>
  );
}
