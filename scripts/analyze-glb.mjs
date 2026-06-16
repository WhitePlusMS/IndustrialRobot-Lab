// 分析GLB文件：打印节点层级、局部变换、关节轴
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

  console.log('=== 场景层级 ===\n');

  function printNode(node, indent = 0) {
    const prefix = '  '.repeat(indent);
    const pos = `${node.position.x.toFixed(3)}, ${node.position.y.toFixed(3)}, ${node.position.z.toFixed(3)}`;
    const euler = `${node.rotation.x.toFixed(3)}, ${node.rotation.y.toFixed(3)}, ${node.rotation.z.toFixed(3)}`;

    console.log(`${prefix}■ ${node.name}`);
    console.log(`${prefix}  Position (${pos})  Euler (${euler})`);
    console.log(`${prefix}  Scale (${node.scale.x.toFixed(4)}, ${node.scale.y.toFixed(4)}, ${node.scale.z.toFixed(4)})`);

    if (node.children.length > 0) {
      node.children.forEach(child => printNode(child, indent + 1));
    }
  }

  printNode(root);

  // 关键节点分析
  console.log('\n=== 关键节点世界位置 ===\n');
  const keyNodes = ['固定底座', '转台', '大臂', '小臂', '回转机构', '末端关节', '快拆机器人端口', '吸盘'];

  root.traverse((node) => {
    if (keyNodes.includes(node.name)) {
      const worldPos = new THREE.Vector3();
      node.getWorldPosition(worldPos);
      console.log(`"${node.name}" → World (${worldPos.x.toFixed(3)}, ${worldPos.y.toFixed(3)}, ${worldPos.z.toFixed(3)})`);
    }
  });

  // 关节父节点局部轴分析
  console.log('\n=== 每个关节的父节点局部轴方向（世界空间） ===\n');
  const jointNames = ['转台', '大臂', '小臂', '回转机构', '末端关节', '快拆机器人端口'];

  for (const name of jointNames) {
    let node = null;
    root.traverse((n) => { if (n.name === name) node = n; });
    if (!node || !node.parent) continue;

    const parentQuat = new THREE.Quaternion();
    node.parent.getWorldQuaternion(parentQuat);

    const xDir = new THREE.Vector3(1, 0, 0).applyQuaternion(parentQuat);
    const yDir = new THREE.Vector3(0, 1, 0).applyQuaternion(parentQuat);
    const zDir = new THREE.Vector3(0, 0, 1).applyQuaternion(parentQuat);

    console.log(`关节 "${name}" 父节点 "${node.parent.name}" 轴:`);
    console.log(`  X (${xDir.x.toFixed(2)}, ${xDir.y.toFixed(2)}, ${xDir.z.toFixed(2)})`);
    console.log(`  Y (${yDir.x.toFixed(2)}, ${yDir.y.toFixed(2)}, ${yDir.z.toFixed(2)})`);
    console.log(`  Z (${zDir.x.toFixed(2)}, ${zDir.y.toFixed(2)}, ${zDir.z.toFixed(2)})`);
  }

  // 关节自身局部坐标轴
  console.log('\n=== 关节自身局部轴（世界方向） ===\n');
  for (const name of jointNames) {
    let node = null;
    root.traverse((n) => { if (n.name === name) node = n; });
    if (!node) continue;

    const quat = new THREE.Quaternion();
    node.getWorldQuaternion(quat);

    const xDir = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
    const yDir = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
    const zDir = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);

    console.log(`"${name}" 自身轴:`);
    console.log(`  X (${xDir.x.toFixed(2)}, ${xDir.y.toFixed(2)}, ${xDir.z.toFixed(2)})`);
    console.log(`  Y (${yDir.x.toFixed(2)}, ${yDir.y.toFixed(2)}, ${yDir.z.toFixed(2)})`);
    console.log(`  Z (${zDir.y.toFixed(2)}, ${zDir.y.toFixed(2)}, ${zDir.z.toFixed(2)})`);
  }

  // 验证：KUKA_6D 根节点的矩阵
  console.log('\n=== KUKA_6D 根节点矩阵 ===');
  root.traverse((node) => {
    if (node.name === 'KUKA_6D') {
      const m = node.matrix.elements;
      console.log(`Scale: (${node.scale.x}, ${node.scale.y}, ${node.scale.z})`);
      console.log(`Rotation: (${node.rotation.x.toFixed(3)}, ${node.rotation.y.toFixed(3)}, ${node.rotation.z.toFixed(3)}, ${node.rotation.w.toFixed(3)})`);
      console.log(`Position: (${node.position.x}, ${node.position.y}, ${node.position.z})`);
    }
  });

  // 关键：找出末端执行器在世界空间中的位置（默认姿态[0,-30,60,0,0,0]时）
  console.log('\n=== 重要：默认姿态各关节世界位置 ===');
  console.log('这个数据可以帮助确定 DH 参数到模型空间的转换关系');

  // 计算 base 到 J6 末端的距离
  let basePos = new THREE.Vector3();
  let j6Pos = new THREE.Vector3();
  root.traverse((node) => {
    if (node.name === '固定底座') node.getWorldPosition(basePos);
    if (node.name === '快拆机器人端口') node.getWorldPosition(j6Pos);
  });
  const height = j6Pos.y - basePos.y;
  console.log(`底座 Y: ${basePos.y.toFixed(3)}, J6 末端 Y: ${j6Pos.y.toFixed(3)}, 总高: ${height.toFixed(3)}`);

  // 看看吸盘位置
  let suctionPos = new THREE.Vector3();
  root.traverse((node) => {
    if (node.name === '吸盘') node.getWorldPosition(suctionPos);
  });
  console.log(`吸盘 World: (${suctionPos.x.toFixed(3)}, ${suctionPos.y.toFixed(3)}, ${suctionPos.z.toFixed(3)})`);

}, undefined, (error) => {
  console.error('加载GLB失败:', error);
});
