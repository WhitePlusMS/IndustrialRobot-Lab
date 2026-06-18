// src/components/learning/StepList.tsx
import { Check } from 'lucide-react';
import type { CourseStep } from '@/lib/course-config';

interface StepListProps {
  steps: CourseStep[];
  currentStep: number;
  completedSteps?: Set<string>;
  onStepClick: (index: number) => void;
}

export default function StepList({ steps, currentStep, completedSteps = new Set(), onStepClick }: StepListProps) {
  return (
    <div className="space-y-2 p-4">
      {steps.map((step, index) => {
        const done = completedSteps.has(step.id);
        const active = index === currentStep;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick(index)}
            className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              active
                ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100/50 shadow-[0_0_0_1px_#3b82f6,0_10px_25px_-8px_rgba(59,130,246,0.18)]'
                : done
                  ? 'border-green-200 bg-gradient-to-br from-green-50 to-green-100/50'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm ${
                active
                  ? 'bg-blue-500 text-white'
                  : done
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-200 text-slate-500'
              }`}
            >
              {done ? <Check className="w-4 h-4" /> : index + 1}
            </div>
            <div className="min-w-0">
              <p
                className={`text-[13px] font-semibold truncate ${
                  active ? 'text-slate-800' : done ? 'text-slate-700' : 'text-slate-500'
                }`}
              >
                {step.title}
              </p>
              <p
                className={`text-[11px] mt-0.5 truncate ${
                  active ? 'text-slate-600' : 'text-slate-500'
                }`}
              >
                {step.subtitle}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
