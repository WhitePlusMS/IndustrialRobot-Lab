// src/components/layout/Header.tsx
import { HelpCircle } from 'lucide-react';
import type { LearningMode } from '@/lib/course-config';

interface HeaderProps {
  mode: LearningMode;
  onModeChange: (mode: LearningMode) => void;
}

export default function Header({ mode, onModeChange }: HeaderProps) {
  return (
    <header className="h-[52px] shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] select-none z-20">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v20M2 12h20" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
        <h1 className="text-base font-bold text-slate-800 tracking-tight">6F Robot 机械臂仿真平台</h1>
      </div>

      <div className="flex items-center gap-5">
        {/* 模式切换 */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200"
          role="group"
          aria-label="学习模式切换"
        >
          <span className={`text-xs font-medium ${mode === 'free' ? 'text-blue-600' : 'text-slate-500'}`}>
            自由练习
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={mode === 'guided'}
            onClick={() => onModeChange(mode === 'guided' ? 'free' : 'guided')}
            className="relative w-10 h-5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 bg-slate-200 data-[active=true]:bg-blue-500"
            data-active={mode === 'guided'}
          >
            <span
              className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
              style={{ transform: mode === 'guided' ? 'translateX(20px)' : 'translateX(0)' }}
            />
          </button>
          <span className={`text-xs font-medium ${mode === 'guided' ? 'text-blue-600' : 'text-slate-500'}`}>
            引导教学
          </span>
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <HelpCircle className="w-4 h-4" />
          帮助
        </button>
      </div>
    </header>
  );
}
