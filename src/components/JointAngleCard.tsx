// src/components/JointAngleCard.tsx
import { ChevronDown, ChevronUp, Shuffle, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { RobotConfig, JointAngles } from '@/types/robot';
import StepValueSelector from './StepValueSelector';
import LongPressButton from './LongPressButton';

interface JointAngleCardProps {
  joints: JointAngles;
  config: RobotConfig;
  jointStep: number;
  onJointStepChange: (v: number) => void;
  onAdjustJoint: (index: number, delta: number, isContinuous?: boolean) => void;
  onReset: () => void;
  onRandom: () => void;
}

export default function JointAngleCard({
  joints,
  config,
  jointStep,
  onJointStepChange,
  onAdjustJoint,
  onReset,
  onRandom,
}: JointAngleCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const dhValues = Object.values(config.dhParams);

  return (
    <div className="bg-white border border-[#D1D5DB] rounded-sm">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[#F9FAFB] border-b border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none"
        aria-expanded={!collapsed}
      >
        <span className="text-sm font-semibold text-[#1E293B]">关节角度</span>
        {collapsed ? <ChevronDown className="w-4 h-4 text-[#64748B]" /> : <ChevronUp className="w-4 h-4 text-[#64748B]" />}
      </button>
      {!collapsed && (
        <div className="p-3 space-y-2">
          {joints.map((angle, i) => {
            const range = dhValues[i].thetaRange;
            const isOutOfRange = angle < range[0] - 0.01 || angle > range[1] + 0.01;
            return (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#64748B] w-10">J{i + 1}</span>
                <LongPressButton
                  aria-label={`减小 J${i + 1} 角度`}
                  onClick={(isContinuous) => onAdjustJoint(i, -1, isContinuous)}
                  className="w-7 h-7 flex items-center justify-center bg-[#F3F4F6] border border-[#D1D5DB] rounded-sm text-[#1E293B] hover:bg-[#E5E7EB] active:bg-[#2563EB] active:text-white active:border-[#2563EB] transition-colors"
                >
                  <span className="pointer-events-none">−</span>
                </LongPressButton>
                <span
                  className={`text-sm font-mono tabular-nums font-medium w-16 text-center pointer-events-none ${
                    isOutOfRange ? 'text-[#EF4444]' : 'text-[#0F172A]'
                  }`}
                >
                  {angle.toFixed(1)}°
                </span>
                <LongPressButton
                  aria-label={`增大 J${i + 1} 角度`}
                  onClick={(isContinuous) => onAdjustJoint(i, 1, isContinuous)}
                  className="w-7 h-7 flex items-center justify-center bg-[#F3F4F6] border border-[#D1D5DB] rounded-sm text-[#1E293B] hover:bg-[#E5E7EB] active:bg-[#2563EB] active:text-white active:border-[#2563EB] transition-colors"
                >
                  <span className="pointer-events-none">+</span>
                </LongPressButton>
                <span className="text-xs text-[#94A3B8] w-24 text-right truncate">
                  [{range[0]} ~ {range[1]}]
                </span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB]">
            <span className="text-xs text-[#64748B]">步进:</span>
            <StepValueSelector values={[0.1, 1, 5, 10]} unit="°" current={jointStep} onChange={onJointStepChange} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onReset}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-[#1E293B] bg-[#F3F4F6] border border-[#D1D5DB] rounded-sm hover:bg-[#E5E7EB] transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              重置
            </button>
            <button
              type="button"
              onClick={onRandom}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-[#1E293B] bg-[#F3F4F6] border border-[#D1D5DB] rounded-sm hover:bg-[#E5E7EB] transition-colors"
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
