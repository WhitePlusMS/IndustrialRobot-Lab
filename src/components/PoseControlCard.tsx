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
  /** 全局禁用所有方向按钮 */
  disabled?: boolean;
}

export default function PoseControlCard({
  coordinateSystem,
  onCoordinateChange,
  posStep,
  onPosStepChange,
  rotStep,
  onRotStepChange,
  onMoveDirection,
  disabled = false,
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
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/80 border-b border-slate-100 hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        aria-expanded={!collapsed}
      >
        <span className="text-sm font-semibold text-slate-700">位姿控制</span>
        {collapsed ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-500" />}
      </button>
      {!collapsed && (
        <div className="p-4 space-y-4">
          {/* 坐标系切换 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">坐标系:</span>
            <div className="flex border border-slate-200 rounded-sm overflow-hidden" role="group" aria-label="坐标系选择">
              <button
                type="button"
                aria-pressed={coordinateSystem === 'World'}
                onClick={() => onCoordinateChange('World')}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-medium transition-colors ${
                  coordinateSystem === 'World'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Globe className="w-3 h-3" />
                World
              </button>
              <button
                type="button"
                aria-pressed={coordinateSystem === 'Tool'}
                onClick={() => onCoordinateChange('Tool')}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-medium transition-colors border-l border-slate-200 ${
                  coordinateSystem === 'Tool'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
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
              <span className="text-xs font-medium text-slate-500">位置 (mm)</span>
              <div className="grid grid-cols-3 gap-1">
                <div />
                <DirectionButton
                  label="Z+"
                  onClick={() => handleDirectionClick('z', 1)}
                  onLongPressStart={() => handleLongPressStart('z', 1)}
                  onLongPressEnd={handleLongPressEnd}
                  disabled={disabled}
                />
                <div />
                <DirectionButton
                  label="Y+"
                  onClick={() => handleDirectionClick('y', 1)}
                  onLongPressStart={() => handleLongPressStart('y', 1)}
                  onLongPressEnd={handleLongPressEnd}
                  disabled={disabled}
                />
                <div className="w-12 h-12 flex items-center justify-center">
                  <div className="w-2 h-2 bg-slate-400 rounded-full" />
                </div>
                <DirectionButton
                  label="Y−"
                  onClick={() => handleDirectionClick('y', -1)}
                  onLongPressStart={() => handleLongPressStart('y', -1)}
                  onLongPressEnd={handleLongPressEnd}
                  disabled={disabled}
                />
                <div />
                <DirectionButton
                  label="Z−"
                  onClick={() => handleDirectionClick('z', -1)}
                  onLongPressStart={() => handleLongPressStart('z', -1)}
                  onLongPressEnd={handleLongPressEnd}
                  disabled={disabled}
                />
                <div />
                <DirectionButton
                  label="X−"
                  onClick={() => handleDirectionClick('x', -1)}
                  onLongPressStart={() => handleLongPressStart('x', -1)}
                  onLongPressEnd={handleLongPressEnd}
                  disabled={disabled}
                />
                <div />
                <DirectionButton
                  label="X+"
                  onClick={() => handleDirectionClick('x', 1)}
                  onLongPressStart={() => handleLongPressStart('x', 1)}
                  onLongPressEnd={handleLongPressEnd}
                  disabled={disabled}
                />
              </div>
            </div>

            {/* 姿态 */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-medium text-slate-500">姿态 (°)</span>
              <div className="grid grid-cols-3 gap-1">
                <div />
                <DirectionButton
                  label="RZ+"
                  onClick={() => handleDirectionClick('rz', 1)}
                  onLongPressStart={() => handleLongPressStart('rz', 1)}
                  onLongPressEnd={handleLongPressEnd}
                  disabled={disabled}
                />
                <div />
                <DirectionButton
                  label="RY+"
                  onClick={() => handleDirectionClick('ry', 1)}
                  onLongPressStart={() => handleLongPressStart('ry', 1)}
                  onLongPressEnd={handleLongPressEnd}
                  disabled={disabled}
                />
                <div className="w-12 h-12 flex items-center justify-center">
                  <div className="w-2 h-2 bg-slate-400 rounded-full" />
                </div>
                <DirectionButton
                  label="RY−"
                  onClick={() => handleDirectionClick('ry', -1)}
                  onLongPressStart={() => handleLongPressStart('ry', -1)}
                  onLongPressEnd={handleLongPressEnd}
                  disabled={disabled}
                />
                <div />
                <DirectionButton
                  label="RZ−"
                  onClick={() => handleDirectionClick('rz', -1)}
                  onLongPressStart={() => handleLongPressStart('rz', -1)}
                  onLongPressEnd={handleLongPressEnd}
                  disabled={disabled}
                />
                <div />
                <DirectionButton
                  label="RX−"
                  onClick={() => handleDirectionClick('rx', -1)}
                  onLongPressStart={() => handleLongPressStart('rx', -1)}
                  onLongPressEnd={handleLongPressEnd}
                  disabled={disabled}
                />
                <div />
                <DirectionButton
                  label="RX+"
                  onClick={() => handleDirectionClick('rx', 1)}
                  onLongPressStart={() => handleLongPressStart('rx', 1)}
                  onLongPressEnd={handleLongPressEnd}
                  disabled={disabled}
                />
              </div>
            </div>
          </div>

          {/* 步进值 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-10">位置步进:</span>
              <StepValueSelector values={[0.1, 1, 10, 50]} unit="mm" current={posStep} onChange={onPosStepChange} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-10">姿态步进:</span>
              <StepValueSelector values={[0.1, 1, 5, 10]} unit="°" current={rotStep} onChange={onRotStepChange} />
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
