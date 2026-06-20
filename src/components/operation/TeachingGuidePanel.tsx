// src/components/operation/TeachingGuidePanel.tsx
// 右侧教学引导卡片：与操作控件同处一个滚动区域，聚焦“怎么做”

import { ListOrdered, CheckCircle2, Eye, ArrowRight, AlertTriangle } from 'lucide-react';
import type { CourseStep } from '@/lib/course-config';

interface TeachingGuidePanelProps {
  step: CourseStep;
}

export default function TeachingGuidePanel({ step }: TeachingGuidePanelProps) {
  const { teachingGuide, sceneInteraction } = step;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      {/* 当前任务 */}
      <div className="mb-4 pb-3 border-b border-slate-100">
        <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">当前任务</p>
        <h3 className="text-sm font-bold text-slate-800 mt-0.5 leading-tight">{step.title}</h3>
        <p className="text-[12px] text-slate-600 leading-relaxed mt-1">{teachingGuide.task}</p>
        {sceneInteraction && (
          <p className="text-[11px] text-blue-700 bg-blue-50 rounded-lg px-2.5 py-1.5 mt-2 leading-relaxed">
            {sceneInteraction.hint}
          </p>
        )}
      </div>

      {/* 操作步骤 */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-2">
          <ListOrdered className="w-3.5 h-3.5 text-blue-600" />
          <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">操作步骤</p>
        </div>
        <ol className="space-y-1.5">
          {teachingGuide.operationSteps.map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 border border-blue-100">
                {index + 1}
              </span>
              <p className="text-[12px] text-slate-600 leading-relaxed">{item}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* 完成检查 */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">完成检查</p>
        </div>
        <ul className="space-y-1.5">
          {teachingGuide.checkItems.map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              <div className="w-3.5 h-3.5 rounded border border-emerald-300 bg-white flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
              </div>
              <p className="text-[12px] text-slate-600 leading-relaxed">{item}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* 重点观察 */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Eye className="w-3.5 h-3.5 text-amber-600" />
          <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">重点观察</p>
        </div>
        <ul className="space-y-1.5">
          {teachingGuide.observe.map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              <ArrowRight className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-slate-600 leading-relaxed">{item}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* 注意事项 */}
      {step.warning && (
        <div className="flex items-start gap-2 pt-3 border-t border-slate-100">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700 leading-relaxed">
            <span className="font-semibold">注意事项：</span>
            {step.warning}
          </p>
        </div>
      )}
    </div>
  );
}
