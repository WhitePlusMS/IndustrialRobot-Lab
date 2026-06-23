// src/components/GraspableBox.tsx
// 可抓取箱子（场景米制坐标）
import { useMemo } from 'react';
import * as THREE from 'three';
import type { BoxState } from '@/hooks/useSuckerControl';

// 箱子尺寸：120mm → 0.12m
const BOX_M = 0.12;
const BOX_HALF_M = BOX_M / 2;

interface GraspableBoxProps {
  position: [number, number, number]; // 场景米
  state: BoxState;
}

export default function GraspableBox({ position, state }: GraspableBoxProps) {
  const color = useMemo(() => {
    switch (state) {
      case 'FREE': return '#E65100';
      case 'FALLING': return '#FDD835';
      case 'ATTACHED': return '#43A047';
      case 'PLACED': return '#FB8C00';
      case 'RESTING': return '#795548';
      default: return '#E65100';
    }
  }, [state]);

  return (
    <group>
      {/* 箱子主体 */}
      <mesh position={position} castShadow receiveShadow userData={{ objectName: '箱子' }}>
        <boxGeometry args={[BOX_M, BOX_M, BOX_M]} />
        <meshStandardMaterial color={color} metalness={0.2} roughness={0.7} />
      </mesh>

      {/* 边框线 */}
      <primitive
        object={new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(BOX_M, BOX_M, BOX_M)),
          new THREE.LineBasicMaterial({ color: '#3E2723', linewidth: 1 })
        )}
        position={position}
      />

      {/* 掉落中指示器 */}
      {state === 'FALLING' && (
        <>
          <mesh position={[position[0], position[1] + BOX_HALF_M + 0.03, position[2]]}>
            <coneGeometry args={[0.006, 0.02, 8]} />
            <meshStandardMaterial color="#FDD835" emissive="#FDD835" emissiveIntensity={0.6} />
          </mesh>
          {/* 落点标记环（跟随箱子底部位置） */}
          <mesh position={[position[0], position[1] - BOX_HALF_M, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.015, 0.025, 32]} />
            <meshStandardMaterial color="#FDD835" transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}

      {/* 吸附状态指示器 */}
      {state === 'ATTACHED' && (
        <mesh position={[position[0], position[1] + BOX_HALF_M + 0.02, position[2]]}>
          <sphereGeometry args={[0.008, 8, 8]} />
          <meshStandardMaterial color="#22C55E" emissive="#22C55E" emissiveIntensity={0.8} />
        </mesh>
      )}
    </group>
  );
}
