// src/components/DirectionButton.tsx
import { useRef, useCallback } from 'react';

interface DirectionButtonProps {
  label: string;
  onClick: () => void;
  onLongPressStart?: () => void;
  onLongPressEnd?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

export default function DirectionButton({
  label,
  onClick,
  onLongPressStart,
  onLongPressEnd,
  disabled = false,
  variant = 'primary',
}: DirectionButtonProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLongPress = useRef(false);

  const clearTimers = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (longPressInterval.current) {
      clearInterval(longPressInterval.current);
      longPressInterval.current = null;
    }
  }, []);

  const handleMouseDown = useCallback(() => {
    if (disabled) return;
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPressStart?.();
      // 启动 interval 实现长按持续运动
      longPressInterval.current = setInterval(() => {
        onLongPressStart?.();
      }, 120);
    }, 150);
  }, [disabled, onLongPressStart]);

  const handleMouseUp = useCallback(() => {
    clearTimers();
    if (!isLongPress.current) {
      onClick();
    } else {
      onLongPressEnd?.();
    }
  }, [onClick, onLongPressEnd, clearTimers]);

  const handleMouseLeave = useCallback(() => {
    clearTimers();
    if (isLongPress.current) {
      onLongPressEnd?.();
    }
  }, [onLongPressEnd, clearTimers]);

  const handleTouchStart = useCallback(() => {
    if (disabled) return;
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPressStart?.();
      longPressInterval.current = setInterval(() => {
        onLongPressStart?.();
      }, 120);
    }, 150);
  }, [disabled, onLongPressStart]);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault(); // 阻止后续 click/mouse 事件
      clearTimers();
      if (!isLongPress.current) {
        onClick();
      } else {
        onLongPressEnd?.();
      }
    },
    [onClick, onLongPressEnd, clearTimers]
  );

  return (
    <button
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      disabled={disabled}
      className={`w-12 h-12 flex items-center justify-center text-xs font-bold border rounded-sm transition-colors select-none ${
        variant === 'primary'
          ? 'bg-[#F3F4F6] text-[#1E293B] border-[#94A3B8] hover:bg-[#E5E7EB] active:bg-[#2563EB] active:text-white active:border-[#2563EB]'
          : 'bg-[#F3F4F6] text-[#1E293B] border-[#94A3B8] hover:bg-[#E5E7EB] active:bg-[#2563EB] active:text-white active:border-[#2563EB]'
      } disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none`}
    >
      {label}
    </button>
  );
}
