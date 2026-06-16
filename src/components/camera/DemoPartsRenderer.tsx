// src/components/camera/DemoPartsRenderer.tsx
// 在场景中渲染掉落演示零件（每个零件独立 useFrame 重力物理）
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { DemoPart } from '@/hooks/useDemoParts';

const GRAVITY = 9.8;

function PartMesh({ part }: { part: DemoPart }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const restingY = part.size / 2;

  const geo = useMemo(() => {
    switch (part.type) {
      case 'sphere':
        return <sphereGeometry args={[part.size / 2, 16, 16]} />;
      case 'box':
        return <boxGeometry args={[part.size, part.size, part.size]} />;
      case 'cylinder':
        return <cylinderGeometry args={[part.size / 2, part.size / 2, part.size, 16]} />;
      case 'hexagon':
        return <cylinderGeometry args={[part.size / 2, part.size / 2, part.size, 6]} />;
    }
  }, [part.type, part.size]);

  useFrame(() => {
    if (!meshRef.current) return;
    const elapsed = (performance.now() - part.spawnedAt) / 1000;
    const freeFallY = part.position[1] - 0.5 * GRAVITY * elapsed * elapsed;
    meshRef.current.position.y = Math.max(freeFallY, restingY);
  });

  return (
    <mesh
      ref={meshRef}
      position={[part.position[0], part.position[1], part.position[2]]}
      castShadow
    >
      {geo}
      <meshStandardMaterial color={part.color} roughness={0.5} metalness={0.3} />
    </mesh>
  );
}

interface DemoPartsRendererProps {
  parts: DemoPart[];
}

export default function DemoPartsRenderer({ parts }: DemoPartsRendererProps) {
  if (parts.length === 0) return null;

  return (
    <group>
      {parts.map((part) => (
        <PartMesh key={part.id} part={part} />
      ))}
    </group>
  );
}
