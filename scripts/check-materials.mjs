import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import fs from 'fs';

const loader = new GLTFLoader();
const buffer = fs.readFileSync('public/models/KUKA_V1.glb');
loader.parse(buffer.buffer, '', (gltf) => {
  const scene = gltf.scene;
  const map = new Map();
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((mat) => {
        const id = mat.uuid;
        if (!map.has(id)) map.set(id, { count: 0, meshes: [], color: mat.color?.getHexString?.() });
        map.get(id).count++;
        map.get(id).meshes.push(child.name);
      });
    }
  });
  console.log(JSON.stringify([...map.entries()].map(([id, v]) => ({ id: id.slice(0,8), count: v.count, color: v.color, meshes: v.meshes.slice(0,5) })), null, 2));
}, (err) => {
  console.error(err);
});
