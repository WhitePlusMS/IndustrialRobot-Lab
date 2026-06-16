// src/lib/capture-engine.ts
import * as THREE from 'three';

// 分割颜色调色板
const SEGMENTATION_PALETTE = [
  '#FF0000', '#FF8C00', '#FFD700', '#00CC00', '#00BFFF',
  '#0066FF', '#9933FF', '#FF69B4', '#8B4513', '#AAAAAA',
  '#666666', '#999999',
];

/**
 * 从相机视角拍摄彩色照片
 */
export function captureColorPhoto(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  resolution: [number, number]
): string {
  const [width, height] = resolution;

  const renderTarget = new THREE.WebGLRenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
  });

  const originalSize = renderer.getSize(new THREE.Vector2());

  renderer.setSize(width, height);
  renderer.setRenderTarget(renderTarget);
  renderer.render(scene, camera);

  const buffer = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, buffer);

  renderer.setRenderTarget(null);
  renderer.setSize(originalSize.x, originalSize.y);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = ((height - 1 - y) * width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      imageData.data[dstIdx] = buffer[srcIdx];
      imageData.data[dstIdx + 1] = buffer[srcIdx + 1];
      imageData.data[dstIdx + 2] = buffer[srcIdx + 2];
      imageData.data[dstIdx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  renderTarget.dispose();

  return canvas.toDataURL('image/png');
}

/**
 * 从相机视角拍摄分割照片
 */
export function captureSegmentationPhoto(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  resolution: [number, number]
): { dataURL: string; colorMap: Record<string, string> } {
  const [width, height] = resolution;

  const meshes: THREE.Mesh[] = [];
  const originalMaterials: (THREE.Material | THREE.Material[])[] = [];
  const colorMap: Record<string, string> = {};
  const objectNames: string[] = [];

  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh && !obj.userData.isHelper && !obj.userData.isGrid) {
      meshes.push(obj);
      originalMaterials.push(obj.material);

      const name = obj.userData.objectName || obj.name || `Object_${meshes.length}`;
      objectNames.push(name);

      const colorHex = SEGMENTATION_PALETTE[(meshes.length - 1) % SEGMENTATION_PALETTE.length];
      colorMap[colorHex] = name;

      const segMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorHex),
        side: THREE.DoubleSide,
      });
      obj.material = segMaterial;
    }
  });

  const lights: THREE.Light[] = [];
  scene.traverse((obj) => {
    if (obj instanceof THREE.Light) {
      lights.push(obj);
      obj.visible = false;
    }
  });

  const renderTarget = new THREE.WebGLRenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
  });

  const originalSize = renderer.getSize(new THREE.Vector2());

  renderer.setSize(width, height);
  renderer.setRenderTarget(renderTarget);
  renderer.render(scene, camera);

  const buffer = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, buffer);

  renderer.setRenderTarget(null);
  renderer.setSize(originalSize.x, originalSize.y);

  meshes.forEach((mesh, i) => {
    mesh.material = originalMaterials[i];
  });

  lights.forEach((light) => {
    light.visible = true;
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = ((height - 1 - y) * width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      imageData.data[dstIdx] = buffer[srcIdx];
      imageData.data[dstIdx + 1] = buffer[srcIdx + 1];
      imageData.data[dstIdx + 2] = buffer[srcIdx + 2];
      imageData.data[dstIdx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  renderTarget.dispose();

  return { dataURL: canvas.toDataURL('image/png'), colorMap };
}

/**
 * 从相机视角拍摄深度图
 * 深度值 = 像素点到相机的线性距离
 * 可视化：近处 = 白色，远处 = 黑色
 */
export function captureDepthPhoto(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  resolution: [number, number],
  near: number,
  far: number
): string {
  const [width, height] = resolution;

  const meshes: THREE.Mesh[] = [];
  const originalMaterials: (THREE.Material | THREE.Material[])[] = [];

  const depthMaterialBase = new THREE.ShaderMaterial({
    vertexShader: `
      varying float vViewZ;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vec4 viewPosition = viewMatrix * worldPosition;
        vViewZ = -viewPosition.z;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      varying float vViewZ;
      uniform float uNear;
      uniform float uFar;
      void main() {
        float normalized = (vViewZ - uNear) / (uFar - uNear);
        normalized = 1.0 - clamp(normalized, 0.0, 1.0);
        gl_FragColor = vec4(vec3(normalized), 1.0);
      }
    `,
    uniforms: {
      uNear: { value: near },
      uFar: { value: far },
    },
  });

  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh && !obj.userData.isHelper && !obj.userData.isGrid) {
      meshes.push(obj);
      originalMaterials.push(obj.material);
      const depthMat = depthMaterialBase.clone();
      depthMat.uniforms.uNear.value = near;
      depthMat.uniforms.uFar.value = far;
      obj.material = depthMat;
    }
  });

  const lights: THREE.Light[] = [];
  scene.traverse((obj) => {
    if (obj instanceof THREE.Light) {
      lights.push(obj);
      obj.visible = false;
    }
  });

  const renderTarget = new THREE.WebGLRenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
  });

  const originalSize = renderer.getSize(new THREE.Vector2());
  const originalClearColor = new THREE.Color();
  renderer.getClearColor(originalClearColor);
  const originalClearAlpha = renderer.getClearAlpha();

  renderer.setClearColor('#000000', 1);
  renderer.setSize(width, height);
  renderer.setRenderTarget(renderTarget);
  renderer.clear();
  renderer.render(scene, camera);

  const buffer = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, buffer);

  renderer.setRenderTarget(null);
  renderer.setSize(originalSize.x, originalSize.y);
  renderer.setClearColor(originalClearColor, originalClearAlpha);

  meshes.forEach((mesh, i) => {
    mesh.material = originalMaterials[i];
  });

  lights.forEach((light) => {
    light.visible = true;
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = ((height - 1 - y) * width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      const gray = buffer[srcIdx];
      imageData.data[dstIdx] = gray;
      imageData.data[dstIdx + 1] = gray;
      imageData.data[dstIdx + 2] = gray;
      imageData.data[dstIdx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  renderTarget.dispose();
  depthMaterialBase.dispose();

  return canvas.toDataURL('image/png');
}

/** 生成文件名 */
export function generateFileName(type: 'color' | 'segmentation' | 'depth'): string {
  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  return `capture_${type}_${ts}.png`;
}

/** 下载图片 */
export function downloadImage(dataURL: string, fileName: string) {
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
