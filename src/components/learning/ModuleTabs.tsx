// src/components/learning/ModuleTabs.tsx
import { Bot, Camera, Grip } from 'lucide-react';
import type { ModuleId } from '@/lib/course-config';

interface ModuleTabsProps {
  activeModule: ModuleId;
  onModuleChange: (module: ModuleId) => void;
}

const modules: { id: ModuleId; label: string; icon: typeof Bot }[] = [
  { id: 'robot', label: '机械臂', icon: Bot },
  { id: 'camera', label: '相机系统', icon: Camera },
  { id: 'grasp', label: '抓取实训', icon: Grip },
];

export default function ModuleTabs({ activeModule, onModuleChange }: ModuleTabsProps) {
  return (
    <div className="flex border-b border-slate-200 bg-slate-50/80">
      {modules.map(({ id, label, icon: Icon }) => {
        const active = activeModule === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onModuleChange(id)}
            className={`flex-1 py-3.5 text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              active
                ? 'bg-white text-blue-600 shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
                : 'text-slate-600 hover:bg-white/50 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {active && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-500 rounded-t-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
