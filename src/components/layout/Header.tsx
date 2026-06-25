// src/components/layout/Header.tsx
import type { LearningMode } from '@/lib/course-config';

interface HeaderProps {
  mode: LearningMode;
  onModeChange: (mode: LearningMode) => void;
}

export default function Header({ mode, onModeChange }: HeaderProps) {
  return (
    <header className="h-[52px] shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] select-none z-20">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-bold text-slate-800 tracking-tight">IndustrialRobot-Lab · 工业机械臂实验室</h1>
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

        <a
          href="https://github.com/WhitePlusMS/IndustrialRobot-Lab"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
          GitHub
        </a>
      </div>
    </header>
  );
}
