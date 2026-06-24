import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const glbPath = path.resolve(__dirname, '../public/models/KUKA_V1.glb');
const buffer = fs.readFileSync(glbPath);

const loader = new GLTFLoader();

loader.parse(buffer.buffer, '', (gltf) => {
  const root = gltf.scene;
  let sucker = null;
  root.traverse((node) => {
    if (node.name === '吸盘') sucker = node;
  });

  if (!sucker) {
    console.error('未找到吸盘节点');
    return;
  }

  sucker.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(sucker);
  const size = new THREE.Vector3();
  bbox.getSize(size);

  console.log('=== 吸盘外接盒（GLB原始单位）===');
  console.log(`宽(x): ${size.x.toFixed(4)}`);
  console.log(`高(y): ${size.y.toFixed(4)}`);
  console.log(`深(z): ${size.z.toFixed(4)}`);
  console.log('');
  console.log('=== 吸盘外接盒（应用 MODEL_SCALE=0.0943 后，单位：米）===');
  const SCALE = 0.0943;
  console.log(`宽(x): ${(size.x * SCALE).toFixed(4)} m`);
  console.log(`高(y): ${(size.y * SCALE).toFixed(4)} m`);
  console.log(`深(z): ${(size.z * SCALE).toFixed(4)} m`);
  console.log('');
  console.log('=== 吸盘外接盒（应用 MODEL_SCALE*1000 后，单位：mm）===');
  console.log(`宽(x): ${(size.x * SCALE * 1000).toFixed(2)} mm`);
  console.log(`高(y): ${(size.y * SCALE * 1000).toFixed(2)} mm`);
  console.log(`深(z): ${(size.z * SCALE * 1000).toFixed(2)} mm`);
}, undefined, (error) => {
  console.error('加载GLB失败:', error);
});
