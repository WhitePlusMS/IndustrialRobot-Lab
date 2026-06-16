// src/components/camera/CameraGroundProjection.tsx
// 用虚线框出相机在地面上的视野范围（含半透明填充）
import { useMemo } from 'react';
import * as THREE from 'three';
import { computeCameraGroundPolygon } from '@/lib/camera-ground';

interface CameraGroundProjectionProps {
  position: [number, number, number];
  rotation: [number, number, number];
  fov: number;
  near: number;
  far: number;
  aspect?: number;
}

const GROUND_Y = 0.002;

export default function CameraGroundProjection(props: CameraGroundProjectionProps) {
  const lineObj = useMemo(() => {
    const pts = computeCameraGroundPolygon(props);
    if (!pts) return null;

    // 地面 Y 偏移
    pts.forEach((p) => (p.y = GROUND_Y));

    // 虚线边框
    const linePts = [...pts, pts[0].clone()];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
    const lineMat = new THREE.LineDashedMaterial({
      color: '#00BCD4',
      dashSize: 0.04,
      gapSize: 0.025,
      opacity: 0.9,
      transparent: true,
    });

    // 半透明填充面（三角形扇）
    const fillGeo = new THREE.BufferGeometry();
    const verts: number[] = [];
    for (let i = 1; i < pts.length - 1; i++) {
      verts.push(pts[0].x, pts[0].y, pts[0].z);
      verts.push(pts[i].x, pts[i].y, pts[i].z);
      verts.push(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
    }
    fillGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    fillGeo.computeVertexNormals();
    const fillMat = new THREE.MeshBasicMaterial({
      color: '#00BCD4',
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const group = new THREE.Group();
    group.add(new THREE.Line(lineGeo, lineMat));
    group.add(new THREE.Mesh(fillGeo, fillMat));
    return group;
  }, [props.position, props.rotation, props.fov, props.near, props.far, props.aspect]);

  if (!lineObj) return null;

  return (
    <primitive
      object={lineObj}
      onUpdate={(self: any) => {
        self.children.forEach((child: any) => {
          if (child.isLine) child.computeLineDistances?.();
        });
      }}
    />
  );
}
