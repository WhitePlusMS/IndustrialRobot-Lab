// src/components/layout/StatusBar.tsx
import type { StatusType, CoordinateSystem, JointAngles } from '@/types/robot';

interface StatusBarProps {
  status: StatusType;
  coordinateSystem: CoordinateSystem;
  position: [number, number, number];
  euler: [number, number, number];
  joints: JointAngles;
}

const statusConfig: Record<
  StatusType,
  { color: string; bgColor: string; borderColor: string; text: string }
> = {
  ready: {
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    text: '就绪',
  },
  moving: {
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    text: '运动中…',
  },
  complete: {
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    text: '运动完成',
  },
  nearSingularity: {
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    text: '接近奇异点',
  },
  jointLimited: {
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    text: '已限制到关节边界',
  },
  unreachable: {
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    text: '目标不可达',
  },
  jointOutOfRange: {
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    text: '目标超出关节范围',
  },
  jointLimitExceeded: {
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    text: '关节超限',
  },
};

export default function StatusBar({ status, coordinateSystem, position, euler, joints }: StatusBarProps) {
  const config = statusConfig[status];

  return (
    <footer
      role="status"
      aria-live="polite"
      className="h-10 shrink-0 bg-white border-t border-slate-200 flex items-center px-4 gap-3 text-xs z-20 shadow-[0_-1px_3px_rgba(0,0,0,0.03)]"
    >
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${config.bgColor} ${config.borderColor} ${config.color}`}
      >
        <div className={`w-1.5 h-1.5 rounded-full ${status === 'moving' ? 'bg-amber-500 animate-pulse' : 'bg-current'}`} />
        <span className="font-semibold">{config.text}</span>
      </div>

      <span className="text-slate-300">|</span>

      <span className="text-slate-500 font-medium">{coordinateSystem}</span>

      <span className="text-slate-300">|</span>

      <div className="flex items-center gap-2">
        <span className="text-slate-400">位置</span>
        <span className="font-mono tabular-nums text-slate-700 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
          X {position[0].toFixed(2)}
        </span>
        <span className="font-mono tabular-nums text-slate-700 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
          Y {position[1].toFixed(2)}
        </span>
        <span className="font-mono tabular-nums text-slate-700 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
          Z {position[2].toFixed(2)}
        </span>
      </div>

      <span className="text-slate-300">|</span>

      <div className="flex items-center gap-2">
        <span className="text-slate-400">姿态</span>
        <span className="font-mono tabular-nums text-slate-700 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
          Rx {euler[0].toFixed(1)}°
        </span>
        <span className="font-mono tabular-nums text-slate-700 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
          Ry {euler[1].toFixed(1)}°
        </span>
        <span className="font-mono tabular-nums text-slate-700 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
          Rz {euler[2].toFixed(1)}°
        </span>
      </div>

      <span className="text-slate-300">|</span>

      <div className="flex items-center gap-2">
        <span className="text-slate-400">J1</span>
        <span className="font-mono tabular-nums text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded">
          {joints[0].toFixed(1)}°
        </span>
      </div>
    </footer>
  );
}
