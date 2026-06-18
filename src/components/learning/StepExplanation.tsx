// src/components/learning/StepExplanation.tsx
import { Lightbulb, Target, AlertTriangle } from 'lucide-react';
import type { CourseStep } from '@/lib/course-config';

interface StepExplanationProps {
  step: CourseStep;
}

export default function StepExplanation({ step }: StepExplanationProps) {
  return (
    <div className="space-y-4">
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
        <p
          className="text-[13px] text-slate-600 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: step.explanation }}
        />
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Target className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] text-blue-800 font-semibold mb-1">本步目标</p>
            <p className="text-[12px] text-blue-700 leading-relaxed">{step.goal}</p>
          </div>
        </div>
      </div>

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
