// 笛卡尔空间绝对定位：输入目标坐标与姿态，IK 解算后驱动机械臂末端到达指定位姿
import { useState, useCallback, useRef } from 'react';
import { Crosshair } from 'lucide-react';

interface PositionTargetCardProps {
  currentGLBPosition: [number, number, number] | null;
  onGoToPosition: (x: number, y: number, z: number, rx?: number, ry?: number, rz?: number) => boolean;
  disabled?: boolean;
}

/** 格式化为 mm 显示 */
function fmtMm(v: number): string {
  return (v * 1000).toFixed(0);
}

export default function PositionTargetCard({
  currentGLBPosition,
  onGoToPosition,
  disabled = false,
}: PositionTargetCardProps) {
  // 输入值单位：毫米（mm），提交时转换为米；姿态输入单位：°
  const [inputX, setInputX] = useState('');
  const [inputY, setInputY] = useState('');
  const [inputZ, setInputZ] = useState('');
  const [inputRx, setInputRx] = useState('');
  const [inputRy, setInputRy] = useState('');
  const [inputRz, setInputRz] = useState('');
  const [feedback, setFeedback] = useState<'idle' | 'success' | 'failed'>('idle');
  const [feedbackText, setFeedbackText] = useState('');
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 点击当前位姿的"填入"按钮时，将当前 GLB 坐标（m）转换为 mm 填入输入框
  const fillCurrent = useCallback(() => {
    if (currentGLBPosition) {
      setInputX(fmtMm(currentGLBPosition[0]));
      setInputY(fmtMm(currentGLBPosition[1]));
      setInputZ(fmtMm(currentGLBPosition[2]));
    }
  }, [currentGLBPosition]);

  const handleGo = useCallback(() => {
    const x = parseFloat(inputX);
    const y = parseFloat(inputY);
    const z = parseFloat(inputZ);
    if (isNaN(x) || isNaN(y) || isNaN(z)) return;

    const rx = inputRx ? parseFloat(inputRx) : undefined;
    const ry = inputRy ? parseFloat(inputRy) : undefined;
    const rz = inputRz ? parseFloat(inputRz) : undefined;

    // 输入为 mm，调用回调前转换为 m
    const ok = onGoToPosition(x / 1000, y / 1000, z / 1000, rx, ry, rz);
    setFeedback(ok ? 'success' : 'failed');
    setFeedbackText(ok ? '运动成功' : '目标不可达');
    if (feedbackTimeout.current) {
      clearTimeout(feedbackTimeout.current);
    }
    feedbackTimeout.current = setTimeout(() => {
      setFeedback('idle');
      setFeedbackText('');
    }, 1500);
  }, [inputX, inputY, inputZ, inputRx, inputRy, inputRz, onGoToPosition]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleGo();
    },
    [handleGo]
  );

  const renderInput = (
    label: string,
    value: string,
    setter: (v: string) => void,
    unit: string,
    placeholder: string,
    ariaLabel: string
  ) => (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-slate-500 w-5" htmlFor={`target-${label.toLowerCase()}`}>
        {label}
      </label>
      <input
        id={`target-${label.toLowerCase()}`}
        type="number"
        inputMode="decimal"
        autoComplete="off"
        step="1"
        value={value}
        onChange={(e) => setter(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1 px-2 py-1 text-xs font-mono border border-slate-200 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        disabled={disabled}
        aria-label={ariaLabel}
      />
      <span className="text-[10px] text-slate-400 w-5 text-right">{unit}</span>
    </div>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100">
        <span className="text-sm font-semibold text-slate-700">笛卡尔空间定位</span>
      </div>
      <div className="p-4 space-y-3">
        {/* 当前 GLB 坐标 */}
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
          <p className="text-[11px] text-slate-500">目标坐标单位为毫米（mm），与当前坐标显示一致。</p>
          {renderInput('X', inputX, setInputX, 'mm', '400', '目标 X 坐标')}
          {renderInput('Y', inputY, setInputY, 'mm', '300', '目标 Y 坐标')}
          {renderInput('Z', inputZ, setInputZ, 'mm', '250', '目标 Z 坐标')}
        </div>

        {/* 目标姿态输入（可选） */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <p className="text-[11px] text-slate-400">目标姿态（可选，留空保持当前姿态）</p>
          {renderInput('Rx', inputRx, setInputRx, '°', '0', '目标 Rx 姿态')}
          {renderInput('Ry', inputRy, setInputRy, '°', '0', '目标 Ry 姿态')}
          {renderInput('Rz', inputRz, setInputRz, '°', '0', '目标 Rz 姿态')}
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
          aria-label={feedbackText || '移动到目标点'}
        >
          <Crosshair className="w-3.5 h-3.5" />
          移动到目标点
        </button>
        <span className="sr-only top-0 left-0 mt-0" aria-live="polite">
          {feedbackText}
        </span>
      </div>
    </div>
  );
}
