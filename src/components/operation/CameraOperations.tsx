// src/components/operation/CameraOperations.tsx
import { useState } from 'react';
import { Aperture, Camera, Scan, Crosshair, Box } from 'lucide-react';
import { CAMERA_RESOLUTIONS } from '@/lib/camera-config';
import type { OperationPanelData } from './OperationPanel';
import CameraParamsCard from '@/components/camera/CameraParamsCard';
import CapturePanel from '@/components/camera/CapturePanel';

export default function CameraOperations(props: OperationPanelData) {
  const stepId = props.currentStep.id;
  const [showCalibrationResult, setShowCalibrationResult] = useState(false);

  const handleCalibrate = () => {
    setShowCalibrationResult(true);
  };

  // 模拟标定结果：内参与当前相机状态一致，外参直接读取虚拟相机位姿
  const [cw, ch] = props.cameraState.resolution;
  const fx = (cw / 2) / Math.tan((props.cameraState.fov * Math.PI) / 360);
  const fy = fx;
  const cx = cw / 2;
  const cy = ch / 2;

  return (
    <div className="space-y-4">
      {/* camera-model：相机模型与可视化开关 */}
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
                onClick={props.toggleCameraModel}
                className={`py-2 text-[11px] font-semibold rounded-lg border shadow-sm flex items-center justify-center gap-1 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                  props.cameraState.showModel
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                相机模型
              </button>
              <button
                type="button"
                onClick={props.toggleCameraFrustum}
                className={`py-2 text-[11px] font-semibold rounded-lg border shadow-sm flex items-center justify-center gap-1 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                  props.cameraState.showFrustum
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

      {/* camera-params：内外参只读概览 */}
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

            {/* 内参矩阵 */}
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
                由 FOV {props.cameraState.fov.toFixed(1)}° 与分辨率 {cw}×{ch} 近似计算
              </div>
            </div>

            {/* 外参只读 */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-[11px] font-semibold text-slate-700 mb-1">外参（相机在世界坐标系中的位姿）</div>
              <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                外参反映相机在空间中的位置和朝向，移动或旋转相机时外参会随之改变。
              </p>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                {(['X', 'Y', 'Z'] as const).map((label, i) => (
                  <div key={label} className="bg-white rounded border border-slate-200 p-2 text-center">
                    <div className="text-[10px] text-slate-400">{label}</div>
                    <div className="font-mono font-semibold text-slate-700">{props.cameraState.position[i].toFixed(2)} m</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
                {(['Rx', 'Ry', 'Rz'] as const).map((label, i) => (
                  <div key={label} className="bg-white rounded border border-slate-200 p-2 text-center">
                    <div className="text-[10px] text-slate-400">{label}</div>
                    <div className="font-mono font-semibold text-slate-700">{props.cameraState.rotation[i].toFixed(1)}°</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* camera-pose：相机位姿调节（仅外参：位置+朝向+显示开关） */}
      {stepId === 'camera-pose' && (
        <CameraParamsCard
          cameraState={props.cameraState}
          posStep={props.cameraPosStep}
          onPosStepChange={props.onCameraPosStepChange}
          rotStep={props.cameraRotStep}
          onRotStepChange={props.onCameraRotStepChange}
          fovStep={props.cameraFovStep}
          onFovStepChange={props.onCameraFovStepChange}
          setPositionAxis={props.setCameraPositionAxis}
          setRotationAxis={props.setCameraRotationAxis}
          setFov={props.setCameraFov}
          setNear={props.setCameraNear}
          setFar={props.setCameraFar}
          toggleFrustum={props.toggleCameraFrustum}
          toggleModel={props.toggleCameraModel}
          resetCamera={props.resetCamera}
          showCamera={props.showCamera}
          showLensParams={false}
          setPositionAxisTarget={props.setCameraPositionAxisTarget}
          setRotationAxisTarget={props.setCameraRotationAxisTarget}
          setFovTarget={props.setCameraFovTarget}
          setNearTarget={props.setCameraNearTarget}
          setFarTarget={props.setCameraFarTarget}
        />
      )}

      {/* camera-fov：视场角 + 裁剪面 + 分辨率 */}
      {stepId === 'camera-fov' && (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Aperture className="w-3.5 h-3.5" />
                视场角 FOV
              </label>
              <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                {props.cameraState.fov.toFixed(1)}°
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={120}
              step={1}
              value={props.cameraState.fov}
              onChange={(e) => props.setCameraFov(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
              <span>10°</span>
              <span>120°</span>
            </div>
          </div>

          {/* 近远裁剪面 */}
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
                    {props.cameraState.near.toFixed(2)} m
                  </span>
                </div>
                <input
                  type="range"
                  min={0.01}
                  max={1}
                  step={0.01}
                  value={props.cameraState.near}
                  onChange={(e) => props.setCameraNear(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>0.01 m</span>
                  <span>1 m</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-slate-500">远裁剪面 Far</label>
                  <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    {props.cameraState.far.toFixed(0)} m
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={100}
                  step={1}
                  value={props.cameraState.far}
                  onChange={(e) => props.setCameraFar(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>1 m</span>
                  <span>100 m</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5" />
              分辨率
            </div>
            <div className="flex flex-wrap gap-2">
              {CAMERA_RESOLUTIONS.map(([w, h]) => {
                const active = props.cameraState.resolution[0] === w && props.cameraState.resolution[1] === h;
                return (
                  <button
                    type="button"
                    key={`${w}x${h}`}
                    aria-pressed={active}
                    onClick={() => props.setCameraResolution(w, h)}
                    className={`px-2 py-1 text-[11px] rounded-sm border focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {w}×{h}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* camera-calibration：标定 UI + 拍摄输出 */}
      {stepId === 'camera-calibration' && (
        <>
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5" />
                模拟标定
              </h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={props.toggleCameraFrustum}
                  className="flex-1 py-2 text-[11px] font-semibold rounded-lg border shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                >
                  {props.cameraState.showFrustum ? '隐藏视野锥' : '显示视野锥'}
                </button>
                <button
                  type="button"
                  onClick={handleCalibrate}
                  className="flex-1 py-2 text-[11px] font-semibold rounded-lg border shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                >
                  执行标定
                </button>
              </div>

              {showCalibrationResult && (
                <div className="text-[11px] font-mono text-slate-600 bg-slate-50 p-3 rounded border border-slate-200 space-y-1">
                  <div className="font-semibold text-slate-700">内参矩阵 K：</div>
                  <div>[{fx.toFixed(1)}, 0, {cx.toFixed(1)}]</div>
                  <div>[0, {fy.toFixed(1)}, {cy.toFixed(1)}]</div>
                  <div>[0, 0, 1]</div>
                  <div className="font-semibold text-slate-700 pt-1">外参（虚拟相机）：</div>
                  <div>
                    位置: [{props.cameraState.position.map((v) => v.toFixed(3)).join(', ')}] m
                  </div>
                  <div>
                    朝向: [{props.cameraState.rotation.map((v) => v.toFixed(1)).join(', ')}] °
                  </div>
                  <div className="pt-1 text-green-600 font-semibold">模拟标定完成</div>
                  <div className="text-[10px] text-slate-500 not-italic font-sans leading-relaxed">
                    以上为根据当前相机状态模拟的标定结果，实际标定需拍摄棋盘格标定板并提取角点。
                  </div>
                </div>
              )}
            </div>
          </div>

          <CapturePanel
            cameraState={props.cameraState}
            captureResult={props.captureResult}
            onCapture={props.onCapture}
            onResolutionChange={props.setCameraResolution}
          />
        </>
      )}
    </div>
  );
}
