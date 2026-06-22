// src/components/TransformGizmo.tsx
// 3D 操作轴：使用 @react-three/drei TransformControls，R3F 原生兼容
// 通过 dummy Object3D 作为操控代理，操控时实时 IK 逆解驱动机械臂
// 空闲时 dummy 跟随法兰末端；drei 自动禁用 OrbitControls 防止冲突

import { useEffect, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { TransformControls as DreiTransformControls } from '@react-three/drei';
import * as THREE from 'three';
import type { GizmoIKHandle } from '@/types/robot';
import { gizmoToTargetPose } from '@/lib/transform-gizmo-utils';

interface TransformGizmoProps {
  gizmoIKRef: React.MutableRefObject<GizmoIKHandle | null>;
  mode: 'translate' | 'rotate';
  stopAnimation?: () => void;
}

export default function TransformGizmo({ gizmoIKRef, mode, stopAnimation }: TransformGizmoProps) {
  const { scene } = useThree();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  dummy.name = 'transform-gizmo-dummy';

  useEffect(() => {
    scene.add(dummy);
    return () => void scene.remove(dummy);
  }, [scene, dummy]);

  const isDraggingRef = useRef(false);
  const stopRef = useRef(stopAnimation);
  stopRef.current = stopAnimation;

  const handleMouseDown = () => {
    isDraggingRef.current = true;
    stopRef.current?.();
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleObjectChange = () => {
    const ikHandle = gizmoIKRef.current;
    if (!ikHandle || !isDraggingRef.current) return;

    const dPos: [number, number, number] = [dummy.position.x, dummy.position.y, dummy.position.z];
    const dQuat: [number, number, number, number] = [
      dummy.quaternion.x, dummy.quaternion.y, dummy.quaternion.z, dummy.quaternion.w,
    ];
    const targetPose = gizmoToTargetPose(dPos, dQuat);

    if (ikHandle.solveAndApply(targetPose)) return;

    // IK 不可达：dummy 回弹到法兰位姿
    const flange = scene.getObjectByName('Pivot_快拆机器人端口');
    if (flange) {
      flange.getWorldPosition(dummy.position);
      flange.getWorldQuaternion(dummy.quaternion);
    }
  };

  // 空闲时 dummy 跟随法兰
  const posBuf = useMemo(() => new THREE.Vector3(), []);
  const quatBuf = useMemo(() => new THREE.Quaternion(), []);
  useFrame(() => {
    if (isDraggingRef.current) return;

    const flange = scene.getObjectByName('Pivot_快拆机器人端口');
    if (!flange) return;

    flange.getWorldPosition(posBuf);
    flange.getWorldQuaternion(quatBuf);

    if (dummy.position.distanceToSquared(posBuf) > 0.000001 ||
        dummy.quaternion.angleTo(quatBuf) > 0.000001) {
      dummy.position.copy(posBuf);
      dummy.quaternion.copy(quatBuf);
    }
  });

  return (
    <DreiTransformControls
      object={dummy}
      mode={mode}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onObjectChange={handleObjectChange}
    />
  );
}
