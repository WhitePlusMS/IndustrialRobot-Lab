// src/components/PositionTargetCard.tsx
// 笛卡尔空间绝对定位：输入目标坐标，IK解算后驱动机械臂末端到达指定位置
import { useState, useCallback } from 'react';
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
    setTimeout(() => setFeedback('idle'), 1500);
  }, [inputX, inputY, inputZ, onGoToPosition]);

  return (
    <div className="bg-white border border-[#D1D5DB] rounded-sm">
      <div className="px-3 py-2 bg-[#F9FAFB] border-b border-[#E5E7EB]">
        <span className="text-sm font-semibold text-[#1E293B]">笛卡尔空间定位</span>
      </div>
      <div className="p-3 space-y-3">
        {/* 当前GLB坐标 */}
        <div className="text-xs text-[#64748B] space-y-1">
          <div className="flex items-center justify-between">
            <span>当前 GLB 坐标 (mm):</span>
            <button
              onClick={fillCurrent}
              disabled={disabled || !currentGLBPosition}
              className="text-[10px] px-1.5 py-0.5 border border-[#D1D5DB] rounded-sm hover:bg-[#F3F4F6] disabled:opacity-40"
            >
              填入
            </button>
          </div>
          {currentGLBPosition ? (
            <div className="font-mono text-[#1E293B]">
              X:{fmtMm(currentGLBPosition[0])} Y:{fmtMm(currentGLBPosition[1])} Z:{fmtMm(currentGLBPosition[2])}
            </div>
          ) : (
            <div className="text-[#94A3B8]">加载中…</div>
          )}
        </div>

        {/* 目标坐标输入 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#64748B] w-4">X</span>
            <input
              type="number"
              step="0.001"
              value={inputX}
              onChange={(e) => setInputX(e.target.value)}
              placeholder="-1.1348"
              className="flex-1 px-2 py-1 text-xs font-mono border border-[#D1D5DB] rounded-sm focus:outline-none focus:border-[#2563EB]"
              disabled={disabled}
            />
            <span className="text-[10px] text-[#94A3B8]">m</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#64748B] w-4">Y</span>
            <input
              type="number"
              step="0.001"
              value={inputY}
              onChange={(e) => setInputY(e.target.value)}
              placeholder="1.3166"
              className="flex-1 px-2 py-1 text-xs font-mono border border-[#D1D5DB] rounded-sm focus:outline-none focus:border-[#2563EB]"
              disabled={disabled}
            />
            <span className="text-[10px] text-[#94A3B8]">m</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#64748B] w-4">Z</span>
            <input
              type="number"
              step="0.001"
              value={inputZ}
              onChange={(e) => setInputZ(e.target.value)}
              placeholder="0.0559"
              className="flex-1 px-2 py-1 text-xs font-mono border border-[#D1D5DB] rounded-sm focus:outline-none focus:border-[#2563EB]"
              disabled={disabled}
            />
            <span className="text-[10px] text-[#94A3B8]">m</span>
          </div>
        </div>

        {/* Go 按钮 */}
        <button
          onClick={handleGo}
          disabled={disabled || !inputX || !inputY || !inputZ}
          className={`w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-sm transition-colors ${
            feedback === 'success'
              ? 'bg-[#16A34A] text-white'
              : feedback === 'failed'
                ? 'bg-[#DC2626] text-white'
                : 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <Crosshair className="w-3.5 h-3.5" />
          运动到此点
        </button>
      </div>
    </div>
  );
}
