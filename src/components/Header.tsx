// src/components/Header.tsx
import { useState, useEffect } from 'react';

/** 格式化当前日期为中文显示 */
function formatDateCN(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const w = weekdays[now.getDay()];
  return `${y}年${m}月${d}日 ${w}`;
}

export default function Header() {
  const [dateStr, setDateStr] = useState(formatDateCN);

  useEffect(() => {
    // 每分钟更新一次日期
    const timer = setInterval(() => setDateStr(formatDateCN()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-10 bg-[#FAFAFA] border-b border-[#E5E5E5] text-[#1E293B] flex items-center justify-between px-5 shrink-0 select-none">
      <span className="text-base font-semibold tracking-wide">
        6F Robot 机械臂仿真平台
      </span>
      <span className="text-sm text-[#64748B]">
        {dateStr}
      </span>
    </div>
  );
}
