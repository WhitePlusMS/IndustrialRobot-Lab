// 分析GLB文件：打印节点层级、局部变换、关节轴
const fs = require('fs');
const path = require('path');
const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');
const { WebGLRenderer } = require('three');
const THREE = require('three');

// 创建最小 Three.js 环境
const scene = new THREE.Scene();
const loader = new GLTFLoader();

const glbPath = path.resolve(__dirname, '../public/models/KUKA_V1.glb');
const buffer = fs.readFileSync(glbPath);

// 解析GLB
loader.parse(buffer.buffer, '', (gltf) => {
  const root = gltf.scene;

  console.log('=== 场景层级 ===\n');

  function printNode(node, indent = 0) {
    const prefix = '  '.repeat(indent);
    const pos = `${node.position.x.toFixed(3)}, ${node.position.y.toFixed(3)}, ${node.position.z.toFixed(3)}`;
    const rot = `[${node.rotation.x.toFixed(3)}, ${node.rotation.y.toFixed(3)}, ${node.rotation.z.toFixed(3)}, ${node.rotation.w.toFixed(3)}]`;
    const scale = `${node.scale.x.toFixed(4)}, ${node.scale.y.toFixed(4)}, ${node.scale.z.toFixed(4)}`;
    const euler = `Euler: ${node.rotation.x.toFixed(3)}, ${node.rotation.y.toFixed(3)}, ${node.rotation.z.toFixed(3)}`;

    console.log(`${prefix}■ ${node.name}`);
    console.log(`${prefix}  Position: (${pos})`);
    console.log(`${prefix}  Rotation: (${rot})`);
    console.log(`${prefix}  Euler: ${euler}`);
    console.log(`${prefix}  Scale: (${scale})`);

    // 打印矩阵
    const m = node.matrix.elements;
    console.log(`${prefix}  Matrix:`);
    console.log(`${prefix}    [${m[0].toFixed(4)}, ${m[1].toFixed(4)}, ${m[2].toFixed(4)}, ${m[3].toFixed(4)}]`);
    console.log(`${prefix}    [${m[4].toFixed(4)}, ${m[5].toFixed(4)}, ${m[6].toFixed(4)}, ${m[7].toFixed(4)}]`);
    console.log(`${prefix}    [${m[8].toFixed(4)}, ${m[9].toFixed(4)}, ${m[10].toFixed(4)}, ${m[11].toFixed(4)}]`);
    console.log(`${prefix}    [0.0000, 0.0000, 0.0000, 1.0000]`);
    console.log('');

    if (node.children.length > 0) {
      node.children.forEach(child => printNode(child, indent + 1));
    }
  }

  printNode(root);

  // 打印关节名称
  console.log('\n=== 查找关键节点 ===\n');
  const keyNodes = ['固定底座', '转台', '大臂', '小臂', '回转机构', '末端关节', '快拆机器人端口', '吸盘'];

  root.traverse((node) => {
    if (keyNodes.includes(node.name)) {
      console.log(`节点 "${node.name}":`);
      console.log(`  Local Position: (${node.position.x.toFixed(3)}, ${node.position.y.toFixed(3)}, ${node.position.z.toFixed(3)})`);

      // 分析局部轴方向
      const dirX = new THREE.Vector3(1, 0, 0).applyQuaternion(node.quaternion);
      const dirY = new THREE.Vector3(0, 1, 0).applyQuaternion(node.quaternion);
      const dirZ = new THREE.Vector3(0, 0, 1).applyQuaternion(node.quaternion);

      console.log(`  Local X axis (world): (${dirX.x.toFixed(3)}, ${dirX.y.toFixed(3)}, ${dirX.z.toFixed(3)})`);
      console.log(`  Local Y axis (world): (${dirY.x.toFixed(3)}, ${dirY.y.toFixed(3)}, ${dirY.z.toFixed(3)})`);
      console.log(`  Local Z axis (world): (${dirZ.x.toFixed(3)}, ${dirZ.y.toFixed(3)}, ${dirZ.z.toFixed(3)})`);

      // 世界位置
      const worldPos = new THREE.Vector3();
      node.getWorldPosition(worldPos);
      console.log(`  World Position: (${worldPos.x.toFixed(3)}, ${worldPos.y.toFixed(3)}, ${worldPos.z.toFixed(3)})`);

      // 父节点名称
      console.log(`  Parent: "${node.parent?.name || 'none'}"`);
      console.log('');
    }
  });

  // 分析关节轴方向（关节旋转应指向哪个轴？）
  console.log('\n=== 关节轴分析 ===\n');

  // DH 参数（从 robot-config.ts）
  const dhAlphas = {
    '转台': 0,           // J1: alpha=0, Z-axis stays parallel to base Z
    '大臂': -Math.PI/2,  // J2: alpha=-π/2, Z rotates to horizontal
    '小臂': 0,           // J3: alpha=0, Z stays parallel to J2
    '回转机构': -Math.PI/2, // J4: alpha=-π/2, Z rotates
    '末端关节': Math.PI/2,  // J5: alpha=π/2, Z rotates
    '快拆机器人端口': -Math.PI/2, // J6: alpha=-π/2
  };

  // KUKA_6D 根节点将 CAD Z-up 转换为 Three.js Y-up
  // 所以每个关节的旋转轴在 Three.js 空间中应该是：
  // DH alpha 定义的是连续关节 Z 轴之间的旋转
  // 关节 i 的旋转轴是 Z_{i-1} 轴（标准 DH 的 Z_{i-1}）

  // 实际上，关键问题是：在 GLB 模型中，每个关节节点在初始姿态下，
  // 关节旋转应该绕哪个局部轴？

  // 对于 KUKA 标准六轴机器人（在 CAD Z-up 空间）：
  // J1: 绕 Z_cad 旋转 → 在 Three.js Y-up 空间 = Y
  // J2: 绕 Y_cad 旋转（肩轴，水平垂直于臂）→ 在 Three.js = -Z
  // J3: 绕 Y_cad 旋转（肘轴，平行于 J2）→ 在 Three.js = -Z
  // J4: 绕 X_cad 旋转（沿前臂，水平指向臂方向）→ 在 Three.js = X
  // J5: 绕 Y_cad 旋转（腕俯仰）→ 在 Three.js = -Z
  // J6: 绕 Z_cad 旋转（腕旋转）→ 在 Three.js = Y

  // 但这是基于 CAD 坐标系的推导！
  // 更好的方法是检查 GLB 节点本身的局部坐标轴方向

  // 查找 base 节点来理解坐标系
  const baseNode = (() => {
    let node = null;
    root.traverse((n) => { if (n.name === '固定底座') node = n; });
    return node;
  })();

  if (baseNode) {
    console.log('基座节点分析:');
    const zAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(baseNode.quaternion);
    const yAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(baseNode.quaternion);
    console.log(`  局部 Z 世界方向: (${zAxis.x.toFixed(3)}, ${zAxis.y.toFixed(3)}, ${zAxis.z.toFixed(3)})`);
    console.log(`  局部 Y 世界方向: (${yAxis.x.toFixed(3)}, ${yAxis.y.toFixed(3)}, ${yAxis.z.toFixed(3)})`);
    console.log(`  基座垂直轴 = 局部 Z (world): Z 轴是否向上？`);
    console.log('');
  }

  // 打印每个关节的父节点局部坐标轴
  const jointNames = ['转台', '大臂', '小臂', '回转机构', '末端关节', '快拆机器人端口'];

  for (const name of jointNames) {
    let node = null;
    root.traverse((n) => { if (n.name === name) node = n; });
    if (!node) continue;

    const parent = node.parent;
    if (!parent) continue;

    // 获取父节点的世界旋转
    const parentQuat = new THREE.Quaternion();
    parent.getWorldQuaternion(parentQuat);

    // 父节点的局部轴在世界空间中的方向
    const xDir = new THREE.Vector3(1, 0, 0).applyQuaternion(parentQuat);
    const yDir = new THREE.Vector3(0, 1, 0).applyQuaternion(parentQuat);
    const zDir = new THREE.Vector3(0, 0, 1).applyQuaternion(parentQuat);

    console.log(`关节 "${name}" 的父节点 "${parent.name}" 局部轴 (世界方向):`);
    console.log(`  X: (${xDir.x.toFixed(3)}, ${xDir.y.toFixed(3)}, ${xDir.z.toFixed(3)})`);
    console.log(`  Y: (${yDir.x.toFixed(3)}, ${yDir.y.toFixed(3)}, ${yDir.z.toFixed(3)})`);
    console.log(`  Z: (${zDir.y.toFixed(3)}, ${zDir.y.toFixed(3)}, ${zDir.z.toFixed(3)})`);
    console.log('');
  }

}, undefined, (error) => {
  console.error('加载GLB失败:', error);
});
