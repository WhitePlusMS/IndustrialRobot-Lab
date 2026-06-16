// src/components/ToolCard.tsx
// 末端工具管理卡片：显示/隐藏机械臂末端工具模型
import { useState } from 'react';
import { ChevronDown, ChevronUp, Wrench } from 'lucide-react';

interface ToolCardProps {
  selectedTool: string;
  onToolChange: (tool: string) => void;
  tools: string[];
}

export default function ToolCard({ selectedTool, onToolChange, tools }: ToolCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-white border border-[#D1D5DB] rounded-sm">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[#F9FAFB] border-b border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none"
        aria-expanded={!collapsed}
      >
        <span className="text-sm font-semibold text-[#1E293B]">末端工具</span>
        {collapsed ? <ChevronDown className="w-4 h-4 text-[#64748B]" /> : <ChevronUp className="w-4 h-4 text-[#64748B]" />}
      </button>
      {!collapsed && (
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Wrench className="w-3.5 h-3.5 text-[#64748B] shrink-0" aria-hidden="true" />
            <label htmlFor="tool-select" className="sr-only">末端工具选择</label>
            <select
              id="tool-select"
              value={selectedTool}
              onChange={(e) => onToolChange(e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs border border-[#D1D5DB] rounded-sm bg-[#FAFAFA] focus:outline-none focus:border-[#2563EB] focus-visible:ring-2 focus-visible:ring-[#2563EB] cursor-pointer"
            >
              <option value="无">无</option>
              {tools.map((tool) => (
                <option key={tool} value={tool}>{tool}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
