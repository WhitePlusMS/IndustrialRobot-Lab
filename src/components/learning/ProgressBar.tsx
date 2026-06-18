// src/components/learning/ProgressBar.tsx
interface ProgressBarProps {
  title: string;
  current: number;
  total: number;
}

export default function ProgressBar({ title, current, total }: ProgressBarProps) {
  const progress = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="px-5 py-4 border-b border-slate-100">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-slate-700">{title}</h2>
        <span className="text-xs font-bold text-blue-600">
          {current} / {total} 课时
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
