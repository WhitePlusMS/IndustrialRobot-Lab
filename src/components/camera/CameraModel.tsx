// src/components/camera/CameraModel.tsx
import { useMemo } from 'react';
import * as THREE from 'three';

interface CameraModelProps {
  position: [number, number, number];
  rotation: [number, number, number];
  fov: number;
  near: number;
  far: number;
  showFrustum: boolean;
  showModel: boolean;
  aspect?: number;
}

export default function CameraModel({
  position,
  rotation,
  fov,
  near,
  far,
  showFrustum,
  showModel,
  aspect = 1.33,
}: CameraModelProps) {
  const rotRad = useMemo(
    () => rotation.map((v) => (v * Math.PI) / 180) as [number, number, number],
    [rotation]
  );

  return (
    <group position={position} rotation={rotRad} visible={showModel}>
      {/* 相机机身 */}
      <mesh castShadow>
        <boxGeometry args={[0.12, 0.1, 0.16]} />
        <meshStandardMaterial color="#F59E0B" metalness={0.3} roughness={0.5} />
      </mesh>

      {/* 镜头 */}
      <mesh position={[0, 0, -0.1]} castShadow>
        <cylinderGeometry args={[0.04, 0.03, 0.05, 32]} />
        <meshStandardMaterial color="#1F2937" metalness={0.3} roughness={0.5} />
      </mesh>

      {/* 镜头前端玻璃 */}
      <mesh position={[0, 0, -0.13]}>
        <cylinderGeometry args={[0.03, 0.03, 0.005, 32]} />
        <meshStandardMaterial color="#3B82F6" metalness={0.8} roughness={0.1} transparent opacity={0.6} />
      </mesh>

      {/* 方向指示器 */}
      <mesh position={[0, 0, -0.24]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.03, 0.1, 16]} />
        <meshStandardMaterial color="#22C55E" emissive="#22C55E" emissiveIntensity={0.8} />
      </mesh>

      {/* 视野锥线框 */}
      <FrustumLines fov={fov} near={near} far={far} aspect={aspect} visible={showFrustum} />
    </group>
  );
}

// 视野锥线框
function FrustumLines({
  fov,
  near,
  far,
  aspect,
  visible,
}: {
  fov: number;
  near: number;
  far: number;
  aspect: number;
  visible: boolean;
}) {
  const geometry = useMemo(() => {
    const fovRad = (fov * Math.PI) / 180;
    const tanFov = Math.tan(fovRad / 2);

    const nearH = near * tanFov;
    const nearW = nearH * aspect;
    const farH = far * tanFov;
    const farW = farH * aspect;

    const points = [
      new THREE.Vector3(-nearW, nearH, -near),
      new THREE.Vector3(nearW, nearH, -near),
      new THREE.Vector3(nearW, -nearH, -near),
      new THREE.Vector3(-nearW, -nearH, -near),
      new THREE.Vector3(-farW, farH, -far),
      new THREE.Vector3(farW, farH, -far),
      new THREE.Vector3(farW, -farH, -far),
      new THREE.Vector3(-farW, -farH, -far),
    ];

    const vertices: number[] = [];
    const addLine = (a: number, b: number) => {
      vertices.push(points[a].x, points[a].y, points[a].z);
      vertices.push(points[b].x, points[b].y, points[b].z);
    };

    addLine(0, 1); addLine(1, 2); addLine(2, 3); addLine(3, 0);
    addLine(4, 5); addLine(5, 6); addLine(6, 7); addLine(7, 4);
    addLine(0, 4); addLine(1, 5); addLine(2, 6); addLine(3, 7);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    return geo;
  }, [fov, near, far, aspect]);

  return (
    <lineSegments geometry={geometry} visible={visible}>
      <lineBasicMaterial color="#00BCD4" transparent opacity={0.4} />
    </lineSegments>
  );
}
