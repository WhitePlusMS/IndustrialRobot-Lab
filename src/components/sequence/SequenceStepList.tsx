// src/components/sequence/SequenceStepList.tsx
import type { ActionStep, ActionStepType } from '@/types/sequence';

interface SequenceStepListProps {
  steps: ActionStep[];
  currentStepIndex: number;
  status: 'idle' | 'running' | 'paused';
  selectedIndex: number;
  onSelect: (index: number) => void;
  onAdd: (type: ActionStepType) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

const STEP_TYPE_OPTIONS: { label: string; value: ActionStepType; color: string }[] = [
  { label: '生成箱子', value: '生成箱子', color: '#E65100' },
  { label: '拍照', value: '拍照', color: '#2563EB' },
  { label: '移动到箱子上方', value: '移动到箱子上方', color: '#059669' },
  { label: '下降到箱面', value: '下降到箱面', color: '#059669' },
  { label: '吸盘开启', value: '吸盘开启', color: '#DC2626' },
  { label: '抬升', value: '抬升', color: '#059669' },
  { label: '移动到目标位姿', value: '移动到目标位姿', color: '#D97706' },
  { label: '吸盘关闭', value: '吸盘关闭', color: '#6B7280' },
  { label: '归位', value: '归位', color: '#4B5563' },
  { label: '等待', value: '等待', color: '#8B5CF6' },
];

function getStepRowClass(step: ActionStep, isActive: boolean, isSelected: boolean): string {
  const base = 'flex items-center gap-2 px-2 py-1.5 cursor-pointer text-[11px] transition-colors border-l-2 ';
  if (step.execStatus === 'error') {
    return base + 'bg-[#FEF2F2] border-l-[#DC2626] text-[#DC2626]';
  }
  if (step.execStatus === 'success') {
    return base + 'bg-[#F0FDF4] border-l-[#22C55E] text-[#166534]';
  }
  if (isActive) {
    return base + 'bg-[#FEFCE8] border-l-[#EAB308] text-[#854D0E]';
  }
  if (isSelected) {
    return base + 'bg-[#F1F5F9] border-l-[#94A3B8] text-[#1E293B]';
  }
  return base + 'bg-white border-l-transparent text-[#1E293B] hover:bg-[#F8FAFC]';
}

export default function SequenceStepList({
  steps,
  currentStepIndex,
  status,
  selectedIndex,
  onSelect,
  onAdd,
  onRemove,
  onMoveUp,
  onMoveDown,
}: SequenceStepListProps) {
  return (
    <div className="space-y-2">
      {/* 步骤列表 */}
      <div className="max-h-[240px] overflow-y-auto border border-[#E5E7EB] rounded-sm bg-white">
        {steps.length === 0 ? (
          <div className="p-4 text-center text-[11px] text-[#94A3B8]">
            暂无步骤，点击下方"+添加"添加步骤
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {steps.map((step, i) => {
              const isActive = status === 'running' && i === currentStepIndex;
              const isSelected = i === selectedIndex;
              const typeColor = STEP_TYPE_OPTIONS.find((o) => o.value === step.type)?.color || '#64748B';

              return (
                <div
                  key={step.id}
                  onClick={() => onSelect(i)}
                  className={getStepRowClass(step, isActive, isSelected)}
                >
                  <span className="text-[#94A3B8] w-4 shrink-0 font-mono text-[10px]">{i + 1}</span>
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: typeColor }}
                  />
                  <span className="flex-1 truncate">{step.type}</span>
                  {step.execStatus === 'success' && (
                    <svg className="w-3 h-3 text-[#22C55E] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {step.execStatus === 'error' && (
                    <svg className="w-3 h-3 text-[#DC2626] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                  {isActive && (
                    <span className="text-[#EAB308] text-[10px] font-medium shrink-0 animate-pulse">执行中</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 添加步骤 */}
      <div className="flex flex-wrap gap-1">
        {STEP_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onAdd(opt.value)}
            className="px-1.5 py-0.5 text-[10px] rounded-sm border border-[#D1D5DB] bg-white text-[#1E293B] hover:bg-[#F3F4F6] transition-colors"
          >
            +{opt.label}
          </button>
        ))}
      </div>

      {/* 操作按钮 */}
      {selectedIndex >= 0 && selectedIndex < steps.length && (
        <div className="flex gap-1">
          <button
            onClick={() => onMoveUp(selectedIndex)}
            disabled={selectedIndex === 0}
            className="px-2 py-0.5 text-[10px] rounded-sm border border-[#D1D5DB] bg-white text-[#1E293B] hover:bg-[#F3F4F6] disabled:opacity-30 transition-colors"
          >
            ↑
          </button>
          <button
            onClick={() => onMoveDown(selectedIndex)}
            disabled={selectedIndex === steps.length - 1}
            className="px-2 py-0.5 text-[10px] rounded-sm border border-[#D1D5DB] bg-white text-[#1E293B] hover:bg-[#F3F4F6] disabled:opacity-30 transition-colors"
          >
            ↓
          </button>
          <button
            onClick={() => onRemove(selectedIndex)}
            className="px-2 py-0.5 text-[10px] rounded-sm border border-[#FCA5A5] bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
          >
            删除
          </button>
        </div>
      )}
    </div>
  );
}
