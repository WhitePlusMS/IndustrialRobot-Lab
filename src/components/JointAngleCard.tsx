// src/components/JointAngleCard.tsx
import { ChevronDown, ChevronUp, Shuffle, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { RobotConfig, JointAngles } from '@/types/robot';
import StepValueSelector from './StepValueSelector';
import LongPressButton from './LongPressButton';

interface JointAngleCardProps {
  joints: JointAngles;
  config: RobotConfig;
  jointStep: number;
  onJointStepChange: (v: number) => void;
  onAdjustJoint: (index: number, delta: number, isContinuous?: boolean) => void;
  onSetJoint?: (index: number, value: number) => void;
  sliderTargetRef: React.MutableRefObject<JointAngles>;
  onReset: () => void;
  onRandom: () => void;
}

export default function JointAngleCard({
  joints,
  config,
  jointStep,
  onJointStepChange,
  onAdjustJoint,
  onSetJoint,
  sliderTargetRef,
  onReset,
  onRandom,
}: JointAngleCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState<{ index: number; value: string } | null>(null);
  const [sliderValues, setSliderValues] = useState<Record<number, number>>({});
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ index: number; value: number } | null>(null);
  const dhValues = Object.values(config.dhParams);

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
      // 先把 pending 的 rAF 回退路径 flush 掉
      if (pendingRef.current) {
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        const base = joints[pending.index];
        onAdjustJoint(pending.index, pending.value - base, false);
      }

      // 把 slider 拖动的关节同步回 React state
      if (onSetJoint) {
        Object.keys(sliderValues).forEach((idxStr) => {
          const idx = Number(idxStr);
          onSetJoint(idx, sliderTargetRef.current[idx]);
        });
      }
      setSliderValues({});
    };

    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, [sliderValues, joints, onAdjustJoint, onSetJoint, sliderTargetRef]);

  // 滑块拖动：只写 ref，不触发 React 渲染；3D 层 useFrame 读 ref 做插值
  const scheduleUpdate = (index: number, value: number) => {
    setSliderValues((prev) => ({ ...prev, [index]: value }));
    sliderTargetRef.current[index] = value;

    if (!onSetJoint) {
      // 无直连 setter 时回退到 rAF 节流，避免事件风暴
      pendingRef.current = { index, value };
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          const pending = pendingRef.current;
          rafRef.current = null;
          pendingRef.current = null;
          if (!pending) return;
          const base = joints[pending.index];
          onAdjustJoint(pending.index, pending.value - base, false);
        });
      }
    }
  };

  // 手动输入角度：回车或失焦时应用
  const applyManualValue = (index: number) => {
    if (!editing || editing.index !== index) return;
    const v = parseFloat(editing.value);
    if (!Number.isNaN(v)) {
      sliderTargetRef.current[index] = v;
      if (onSetJoint) {
        onSetJoint(index, v);
      } else {
        onAdjustJoint(index, v - joints[index], false);
      }
    }
    setEditing(null);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/80 border-b border-slate-100 hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        aria-expanded={!collapsed}
      >
        <span className="text-sm font-semibold text-slate-700">关节角度</span>
        {collapsed ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-500" />}
      </button>
      {!collapsed && (
        <div className="p-4 space-y-3">
          {joints.map((angle, i) => {
            const range = dhValues[i].thetaRange;
            const displayAngle = i in sliderValues ? sliderValues[i] : angle;
            const isOutOfRange = displayAngle < range[0] - 0.01 || displayAngle > range[1] + 0.01;
            return (
              <div key={i} className="space-y-1.5">
                {/* 按钮 + 数值 + 范围 */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-500 w-8">J{i + 1}</span>
                  <LongPressButton
                    aria-label={`减小 J${i + 1} 角度`}
                    onClick={(isContinuous) => onAdjustJoint(i, -1, isContinuous)}
                    className="w-7 h-7 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-sm text-slate-700 hover:bg-slate-200 active:bg-blue-600 active:text-white active:border-blue-600 transition-colors"
                  >
                    <span className="pointer-events-none">−</span>
                  </LongPressButton>
                  {editing?.index === i ? (
                    <div className="w-14 flex items-center justify-center">
                      <input
                        type="number"
                        step={0.1}
                        value={editing.value}
                        onChange={(e) => setEditing({ index: i, value: e.target.value })}
                        onBlur={() => applyManualValue(i)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            applyManualValue(i);
                          } else if (e.key === 'Escape') {
                            setEditing(null);
                          }
                        }}
                        autoFocus
                        className={`w-12 text-sm font-mono tabular-nums font-medium text-center bg-white border-b-2 focus:outline-none ${
                          isOutOfRange ? 'text-red-500 border-red-400' : 'text-slate-800 border-blue-500'
                        }`}
                      />
                      <span className={`text-sm ${isOutOfRange ? 'text-red-500' : 'text-slate-800'}`}>°</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditing({ index: i, value: angle.toFixed(1) })}
                      className={`text-sm font-mono tabular-nums font-medium w-14 text-center rounded px-1 py-0.5 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        isOutOfRange ? 'text-red-500' : 'text-slate-800'
                      }`}
                      aria-label={`编辑 J${i + 1} 角度`}
                    >
                      {displayAngle.toFixed(1)}°
                    </button>
                  )}
                  <LongPressButton
                    aria-label={`增大 J${i + 1} 角度`}
                    onClick={(isContinuous) => onAdjustJoint(i, 1, isContinuous)}
                    className="w-7 h-7 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-sm text-slate-700 hover:bg-slate-200 active:bg-blue-600 active:text-white active:border-blue-600 transition-colors"
                  >
                    <span className="pointer-events-none">+</span>
                  </LongPressButton>
                  <span className="text-[10px] text-slate-400 w-20 text-right truncate">
                    {range[0]}~{range[1]}
                  </span>
                </div>
                {/* 滑块：实时更新，rAF 节流 */}
                <input
                  type="range"
                  min={range[0]}
                  max={range[1]}
                  step={0.1}
                  value={displayAngle}
                  onChange={(e) => scheduleUpdate(i, parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  aria-label={`J${i + 1} 角度滑块`}
                />
              </div>
            );
          })}

          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-500">步进:</span>
            <StepValueSelector values={[0.1, 1, 5, 10]} unit="°" current={jointStep} onChange={onJointStepChange} />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onReset}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-sm hover:bg-slate-200 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              重置
            </button>
            <button
              type="button"
              onClick={onRandom}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-sm hover:bg-slate-200 transition-colors"
            >
              <Shuffle className="w-3 h-3" />
              随机
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
