// src/components/Toolbar.tsx
import { Pin, RotateCcw, Home } from 'lucide-react';

interface ToolbarProps {
  onSaveOrigin: () => void;
  onGoToOrigin: () => void;
  onGoToZero: () => void;
  hasOrigin: boolean;
}

export default function Toolbar({ onSaveOrigin, onGoToOrigin, onGoToZero, hasOrigin }: ToolbarProps) {
  return (
    <div className="h-12 bg-[#F5F5F5] border-b border-[#E5E5E5] flex items-center px-4 gap-3 shrink-0">
      <button
        onClick={onSaveOrigin}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#1E293B] bg-white border border-[#D1D5DB] rounded-sm hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors"
      >
        <Pin className="w-4 h-4" />
        设置为原点
      </button>
      <button
        onClick={onGoToOrigin}
        disabled={!hasOrigin}
        title={!hasOrigin ? '请先设置原点' : ''}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#1E293B] bg-white border border-[#D1D5DB] rounded-sm hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <RotateCcw className="w-4 h-4" />
        回原点
      </button>
      <button
        onClick={onGoToZero}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#1E293B] bg-white border border-[#D1D5DB] rounded-sm hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors"
      >
        <Home className="w-4 h-4" />
        回零位
      </button>
    </div>
  );
}
