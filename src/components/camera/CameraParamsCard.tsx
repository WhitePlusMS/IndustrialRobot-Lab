import { useState, useCallback, useRef, useEffect } from 'react';
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
  applyCameraPatch: (
    patch: Partial<Pick<CameraState, 'position' | 'rotation' | 'fov' | 'near' | 'far'>>,
    options?: { commit?: boolean }
  ) => void;
  toggleFrustum: () => void;
  toggleModel: () => void;
  resetCamera: () => void;
  showCamera: boolean;
  showLensParams?: boolean;
}

const axisLabels = ['X', 'Y', 'Z'];
const rotLabels = ['Rx', 'Ry', 'Rz'];

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  decimals: number;
  onChange: (value: number, commit: boolean) => void;
  ariaLabelPrefix: string;
  labelWidthClass?: string;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  decimals,
  onChange,
  ariaLabelPrefix,
  labelWidthClass = 'w-8',
}: SliderRowProps) {
  const [editing, setEditing] = useState<{ value: string } | null>(null);

  const clamp = useCallback((v: number) => Math.max(min, Math.min(max, v)), [max, min]);

  const applyValue = useCallback((raw: string) => {
    const n = parseFloat(raw);
    if (!Number.isNaN(n)) {
      onChange(clamp(n), true);
    }
    setEditing(null);
  }, [clamp, onChange]);

  const adjust = useCallback((delta: number) => {
    const next = Math.round((value + delta * step) / step) * step;
    onChange(clamp(next), true);
  }, [clamp, onChange, step, value]);

  const displayValue = value.toFixed(decimals);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-medium text-slate-500 ${labelWidthClass}`}>{label}</span>
        <LongPressButton
          aria-label={`减小 ${ariaLabelPrefix}`}
          onClick={() => adjust(-1)}
          className="w-7 h-7 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-sm text-slate-700 hover:bg-slate-200 active:bg-blue-600 active:text-white active:border-blue-600 transition-colors"
        >
          <span className="pointer-events-none">−</span>
        </LongPressButton>
        {editing ? (
          <div className="w-14 flex items-center justify-center">
            <input
              type="number"
              step={step}
              value={editing.value}
              onChange={(e) => setEditing({ value: e.target.value })}
              onBlur={() => applyValue(editing.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  applyValue(editing.value);
                } else if (e.key === 'Escape') {
                  setEditing(null);
                }
              }}
              autoFocus
              className="w-12 text-sm font-mono tabular-nums font-medium text-center bg-white border-b-2 border-blue-500 text-slate-800 focus:outline-none"
            />
            <span className="text-sm text-slate-800">{unit}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing({ value: displayValue })}
            className="text-sm font-mono tabular-nums font-medium w-14 text-center rounded px-1 py-0.5 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 text-slate-800"
            aria-label={`编辑 ${ariaLabelPrefix}`}
          >
            {displayValue}
            {unit}
          </button>
        )}
        <LongPressButton
          aria-label={`增大 ${ariaLabelPrefix}`}
          onClick={() => adjust(1)}
          className="w-7 h-7 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-sm text-slate-700 hover:bg-slate-200 active:bg-blue-600 active:text-white active:border-blue-600 transition-colors"
        >
          <span className="pointer-events-none">+</span>
        </LongPressButton>
        <span className="text-[10px] text-slate-400 w-20 text-right truncate">
          {min}~{max}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(clamp(parseFloat(e.target.value)), false)}
        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        aria-label={`${ariaLabelPrefix} 滑块`}
      />
    </div>
  );
}

export default function CameraParamsCard(props: CameraParamsCardProps) {
  const { cameraState, posStep, rotStep, fovStep, showCamera, applyCameraPatch } = props;
  const [width, height] = cameraState.resolution;
  const fx = (width / 2) / Math.tan((cameraState.fov * Math.PI) / 360);
  const fy = fx;
  const cx = width / 2;
  const cy = height / 2;

  const [sliderValues, setSliderValues] = useState<Record<string, number>>({});
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ key: string; value: number } | null>(null);

  const flushSliderValue = useCallback((key: string, value: number) => {
    if (key.startsWith('pos')) {
      const axis = Number(key.slice(3)) as 0 | 1 | 2;
      const position = [...cameraState.position] as [number, number, number];
      position[axis] = value;
      applyCameraPatch({ position }, { commit: true });
      return;
    }

    if (key.startsWith('rot')) {
      const axis = Number(key.slice(3)) as 0 | 1 | 2;
      const rotation = [...cameraState.rotation] as [number, number, number];
      rotation[axis] = value;
      applyCameraPatch({ rotation }, { commit: true });
      return;
    }

    applyCameraPatch({ [key]: value } as Partial<Pick<CameraState, 'fov' | 'near' | 'far'>>, { commit: true });
  }, [applyCameraPatch, cameraState.position, cameraState.rotation]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (Object.keys(sliderValues).length === 0) return;

    const handlePointerUp = () => {
      if (pendingRef.current) {
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        flushSliderValue(pending.key, pending.value);
      }

      Object.keys(sliderValues).forEach((key) => {
        flushSliderValue(key, sliderValues[key]);
      });
      setSliderValues({});
    };

    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, [flushSliderValue, sliderValues]);

  const scheduleUpdate = useCallback((key: string, value: number) => {
    setSliderValues((prev) => ({ ...prev, [key]: value }));

    if (key.startsWith('pos')) {
      const axis = Number(key.slice(3)) as 0 | 1 | 2;
      const position = [...cameraState.position] as [number, number, number];
      position[axis] = value;
      applyCameraPatch({ position }, { commit: false });
    } else if (key.startsWith('rot')) {
      const axis = Number(key.slice(3)) as 0 | 1 | 2;
      const rotation = [...cameraState.rotation] as [number, number, number];
      rotation[axis] = value;
      applyCameraPatch({ rotation }, { commit: false });
    } else {
      applyCameraPatch({ [key]: value } as Partial<Pick<CameraState, 'fov' | 'near' | 'far'>>, { commit: false });
    }

    pendingRef.current = { key, value };
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        const pending = pendingRef.current;
        rafRef.current = null;
        pendingRef.current = null;
        if (!pending) return;
        flushSliderValue(pending.key, pending.value);
      });
    }
  }, [applyCameraPatch, cameraState.position, cameraState.rotation, flushSliderValue]);

  const getDisplayValue = (key: string, stateValue: number) => (key in sliderValues ? sliderValues[key] : stateValue);

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

      <div className="p-4 space-y-4">
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <div className="text-[11px] font-semibold text-slate-500 mb-1">内参矩阵 K</div>
          <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
            内参反映相机自身特性，由 FOV 和分辨率决定，本区域只读。
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
            由 FOV {cameraState.fov.toFixed(1)}° 与分辨率 {width}×{height} 近似计算
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold text-slate-700 mb-1">外参（相机在世界坐标系中的位姿）</div>
          <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
            外参对应旋转矩阵和平移向量，调节这些参数会改变相机看到的内容。
          </p>

          <div className="text-[11px] font-semibold text-slate-500 mb-2">位置 (m)</div>
          <div className="space-y-3">
            {axisLabels.map((label, i) => {
              const key = `pos${i}`;
              return (
                <SliderRow
                  key={label}
                  label={label}
                  value={getDisplayValue(key, cameraState.position[i])}
                  min={-5}
                  max={5}
                  step={posStep}
                  unit="m"
                  decimals={2}
                  onChange={(v, commit) => {
                    if (commit) {
                      const position = [...cameraState.position] as [number, number, number];
                      position[i] = v;
                      applyCameraPatch({ position }, { commit: true });
                    } else {
                      scheduleUpdate(key, v);
                    }
                  }}
                  ariaLabelPrefix={`相机位置 ${label}`}
                  labelWidthClass="w-4"
                />
              );
            })}
          </div>

          <div className="flex items-center gap-1 mt-2">
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

        <div>
          <div className="text-[11px] font-semibold text-slate-500 mb-2">朝向 (°)</div>
          <div className="space-y-3">
            {rotLabels.map((label, i) => {
              const key = `rot${i}`;
              return (
                <SliderRow
                  key={label}
                  label={label}
                  value={getDisplayValue(key, cameraState.rotation[i])}
                  min={-360}
                  max={360}
                  step={rotStep}
                  unit="°"
                  decimals={1}
                  onChange={(v, commit) => {
                    if (commit) {
                      const rotation = [...cameraState.rotation] as [number, number, number];
                      rotation[i] = v;
                      applyCameraPatch({ rotation }, { commit: true });
                    } else {
                      scheduleUpdate(key, v);
                    }
                  }}
                  ariaLabelPrefix={`相机朝向 ${label}`}
                  labelWidthClass="w-5"
                />
              );
            })}
          </div>

          <div className="flex items-center gap-1 mt-2">
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

        {props.showLensParams !== false && (
          <div>
            <div className="text-[11px] font-semibold text-slate-500 mb-2">镜头参数</div>
            <div className="space-y-3">
              <SliderRow
                label="FOV"
                value={getDisplayValue('fov', cameraState.fov)}
                min={10}
                max={120}
                step={fovStep}
                unit="°"
                decimals={1}
                onChange={(v, commit) => {
                  if (commit) applyCameraPatch({ fov: v }, { commit: true });
                  else scheduleUpdate('fov', v);
                }}
                ariaLabelPrefix="FOV 视场角"
              />
              <SliderRow
                label="近"
                value={getDisplayValue('near', cameraState.near)}
                min={0.01}
                max={1}
                step={0.01}
                unit="m"
                decimals={2}
                onChange={(v, commit) => {
                  if (commit) applyCameraPatch({ near: v }, { commit: true });
                  else scheduleUpdate('near', v);
                }}
                ariaLabelPrefix="近裁剪面"
              />
              <SliderRow
                label="远"
                value={getDisplayValue('far', cameraState.far)}
                min={1}
                max={100}
                step={1}
                unit="m"
                decimals={1}
                onChange={(v, commit) => {
                  if (commit) applyCameraPatch({ far: v }, { commit: true });
                  else scheduleUpdate('far', v);
                }}
                ariaLabelPrefix="远裁剪面"
              />
            </div>

            <div className="flex items-center gap-1 mt-2">
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
        )}

        <div className="flex items-center gap-4 pt-1">
          <label className={`flex items-center gap-1.5 ${!showCamera ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={cameraState.showFrustum}
              onChange={props.toggleFrustum}
              disabled={!showCamera}
              className="w-3.5 h-3.5 rounded border-slate-200 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-[11px] text-slate-700">显示视野锥</span>
          </label>
          <label className={`flex items-center gap-1.5 ${!showCamera ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={cameraState.showModel}
              onChange={props.toggleModel}
              disabled={!showCamera}
              className="w-3.5 h-3.5 rounded border-slate-200 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-[11px] text-slate-700">显示相机模型</span>
          </label>
        </div>
      </div>
    </div>
  );
}
