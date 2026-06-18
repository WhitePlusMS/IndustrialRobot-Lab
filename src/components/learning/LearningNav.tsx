// src/components/learning/LearningNav.tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface LearningNavProps {
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export default function LearningNav({ canGoPrev, canGoNext, onPrev, onNext }: LearningNavProps) {
  return (
    <div className="p-4 border-t border-slate-100 flex gap-3 bg-white">
      <button
        type="button"
        onClick={onPrev}
        disabled={!canGoPrev}
        className="edu-btn flex-1 px-4 py-2.5 text-[13px] font-medium text-slate-600 rounded-xl flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:shadow-none"
      >
        <ChevronLeft className="w-4 h-4" />
        上一步
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        className="flex-1 px-4 py-2.5 text-[13px] font-medium rounded-xl flex items-center justify-center gap-1 text-white bg-gradient-to-r from-blue-500 to-blue-600 border border-blue-600 shadow-sm hover:from-blue-600 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-blue-500 disabled:hover:to-blue-600"
      >
        下一步
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
