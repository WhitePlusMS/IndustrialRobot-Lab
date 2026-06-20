// src/components/learning/StepExplanation.tsx
// 步骤讲解面板：中间区域，聚焦理论、概念和关键术语

import { Lightbulb, Target, AlertTriangle, BookOpen } from 'lucide-react';
import type { CourseStep } from '@/lib/course-config';

interface StepExplanationProps {
  step: CourseStep;
}

export default function StepExplanation({ step }: StepExplanationProps) {
  const { teachingGuide } = step;

  return (
    <div className="space-y-4">
      {/* 步骤标题与理论讲解 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Lightbulb className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">步骤讲解</h3>
            <p className="text-xs text-blue-600 font-medium mt-0.5">{step.title}</p>
          </div>
        </div>
        <div
          className="text-[13px] text-slate-600 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: step.explanation }}
        />
      </div>

      {/* 关键术语 */}
      {teachingGuide.keyTerms.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-slate-600" />
            <h4 className="text-[13px] font-bold text-slate-800">关键术语</h4>
          </div>
          <div className="space-y-2">
            {teachingGuide.keyTerms.map((item, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                  {item.term}
                </span>
                <p className="text-[12px] text-slate-600 leading-relaxed">{item.definition}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 本步目标 */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Target className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] text-emerald-800 font-semibold mb-1">本步目标</p>
            <p className="text-[12px] text-emerald-700 leading-relaxed">{step.goal}</p>
          </div>
        </div>
      </div>

      {/* 注意事项 */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] text-amber-800 font-semibold mb-1">注意事项</p>
            <p className="text-[12px] text-amber-700 leading-relaxed">{step.warning}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
