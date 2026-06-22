// src/lib/joint-highlight.ts
// 机械臂关节高亮工具：高亮/取消高亮 Three.js Mesh
// 从 GLBRobotArm 提取，接口只暴露 highlightJoint / unhighlightJoint
import * as THREE from 'three';

const OUTLINE_COLOR = new THREE.Color('#FBBF24');

// ====== 内部常量 & 函数 ======

function createOutlineMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: OUTLINE_COLOR,
    side: THREE.BackSide,
    depthTest: true,
    transparent: false,
    opacity: 1.0,
  });
}

function createOutlineMesh(mesh: THREE.Mesh): THREE.Mesh {
  const outline = new THREE.Mesh(mesh.geometry.clone(), createOutlineMaterial());
  outline.name = '__joint_highlight_outline__';
  outline.scale.setScalar(1.06);
  outline.renderOrder = 999;
  return outline;
}

function isEmissiveMaterial(m: THREE.Material): m is THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial {
  return 'emissive' in m && m.emissive instanceof THREE.Color;
}

function isColorMaterial(m: THREE.Material): m is THREE.MeshBasicMaterial | THREE.MeshLambertMaterial | THREE.MeshPhongMaterial {
  return 'color' in m && m.color instanceof THREE.Color;
}

// ====== 公开接口 ======

/** 高亮指定 mesh：修改材质为金色发光 + 添加轮廓 */
export function highlightJoint(mesh: THREE.Mesh): void {
  if (mesh.userData.isHighlighted) return;

  mesh.userData.originalMaterial = mesh.material;

  const source = mesh.material;
  const cloned: THREE.Material | THREE.Material[] = Array.isArray(source)
    ? source.map((m) => m.clone())
    : source.clone();

  const apply = (m: THREE.Material) => {
    if (isEmissiveMaterial(m)) {
      m.color.set(OUTLINE_COLOR);
      m.emissive.set(OUTLINE_COLOR);
      m.emissiveIntensity = (m.emissiveIntensity || 0) + 2.5;
    } else if (isColorMaterial(m)) {
      m.color.set(OUTLINE_COLOR);
    }
  };

  if (Array.isArray(cloned)) cloned.forEach(apply);
  else apply(cloned);

  mesh.material = cloned;
  mesh.add(createOutlineMesh(mesh));
  mesh.userData.isHighlighted = true;
}

/** 取消高亮：恢复原始材质并移除轮廓 */
export function unhighlightJoint(mesh: THREE.Mesh): void {
  // 移除轮廓子节点
  const outlines = mesh.children.filter((c) => c.name === '__joint_highlight_outline__');
  outlines.forEach((o) => {
    mesh.remove(o);
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      if (o.material instanceof THREE.Material) o.material.dispose();
      else if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
    }
  });

  if (mesh.userData.originalMaterial !== undefined) {
    mesh.material = mesh.userData.originalMaterial;
    mesh.userData.originalMaterial = undefined;
  }
  mesh.userData.isHighlighted = false;
}
