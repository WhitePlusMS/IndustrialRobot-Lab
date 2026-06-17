// src/components/Header.tsx
import { useState, useEffect } from 'react';

/** 使用浏览器语言格式化当前日期 */
function formatDate(now: Date): string {
  return new Intl.DateTimeFormat(navigator.language, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(now);
}

export default function Header() {
  const [dateStr, setDateStr] = useState(() => formatDate(new Date()));

  useEffect(() => {
    // 每分钟更新一次日期
    const timer = setInterval(() => setDateStr(formatDate(new Date())), 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-10 bg-[#FAFAFA] border-b border-[#E5E5E5] text-[#1E293B] flex items-center justify-between px-5 shrink-0 select-none">
      <span className="text-base font-semibold tracking-wide">
        6F Robot 机械臂仿真平台
      </span>
      <span className="text-sm text-[#64748B] truncate max-w-[40%] text-right">
        {dateStr}
      </span>
    </header>
  );
}
