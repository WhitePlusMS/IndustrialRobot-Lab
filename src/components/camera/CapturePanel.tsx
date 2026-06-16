// src/components/camera/CapturePanel.tsx
import { useCallback, useState } from 'react';
import * as THREE from 'three';
import type { CameraState, CaptureResult } from '@/types/camera';
import { captureColorPhoto, captureSegmentationPhoto, captureDepthPhoto, generateFileName, downloadImage } from '@/lib/capture-engine';

interface CapturePanelProps {
  cameraState: CameraState;
  captureResult: CaptureResult | null;
  onCapture: (result: CaptureResult) => void;
  onResolutionChange: (w: number, h: number) => void;
}

export default function CapturePanel({ cameraState, captureResult, onCapture, onResolutionChange }: CapturePanelProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [viewerLabel, setViewerLabel] = useState('');

  const buildCaptureCamera = useCallback(() => {
    const captureCamera = new THREE.PerspectiveCamera(
      cameraState.fov,
      cameraState.resolution[0] / cameraState.resolution[1],
      cameraState.near,
      cameraState.far
    );
    captureCamera.position.set(
      cameraState.position[0],
      cameraState.position[1],
      cameraState.position[2]
    );
    captureCamera.rotation.set(
      (cameraState.rotation[0] * Math.PI) / 180,
      (cameraState.rotation[1] * Math.PI) / 180,
      (cameraState.rotation[2] * Math.PI) / 180,
      'XYZ'
    );
    captureCamera.updateProjectionMatrix();
    captureCamera.updateMatrixWorld();
    return captureCamera;
  }, [cameraState]);

  const clonePhotoScene = useCallback((scene: THREE.Scene) => {
    const photoScene = scene.clone();
    photoScene.traverse((obj: THREE.Object3D) => {
      if (obj.userData?.isCameraModel) {
        obj.visible = false;
      }
    });
    return photoScene;
  }, []);

  const handleCaptureColor = useCallback(() => {
    setIsCapturing(true);
    setTimeout(() => {
      try {
        const captureInfo = (window as any).__R3F_CAPTURE;
        if (!captureInfo) {
          console.error('无法获取 R3F 渲染器');
          setIsCapturing(false);
          return;
        }
        const { renderer, scene } = captureInfo;
        const captureCamera = buildCaptureCamera();
        const photoScene = clonePhotoScene(scene);
        const dataURL = captureColorPhoto(renderer, photoScene, captureCamera, cameraState.resolution);
        const result: CaptureResult = {
          color: dataURL,
          segmentation: captureResult?.segmentation || null,
          depth: captureResult?.depth || null,
          colorMap: captureResult?.colorMap || {},
        };
        onCapture(result);
      } catch (e) {
        console.error('彩色拍照失败:', e);
      } finally {
        setIsCapturing(false);
      }
    }, 50);
  }, [cameraState, captureResult, onCapture, buildCaptureCamera, clonePhotoScene]);

  const handleCaptureSegmentation = useCallback(() => {
    setIsCapturing(true);
    setTimeout(() => {
      try {
        const captureInfo = (window as any).__R3F_CAPTURE;
        if (!captureInfo) {
          console.error('无法获取 R3F 渲染器');
          setIsCapturing(false);
          return;
        }
        const { renderer, scene } = captureInfo;
        const captureCamera = buildCaptureCamera();
        const photoScene = clonePhotoScene(scene);
        const { dataURL, colorMap } = captureSegmentationPhoto(renderer, photoScene, captureCamera, cameraState.resolution);
        const result: CaptureResult = {
          color: captureResult?.color || null,
          segmentation: dataURL,
          depth: captureResult?.depth || null,
          colorMap,
        };
        onCapture(result);
      } catch (e) {
        console.error('分割拍照失败:', e);
      } finally {
        setIsCapturing(false);
      }
    }, 50);
  }, [cameraState, captureResult, onCapture, buildCaptureCamera, clonePhotoScene]);

  const handleCaptureDepth = useCallback(() => {
    setIsCapturing(true);
    setTimeout(() => {
      try {
        const captureInfo = (window as any).__R3F_CAPTURE;
        if (!captureInfo) {
          console.error('无法获取 R3F 渲染器');
          setIsCapturing(false);
          return;
        }
        const { renderer, scene } = captureInfo;
        const captureCamera = buildCaptureCamera();
        const photoScene = clonePhotoScene(scene);
        const dataURL = captureDepthPhoto(
          renderer,
          photoScene,
          captureCamera,
          cameraState.resolution,
          cameraState.near,
          cameraState.far
        );
        const result: CaptureResult = {
          color: captureResult?.color || null,
          segmentation: captureResult?.segmentation || null,
          depth: dataURL,
          colorMap: captureResult?.colorMap || {},
        };
        onCapture(result);
      } catch (e) {
        console.error('深度图拍摄失败:', e);
      } finally {
        setIsCapturing(false);
      }
    }, 50);
  }, [cameraState, captureResult, onCapture, buildCaptureCamera, clonePhotoScene]);

  const handleDownloadColor = useCallback(() => {
    if (captureResult?.color) {
      downloadImage(captureResult.color, generateFileName('color'));
    }
  }, [captureResult]);

  const handleDownloadSegmentation = useCallback(() => {
    if (captureResult?.segmentation) {
      downloadImage(captureResult.segmentation, generateFileName('segmentation'));
    }
  }, [captureResult]);

  const handleDownloadDepth = useCallback(() => {
    if (captureResult?.depth) {
      downloadImage(captureResult.depth, generateFileName('depth'));
    }
  }, [captureResult]);

  return (
    <>
      <div className="bg-white rounded-md border border-[#E5E7EB] overflow-hidden">
        <div className="px-3 py-2 bg-[#F8FAFC] border-b border-[#E5E7EB]">
          <h3 className="text-xs font-semibold text-[#1E293B] tracking-wide uppercase">拍照输出</h3>
        </div>

        <div className="p-3 space-y-3">
          {/* 分辨率选择 */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#64748B] shrink-0">分辨率:</span>
            {[
              [320, 240],
              [640, 480],
              [1280, 720],
            ].map(([w, h]) => (
              <button
                key={`${w}x${h}`}
                onClick={() => onResolutionChange(w, h)}
                className={`px-1.5 py-0.5 text-[10px] rounded-sm border ${
                  cameraState.resolution[0] === w && cameraState.resolution[1] === h
                    ? 'bg-[#2563EB] text-white border-[#2563EB]'
                    : 'bg-white text-[#1E293B] border-[#D1D5DB] hover:bg-[#F3F4F6]'
                }`}
              >
                {w}x{h}
              </button>
            ))}
          </div>

        {/* 拍照按钮 */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleCaptureColor}
            disabled={isCapturing}
            className="h-8 bg-[#2563EB] text-white text-[10px] font-medium rounded-sm hover:bg-[#1D4ED8] active:bg-[#1E40AF] disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            彩色
          </button>
          <button
            onClick={handleCaptureSegmentation}
            disabled={isCapturing}
            className="h-8 bg-[#F97316] text-white text-[10px] font-medium rounded-sm hover:bg-[#EA580C] active:bg-[#C2410C] disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            分割
          </button>
          <button
            onClick={handleCaptureDepth}
            disabled={isCapturing}
            className="h-8 bg-[#7C3AED] text-white text-[10px] font-medium rounded-sm hover:bg-[#6D28D9] active:bg-[#5B21B6] disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            深度
          </button>
        </div>

        {isCapturing && (
          <div className="text-center text-[11px] text-[#64748B]">正在渲染...</div>
        )}

        {/* 预览区域 */}
        {captureResult && (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-[#64748B]">最近拍摄（双击查看大图）</div>

            <div className="grid grid-cols-3 gap-2">
              {captureResult.color && (
                <div className="space-y-1">
                  <div className="text-[10px] text-[#64748B] text-center">彩色</div>
                  <div
                    className="border border-[#E5E7EB] rounded-sm overflow-hidden bg-[#F8FAFC] aspect-[4/3] cursor-zoom-in"
                    onDoubleClick={() => { setViewerImage(captureResult.color); setViewerLabel('彩色照片'); }}
                  >
                    <img
                      src={captureResult.color}
                      alt="彩色照片"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}
              {captureResult.segmentation && (
                <div className="space-y-1">
                  <div className="text-[10px] text-[#64748B] text-center">分割</div>
                  <div
                    className="border border-[#E5E7EB] rounded-sm overflow-hidden bg-[#F8FAFC] aspect-[4/3] cursor-zoom-in"
                    onDoubleClick={() => { setViewerImage(captureResult.segmentation); setViewerLabel('分割照片'); }}
                  >
                    <img
                      src={captureResult.segmentation}
                      alt="分割照片"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}
              {captureResult.depth && (
                <div className="space-y-1">
                  <div className="text-[10px] text-[#64748B] text-center">深度</div>
                  <div
                    className="border border-[#E5E7EB] rounded-sm overflow-hidden bg-[#F8FAFC] aspect-[4/3] cursor-zoom-in"
                    onDoubleClick={() => { setViewerImage(captureResult.depth); setViewerLabel('深度图'); }}
                  >
                    <img
                      src={captureResult.depth}
                      alt="深度图"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 颜色映射表 */}
            {Object.keys(captureResult.colorMap).length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-[#64748B]">分割颜色映射</div>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(captureResult.colorMap).map(([color, name]) => (
                    <div key={color} className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-3 rounded-sm border border-[#D1D5DB] shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[10px] text-[#1E293B] truncate">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 下载按钮 */}
            <div className="grid grid-cols-3 gap-2">
              {captureResult.color && (
                <button
                  onClick={handleDownloadColor}
                  className="h-7 bg-[#F1F5F9] text-[#1E293B] text-[10px] rounded-sm border border-[#CBD5E1] hover:bg-[#E2E8F0] active:bg-[#CBD5E1] transition-colors flex items-center justify-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  彩色
                </button>
              )}
              {captureResult.segmentation && (
                <button
                  onClick={handleDownloadSegmentation}
                  className="h-7 bg-[#F1F5F9] text-[#1E293B] text-[10px] rounded-sm border border-[#CBD5E1] hover:bg-[#E2E8F0] active:bg-[#CBD5E1] transition-colors flex items-center justify-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  分割
                </button>
              )}
              {captureResult.depth && (
                <button
                  onClick={handleDownloadDepth}
                  className="h-7 bg-[#F1F5F9] text-[#1E293B] text-[10px] rounded-sm border border-[#CBD5E1] hover:bg-[#E2E8F0] active:bg-[#CBD5E1] transition-colors flex items-center justify-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  深度
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>

      {/* 大图查看模态框 */}
      {viewerImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => { setViewerImage(null); setViewerLabel(''); }}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh] bg-white rounded-lg shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#F8FAFC] border-b border-[#E5E7EB]">
              <span className="text-sm font-semibold text-[#1E293B]">{viewerLabel}</span>
              <button
                onClick={() => { setViewerImage(null); setViewerLabel(''); }}
                className="w-7 h-7 flex items-center justify-center rounded-sm text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#1E293B] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* 图片 */}
            <div className="flex items-center justify-center p-2 bg-[#FAFAFA]">
              <img
                src={viewerImage}
                alt={viewerLabel}
                className="max-w-full max-h-[calc(90vh-60px)] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
