// src/components/StatusBar.tsx
import type { StatusType, CoordinateSystem  } from '@/types/robot';

interface StatusBarProps {
  status: StatusType;
  coordinateSystem: CoordinateSystem;
  position: [number, number, number];
  euler: [number, number, number];
}

const statusConfig: Record<
  StatusType,
  { color: string; text: string; bgColor: string }
> = {
  ready: { color: '#10B981', text: '就绪', bgColor: 'bg-[#ECFDF5]' },
  moving: { color: '#F59E0B', text: '运动中…', bgColor: 'bg-[#FFFBEB]' },
  complete: { color: '#10B981', text: '运动完成', bgColor: 'bg-[#ECFDF5]' },
  nearSingularity: { color: '#F59E0B', text: '接近奇异，精度下降', bgColor: 'bg-[#FFFBEB]' },
  jointLimited: { color: '#F59E0B', text: '已限制到关节边界', bgColor: 'bg-[#FFFBEB]' },
  unreachable: { color: '#EF4444', text: '目标不可达', bgColor: 'bg-[#FEF2F2]' },
  jointOutOfRange: { color: '#EF4444', text: '目标超出关节范围', bgColor: 'bg-[#FEF2F2]' },
  jointLimitExceeded: { color: '#EF4444', text: '关节超限', bgColor: 'bg-[#FEF2F2]' },
};

export default function StatusBar({ status, coordinateSystem, position, euler }: StatusBarProps) {
  const config = statusConfig[status];

  return (
    <div className="h-8 bg-[#F5F5F5] border-t border-[#E5E5E5] flex items-center px-3 gap-4 text-xs shrink-0">
      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-sm ${config.bgColor}`}>
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
        <span style={{ color: config.color }} className="font-medium">
          {config.text}
        </span>
      </div>
      <div className="w-px h-4 bg-[#D1D5DB]" />
      <span className="text-[#64748B] font-medium">{coordinateSystem}</span>
      <div className="w-px h-4 bg-[#D1D5DB]" />
      <span className="text-[#64748B]">X:</span>
      <span className="font-mono text-[#0F172A]">{position[0].toFixed(2)}</span>
      <span className="text-[#64748B]">Y:</span>
      <span className="font-mono text-[#0F172A]">{position[1].toFixed(2)}</span>
      <span className="text-[#64748B]">Z:</span>
      <span className="font-mono text-[#0F172A]">{position[2].toFixed(2)}</span>
      <span className="text-[#64748B] ml-2">Rx:</span>
      <span className="font-mono text-[#0F172A]">{euler[0].toFixed(1)}°</span>
      <span className="text-[#64748B]">Ry:</span>
      <span className="font-mono text-[#0F172A]">{euler[1].toFixed(1)}°</span>
      <span className="text-[#64748B]">Rz:</span>
      <span className="font-mono text-[#0F172A]">{euler[2].toFixed(1)}°</span>
    </div>
  );
}
