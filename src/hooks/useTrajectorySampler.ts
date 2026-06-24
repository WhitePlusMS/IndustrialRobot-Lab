import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { findNode } from '@/lib/dh-calibration';

interface UseTrajectorySamplerOptions {
  arm: THREE.Group | null;
  onTrajectoryPoint?: (pos: [number, number, number]) => void;
}

export function useTrajectorySampler({
  arm,
  onTrajectoryPoint,
}: UseTrajectorySamplerOptions) {
  const lastTrajectoryTimeRef = useRef(0);

  useFrame(() => {
    if (!arm || !onTrajectoryPoint) return;

    const now = performance.now();
    if (now - lastTrajectoryTimeRef.current <= 50) {
      return;
    }

    lastTrajectoryTimeRef.current = now;
    arm.updateMatrixWorld(true);
    const flangeNode = findNode(arm, '快拆机器人端口');
    if (!flangeNode) return;

    const worldPos = new THREE.Vector3();
    flangeNode.getWorldPosition(worldPos);
    onTrajectoryPoint([worldPos.x, worldPos.y, worldPos.z]);
  });
}
