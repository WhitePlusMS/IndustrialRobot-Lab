// src/components/sequence/SequenceEditor.tsx
import { useState, useRef, useEffect } from 'react';
import type { ActionStep, SequenceLog, SequenceStatus } from '@/types/sequence';
import type { Waypoint } from '@/hooks/useRobot';
import SequenceStepList from './SequenceStepList';
import SequenceStepParams from './SequenceStepParams';

interface SequenceEditorProps {
  steps: ActionStep[];
  currentStepIndex: number;
  status: SequenceStatus;
  logs: SequenceLog[];
  loadDefaultSequence: () => void;
  clearSequence: () => void;
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
  currentStepIndex,
  status,
  logs,
  loadDefaultSequence,
  clearSequence,
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
  const logsEndRef = useRef<HTMLDivElement>(null);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
  }, [logs, prefersReducedMotion]);

  useEffect(() => {
    if (selectedIndex >= steps.length) {
      setSelectedIndex(-1);
    }
  }, [selectedIndex, steps.length]);

  const handleLoadDefaultSequence = () => {
    loadDefaultSequence();
    setSelectedIndex(-1);
  };

  const handleClearSequence = () => {
    if (!confirm('确定清空所有序列步骤？')) return;
    clearSequence();
    setSelectedIndex(-1);
  };

  const getLogColor = (level: SequenceLog['level']) => {
    switch (level) {
      case 'info': return 'text-slate-400';
      case 'success': return 'text-green-500';
      case 'warn': return 'text-yellow-500';
      case 'error': return 'text-red-500';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100">
        <span className="text-sm font-semibold text-slate-700">动作序列</span>
      </div>

      <div className="p-4 space-y-3">
        {/* 预设按钮 */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleLoadDefaultSequence}
            className="flex-1 h-7 bg-blue-50 text-blue-600 text-[10px] font-medium rounded-sm border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            加载默认抓取序列
          </button>
          <button
            type="button"
            onClick={handleClearSequence}
            className="h-7 px-2 bg-red-50 text-red-600 text-[10px] rounded-sm border border-red-200 hover:bg-red-100 transition-colors"
          >
            清空
          </button>
        </div>

        {/* 状态栏 */}
        <div role="status" aria-live="polite" className="flex gap-3 text-[10px] bg-slate-50 rounded-sm border border-slate-100 px-2 py-1.5">
          <span>
            吸盘:
            <span className={suckerOn ? 'text-blue-600 font-medium' : 'text-slate-400'}>
              {suckerOn ? ' 开启' : ' 关闭'}
            </span>
          </span>
          <span>
            箱子:
            <span className="font-medium text-slate-700"> {boxState}</span>
          </span>
          {status === 'error' && (
            <span className="text-red-600 font-medium">序列出错 — 请重置后重试</span>
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
        {/* 如果存在未选择目标位姿的"移动到目标位姿"步骤，给出红色提示 */}
        {steps.some((s) => s.type === '移动到目标位姿' && !s.params.memoryPointName) && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <span>请为所有"移动到目标位姿"步骤选择目标位姿</span>
          </div>
        )}
        <div className="grid grid-cols-4 gap-1">
          <button
            type="button"
            onClick={runSequence}
            disabled={
              status === 'running' ||
              steps.length === 0 ||
              steps.some((s) => s.type === '移动到目标位姿' && !s.params.memoryPointName)
            }
            className="h-8 bg-green-600 text-white text-[10px] font-medium rounded-sm hover:bg-green-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            运行
          </button>
          <button
            type="button"
            onClick={runSingleStep}
            disabled={status === 'running' || steps.length === 0}
            className="h-8 bg-blue-600 text-white text-[10px] font-medium rounded-sm hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
            单步
          </button>
          <button
            type="button"
            onClick={stopSequence}
            disabled={status !== 'running'}
            className="h-8 bg-red-600 text-white text-[10px] font-medium rounded-sm hover:bg-red-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z" /></svg>
            停止
          </button>
          <button
            type="button"
            onClick={resetSequence}
            className="h-8 bg-slate-600 text-white text-[10px] font-medium rounded-sm hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /></svg>
            重置
          </button>
        </div>

        {/* 步骤参数 */}
        {selectedIndex >= 0 && selectedIndex < steps.length && (
          <div className="bg-white rounded-md border border-slate-100 p-3 space-y-2">
            <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide border-b border-slate-100 pb-1">
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
          <div className="bg-white rounded-md border border-slate-100 p-3 space-y-2">
            <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide border-b border-slate-100 pb-1">
              拍摄结果
            </div>
            <div className="grid grid-cols-3 gap-1">
              {captureImages.color && (
                <div className="space-y-0.5">
                  <div className="text-[9px] text-slate-500 text-center">彩色</div>
                  <img src={captureImages.color} alt="彩色" width="160" height="120" loading="lazy" className="w-full aspect-[4/3] object-contain border border-slate-100 rounded-sm bg-slate-50" />
                </div>
              )}
              {captureImages.segmentation && (
                <div className="space-y-0.5">
                  <div className="text-[9px] text-slate-500 text-center">分割</div>
                  <img src={captureImages.segmentation} alt="分割" width="160" height="120" loading="lazy" className="w-full aspect-[4/3] object-contain border border-slate-100 rounded-sm bg-slate-50" />
                </div>
              )}
              {captureImages.depth && (
                <div className="space-y-0.5">
                  <div className="text-[9px] text-slate-500 text-center">深度</div>
                  <img src={captureImages.depth} alt="深度" width="160" height="120" loading="lazy" className="w-full aspect-[4/3] object-contain border border-slate-100 rounded-sm bg-slate-50" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 日志 */}
        <div className="bg-[#0B1120] rounded-md border border-[#1E293B] overflow-hidden">
          <div className="px-2 py-1 bg-[#1E293B] border-b border-[#334155]">
            <h3 className="text-[10px] font-semibold text-slate-400 tracking-wide uppercase">执行日志</h3>
          </div>
          <div className="p-2 max-h-[160px] overflow-y-auto font-mono text-[10px] space-y-0.5">
            {logs.length === 0 ? (
              <div className="text-slate-500">暂无日志</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={getLogColor(log.level)}>
                  <span className="text-slate-500 opacity-60 tabular-nums">
                    {new Date(log.timestamp).toLocaleTimeString(navigator.language, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  {' '}{log.message}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
