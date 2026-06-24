import * as THREE from 'three';

interface AxesConfig {
  length: number;
  radius: number;
  headRadius: number;
  headHeight: number;
  originRadius: number;
}

const TOOL_AXES_CONFIG: AxesConfig = {
  length: 0.25,
  radius: 0.012,
  headRadius: 0.035,
  headHeight: 0.09,
  originRadius: 0.035,
};

const BASE_AXES_CONFIG: AxesConfig = {
  length: 1.0,
  radius: 0.012,
  headRadius: 0.035,
  headHeight: 0.09,
  originRadius: 0.035,
};

function createAxes(name: string, config: AxesConfig): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  group.renderOrder = 1000;

  const { length, radius, headRadius, headHeight, originRadius } = config;
  const up = new THREE.Vector3(0, 1, 0);

  const axes = [
    { dir: new THREE.Vector3(1, 0, 0), color: 0xff0000 },
    { dir: new THREE.Vector3(0, 1, 0), color: 0x00ff00 },
    { dir: new THREE.Vector3(0, 0, 1), color: 0x0000ff },
  ];

  axes.forEach(({ dir, color }) => {
    const axisGroup = new THREE.Group();

    const shaftGeo = new THREE.CylinderGeometry(radius, radius, length, 16);
    shaftGeo.translate(0, length / 2, 0);
    const shaftMat = new THREE.MeshBasicMaterial({ color, depthTest: false, toneMapped: false });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);

    const headGeo = new THREE.ConeGeometry(headRadius, headHeight, 16);
    headGeo.translate(0, length + headHeight / 2, 0);
    const head = new THREE.Mesh(headGeo, shaftMat);

    axisGroup.add(shaft);
    axisGroup.add(head);

    const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
    axisGroup.setRotationFromQuaternion(q);

    group.add(axisGroup);
  });

  const originGeo = new THREE.SphereGeometry(originRadius, 16, 16);
  const originMat = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    depthTest: false,
    toneMapped: false,
  });
  const origin = new THREE.Mesh(originGeo, originMat);
  group.add(origin);

  return group;
}

export function createBaseAxes(): THREE.Group {
  return createAxes('BaseAxesHelper', BASE_AXES_CONFIG);
}

export function createToolAxesHelper(): THREE.Group {
  return createAxes('ToolAxesHelper', TOOL_AXES_CONFIG);
}
