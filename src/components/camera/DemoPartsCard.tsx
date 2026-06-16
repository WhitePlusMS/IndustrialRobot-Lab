// src/components/camera/DemoPartsCard.tsx
// 相机视野内随机掉落 3D 演示零件的控制面板
import { useState } from 'react';
import { Dices, Trash2 } from 'lucide-react';

interface DemoPartsCardProps {
  onSpawn: (count: number, size: number) => void;
  onClear: () => void;
  hasParts: boolean;
}

export default function DemoPartsCard({ onSpawn, onClear, hasParts }: DemoPartsCardProps) {
  const [count, setCount] = useState(5);
  const [size, setSize] = useState(50); // mm

  const sizeM = size / 1000; // 转米

  const handleClear = () => {
    if (!confirm('确定清除所有演示零件？')) return;
    onClear();
  };

  return (
    <div className="bg-white rounded-md border border-[#E5E7EB] overflow-hidden">
      <div className="px-3 py-2 bg-[#F8FAFC] border-b border-[#E5E7EB]">
        <h3 className="text-xs font-semibold text-[#1E293B] tracking-wide uppercase">演示零件</h3>
      </div>

      <div className="p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <label htmlFor="parts-count" className="text-[11px] text-[#64748B] w-8">数量</label>
          <input
            id="parts-count"
            type="number"
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            className="flex-1 h-6 px-1.5 text-xs font-mono border border-[#D1D5DB] rounded-sm bg-white text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
            min={1}
            max={20}
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="parts-size" className="text-[11px] text-[#64748B] w-8">尺寸</label>
          <input
            id="parts-size"
            type="range"
            value={size}
            onChange={(e) => setSize(parseInt(e.target.value))}
            min={10}
            max={150}
            step={5}
            className="flex-1 h-4 accent-[#2563EB]"
          />
          <span className="text-[11px] font-mono text-[#1E293B] w-10 text-right">{size}mm</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onSpawn(count, sizeM)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-white bg-[#2563EB] rounded-sm hover:bg-[#1D4ED8] transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none"
          >
            <Dices className="w-3 h-3" />
            生成零件
          </button>
          <button
            onClick={handleClear}
            disabled={!hasParts}
            className="flex items-center justify-center gap-1 py-1.5 px-3 text-xs font-medium text-[#64748B] bg-[#F1F5F9] border border-[#D1D5DB] rounded-sm hover:bg-[#E2E8F0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-[#64748B] focus-visible:outline-none"
          >
            <Trash2 className="w-3 h-3" />
            清除
          </button>
        </div>
      </div>
    </div>
  );
}
