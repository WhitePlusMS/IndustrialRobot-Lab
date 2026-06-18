// src/components/camera/CameraParamsCard.tsx
import { useCallback } from 'react';
import type { CameraState } from '@/types/camera';
import LongPressButton from '@/components/LongPressButton';

interface CameraParamsCardProps {
  cameraState: CameraState;
  posStep: number;
  onPosStepChange: (v: number) => void;
  rotStep: number;
  onRotStepChange: (v: number) => void;
  fovStep: number;
  onFovStepChange: (v: number) => void;
  setPositionAxis: (axis: 0 | 1 | 2, value: number) => void;
  setRotationAxis: (axis: 0 | 1 | 2, value: number) => void;
  setFov: (v: number) => void;
  setNear: (v: number) => void;
  setFar: (v: number) => void;
  toggleFrustum: () => void;
  toggleModel: () => void;
  resetCamera: () => void;
}

const axisLabels = ['X', 'Y', 'Z'];
const rotLabels = ['Rx', 'Ry', 'Rz'];

export default function CameraParamsCard(props: CameraParamsCardProps) {
  const { cameraState, posStep, rotStep, fovStep } = props;

  const handlePosChange = useCallback(
    (axis: 0 | 1 | 2, val: string) => {
      const n = parseFloat(val);
      if (!isNaN(n)) props.setPositionAxis(axis, n);
    },
    [props]
  );

  const handleRotChange = useCallback(
    (axis: 0 | 1 | 2, val: string) => {
      const n = parseFloat(val);
      if (!isNaN(n)) props.setRotationAxis(axis, n);
    },
    [props]
  );

  const adjustPos = useCallback(
    (axis: 0 | 1 | 2, delta: number) => {
      const current = cameraState.position[axis];
      props.setPositionAxis(axis, current + delta * posStep);
    },
    [cameraState, posStep, props]
  );

  const adjustRot = useCallback(
    (axis: 0 | 1 | 2, delta: number) => {
      const current = cameraState.rotation[axis];
      props.setRotationAxis(axis, current + delta * rotStep);
    },
    [cameraState, rotStep, props]
  );

  const adjustFov = useCallback(
    (delta: number) => {
      props.setFov(cameraState.fov + delta * fovStep);
    },
    [cameraState, fovStep, props]
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">相机参数</h3>
        <button
          type="button"
          onClick={props.resetCamera}
          className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200 hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        >
          重置
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* 位置控制 */}
        <div>
          <div className="text-[11px] font-semibold text-slate-500 mb-1.5">位置 (m)</div>
          <div className="space-y-1.5">
            {axisLabels.map((label, i) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-slate-700 w-4">{label}</span>
                <LongPressButton
                  aria-label={`减小相机位置 ${label}`}
                  onClick={() => adjustPos(i as 0 | 1 | 2, -1)}
                  className="w-6 h-6 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-sm text-slate-700 hover:bg-slate-200 active:bg-blue-600 active:text-white text-xs"
                >
                  <span className="pointer-events-none">−</span>
                </LongPressButton>
                <input
                  type="number"
                  inputMode="decimal"
                  autoComplete="off"
                  value={cameraState.position[i].toFixed(3)}
                  onChange={(e) => handlePosChange(i as 0 | 1 | 2, e.target.value)}
                  className="flex-1 min-w-0 h-6 px-1.5 text-xs font-mono border border-slate-200 rounded-sm bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  step={posStep}
                  aria-label={`相机位置 ${label}`}
                />
                <span className="text-[10px] text-slate-400 w-4 shrink-0">m</span>
                <LongPressButton
                  aria-label={`增大相机位置 ${label}`}
                  onClick={() => adjustPos(i as 0 | 1 | 2, 1)}
                  className="w-6 h-6 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-sm text-slate-700 hover:bg-slate-200 active:bg-blue-600 active:text-white text-xs"
                >
                  <span className="pointer-events-none">+</span>
                </LongPressButton>
              </div>
            ))}
          </div>

          {/* 位置步进 */}
          <div className="flex items-center gap-1 mt-1.5">
            <span className="text-[10px] text-slate-500">步进:</span>
            {[0.01, 0.05, 0.1, 0.5].map((v) => (
              <button
                type="button"
                key={v}
                aria-pressed={posStep === v}
                onClick={() => props.onPosStepChange(v)}
                className={`px-1.5 py-0.5 text-[10px] rounded-sm border focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                  posStep === v
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {v}
              </button>
            ))}
            <span className="text-[10px] text-slate-400">m</span>
          </div>
        </div>

        {/* 朝向控制 */}
        <div>
          <div className="text-[11px] font-semibold text-slate-500 mb-1.5">朝向 (°)</div>
          <div className="space-y-1.5">
            {rotLabels.map((label, i) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-slate-700 w-5">{label}</span>
                <LongPressButton
                  aria-label={`减小相机朝向 ${label}`}
                  onClick={() => adjustRot(i as 0 | 1 | 2, -1)}
                  className="w-6 h-6 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-sm text-slate-700 hover:bg-slate-200 active:bg-blue-600 active:text-white text-xs"
                >
                  <span className="pointer-events-none">−</span>
                </LongPressButton>
                <input
                  type="number"
                  inputMode="decimal"
                  autoComplete="off"
                  value={cameraState.rotation[i].toFixed(1)}
                  onChange={(e) => handleRotChange(i as 0 | 1 | 2, e.target.value)}
                  className="flex-1 min-w-0 h-6 px-1.5 text-xs font-mono border border-slate-200 rounded-sm bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  step={rotStep}
                  aria-label={`相机朝向 ${label}`}
                />
                <span className="text-[10px] text-slate-400 w-4 shrink-0">°</span>
                <LongPressButton
                  aria-label={`增大相机朝向 ${label}`}
                  onClick={() => adjustRot(i as 0 | 1 | 2, 1)}
                  className="w-6 h-6 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-sm text-slate-700 hover:bg-slate-200 active:bg-blue-600 active:text-white text-xs"
                >
                  <span className="pointer-events-none">+</span>
                </LongPressButton>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1 mt-1.5">
            <span className="text-[10px] text-slate-500">步进:</span>
            {[1, 5, 10, 30].map((v) => (
              <button
                type="button"
                key={v}
                aria-pressed={rotStep === v}
                onClick={() => props.onRotStepChange(v)}
                className={`px-1.5 py-0.5 text-[10px] rounded-sm border focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                  rotStep === v
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {v}
              </button>
            ))}
            <span className="text-[10px] text-slate-400">°</span>
          </div>
        </div>

        {/* 镜头参数 */}
        <div>
          <div className="text-[11px] font-semibold text-slate-500 mb-1.5">镜头参数</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-slate-700 w-8">FOV</span>
              <LongPressButton
                aria-label="减小 FOV"
                onClick={() => adjustFov(-1)}
                className="w-6 h-6 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-sm text-slate-700 hover:bg-slate-200 active:bg-blue-600 active:text-white text-xs"
              >
                <span className="pointer-events-none">−</span>
              </LongPressButton>
              <input
                type="number"
                inputMode="decimal"
                autoComplete="off"
                value={cameraState.fov.toFixed(1)}
                onChange={(e) => props.setFov(parseFloat(e.target.value) || 60)}
                className="flex-1 min-w-0 h-6 px-1.5 text-xs font-mono border border-slate-200 rounded-sm bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                step={fovStep}
                aria-label="FOV 视场角"
              />
              <span className="text-[10px] text-slate-400 w-4">°</span>
              <LongPressButton
                aria-label="增大 FOV"
                onClick={() => adjustFov(1)}
                className="w-6 h-6 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-sm text-slate-700 hover:bg-slate-200 active:bg-blue-600 active:text-white text-xs"
              >
                <span className="pointer-events-none">+</span>
              </LongPressButton>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-slate-700 w-8" title="近裁剪面">近</span>
              <input
                type="number"
                inputMode="decimal"
                autoComplete="off"
                value={cameraState.near.toFixed(2)}
                onChange={(e) => props.setNear(parseFloat(e.target.value) || 0.1)}
                className="flex-1 min-w-0 h-6 px-1.5 text-xs font-mono border border-slate-200 rounded-sm bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                step={0.01}
                min={0.01}
                max={1}
                aria-label="近裁剪面"
              />
              <span className="text-[10px] text-slate-400 w-4 shrink-0">m</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-slate-700 w-8" title="远裁剪面">远</span>
              <input
                type="number"
                inputMode="decimal"
                autoComplete="off"
                value={cameraState.far.toFixed(1)}
                onChange={(e) => props.setFar(parseFloat(e.target.value) || 10)}
                className="flex-1 min-w-0 h-6 px-1.5 text-xs font-mono border border-slate-200 rounded-sm bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                step={1}
                min={1}
                max={100}
                aria-label="远裁剪面"
              />
              <span className="text-[10px] text-slate-400 w-4 shrink-0">m</span>
            </div>
          </div>

          <div className="flex items-center gap-1 mt-1.5">
            <span className="text-[10px] text-slate-500">步进:</span>
            {[1, 5, 10, 30].map((v) => (
              <button
                type="button"
                key={v}
                aria-pressed={fovStep === v}
                onClick={() => props.onFovStepChange(v)}
                className={`px-1.5 py-0.5 text-[10px] rounded-sm border focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                  fovStep === v
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {v}
              </button>
            ))}
            <span className="text-[10px] text-slate-400">°</span>
          </div>
        </div>

        {/* 显示控制 */}
        <div className="flex items-center gap-4 pt-1">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={cameraState.showFrustum}
              onChange={props.toggleFrustum}
              className="w-3.5 h-3.5 rounded border-slate-200 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-[11px] text-slate-700">显示视野锥</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={cameraState.showModel}
              onChange={props.toggleModel}
              className="w-3.5 h-3.5 rounded border-slate-200 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-[11px] text-slate-700">显示相机模型</span>
          </label>
        </div>
      </div>
    </div>
  );
}
