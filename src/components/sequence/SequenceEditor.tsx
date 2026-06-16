// src/components/sequence/SequenceEditor.tsx
import { useState, useRef, useEffect } from 'react';
import type { ActionStep, SequenceLog, SequenceStatus } from '@/types/sequence';
import { createDefaultGraspSequence } from '@/types/sequence';
import type { Waypoint } from '@/hooks/useRobotKinematics';
import SequenceStepList from './SequenceStepList';
import SequenceStepParams from './SequenceStepParams';

interface SequenceEditorProps {
  steps: ActionStep[];
  setStepsList: (steps: ActionStep[]) => void;
  currentStepIndex: number;
  status: SequenceStatus;
  logs: SequenceLog[];
  addStep: (type: ActionStep['type']) => void;
  removeStep: (index: number) => void;
  moveStep: (index: number, direction: 'up' | 'down') => void;
  updateStep: (index: number, updates: Partial<ActionStep>) => void;
  runSequence: () => void;
  runSingleStep: () => void;
  stopSequence: () => void;
  resetSequence: () => void;
  waypoints: Waypoint[];
  captureImages: { color?: string; segmentation?: string; depth?: string };
  suckerOn: boolean;
  boxState: string;
}

export default function SequenceEditor({
  steps,
  setStepsList,
  currentStepIndex,
  status,
  logs,
  addStep,
  removeStep,
  moveStep,
  updateStep,
  runSequence,
  runSingleStep,
  stopSequence,
  resetSequence,
  waypoints,
  captureImages,
  suckerOn,
  boxState,
}: SequenceEditorProps) {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [sequenceName, setSequenceName] = useState('抓取演示');
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const loadDefaultSequence = () => {
    setStepsList(createDefaultGraspSequence());
    setSelectedIndex(-1);
  };

  const clearSequence = () => {
    setStepsList([]);
    setSelectedIndex(-1);
  };

  const getLogColor = (level: SequenceLog['level']) => {
    switch (level) {
      case 'info': return 'text-[#94A3B8]';
      case 'success': return 'text-[#22C55E]';
      case 'warn': return 'text-[#EAB308]';
      case 'error': return 'text-[#EF4444]';
      default: return 'text-[#94A3B8]';
    }
  };

  return (
    <div className="space-y-3">
      {/* 预设按钮 */}
      <div className="flex gap-1">
        <button
          onClick={loadDefaultSequence}
          className="flex-1 h-7 bg-[#EFF6FF] text-[#2563EB] text-[10px] font-medium rounded-sm border border-[#BFDBFE] hover:bg-[#DBEAFE] transition-colors"
        >
          加载默认抓取序列
        </button>
        <button
          onClick={clearSequence}
          className="h-7 px-2 bg-[#FEF2F2] text-[#DC2626] text-[10px] rounded-sm border border-[#FECACA] hover:bg-[#FEE2E2] transition-colors"
        >
          清空
        </button>
      </div>

      {/* 状态栏 */}
      <div className="flex gap-3 text-[10px] bg-white rounded-sm border border-[#E5E7EB] px-2 py-1.5">
        <span>
          吸盘:
          <span className={suckerOn ? 'text-[#2563EB] font-medium' : 'text-[#94A3B8]'}>
            {suckerOn ? ' 开启' : ' 关闭'}
          </span>
        </span>
        <span>
          箱子:
          <span className="font-medium text-[#1E293B]"> {boxState}</span>
        </span>
        {status === 'error' && (
          <span className="text-[#DC2626] font-medium">序列出错 — 请重置后重试</span>
        )}
      </div>

      {/* 步骤列表 */}
      <SequenceStepList
        steps={steps}
        currentStepIndex={currentStepIndex}
        status={status}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        onAdd={addStep}
        onRemove={removeStep}
        onMoveUp={(i) => moveStep(i, 'up')}
        onMoveDown={(i) => moveStep(i, 'down')}
      />

      {/* 播放控制 */}
      <div className="grid grid-cols-4 gap-1">
        <button
          onClick={runSequence}
          disabled={status === 'running' || steps.length === 0}
          className="h-8 bg-[#059669] text-white text-[10px] font-medium rounded-sm hover:bg-[#047857] disabled:opacity-40 transition-colors flex items-center justify-center gap-1"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          运行
        </button>
        <button
          onClick={runSingleStep}
          disabled={status === 'running' || steps.length === 0}
          className="h-8 bg-[#2563EB] text-white text-[10px] font-medium rounded-sm hover:bg-[#1D4ED8] disabled:opacity-40 transition-colors flex items-center justify-center gap-1"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
          单步
        </button>
        <button
          onClick={stopSequence}
          disabled={status !== 'running'}
          className="h-8 bg-[#DC2626] text-white text-[10px] font-medium rounded-sm hover:bg-[#B91C1C] disabled:opacity-40 transition-colors flex items-center justify-center gap-1"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
          停止
        </button>
        <button
          onClick={resetSequence}
          className="h-8 bg-[#6B7280] text-white text-[10px] font-medium rounded-sm hover:bg-[#4B5563] transition-colors flex items-center justify-center gap-1"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /></svg>
          重置
        </button>
      </div>

      {/* 步骤参数 */}
      {selectedIndex >= 0 && selectedIndex < steps.length && (
        <div className="bg-white rounded-md border border-[#E5E7EB] p-3 space-y-2">
          <div className="text-[11px] font-semibold text-[#1E293B] uppercase tracking-wide border-b border-[#E5E7EB] pb-1">
            参数
          </div>
          <SequenceStepParams
            step={steps[selectedIndex]}
            onUpdate={(updates) => updateStep(selectedIndex, updates)}
            waypoints={waypoints}
          />
        </div>
      )}

      {/* 拍照结果 */}
      {(captureImages.color || captureImages.segmentation || captureImages.depth) && (
        <div className="bg-white rounded-md border border-[#E5E7EB] p-3 space-y-2">
          <div className="text-[11px] font-semibold text-[#1E293B] uppercase tracking-wide border-b border-[#E5E7EB] pb-1">
            拍摄结果
          </div>
          <div className="grid grid-cols-3 gap-1">
            {captureImages.color && (
              <div className="space-y-0.5">
                <div className="text-[9px] text-[#64748B] text-center">彩色</div>
                <img src={captureImages.color} alt="彩色" className="w-full aspect-[4/3] object-contain border border-[#E5E7EB] rounded-sm bg-[#F8FAFC]" />
              </div>
            )}
            {captureImages.segmentation && (
              <div className="space-y-0.5">
                <div className="text-[9px] text-[#64748B] text-center">分割</div>
                <img src={captureImages.segmentation} alt="分割" className="w-full aspect-[4/3] object-contain border border-[#E5E7EB] rounded-sm bg-[#F8FAFC]" />
              </div>
            )}
            {captureImages.depth && (
              <div className="space-y-0.5">
                <div className="text-[9px] text-[#64748B] text-center">深度</div>
                <img src={captureImages.depth} alt="深度" className="w-full aspect-[4/3] object-contain border border-[#E5E7EB] rounded-sm bg-[#F8FAFC]" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 日志 */}
      <div className="bg-[#0B1120] rounded-md border border-[#1E293B] overflow-hidden">
        <div className="px-2 py-1 bg-[#1E293B] border-b border-[#334155]">
          <h3 className="text-[10px] font-semibold text-[#94A3B8] tracking-wide uppercase">执行日志</h3>
        </div>
        <div className="p-2 max-h-[160px] overflow-y-auto font-mono text-[10px] space-y-0.5">
          {logs.length === 0 ? (
            <div className="text-[#475569]">暂无日志</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className={getLogColor(log.level)}>
                <span className="text-[#475569] opacity-60">
                  {new Date(log.timestamp).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                {' '}{log.message}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
