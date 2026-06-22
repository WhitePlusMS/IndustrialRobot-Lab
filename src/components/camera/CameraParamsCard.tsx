// src/components/camera/CameraParamsCard.tsx
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
  setPositionAxis: (axis: 0 | 1 | 2, value: number) => void;
  setRotationAxis: (axis: 0 | 1 | 2, value: number) => void;
  setFov: (v: number) => void;
  setNear: (v: number) => void;
  setFar: (v: number) => void;
  toggleFrustum: () => void;
  toggleModel: () => void;
  resetCamera: () => void;
  /** 相机总闸（用于禁用内部 checkbox） */
  showCamera: boolean;
  /** 是否显示镜头参数区（FOV/near/far），默认 true。Step 3 位姿调整传 false */
  showLensParams?: boolean;
  /** slider 拖拽时直接写 ref，不触发 React state */
  setPositionAxisTarget: (axis: 0 | 1 | 2, value: number) => void;
  setRotationAxisTarget: (axis: 0 | 1 | 2, value: number) => void;
  setFovTarget: (value: number) => void;
  setNearTarget: (value: number) => void;
  setFarTarget: (value: number) => void;
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

/**
 * 通用滑动条参数行
 * 参考 JointAngleCard 的交互：+/- 按钮、可点击编辑数值、range 滑块、范围提示
 * commit=false 表示拖动中，只更新本地显示；commit=true 表示最终同步到 React state
 */
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

  const clamp = useCallback((v: number) => Math.max(min, Math.min(max, v)), [min, max]);

  const applyValue = useCallback(
    (raw: string) => {
      const n = parseFloat(raw);
      if (!Number.isNaN(n)) {
        onChange(clamp(n), true);
      }
      setEditing(null);
    },
    [clamp, onChange]
  );

  const adjust = useCallback(
    (delta: number) => {
      // 按当前 step 规整后加减，避免浮点误差
      const next = Math.round((value + delta * step) / step) * step;
      onChange(clamp(next), true);
    },
    [clamp, onChange, step, value]
  );

  const displayValue = value.toFixed(decimals);

  return (
    <div className="space-y-1.5">
      {/* 按钮 + 数值 + 范围 */}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-medium text-slate-500 ${labelWidthClass}`}>{label}</span>
        <LongPressButton
          aria-label={`减小 ${ariaLabelPrefix}`}
          onClick={(isContinuous) => adjust(isContinuous ? -1 : -1)}
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
          onClick={(isContinuous) => adjust(isContinuous ? 1 : 1)}
          className="w-7 h-7 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-sm text-slate-700 hover:bg-slate-200 active:bg-blue-600 active:text-white active:border-blue-600 transition-colors"
        >
          <span className="pointer-events-none">+</span>
        </LongPressButton>
        <span className="text-[10px] text-slate-400 w-20 text-right truncate">
          {min}~{max}
        </span>
      </div>
      {/* 滑块：拖动中只提交本地显示，不触发 React state */}
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
  const { cameraState, posStep, rotStep, fovStep, showCamera } = props;
  const {
    setPositionAxis,
    setRotationAxis,
    setFov,
    setNear,
    setFar,
  } = props;

  // 根据 FOV 与分辨率近似计算内参矩阵（假设正方形像素、主点在图像中心）
  const [width, height] = cameraState.resolution;
  const fx = (width / 2) / Math.tan((cameraState.fov * Math.PI) / 360);
  const fy = fx;
  const cx = width / 2;
  const cy = height / 2;

  /**
   * 拖动中的本地覆盖值。
   * key: 'pos0' | 'pos1' | 'pos2' | 'rot0' | 'rot1' | 'rot2' | 'fov' | 'near' | 'far'
   */
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({});
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ key: string; value: number } | null>(null);

  // 将 slider 最终值同步回 React state 的辅助函数
  const flushSliderValue = useCallback(
    (key: string, value: number) => {
      if (key.startsWith('pos')) {
        const axis = Number(key.slice(3)) as 0 | 1 | 2;
        setPositionAxis(axis, value);
      } else if (key.startsWith('rot')) {
        const axis = Number(key.slice(3)) as 0 | 1 | 2;
        setRotationAxis(axis, value);
      } else if (key === 'fov') {
        setFov(value);
      } else if (key === 'near') {
        setNear(value);
      } else if (key === 'far') {
        setFar(value);
      }
    },
    [setPositionAxis, setRotationAxis, setFov, setNear, setFar]
  );

  // 组件卸载时取消未执行的 rAF
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // 拖动结束时把 ref 里的最终值同步回 React state，供 UI 和其他逻辑使用
  useEffect(() => {
    if (Object.keys(sliderValues).length === 0) return;

    const handlePointerUp = () => {
      // flush 未执行的 rAF 回退路径
      if (pendingRef.current) {
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        flushSliderValue(pending.key, pending.value);
      }

      // 把 slider 拖动的最终值同步回 React state
      Object.keys(sliderValues).forEach((key) => {
        flushSliderValue(key, sliderValues[key]);
      });
      setSliderValues({});
    };

    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, [sliderValues, flushSliderValue]);

  /**
   * 滑块拖动：只写 ref 和本地覆盖，不触发 React 渲染。
   * 3D 层 useFrame 读 ref 做插值；CameraParamsCard 本地显示读 sliderValues。
   */
  const scheduleUpdate = useCallback(
    (key: string, value: number) => {
      setSliderValues((prev) => ({ ...prev, [key]: value }));

      // 写 slider target ref
      if (key.startsWith('pos')) {
        props.setPositionAxisTarget(Number(key.slice(3)) as 0 | 1 | 2, value);
      } else if (key.startsWith('rot')) {
        props.setRotationAxisTarget(Number(key.slice(3)) as 0 | 1 | 2, value);
      } else if (key === 'fov') {
        props.setFovTarget(value);
      } else if (key === 'near') {
        props.setNearTarget(value);
      } else if (key === 'far') {
        props.setFarTarget(value);
      }

      // 无直连 target setter 时回退到 rAF 节流，避免事件风暴
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
    },
    [props, flushSliderValue]
  );

  // 获取显示值：拖动中优先用 sliderValues，否则用 cameraState
  const getDisplayValue = (key: string, stateValue: number) =>
    key in sliderValues ? sliderValues[key] : stateValue;

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
        {/* 内参矩阵只读展示 */}
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

        {/* 外参：位置与朝向 */}
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
                      props.setPositionAxis(i as 0 | 1 | 2, v);
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

          {/* 位置步进 */}
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

        {/* 朝向控制 */}
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
                      props.setRotationAxis(i as 0 | 1 | 2, v);
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

        {/* 镜头参数（可选：Step 3 位姿调整时隐藏） */}
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
                if (commit) props.setFov(v);
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
                if (commit) props.setNear(v);
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
                if (commit) props.setFar(v);
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

        {/* 显示控制 */}
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
