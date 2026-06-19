// src/components/camera/CapturePanel.tsx
import { useCallback, useState, useEffect } from 'react';
import * as THREE from 'three';
import type { CameraState, CaptureResult } from '@/types/camera';
import { captureColorPhoto, captureSegmentationPhoto, captureDepthPhoto, generateFileName, downloadImage } from '@/lib/capture-engine';
import { useSceneRendererAPI } from '@/hooks/useSceneRendererAPI';

interface CapturePanelProps {
  cameraState: CameraState;
  captureResult: CaptureResult | null;
  onCapture: (result: CaptureResult) => void;
  onResolutionChange: (w: number, h: number) => void;
}

const MIN_LOADING_MS = 300;

export default function CapturePanel({ cameraState, captureResult, onCapture, onResolutionChange }: CapturePanelProps) {
  const sceneRendererApi = useSceneRendererAPI();
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

  const captureWithProgress = useCallback(async (fn: () => void) => {
    setIsCapturing(true);
    const start = Date.now();
    // 延迟一小段时间让 UI 有机会渲染 loading 状态
    await new Promise((r) => setTimeout(r, 0));
    try {
      fn();
    } finally {
      const elapsed = Date.now() - start;
      const remaining = MIN_LOADING_MS - elapsed;
      if (remaining > 0) {
        await new Promise((r) => setTimeout(r, remaining));
      }
      setIsCapturing(false);
    }
  }, []);

  const handleCaptureColor = useCallback(() => {
    captureWithProgress(() => {
      try {
        if (!sceneRendererApi) {
          console.error('无法获取 R3F 渲染器');
          return;
        }
        const { renderer, scene } = sceneRendererApi;
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
      }
    });
  }, [cameraState, captureResult, onCapture, buildCaptureCamera, clonePhotoScene, captureWithProgress, sceneRendererApi]);

  const handleCaptureSegmentation = useCallback(() => {
    captureWithProgress(() => {
      try {
        if (!sceneRendererApi) {
          console.error('无法获取 R3F 渲染器');
          return;
        }
        const { renderer, scene } = sceneRendererApi;
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
      }
    });
  }, [cameraState, captureResult, onCapture, buildCaptureCamera, clonePhotoScene, captureWithProgress, sceneRendererApi]);

  const handleCaptureDepth = useCallback(() => {
    captureWithProgress(() => {
      try {
        if (!sceneRendererApi) {
          console.error('无法获取 R3F 渲染器');
          return;
        }
        const { renderer, scene } = sceneRendererApi;
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
      }
    });
  }, [cameraState, captureResult, onCapture, buildCaptureCamera, clonePhotoScene, captureWithProgress, sceneRendererApi]);

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

  const openViewer = useCallback((img: string, label: string) => {
    setViewerImage(img);
    setViewerLabel(label);
  }, []);

  const closeViewer = useCallback(() => {
    setViewerImage(null);
    setViewerLabel('');
  }, []);

  useEffect(() => {
    if (!viewerImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeViewer();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewerImage, closeViewer]);

  const handlePreviewKeyDown = useCallback((e: React.KeyboardEvent, img: string, label: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openViewer(img, label);
    }
  }, [openViewer]);

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">拍照输出</h3>
        </div>

        <div className="p-4 space-y-3">
          {/* 分辨率选择 */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500 shrink-0">分辨率:</span>
            {[
              [320, 240],
              [640, 480],
              [1280, 720],
            ].map(([w, h]) => (
              <button
                type="button"
                key={`${w}x${h}`}
                aria-pressed={cameraState.resolution[0] === w && cameraState.resolution[1] === h}
                onClick={() => onResolutionChange(w, h)}
                className={`px-1.5 py-0.5 text-[10px] rounded-sm border focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                  cameraState.resolution[0] === w && cameraState.resolution[1] === h
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {w}x{h}
              </button>
            ))}
          </div>

        {/* 拍照按钮 */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={handleCaptureColor}
            disabled={isCapturing}
            className="h-8 bg-blue-600 text-white text-[10px] font-medium rounded-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-1 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
          >
            {isCapturing ? (
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
            彩色
          </button>
          <button
            type="button"
            onClick={handleCaptureSegmentation}
            disabled={isCapturing}
            className="h-8 bg-orange-500 text-white text-[10px] font-medium rounded-sm hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
          >
            {isCapturing ? (
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            )}
            分割
          </button>
          <button
            type="button"
            onClick={handleCaptureDepth}
            disabled={isCapturing}
            className="h-8 bg-violet-600 text-white text-[10px] font-medium rounded-sm hover:bg-violet-700 active:bg-violet-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-1 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
          >
            {isCapturing ? (
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            )}
            深度
          </button>
        </div>

        {isCapturing && (
          <div className="text-center text-[11px] text-slate-500" role="status" aria-live="polite">正在渲染…</div>
        )}

        {/* 预览区域 */}
        {captureResult && (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-slate-500">最近拍摄（双击或按 Enter 查看大图）</div>

            <div className="grid grid-cols-3 gap-2">
              {captureResult.color && (
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-500 text-center">彩色</div>
                  <div
                    className="border border-slate-100 rounded-sm overflow-hidden bg-slate-50 aspect-[4/3] cursor-zoom-in focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                    onDoubleClick={() => openViewer(captureResult.color!, '彩色照片')}
                    onKeyDown={(e) => handlePreviewKeyDown(e, captureResult.color!, '彩色照片')}
                    tabIndex={0}
                    role="button"
                    aria-label="查看彩色照片大图"
                  >
                    <img
                      src={captureResult.color}
                      alt="彩色照片"
                      width="160"
                      height="120"
                      loading="lazy"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}
              {captureResult.segmentation && (
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-500 text-center">分割</div>
                  <div
                    className="border border-slate-100 rounded-sm overflow-hidden bg-slate-50 aspect-[4/3] cursor-zoom-in focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                    onDoubleClick={() => openViewer(captureResult.segmentation!, '分割照片')}
                    onKeyDown={(e) => handlePreviewKeyDown(e, captureResult.segmentation!, '分割照片')}
                    tabIndex={0}
                    role="button"
                    aria-label="查看分割照片大图"
                  >
                    <img
                      src={captureResult.segmentation}
                      alt="分割照片"
                      width="160"
                      height="120"
                      loading="lazy"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}
              {captureResult.depth && (
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-500 text-center">深度</div>
                  <div
                    className="border border-slate-100 rounded-sm overflow-hidden bg-slate-50 aspect-[4/3] cursor-zoom-in focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                    onDoubleClick={() => openViewer(captureResult.depth!, '深度图')}
                    onKeyDown={(e) => handlePreviewKeyDown(e, captureResult.depth!, '深度图')}
                    tabIndex={0}
                    role="button"
                    aria-label="查看深度图大图"
                  >
                    <img
                      src={captureResult.depth}
                      alt="深度图"
                      width="160"
                      height="120"
                      loading="lazy"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 颜色映射表 */}
            {Object.keys(captureResult.colorMap).length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-slate-500">分割颜色映射</div>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(captureResult.colorMap).map(([color, name]) => (
                    <div key={color} className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-3 rounded-sm border border-slate-200 shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[10px] text-slate-700 truncate">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 下载按钮 */}
            <div className="grid grid-cols-3 gap-2">
              {captureResult.color && (
                <button
                  type="button"
                  onClick={handleDownloadColor}
                  className="h-7 bg-slate-100 text-slate-700 text-[10px] rounded-sm border border-slate-200 hover:bg-slate-200 active:bg-slate-300 transition-colors flex items-center justify-center gap-1 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  彩色
                </button>
              )}
              {captureResult.segmentation && (
                <button
                  type="button"
                  onClick={handleDownloadSegmentation}
                  className="h-7 bg-slate-100 text-slate-700 text-[10px] rounded-sm border border-slate-200 hover:bg-slate-200 active:bg-slate-300 transition-colors flex items-center justify-center gap-1 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  分割
                </button>
              )}
              {captureResult.depth && (
                <button
                  type="button"
                  onClick={handleDownloadDepth}
                  className="h-7 bg-slate-100 text-slate-700 text-[10px] rounded-sm border border-slate-200 hover:bg-slate-200 active:bg-slate-300 transition-colors flex items-center justify-center gap-1 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
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
          role="dialog"
          aria-modal="true"
          aria-labelledby="viewer-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 overscroll-contain"
          onClick={closeViewer}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh] bg-white rounded-lg shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50/80 border-b border-slate-100">
              <span id="viewer-title" className="text-sm font-semibold text-slate-700">{viewerLabel}</span>
              <button
                type="button"
                onClick={closeViewer}
                className="w-7 h-7 flex items-center justify-center rounded-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                aria-label="关闭"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* 图片 */}
            <div className="flex items-center justify-center p-2 bg-slate-50">
              <img
                src={viewerImage}
                alt={viewerLabel}
                width="1280"
                height="960"
                className="max-w-full max-h-[calc(90vh-60px)] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
