// src/types/camera.ts

export interface CameraState {
  position: [number, number, number];   // m
  rotation: [number, number, number];   // deg (XYZ Euler)
  fov: number;
  near: number;  // m
  far: number;   // m
  showCamera: boolean;
  showFrustum: boolean;
  showModel: boolean;
  resolution: [number, number];
}

export interface CaptureResult {
  color: string | null;           // dataURL
  segmentation: string | null;    // dataURL
  depth: string | null;           // dataURL (grayscale)
  colorMap: Record<string, string>; // hexColor -> objectName
}

export type CameraTab = 'robot' | 'camera';
