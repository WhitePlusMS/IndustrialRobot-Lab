// src/components/RobotScene.tsx
// 使用官方的KUKA GLB模型替换程序化生成的机械臂
// 场景尺度：Three.js单位为米，DH参数（mm）乘以 SCENE_SCALE 转换
import { useMemo, Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import type { JointAngles } from '@/types/robot';
import type { CameraState } from '@/types/camera';
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

/** DH 坐标(mm) → Three.js GLB 场景坐标(m) 近似转换（DH与GLB坐标系不同，仅用于视觉近似） */
export function dhPosToScene(pos: [number, number, number]): [number, number, number] {
  return [pos[0] / 1000, pos[1] / 1000, pos[2] / 1000];
}

interface RobotSceneProps {
  joints: JointAngles;
  trajectory: [number, number, number][];
  showGrid: boolean;
  showAxes: boolean;
  showTrajectory: boolean;
  cameraPosition: [number, number, number];
  onTrajectoryPoint?: (pos: [number, number, number]) => void;
  selectedTool?: string;
  onToolList?: (tools: string[]) => void;
  cameraState?: CameraState;
  /** 滑块/输入框直接写入的目标关节 ref；3D 层每帧读取，避免 React 高频重绘 */
  sliderTargetRef?: React.MutableRefObject<JointAngles>;
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
  showAxes,
  showTrajectory,
  onTrajectoryPoint,
  cameraPosition,
  selectedTool,
  onToolList,
  cameraState,
  sliderTargetRef,
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

      {showAxes && <primitive object={new THREE.AxesHelper(1.5)} position={[0, 0, 0]} />}

      {/* GLB机械臂模型 */}
      <Suspense fallback={<LoadingPlaceholder />}>
        <GLBRobotArm joints={joints} sliderTargetRef={sliderTargetRef} onTrajectoryPoint={onTrajectoryPoint} selectedTool={selectedTool} onToolList={onToolList} />
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
      {cameraState && (
        <group userData={{ isCameraModel: true }}>
          <CameraModel
            position={cameraState.position}
            rotation={cameraState.rotation}
            fov={cameraState.fov}
            near={cameraState.near}
            far={cameraState.far}
            showFrustum={cameraState.showFrustum}
            showModel={cameraState.showModel}
          />
        </group>
      )}

      {/* 相机视锥体地面投影虚线框 */}
      {cameraState && cameraState.showFrustum && (
        <CameraGroundProjection
          position={cameraState.position}
          rotation={cameraState.rotation}
          fov={cameraState.fov}
          near={cameraState.near}
          far={cameraState.far}
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
  return (
    <div className="w-full h-full" style={{ touchAction: 'manipulation' }}>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ position: props.cameraPosition, fov: 45, near: 0.01, far: 100 }}
        gl={{ antialias: true }}
        style={{ background: '#E8E8E8', width: '100%', height: '100%', touchAction: 'manipulation' }}
      >
        <SceneContent {...props} />
      </Canvas>
    </div>
  );
}
