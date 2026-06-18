// src/components/operation/CameraOperations.tsx
import { Camera, Aperture, RotateCcw } from 'lucide-react';
import type { OperationPanelProps } from './OperationPanel';
import CameraParamsCard from '@/components/camera/CameraParamsCard';
import CapturePanel from '@/components/camera/CapturePanel';

export default function CameraOperations(props: OperationPanelProps) {
  const stepId = props.currentStep.id;
  const isFree = props.mode === 'free';

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 border-l-4 border-l-blue-500 shadow-sm">
        <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">当前任务</p>
        <p className="text-[15px] font-bold text-slate-800">{props.currentStep.title}</p>
      </div>

      {/* 相机位姿滑块 */}
      {(stepId === 'camera-pose' || isFree) && (
        <div className="space-y-3">
          {[
            { label: '位置 X', value: props.cameraState.position[0], min: -5, max: 5, step: 0.1, axis: 0 as const, unit: 'm' },
            { label: '位置 Y', value: props.cameraState.position[1], min: -5, max: 5, step: 0.1, axis: 1 as const, unit: 'm' },
            { label: '位置 Z', value: props.cameraState.position[2], min: -5, max: 5, step: 0.1, axis: 2 as const, unit: 'm' },
          ].map((item) => (
            <div key={item.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-700">{item.label}</label>
                <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {item.value.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={item.min}
                max={item.max}
                step={item.step}
                value={item.value}
                onChange={(e) => props.setCameraPositionAxis(item.axis, parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          ))}

          {/* 快捷视角 */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: '前', pos: [0, 1.5, 4] as [number, number, number] },
              { label: '侧', pos: [4, 1.5, 0] as [number, number, number] },
              { label: '顶', pos: [0, 5, 0.01] as [number, number, number] },
              { label: '自', pos: [3, 2, 3] as [number, number, number] },
            ].map((view) => (
              <button
                key={view.label}
                type="button"
                onClick={() => {
                  props.setCameraPositionAxis(0, view.pos[0]);
                  props.setCameraPositionAxis(1, view.pos[1]);
                  props.setCameraPositionAxis(2, view.pos[2]);
                }}
                className="py-2 text-xs font-semibold text-slate-600 rounded-lg bg-white border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100"
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FOV */}
      {(stepId === 'camera-fov' || isFree) && (
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
      )}

      {/* 拍摄 */}
      {(stepId === 'camera-calibration' || isFree) && (
        <CapturePanel
          cameraState={props.cameraState}
          captureResult={props.captureResult}
          onCapture={props.onCapture}
          onResolutionChange={props.setCameraResolution}
        />
      )}

      {/* 自由模式完整控件 */}
      {isFree && (
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

      {/* 步骤确认按钮 */}
      {stepId === 'camera-model' && (
        <button
          type="button"
          className="w-full py-3 text-[13px] font-semibold rounded-xl text-white bg-gradient-to-r from-green-500 to-green-600 border border-green-600 shadow-sm hover:from-green-600 hover:to-green-700 flex items-center justify-center gap-2"
        >
          <Camera className="w-4 h-4" />
          我理解了相机模型
        </button>
      )}

      {stepId === 'camera-pose' && (
        <button
          type="button"
          onClick={() => props.resetCamera()}
          className="w-full py-3 text-[13px] font-semibold rounded-xl text-white bg-gradient-to-r from-green-500 to-green-600 border border-green-600 shadow-sm hover:from-green-600 hover:to-green-700 flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          重置相机视角
        </button>
      )}
    </div>
  );
}
