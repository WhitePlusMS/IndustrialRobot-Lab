// src/components/learning/TheoryPanel.tsx
import type { TheoryItem } from '@/lib/course-config';

interface TheoryPanelProps {
  items: TheoryItem[];
}

export default function TheoryPanel({ items }: TheoryPanelProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800 mb-4">相关知识点</h3>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-3 group">
            <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-200 transition-colors">
              <span className="text-xs font-bold text-blue-600">{index + 1}</span>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-slate-700">{item.title}</p>
              <p className="text-[12px] text-slate-500 leading-relaxed mt-0.5">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
