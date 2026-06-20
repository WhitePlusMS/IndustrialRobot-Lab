// src/lib/camera-config.ts

/**
 * 相机模块共享分辨率配置。
 * 用于 FOV、标定、拍照输出等步骤，保证分辨率选择统一。
 */
export const CAMERA_RESOLUTIONS = [
  [640, 480],
  [1280, 720],
  [1920, 1080],
] as const;
