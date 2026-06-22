// src/components/operation/CameraOperations.tsx
import { useState } from 'react';
import { Aperture, RotateCcw, Camera, Scan, Crosshair, Box } from 'lucide-react';
import { CAMERA_RESOLUTIONS } from '@/lib/camera-config';
import type { OperationPanelData } from './OperationPanel';
import CameraParamsCard from '@/components/camera/CameraParamsCard';
import CapturePanel from '@/components/camera/CapturePanel';

export default function CameraOperations(props: OperationPanelData) {
  const stepId = props.currentStep.id;
  const [showCalibrationResult, setShowCalibrationResult] = useState(false);

  // 快捷视角：控制虚拟工业相机本身的位置与朝向
  const views = [
    { label: '前', pos: [0, 1.5, 4] as [number, number, number], rot: [-90, 0, 180] as [number, number, number] },
    { label: '侧', pos: [4, 1.5, 0] as [number, number, number], rot: [-90, 0, -90] as [number, number, number] },
    { label: '顶', pos: [0, 5, 0.01] as [number, number, number], rot: [-90, 0, 0] as [number, number, number] },
    { label: '自', pos: [3, 2, 3] as [number, number, number], rot: [-90, 0, 135] as [number, number, number] },
  ];

  const applyCameraView = (pos: [number, number, number], rot: [number, number, number]) => {
    props.setCameraPositionAxis(0, pos[0]);
    props.setCameraPositionAxis(1, pos[1]);
    props.setCameraPositionAxis(2, pos[2]);
    props.setCameraRotationAxis(0, rot[0]);
    props.setCameraRotationAxis(1, rot[1]);
    props.setCameraRotationAxis(2, rot[2]);
  };

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

      {/* camera-params：内外参综合调节 */}
      {stepId === 'camera-params' && (
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
        />
      )}

      {/* camera-pose：位姿滑块 + 快捷视角 */}
      {stepId === 'camera-pose' && (
        <div className="space-y-3">
          {[
            { label: '位置 X', value: props.cameraState.position[0], min: -5, max: 5, step: 0.1, axis: 0 as const, unit: 'm', setter: props.setCameraPositionAxis },
            { label: '位置 Y', value: props.cameraState.position[1], min: -5, max: 5, step: 0.1, axis: 1 as const, unit: 'm', setter: props.setCameraPositionAxis },
            { label: '位置 Z', value: props.cameraState.position[2], min: -5, max: 5, step: 0.1, axis: 2 as const, unit: 'm', setter: props.setCameraPositionAxis },
            { label: '朝向 Rx', value: props.cameraState.rotation[0], min: -360, max: 360, step: 1, axis: 0 as const, unit: '°', setter: props.setCameraRotationAxis },
            { label: '朝向 Ry', value: props.cameraState.rotation[1], min: -360, max: 360, step: 1, axis: 1 as const, unit: '°', setter: props.setCameraRotationAxis },
            { label: '朝向 Rz', value: props.cameraState.rotation[2], min: -360, max: 360, step: 1, axis: 2 as const, unit: '°', setter: props.setCameraRotationAxis },
          ].map((item) => (
            <div key={item.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-700">{item.label}</label>
                <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {item.value.toFixed(2)}
                  {item.unit}
                </span>
              </div>
              <input
                type="range"
                min={item.min}
                max={item.max}
                step={item.step}
                value={item.value}
                onChange={(e) => item.setter(item.axis, parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          ))}

          {/* 快捷视角：直接控制虚拟工业相机 */}
          <div className="grid grid-cols-4 gap-2">
            {views.map((view) => (
              <button
                key={view.label}
                type="button"
                onClick={() => applyCameraView(view.pos, view.rot)}
                className="py-2 text-xs font-semibold text-slate-600 rounded-lg bg-white border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
              >
                {view.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => props.resetCamera()}
            className="w-full py-3 text-[13px] font-semibold rounded-xl text-white bg-gradient-to-r from-green-500 to-green-600 border border-green-600 shadow-sm hover:from-green-600 hover:to-green-700 flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:outline-none"
          >
            <RotateCcw className="w-4 h-4" />
            重置相机视角
          </button>
        </div>
      )}

      {/* camera-fov：FOV + 分辨率 */}
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
                标定
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
                  <div className="pt-1 text-green-600 font-semibold">标定完成</div>
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
