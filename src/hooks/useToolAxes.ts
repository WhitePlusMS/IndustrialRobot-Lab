import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createToolAxesHelper } from '@/lib/robot-axes';
import { findNode } from '@/lib/dh-calibration';

interface UseToolAxesOptions {
  arm: THREE.Group | null;
  scene: THREE.Scene;
  showToolAxes: boolean;
  coordinateSystem: 'World' | 'Tool';
}

export function useToolAxes({
  arm,
  scene,
  showToolAxes,
  coordinateSystem,
}: UseToolAxesOptions) {
  const toolAxesRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const existingHelpers: THREE.Object3D[] = [];
    scene.traverse((child) => {
      if (child.name === 'ToolAxesHelper') existingHelpers.push(child);
    });
    existingHelpers.forEach((helper) => helper.parent?.remove(helper));

    if (!showToolAxes) {
      toolAxesRef.current = null;
      return;
    }

    const toolAxes = createToolAxesHelper();
    scene.add(toolAxes);
    toolAxesRef.current = toolAxes;

    return () => {
      toolAxes.parent?.remove(toolAxes);
      if (toolAxesRef.current === toolAxes) {
        toolAxesRef.current = null;
      }
    };
  }, [scene, showToolAxes]);

  useFrame(() => {
    if (!arm || !toolAxesRef.current) return;
    const pivot = findNode(arm, 'Pivot_快拆机器人端口');
    if (!pivot) return;

    const worldPos = new THREE.Vector3();
    pivot.getWorldPosition(worldPos);
    toolAxesRef.current.position.copy(worldPos);

    if (coordinateSystem === 'World') {
      toolAxesRef.current.quaternion.identity();
    } else {
      const worldQuat = new THREE.Quaternion();
      pivot.getWorldQuaternion(worldQuat);
      toolAxesRef.current.quaternion.copy(worldQuat);
    }

    toolAxesRef.current.scale.setScalar(1);
  });
}
