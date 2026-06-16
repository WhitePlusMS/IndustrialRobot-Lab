// src/hooks/useDemoParts.ts
// 相机视野内随机掉落 3D 演示零件
import { useState, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { computeCameraGroundPolygon } from '@/lib/camera-ground';
import type { CameraParams } from '@/lib/camera-ground';

export interface DemoPart {
  id: number;
  type: 'sphere' | 'box' | 'cylinder' | 'hexagon';
  position: [number, number, number];   // 地面 XZ + 初始 Y
  color: string;
  size: number;                          // 特征尺寸 (m)
  spawnedAt: number;                     // performance.now()
}

const COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899'];
const TYPES: DemoPart['type'][] = ['sphere', 'box', 'cylinder', 'hexagon'];
const MIN_SPAWN_Y = 0.5;
const MAX_SPAWN_Y = 1.5;
const INNER_SCALE = 0.8;

let _nextId = 1;

function randomBetween(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 在凸多边形内随机采样一点（重心三角剖分加权法） */
function randomPointInPolygon(polygon: THREE.Vector3[]): THREE.Vector3 {
  const centroid = new THREE.Vector3();
  polygon.forEach((p) => centroid.add(p));
  centroid.divideScalar(polygon.length);

  // 构建三角形列表 + 面积
  const triangles: { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; area: number }[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = centroid;
    const b = polygon[i];
    const c = polygon[(i + 1) % polygon.length];
    const area = new THREE.Triangle(a, b, c).getArea();
    triangles.push({ a, b, c, area });
  }

  const totalArea = triangles.reduce((s, t) => s + t.area, 0);

  // 按面积加权随机选三角形
  let r = Math.random() * totalArea;
  let chosen = triangles[0];
  for (const tri of triangles) {
    r -= tri.area;
    if (r <= 0) {
      chosen = tri;
      break;
    }
  }

  // 三角形内随机点（重心坐标法）
  const r1 = Math.random();
  const r2 = Math.random();
  const sqrtR1 = Math.sqrt(r1);
  const u = 1 - sqrtR1;
  const v = r2 * sqrtR1;
  const w = 1 - u - v;

  return new THREE.Vector3(
    chosen.a.x * u + chosen.b.x * v + chosen.c.x * w,
    0,
    chosen.a.z * u + chosen.b.z * v + chosen.c.z * w,
  );
}

export function useDemoParts() {
  const [parts, setParts] = useState<DemoPart[]>([]);
  const partsRef = useRef(parts);
  partsRef.current = parts;

  /** 在相机视野内圈生成零件 */
  const spawnParts = useCallback((count: number, size: number, camera: CameraParams) => {
    const polygon = computeCameraGroundPolygon(camera);
    if (!polygon || polygon.length < 3) return;

    // 缩到内圈
    const centroid = new THREE.Vector3();
    polygon.forEach((p) => centroid.add(p));
    centroid.divideScalar(polygon.length);
    const innerPoly = polygon.map((p) =>
      centroid.clone().add(p.clone().sub(centroid).multiplyScalar(INNER_SCALE))
    );

    const now = performance.now();
    const newParts: DemoPart[] = [];

    for (let i = 0; i < count; i++) {
      const pt = randomPointInPolygon(innerPoly);
      newParts.push({
        id: _nextId++,
        type: randomPick(TYPES),
        position: [pt.x, randomBetween(MIN_SPAWN_Y, MAX_SPAWN_Y), pt.z],
        color: randomPick(COLORS),
        size,
        spawnedAt: now + i * 30,
      });
    }

    setParts(newParts);
  }, []);

  /** 清除所有零件 */
  const clearParts = useCallback(() => {
    setParts([]);
  }, []);

  return { parts, spawnParts, clearParts };
}
