// src/lib/camera-ground.ts
// 相机视锥体与 Y=0 地面交线计算（世界坐标）
import * as THREE from 'three';

export interface CameraParams {
  position: [number, number, number];   // 相机世界坐标 (m)
  rotation: [number, number, number];   // 欧拉角 (deg, XYZ)
  fov: number;                          // 垂直视场角 (deg)
  near: number;                         // 近平面 (m)
  far: number;                          // 远平面 (m)
  aspect?: number;                      // 宽高比，默认 1.33
}

/**
 * 计算相机视锥体四条棱边与 Y=0 的交点
 * 返回排序后的凸多边形顶点（世界坐标），不够 2 个交点时返回 null
 */
export function computeCameraGroundPolygon(params: CameraParams): THREE.Vector3[] | null {
  const { position, rotation, fov, near, far, aspect = 1.33 } = params;

  const rotRad: [number, number, number] = [
    (rotation[0] * Math.PI) / 180,
    (rotation[1] * Math.PI) / 180,
    (rotation[2] * Math.PI) / 180,
  ];

  const euler = new THREE.Euler(rotRad[0], rotRad[1], rotRad[2], 'XYZ');
  const rotMatrix = new THREE.Matrix4().makeRotationFromEuler(euler);

  const fovRad = (fov * Math.PI) / 180;
  const farH = far * Math.tan(fovRad / 2);
  const farW = farH * aspect;

  // far 平面四角（相机本地空间，相机看 -Z）
  const localCorners: THREE.Vector3[] = [
    new THREE.Vector3(-farW,  farH, -far),
    new THREE.Vector3( farW,  farH, -far),
    new THREE.Vector3( farW, -farH, -far),
    new THREE.Vector3(-farW, -farH, -far),
  ];

  const camPos = new THREE.Vector3(position[0], position[1], position[2]);
  const nearRatio = near / far;
  const hitPoints: THREE.Vector3[] = [];

  // 每条棱边射线与 Y=0 求交
  for (const localCorner of localCorners) {
    const worldDir = localCorner.clone().applyMatrix4(rotMatrix);

    if (Math.abs(worldDir.y) < 1e-10) continue;

    const t = -camPos.y / worldDir.y;

    // t <= 0: 射线朝上; t < nearRatio: 在近平面之前; t > 1: 超出远平面
    if (t <= 0 || t < nearRatio || t > 1) continue;

    hitPoints.push(camPos.clone().add(worldDir.multiplyScalar(t)));
  }

  if (hitPoints.length < 2) return null;

  // 按质心角度排序
  const centroid = new THREE.Vector3();
  hitPoints.forEach((p) => centroid.add(p));
  centroid.divideScalar(hitPoints.length);

  hitPoints.sort((a, b) => {
    const angleA = Math.atan2(a.z - centroid.z, a.x - centroid.x);
    const angleB = Math.atan2(b.z - centroid.z, b.x - centroid.x);
    return angleA - angleB;
  });

  return hitPoints;
}
