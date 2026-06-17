// src/components/PoseControlCard.tsx
import { useState, useRef, useCallback } from 'react';
import { ChevronDown, ChevronUp, Globe, Wrench } from 'lucide-react';
import type { CoordinateSystem  } from '@/types/robot';
import DirectionButton from './DirectionButton';
import StepValueSelector from './StepValueSelector';

interface PoseControlCardProps {
  coordinateSystem: CoordinateSystem;
  onCoordinateChange: (cs: CoordinateSystem) => void;
  posStep: number;
  onPosStepChange: (v: number) => void;
  rotStep: number;
  onRotStepChange: (v: number) => void;
  onMoveDirection: (axis: 'x' | 'y' | 'z' | 'rx' | 'ry' | 'rz', sign: 1 | -1, isLongPress: boolean) => void;
}

export default function PoseControlCard({
  coordinateSystem,
  onCoordinateChange,
  posStep,
  onPosStepChange,
  rotStep,
  onRotStepChange,
  onMoveDirection,
}: PoseControlCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const longPressAxis = useRef<string | null>(null);

  const handleDirectionClick = useCallback(
    (axis: 'x' | 'y' | 'z' | 'rx' | 'ry' | 'rz', sign: 1 | -1) => {
      onMoveDirection(axis, sign, false);
    },
    [onMoveDirection]
  );

  const handleLongPressStart = useCallback(
    (axis: 'x' | 'y' | 'z' | 'rx' | 'ry' | 'rz', sign: 1 | -1) => {
      longPressAxis.current = `${axis}:${sign}`;
      onMoveDirection(axis, sign, true);
    },
    [onMoveDirection]
  );

  const handleLongPressEnd = useCallback(() => {
    longPressAxis.current = null;
  }, []);

  return (
    <div className="bg-white border border-[#D1D5DB] rounded-sm">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[#F9FAFB] border-b border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none"
        aria-expanded={!collapsed}
      >
        <span className="text-sm font-semibold text-[#1E293B]">位姿控制</span>
        {collapsed ? <ChevronDown className="w-4 h-4 text-[#64748B]" /> : <ChevronUp className="w-4 h-4 text-[#64748B]" />}
      </button>
      {!collapsed && (
        <div className="p-3 space-y-4">
          {/* 坐标系切换 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#64748B]">坐标系:</span>
            <div className="flex border border-[#D1D5DB] rounded-sm overflow-hidden" role="group" aria-label="坐标系选择">
              <button
                type="button"
                aria-pressed={coordinateSystem === 'World'}
                onClick={() => onCoordinateChange('World')}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-medium transition-colors ${
                  coordinateSystem === 'World'
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-white text-[#1E293B] hover:bg-[#F9FAFB]'
                }`}
              >
                <Globe className="w-3 h-3" />
                World
              </button>
              <button
                type="button"
                aria-pressed={coordinateSystem === 'Tool'}
                onClick={() => onCoordinateChange('Tool')}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-medium transition-colors border-l border-[#D1D5DB] ${
                  coordinateSystem === 'Tool'
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-white text-[#1E293B] hover:bg-[#F9FAFB]'
                }`}
              >
                <Wrench className="w-3 h-3" />
                Tool
              </button>
            </div>
          </div>

          {/* 位置方向键 + 姿态方向键 */}
          <div className="flex gap-6 justify-center">
            {/* 位置 */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-medium text-[#64748B]">位置 (mm)</span>
              <div className="grid grid-cols-3 gap-1">
                <div />
                <DirectionButton
                  label="Z+"
                  onClick={() => handleDirectionClick('z', 1)}
                  onLongPressStart={() => handleLongPressStart('z', 1)}
                  onLongPressEnd={handleLongPressEnd}
                />
                <div />
                <DirectionButton
                  label="Y+"
                  onClick={() => handleDirectionClick('y', 1)}
                  onLongPressStart={() => handleLongPressStart('y', 1)}
                  onLongPressEnd={handleLongPressEnd}
                />
                <div className="w-12 h-12 flex items-center justify-center">
                  <div className="w-2 h-2 bg-[#94A3B8] rounded-full" />
                </div>
                <DirectionButton
                  label="Y−"
                  onClick={() => handleDirectionClick('y', -1)}
                  onLongPressStart={() => handleLongPressStart('y', -1)}
                  onLongPressEnd={handleLongPressEnd}
                />
                <div />
                <DirectionButton
                  label="Z−"
                  onClick={() => handleDirectionClick('z', -1)}
                  onLongPressStart={() => handleLongPressStart('z', -1)}
                  onLongPressEnd={handleLongPressEnd}
                />
                <div />
                <DirectionButton
                  label="X−"
                  onClick={() => handleDirectionClick('x', -1)}
                  onLongPressStart={() => handleLongPressStart('x', -1)}
                  onLongPressEnd={handleLongPressEnd}
                />
                <div />
                <DirectionButton
                  label="X+"
                  onClick={() => handleDirectionClick('x', 1)}
                  onLongPressStart={() => handleLongPressStart('x', 1)}
                  onLongPressEnd={handleLongPressEnd}
                />
              </div>
            </div>

            {/* 姿态 */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-medium text-[#64748B]">姿态 (°)</span>
              <div className="grid grid-cols-3 gap-1">
                <div />
                <DirectionButton
                  label="RZ+"
                  onClick={() => handleDirectionClick('rz', 1)}
                  onLongPressStart={() => handleLongPressStart('rz', 1)}
                  onLongPressEnd={handleLongPressEnd}
                />
                <div />
                <DirectionButton
                  label="RY+"
                  onClick={() => handleDirectionClick('ry', 1)}
                  onLongPressStart={() => handleLongPressStart('ry', 1)}
                  onLongPressEnd={handleLongPressEnd}
                />
                <div className="w-12 h-12 flex items-center justify-center">
                  <div className="w-2 h-2 bg-[#94A3B8] rounded-full" />
                </div>
                <DirectionButton
                  label="RY−"
                  onClick={() => handleDirectionClick('ry', -1)}
                  onLongPressStart={() => handleLongPressStart('ry', -1)}
                  onLongPressEnd={handleLongPressEnd}
                />
                <div />
                <DirectionButton
                  label="RZ−"
                  onClick={() => handleDirectionClick('rz', -1)}
                  onLongPressStart={() => handleLongPressStart('rz', -1)}
                  onLongPressEnd={handleLongPressEnd}
                />
                <div />
                <DirectionButton
                  label="RX−"
                  onClick={() => handleDirectionClick('rx', -1)}
                  onLongPressStart={() => handleLongPressStart('rx', -1)}
                  onLongPressEnd={handleLongPressEnd}
                />
                <div />
                <DirectionButton
                  label="RX+"
                  onClick={() => handleDirectionClick('rx', 1)}
                  onLongPressStart={() => handleLongPressStart('rx', 1)}
                  onLongPressEnd={handleLongPressEnd}
                />
              </div>
            </div>
          </div>

          {/* 步进值 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748B] w-10">位置步进:</span>
              <StepValueSelector values={[0.1, 1, 10, 50]} unit="mm" current={posStep} onChange={onPosStepChange} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748B] w-10">姿态步进:</span>
              <StepValueSelector values={[0.1, 1, 5, 10]} unit="°" current={rotStep} onChange={onRotStepChange} />
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
