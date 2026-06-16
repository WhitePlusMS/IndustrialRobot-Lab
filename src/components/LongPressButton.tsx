// src/components/LongPressButton.tsx
import { useRef, useCallback, type ReactNode } from 'react';

interface LongPressButtonProps {
  children: ReactNode;
  onClick: (isLongPress?: boolean) => void;
  disabled?: boolean;
  className?: string;
  delay?: number;
  interval?: number;
}

export default function LongPressButton({
  children,
  onClick,
  disabled = false,
  className = '',
  delay = 150,
  interval = 60,
}: LongPressButtonProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLongPress = useRef(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startLongPress = useCallback(() => {
    if (disabled) return;
    isLongPress.current = false;
    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      onClick(true);
      intervalRef.current = setInterval(() => {
        onClick(true);
      }, interval);
    }, delay);
  }, [disabled, onClick, delay, interval]);

  const handleMouseDown = useCallback(() => {
    startLongPress();
  }, [startLongPress]);

  const handleMouseUp = useCallback(() => {
    if (!isLongPress.current && timerRef.current) {
      onClick(false);
    }
    clearTimers();
  }, [onClick, clearTimers]);

  const handleMouseLeave = useCallback(() => {
    clearTimers();
  }, [clearTimers]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      startLongPress();
    },
    [startLongPress]
  );

  const handleClick = useCallback(() => {
    if (!isLongPress.current) onClick(false);
  }, [onClick]);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (!isLongPress.current && timerRef.current) {
        onClick(false);
      }
      clearTimers();
    },
    [onClick, clearTimers]
  );

  const handleTouchCancel = useCallback(() => {
    clearTimers();
  }, [clearTimers]);

  return (
    <button
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      disabled={disabled}
      className={`select-none ${className}`}
    >
      {children}
    </button>
  );
}
