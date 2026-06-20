// src/components/learning/TheoryPanel.tsx
// 相关知识面板：按当前步骤关联关系展示知识点

import { BookOpen, Sparkles } from 'lucide-react';
import type { CourseStep, TheoryItem } from '@/lib/course-config';

interface TheoryPanelProps {
  items: TheoryItem[];
  currentStep?: CourseStep;
}

export default function TheoryPanel({ items, currentStep }: TheoryPanelProps) {
  // 根据当前步骤的 relatedTheoryIds 对知识点排序：关联的排在前面
  const relatedIds = new Set(currentStep?.relatedTheoryIds ?? []);
  const sortedItems = [...items].sort((a, b) => {
    const aRelated = relatedIds.has(a.id) ? 1 : 0;
    const bRelated = relatedIds.has(b.id) ? 1 : 0;
    return bRelated - aRelated;
  });

  return (
    <div className="space-y-4">
      {currentStep && relatedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] text-blue-800 font-semibold mb-1">与本步骤相关的知识</p>
              <p className="text-[12px] text-blue-700 leading-relaxed">
                以下打标知识点与本步骤操作直接相关，建议优先阅读。
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4">相关知识点</h3>
        <div className="space-y-4">
          {sortedItems.map((item, index) => {
            const related = relatedIds.has(item.id);
            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 group p-3 -mx-3 rounded-xl transition-colors ${
                  related ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    related
                      ? 'bg-blue-100 group-hover:bg-blue-200'
                      : 'bg-slate-100 group-hover:bg-slate-200'
                  }`}
                >
                  <span
                    className={`text-xs font-bold ${
                      related ? 'text-blue-600' : 'text-slate-600'
                    }`}
                  >
                    {index + 1}
                  </span>
                </div>
                <div className="flex-1">
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
                      <span className="text-[10px] font-semibold text-blue-600 mt-0.5">为什么现在学：</span>
                      <p className="text-[11px] text-blue-700 leading-relaxed">{item.whyNow}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
