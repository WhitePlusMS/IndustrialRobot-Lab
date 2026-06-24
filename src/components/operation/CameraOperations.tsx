import { useState } from 'react';
import { Aperture, Camera, Scan } from 'lucide-react';
import { CAMERA_RESOLUTIONS } from '@/lib/camera-config';
import CameraParamsCard from '@/components/camera/CameraParamsCard';
import CapturePanel from '@/components/camera/CapturePanel';
import { useLearning } from '@/contexts/LearningContext';
import { useVirtualCameraContext } from '@/contexts/VirtualCameraContext';

export default function CameraOperations() {
  const { currentStep } = useLearning();
  const camera = useVirtualCameraContext();
  if (!currentStep) return null;
  const stepId = currentStep.id;
  const [showCalibrationResult] = useState(false);

  const [cw, ch] = camera.cameraState.resolution;
  const fx = (cw / 2) / Math.tan((camera.cameraState.fov * Math.PI) / 360);
  const fy = fx;
  const cx = cw / 2;
  const cy = ch / 2;

  return (
    <div className="space-y-4">
      {stepId === 'camera-model' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              模型显示
            </h3>
          </div>
          <div className="p-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={camera.toggleModel}
                className={`py-2 text-[11px] font-semibold rounded-lg border shadow-sm flex items-center justify-center gap-1 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                  camera.cameraState.showModel
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                相机模型
              </button>
              <button
                type="button"
                onClick={camera.toggleFrustum}
                className={`py-2 text-[11px] font-semibold rounded-lg border shadow-sm flex items-center justify-center gap-1 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                  camera.cameraState.showFrustum
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Scan className="w-3.5 h-3.5" />
                视野锥
              </button>
            </div>
          </div>
        </div>
      )}

      {stepId === 'camera-params' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              相机参数概览
            </h3>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              本步骤用于认知内外参的含义，所有参数为<strong>只读</strong>展示。如需调节，请切换到后续步骤。
            </p>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-[11px] font-semibold text-slate-700 mb-1">内参矩阵 K</div>
              <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                内参反映相机自身特性（焦距 fx/fy、主点 cx/cy），由 FOV 和分辨率决定，同一台相机通常固定不变。
              </p>
              <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-[11px] font-mono text-slate-700">
                <span>{fx.toFixed(1)}</span>
                <span>0</span>
                <span>{cx.toFixed(1)}</span>
                <span>0</span>
                <span>{fy.toFixed(1)}</span>
                <span>{cy.toFixed(1)}</span>
                <span>0</span>
                <span>0</span>
                <span>1</span>
              </div>
              <div className="mt-2 text-[10px] text-slate-400">
                由 FOV {camera.cameraState.fov.toFixed(1)}° 与分辨率 {cw}×{ch} 近似计算
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-[11px] font-semibold text-slate-700 mb-1">外参（相机在世界坐标系中的位姿）</div>
              <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                外参反映相机在空间中的位置和朝向，移动或旋转相机时外参会随之改变。
              </p>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                {(['X', 'Y', 'Z'] as const).map((label, i) => (
                  <div key={label} className="bg-white rounded border border-slate-200 p-2 text-center">
                    <div className="text-[10px] text-slate-400">{label}</div>
                    <div className="font-mono font-semibold text-slate-700">{camera.cameraState.position[i].toFixed(2)} m</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
                {(['Rx', 'Ry', 'Rz'] as const).map((label, i) => (
                  <div key={label} className="bg-white rounded border border-slate-200 p-2 text-center">
                    <div className="text-[10px] text-slate-400">{label}</div>
                    <div className="font-mono font-semibold text-slate-700">{camera.cameraState.rotation[i].toFixed(1)}°</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {stepId === 'camera-pose' && (
        <CameraParamsCard
          cameraState={camera.cameraState}
          posStep={camera.posStep}
          onPosStepChange={camera.setPosStep}
          rotStep={camera.rotStep}
          onRotStepChange={camera.setRotStep}
          fovStep={camera.fovStep}
          onFovStepChange={camera.setFovStep}
          applyCameraPatch={camera.applyCameraPatch}
          toggleFrustum={camera.toggleFrustum}
          toggleModel={camera.toggleModel}
          resetCamera={camera.resetCamera}
          showCamera={camera.cameraState.showCamera}
          showLensParams={false}
        />
      )}

      {stepId === 'camera-fov' && (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Aperture className="w-3.5 h-3.5" />
                视场角 FOV
              </label>
              <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                {camera.cameraState.fov.toFixed(1)}°
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={120}
              step={1}
              value={camera.cameraState.fov}
              onChange={(e) => camera.applyCameraPatch({ fov: parseFloat(e.target.value) })}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
              <span>10°</span>
              <span>120°</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="text-[11px] font-semibold text-slate-500 mb-3 flex items-center gap-1.5">
              <Scan className="w-3.5 h-3.5" />
              裁剪面
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-slate-500">近裁剪面 Near</label>
                  <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    {camera.cameraState.near.toFixed(2)} m
                  </span>
                </div>
                <input
                  type="range"
                  min={0.01}
                  max={1}
                  step={0.01}
                  value={camera.cameraState.near}
                  onChange={(e) => camera.applyCameraPatch({ near: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-slate-500">远裁剪面 Far</label>
                  <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    {camera.cameraState.far.toFixed(0)} m
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={100}
                  step={1}
                  value={camera.cameraState.far}
                  onChange={(e) => camera.applyCameraPatch({ far: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="text-[11px] font-semibold text-slate-500 mb-3">图像分辨率</div>
            <div className="grid grid-cols-2 gap-2">
              {CAMERA_RESOLUTIONS.map(([w, h]) => {
                const active = camera.cameraState.resolution[0] === w && camera.cameraState.resolution[1] === h;
                return (
                  <button
                    key={`${w}x${h}`}
                    type="button"
                    onClick={() => camera.setResolution(w, h)}
                    className={`py-2 text-[11px] font-semibold rounded-lg border shadow-sm transition-colors ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {w} × {h}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <CapturePanel
        cameraState={camera.cameraState}
        captureResult={camera.captureResult}
        onCapture={camera.saveCapture}
        onResolutionChange={camera.setResolution}
      />

      {showCalibrationResult && null}
    </div>
  );
}
