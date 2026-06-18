// src/components/PositionTargetCard.tsx
// 笛卡尔空间绝对定位：输入目标坐标，IK解算后驱动机械臂末端到达指定位置
import { useState, useCallback, useRef } from 'react';
import { Crosshair } from 'lucide-react';

interface PositionTargetCardProps {
  currentGLBPosition: [number, number, number] | null;
  onGoToPosition: (x: number, y: number, z: number) => boolean;
  disabled?: boolean;
}

/** 格式化为mm显示 */
function fmtMm(v: number): string {
  return (v * 1000).toFixed(0);
}

export default function PositionTargetCard({
  currentGLBPosition,
  onGoToPosition,
  disabled = false,
}: PositionTargetCardProps) {
  // 输入值单位：米（与GLB模型坐标一致）
  const [inputX, setInputX] = useState('');
  const [inputY, setInputY] = useState('');
  const [inputZ, setInputZ] = useState('');
  const [feedback, setFeedback] = useState<'idle' | 'success' | 'failed'>('idle');
  const [feedbackText, setFeedbackText] = useState('');
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 点击当前位姿的"填入"按钮时，将当前GLB坐标填入输入框
  const fillCurrent = useCallback(() => {
    if (currentGLBPosition) {
      setInputX(currentGLBPosition[0].toFixed(4));
      setInputY(currentGLBPosition[1].toFixed(4));
      setInputZ(currentGLBPosition[2].toFixed(4));
    }
  }, [currentGLBPosition]);

  const handleGo = useCallback(() => {
    const x = parseFloat(inputX);
    const y = parseFloat(inputY);
    const z = parseFloat(inputZ);
    if (isNaN(x) || isNaN(y) || isNaN(z)) return;

    const ok = onGoToPosition(x, y, z);
    setFeedback(ok ? 'success' : 'failed');
    setFeedbackText(ok ? '运动成功' : '目标不可达');
    if (feedbackTimeout.current) {
      clearTimeout(feedbackTimeout.current);
    }
    feedbackTimeout.current = setTimeout(() => {
      setFeedback('idle');
      setFeedbackText('');
    }, 1500);
  }, [inputX, inputY, inputZ, onGoToPosition]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleGo();
  }, [handleGo]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100">
        <span className="text-sm font-semibold text-slate-700">笛卡尔空间定位</span>
      </div>
      <div className="p-4 space-y-3">
        {/* 当前GLB坐标 */}
        <div className="text-xs text-slate-500 space-y-1">
          <div className="flex items-center justify-between">
            <span>当前 GLB 坐标 (mm):</span>
            <button
              type="button"
              onClick={fillCurrent}
              disabled={disabled || !currentGLBPosition}
              className="text-[10px] px-1.5 py-0.5 bg-white border border-slate-200 text-slate-700 rounded-sm hover:bg-slate-50 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            >
              填入
            </button>
          </div>
          {currentGLBPosition ? (
            <div className="font-mono text-slate-800">
              X:{fmtMm(currentGLBPosition[0])} Y:{fmtMm(currentGLBPosition[1])} Z:{fmtMm(currentGLBPosition[2])}
            </div>
          ) : (
            <div className="text-slate-400">加载中…</div>
          )}
        </div>

        {/* 目标坐标输入 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 w-4" htmlFor="target-x">X</label>
            <input
              id="target-x"
              type="number"
              inputMode="decimal"
              autoComplete="off"
              step="0.001"
              value={inputX}
              onChange={(e) => setInputX(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="-1.1348"
              className="flex-1 px-2 py-1 text-xs font-mono border border-slate-200 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              disabled={disabled}
              aria-label="目标 X 坐标"
            />
            <span className="text-[10px] text-slate-400">m</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 w-4" htmlFor="target-y">Y</label>
            <input
              id="target-y"
              type="number"
              inputMode="decimal"
              autoComplete="off"
              step="0.001"
              value={inputY}
              onChange={(e) => setInputY(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="1.3166"
              className="flex-1 px-2 py-1 text-xs font-mono border border-slate-200 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              disabled={disabled}
              aria-label="目标 Y 坐标"
            />
            <span className="text-[10px] text-slate-400">m</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 w-4" htmlFor="target-z">Z</label>
            <input
              id="target-z"
              type="number"
              inputMode="decimal"
              autoComplete="off"
              step="0.001"
              value={inputZ}
              onChange={(e) => setInputZ(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="0.0559"
              className="flex-1 px-2 py-1 text-xs font-mono border border-slate-200 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              disabled={disabled}
              aria-label="目标 Z 坐标"
            />
            <span className="text-[10px] text-slate-400">m</span>
          </div>
        </div>

        {/* Go 按钮 */}
        <button
          type="button"
          onClick={handleGo}
          disabled={disabled || !inputX || !inputY || !inputZ}
          className={`w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
            feedback === 'success'
              ? 'bg-green-600 text-white'
              : feedback === 'failed'
                ? 'bg-red-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          aria-label={feedbackText || '运动到此点'}
        >
          <Crosshair className="w-3.5 h-3.5" />
          运动到此点
        </button>
        <span className="sr-only top-0 left-0 mt-0" aria-live="polite">{feedbackText}</span>
      </div>
    </div>
  );
}
