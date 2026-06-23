// 步骤讲解面板：中间区域，聚焦理论、概念、关键术语与本步相关知识

import { Lightbulb, Target, AlertTriangle, BookOpen, Sparkles, ArrowRight } from 'lucide-react';
import type { CourseStep, TheoryItem } from '@/lib/course-config';

interface StepExplanationProps {
  step: CourseStep;
  theoryItems: TheoryItem[];
}

export default function StepExplanation({ step, theoryItems }: StepExplanationProps) {
  const { teachingGuide } = step;

  // 按当前步骤的 relatedTheoryIds 对知识点排序：关联的排在前面
  const relatedIds = new Set(step.relatedTheoryIds ?? []);
  const sortedItems = [...theoryItems].sort((a, b) => {
    const aRelated = relatedIds.has(a.id) ? 1 : 0;
    const bRelated = relatedIds.has(b.id) ? 1 : 0;
    return bRelated - aRelated;
  });
  const hasRelated = sortedItems.some((item) => relatedIds.has(item.id));

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

      {/* 本步相关知识：原“相关知识”Tab 的内容合并到这里 */}
      {sortedItems.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h4 className="text-[13px] font-bold text-slate-800">本步相关知识</h4>
          </div>

          {hasRelated && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3">
              <p className="text-[11px] text-blue-700 leading-relaxed">
                以下打标知识点与本步骤操作直接相关，建议优先阅读。
              </p>
            </div>
          )}

          <div className="space-y-3">
            {sortedItems.map((item) => {
              const related = relatedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl ${related ? 'bg-blue-50/60' : 'bg-slate-50/60'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[13px] font-semibold text-slate-700">{item.title}</p>
                    {related && (
                      <span className="text-[10px] font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                        本步相关
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-slate-500 leading-relaxed">{item.description}</p>
                  {related && (
                    <div className="mt-2 flex items-start gap-1.5">
                      <ArrowRight className="w-3 h-3 text-blue-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-blue-700 leading-relaxed">{item.whyNow}</p>
                    </div>
                  )}
                </div>
              );
            })}
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
      {step.warning && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] text-amber-800 font-semibold mb-1">注意事项</p>
              <p className="text-[12px] text-amber-700 leading-relaxed">{step.warning}</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
