// src/components/SpawnAreaFence.tsx
// 箱子随机生成区域围栏（场景米制坐标）
import { useMemo } from 'react';
import * as THREE from 'three';

interface SpawnAreaFenceProps {
  /** 区域中心 [X, Z] 米 */
  center: [number, number];
  /** X方向半宽 米 */
  rangeX: number;
  /** Z方向半宽 米 */
  rangeZ: number;
  /** 是否可见 */
  visible: boolean;
  /** 自由落体停止高度 米（可选，显示托盘） */
  restingHeight?: number;
  /** 最小掉落高度 米（可选，显示下界环） */
  minHeight?: number;
  /** 最大掉落高度 米（可选，显示顶部环） */
  maxHeight?: number;
}

const FENCE_Y = 0.002;

export default function SpawnAreaFence({ center, rangeX, rangeZ, visible, restingHeight, minHeight, maxHeight }: SpawnAreaFenceProps) {
  const groundRectGeo = useMemo(() => {
    const pts = [
      new THREE.Vector3(center[0] - rangeX, FENCE_Y, center[1] - rangeZ),
      new THREE.Vector3(center[0] + rangeX, FENCE_Y, center[1] - rangeZ),
      new THREE.Vector3(center[0] + rangeX, FENCE_Y, center[1] + rangeZ),
      new THREE.Vector3(center[0] - rangeX, FENCE_Y, center[1] + rangeZ),
      new THREE.Vector3(center[0] - rangeX, FENCE_Y, center[1] - rangeZ),
    ];
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [center, rangeX, rangeZ]);

  const planeGeo = useMemo(
    () => new THREE.PlaneGeometry(rangeX * 2, rangeZ * 2),
    [rangeX, rangeZ],
  );

  // 停止高度托盘
  const shelfVisible = !!restingHeight && restingHeight > 0;

  // minHeight 虚线环
  const minRingGeo = useMemo(() => {
    if (minHeight == null || minHeight <= 0) return null;
    const pts: THREE.Vector3[] = [
      [-rangeX, minHeight, -rangeZ], [+rangeX, minHeight, -rangeZ],
      [+rangeX, minHeight, +rangeZ], [-rangeX, minHeight, +rangeZ],
      [-rangeX, minHeight, -rangeZ],
    ].map(([x, y, z]) => new THREE.Vector3(center[0] + x, y, center[1] + z));
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [minHeight, center, rangeX, rangeZ]);

  // maxHeight 虚线环
  const maxRingGeo = useMemo(() => {
    if (maxHeight == null || maxHeight <= 0) return null;
    const pts: THREE.Vector3[] = [
      [-rangeX, maxHeight, -rangeZ], [+rangeX, maxHeight, -rangeZ],
      [+rangeX, maxHeight, +rangeZ], [-rangeX, maxHeight, +rangeZ],
      [-rangeX, maxHeight, -rangeZ],
    ].map(([x, y, z]) => new THREE.Vector3(center[0] + x, y, center[1] + z));
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [maxHeight, center, rangeX, rangeZ]);

  // 竖直边线（地面 → maxHeight）
  const pillarGeo = useMemo(() => {
    if (maxHeight == null || maxHeight <= 0) return null;
    const corners = [
      [-rangeX, -rangeZ], [+rangeX, -rangeZ], [+rangeX, +rangeZ], [-rangeX, +rangeZ],
    ];
    const verts: number[] = [];
    corners.forEach(([dx, dz]) => {
      verts.push(center[0] + dx, 0, center[1] + dz, center[0] + dx, maxHeight, center[1] + dz);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return geo;
  }, [maxHeight, center, rangeX, rangeZ]);

  if (!visible) return null;

  return (
    <group>
      {/* 工作台面半透明区域 */}
      <mesh geometry={planeGeo} position={[center[0], FENCE_Y, center[1]]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#F59E0B" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>

      {/* 地面虚线边框 */}
      <primitive
        object={new THREE.Line(groundRectGeo, new THREE.LineDashedMaterial({
          color: '#F59E0B', dashSize: 0.02, gapSize: 0.015, opacity: 0.8, transparent: true,
        }))}
        onUpdate={(self: any) => self.computeLineDistances?.()}
      />

      {/* 四个角标记 */}
      {([
        [center[0] - rangeX, FENCE_Y, center[1] - rangeZ],
        [center[0] + rangeX, FENCE_Y, center[1] - rangeZ],
        [center[0] + rangeX, FENCE_Y, center[1] + rangeZ],
        [center[0] - rangeX, FENCE_Y, center[1] + rangeZ],
      ] as [number, number, number][]).map((pos, i) => (
        <mesh key={`corner-${i}`} position={pos}>
          <sphereGeometry args={[0.006, 8, 8]} />
          <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={0.5} />
        </mesh>
      ))}

      {/* === 停止高度（绿色托盘） === */}
      {shelfVisible && (
        <>
          <mesh geometry={planeGeo} position={[center[0], restingHeight!, center[1]]} rotation={[-Math.PI / 2, 0, 0]}>
            <meshBasicMaterial color="#22C55E" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.PlaneGeometry(rangeX * 2, rangeZ * 2)]} />
            <lineBasicMaterial color="#22C55E" opacity={0.4} transparent />
          </lineSegments>
        </>
      )}

      {/* === 最小高度（蓝色虚线环） === */}
      {minRingGeo && minHeight != null && minHeight > 0 && (
        <primitive
          object={new THREE.Line(minRingGeo, new THREE.LineDashedMaterial({
            color: '#3B82F6', dashSize: 0.025, gapSize: 0.018, opacity: 0.45, transparent: true,
          }))}
          onUpdate={(self: any) => self.computeLineDistances?.()}
        />
      )}

      {/* === 最大高度（橙色虚线环） === */}
      {maxRingGeo && maxHeight != null && maxHeight > 0 && (
        <primitive
          object={new THREE.Line(maxRingGeo, new THREE.LineDashedMaterial({
            color: '#F97316', dashSize: 0.03, gapSize: 0.02, opacity: 0.5, transparent: true,
          }))}
          onUpdate={(self: any) => self.computeLineDistances?.()}
        />
      )}

      {/* === 竖直边线 === */}
      {pillarGeo && (
        <primitive
          object={new THREE.LineSegments(pillarGeo, new THREE.LineBasicMaterial({
            color: '#F59E0B', opacity: 0.25, transparent: true,
          }))}
        />
      )}
    </group>
  );
}
