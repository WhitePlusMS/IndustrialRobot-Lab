// src/components/sequence/SequenceStepParams.tsx
import {
  DEFAULT_SEQUENCE_APPROACH_HEIGHT,
  DEFAULT_SEQUENCE_BOX_FIXED_POSITION,
  DEFAULT_SEQUENCE_BOX_MAX_HEIGHT,
  DEFAULT_SEQUENCE_BOX_MIN_HEIGHT,
  DEFAULT_SEQUENCE_BOX_RANDOM_CENTER,
  DEFAULT_SEQUENCE_BOX_RANDOM_RANGE_X,
  DEFAULT_SEQUENCE_BOX_RANDOM_RANGE_Z,
  DEFAULT_SEQUENCE_BOX_RESTING_HEIGHT,
  DEFAULT_SEQUENCE_LIFT_HEIGHT,
  DEFAULT_SEQUENCE_PLACE_ORIENTATION_DEG,
  DEFAULT_SEQUENCE_PLACE_POSITION_M,
  DEFAULT_SEQUENCE_PLACE_PRESET_LABEL,
  DEFAULT_SEQUENCE_PLACE_PRESET_NAME,
  type ActionStep,
} from '@/types/sequence';
import type { Waypoint } from '@/hooks/useRobot';

interface SequenceStepParamsProps {
  step: ActionStep | null;
  onUpdate: (updates: Partial<ActionStep>) => void;
  waypoints: Waypoint[];
}

/** 安全解析数字输入：允许中间态如 "-" "."，isNaN 时不更新 */
function safeNumber(raw: string): number | null {
  if (raw === '' || raw === '-' || raw === '.') return null;
  const v = parseFloat(raw);
  return isNaN(v) ? null : v;
}

export default function SequenceStepParams({
  step,
  onUpdate,
  waypoints,
}: SequenceStepParamsProps) {
  if (!step) {
    return (
      <div className="text-[11px] text-[#94A3B8] py-2">
        选择一个步骤以编辑参数
      </div>
    );
  }

  const handleParamChange = (key: string, value: unknown) => {
    onUpdate({
      params: { ...step.params, [key]: value },
    });
  };

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold text-[#1E293B]">{step.type}</div>

      {/* 生成箱子 */}
      {step.type === '生成箱子' && (
        <div className="space-y-3">
          {/* 模式切换 */}
          <div className="flex gap-1" role="group" aria-label="箱子生成模式">
            <button
              type="button"
              aria-pressed={step.params.boxSpawn?.mode === 'fixed'}
              onClick={() => handleParamChange('boxSpawn', { ...step.params.boxSpawn, mode: 'fixed' })}
              className={`flex-1 h-6 text-[10px] rounded-sm border transition-colors ${
                step.params.boxSpawn?.mode === 'fixed'
                  ? 'bg-[#2563EB] text-white border-[#2563EB]'
                  : 'bg-white text-[#1E293B] border-[#D1D5DB] hover:bg-[#F3F4F6]'
              }`}
            >
              固定位置
            </button>
            <button
              type="button"
              aria-pressed={step.params.boxSpawn?.mode === 'random'}
              onClick={() => handleParamChange('boxSpawn', { ...step.params.boxSpawn, mode: 'random' })}
              className={`flex-1 h-6 text-[10px] rounded-sm border transition-colors ${
                step.params.boxSpawn?.mode === 'random'
                  ? 'bg-[#F59E0B] text-white border-[#F59E0B]'
                  : 'bg-white text-[#1E293B] border-[#D1D5DB] hover:bg-[#F3F4F6]'
              }`}
            >
              随机区域
            </button>
          </div>

          {/* 固定模式参数 */}
          {step.params.boxSpawn?.mode === 'fixed' && (
            <div className="space-y-1">
              <div className="text-[10px] text-[#64748B] font-medium">固定位置 (mm)</div>
              <div className="grid grid-cols-3 gap-1">
                {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                  <div key={axis} className="flex items-center gap-1">
                    <span className="text-[10px] text-[#64748B] w-3">{axis}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={`箱子固定位置 ${axis}`}
                      value={step.params.boxSpawn?.fixedPosition?.[i] ?? DEFAULT_SEQUENCE_BOX_FIXED_POSITION[i]}
                      onChange={(e) => {
                        const n = safeNumber(e.target.value);
                        if (n === null) return;
                        const pos = [...(step.params.boxSpawn?.fixedPosition ?? DEFAULT_SEQUENCE_BOX_FIXED_POSITION)] as [number, number, number];
                        pos[i] = n;
                        handleParamChange('boxSpawn', {
                          ...step.params.boxSpawn,
                          mode: 'fixed',
                          fixedPosition: pos,
                        });
                      }}
                      className="w-full h-6 px-1 text-[10px] font-mono border border-[#D1D5DB] rounded-sm bg-white"
                      step={10}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 随机模式参数 */}
          {step.params.boxSpawn?.mode === 'random' && (
            <div className="space-y-2">
              <div className="text-[10px] text-[#64748B] font-medium">随机生成区域 (XZ平面)</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-[#64748B]">中心 X</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label="随机生成中心 X"
                    value={step.params.boxSpawn?.randomCenter?.[0] ?? DEFAULT_SEQUENCE_BOX_RANDOM_CENTER[0]}
                    onChange={(e) => {
                      const n = safeNumber(e.target.value);
                      if (n === null) return;
                      const center = [...(step.params.boxSpawn?.randomCenter ?? DEFAULT_SEQUENCE_BOX_RANDOM_CENTER)] as [number, number];
                      center[0] = n;
                      handleParamChange('boxSpawn', {
                        ...step.params.boxSpawn,
                        mode: 'random',
                        randomCenter: center,
                      });
                    }}
                    className="w-full h-6 px-1 text-[10px] font-mono border border-[#D1D5DB] rounded-sm bg-white"
                    step={10}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-[#64748B]">中心 Z</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label="随机生成中心 Z"
                    value={step.params.boxSpawn?.randomCenter?.[1] ?? DEFAULT_SEQUENCE_BOX_RANDOM_CENTER[1]}
                    onChange={(e) => {
                      const n = safeNumber(e.target.value);
                      if (n === null) return;
                      const center = [...(step.params.boxSpawn?.randomCenter ?? DEFAULT_SEQUENCE_BOX_RANDOM_CENTER)] as [number, number];
                      center[1] = n;
                      handleParamChange('boxSpawn', {
                        ...step.params.boxSpawn,
                        mode: 'random',
                        randomCenter: center,
                      });
                    }}
                    className="w-full h-6 px-1 text-[10px] font-mono border border-[#D1D5DB] rounded-sm bg-white"
                    step={10}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-[#64748B]">X范围 (半宽)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label="随机生成 X 范围"
                    value={step.params.boxSpawn?.randomRangeX ?? DEFAULT_SEQUENCE_BOX_RANDOM_RANGE_X}
                    onChange={(e) => {
                      const n = safeNumber(e.target.value);
                      if (n === null) return;
                      handleParamChange('boxSpawn', {
                        ...step.params.boxSpawn,
                        mode: 'random',
                        randomRangeX: n,
                      });
                    }}
                    className="w-full h-6 px-1 text-[10px] font-mono border border-[#D1D5DB] rounded-sm bg-white"
                    step={10}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-[#64748B]">Z范围 (半宽)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label="随机生成 Z 范围"
                    value={step.params.boxSpawn?.randomRangeZ ?? DEFAULT_SEQUENCE_BOX_RANDOM_RANGE_Z}
                    onChange={(e) => {
                      const n = safeNumber(e.target.value);
                      if (n === null) return;
                      handleParamChange('boxSpawn', {
                        ...step.params.boxSpawn,
                        mode: 'random',
                        randomRangeZ: n,
                      });
                    }}
                    className="w-full h-6 px-1 text-[10px] font-mono border border-[#D1D5DB] rounded-sm bg-white"
                    step={10}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-[#64748B]">最小高度</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label="随机生成最小高度"
                    value={step.params.boxSpawn?.minHeight ?? DEFAULT_SEQUENCE_BOX_MIN_HEIGHT}
                    onChange={(e) => {
                      const n = safeNumber(e.target.value);
                      if (n === null) return;
                      handleParamChange('boxSpawn', {
                        ...step.params.boxSpawn,
                        mode: 'random',
                        minHeight: n,
                      });
                    }}
                    className="w-full h-6 px-1 text-[10px] font-mono border border-[#D1D5DB] rounded-sm bg-white"
                    step={10}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-[#64748B]">最大高度</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label="随机生成最大高度"
                    value={step.params.boxSpawn?.maxHeight ?? DEFAULT_SEQUENCE_BOX_MAX_HEIGHT}
                    onChange={(e) => {
                      const n = safeNumber(e.target.value);
                      if (n === null) return;
                      handleParamChange('boxSpawn', {
                        ...step.params.boxSpawn,
                        mode: 'random',
                        maxHeight: n,
                      });
                    }}
                    className="w-full h-6 px-1 text-[10px] font-mono border border-[#D1D5DB] rounded-sm bg-white"
                    step={10}
                  />
                </div>
              </div>
              {/* 停止高度 */}
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[#64748B] font-medium">停止高度</span>
                  <span className="text-[9px] text-[#22C55E]">(箱子落至此悬停)</span>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label="箱子停止高度"
                  value={step.params.boxSpawn?.restingHeight ?? DEFAULT_SEQUENCE_BOX_RESTING_HEIGHT}
                  onChange={(e) => {
                    const n = safeNumber(e.target.value);
                    if (n === null) return;
                    handleParamChange('boxSpawn', {
                      ...step.params.boxSpawn,
                      mode: 'random',
                      restingHeight: n,
                    });
                  }}
                  className="w-full h-6 px-1 text-[10px] font-mono border border-[#D1D5DB] rounded-sm bg-white"
                  step={10} min={10}
                />
              </div>
              <div className="text-[9px] text-[#94A3B8]">
                箱子在橙色围栏内随机生成，从 min~max 高度自由落体至停止高度悬停
              </div>
              <div className="text-[9px] text-[#94A3B8]">
                箱体尺寸固定为 480 mm x 480 mm x 480 mm
              </div>
            </div>
          )}
        </div>
      )}

      {/* 移动到箱子上方 */}
      {step.type === '移动到箱子上方' && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#64748B] w-16 shrink-0">接近高度</span>
            <input
              type="number"
              inputMode="decimal"
              autoComplete="off"
              aria-label="接近高度"
              value={step.params.approachHeight ?? DEFAULT_SEQUENCE_APPROACH_HEIGHT}
              onChange={(e) => { const n = safeNumber(e.target.value); if (n !== null) handleParamChange('approachHeight', n); }}
              className="flex-1 h-6 px-1.5 text-[11px] font-mono border border-[#D1D5DB] rounded-sm bg-white"
              step={10} min={10} max={200}
            />
            <span className="text-[10px] text-[#94A3B8] shrink-0">mm</span>
          </div>
        </div>
      )}

      {/* 抬升 */}
      {step.type === '抬升' && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#64748B] w-16 shrink-0">抬升高度</span>
            <input
              type="number"
              inputMode="decimal"
              autoComplete="off"
              aria-label="抬升高度"
              value={step.params.liftHeight ?? DEFAULT_SEQUENCE_LIFT_HEIGHT}
              onChange={(e) => { const n = safeNumber(e.target.value); if (n !== null) handleParamChange('liftHeight', n); }}
              className="flex-1 h-6 px-1.5 text-[11px] font-mono border border-[#D1D5DB] rounded-sm bg-white"
              step={10} min={10} max={500}
            />
            <span className="text-[10px] text-[#94A3B8] shrink-0">mm</span>
          </div>
        </div>
      )}

      {/* 移动到目标位姿 */}
      {step.type === '移动到目标位姿' && (
        <div className="space-y-1">
          <div className="text-[10px] text-[#64748B] font-medium">选择目标位姿</div>
          <select
            aria-label="选择目标位姿"
            value={step.params.memoryPointName ?? DEFAULT_SEQUENCE_PLACE_PRESET_NAME}
            onChange={(e) => handleParamChange('memoryPointName', e.target.value)}
            className="w-full h-7 px-1.5 text-[11px] border border-[#D1D5DB] rounded-sm bg-white"
          >
            <option value={DEFAULT_SEQUENCE_PLACE_PRESET_NAME}>
              {DEFAULT_SEQUENCE_PLACE_PRESET_LABEL} [0.102, 1.115, 1.143] m · [-126.3°, 87.8°, -38.2°]
            </option>
            {waypoints.map((wp) => (
              <option key={wp.name} value={wp.name}>
                {wp.name} [{wp.joints.map((j) => j.toFixed(0)).join(', ')}]
              </option>
            ))}
          </select>
          <div className="text-[9px] text-[#94A3B8]">
            当前内建默认位姿：[{DEFAULT_SEQUENCE_PLACE_POSITION_M[0].toFixed(3)}, {DEFAULT_SEQUENCE_PLACE_POSITION_M[1].toFixed(3)}, {DEFAULT_SEQUENCE_PLACE_POSITION_M[2].toFixed(3)}] m · [{DEFAULT_SEQUENCE_PLACE_ORIENTATION_DEG[0].toFixed(1)}°, {DEFAULT_SEQUENCE_PLACE_ORIENTATION_DEG[1].toFixed(1)}°, {DEFAULT_SEQUENCE_PLACE_ORIENTATION_DEG[2].toFixed(1)}°]
          </div>
        </div>
      )}

      {/* 等待 */}
      {step.type === '等待' && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#64748B] w-16 shrink-0">等待时长</span>
            <input
              type="number"
              inputMode="decimal"
              autoComplete="off"
              aria-label="等待时长"
              value={step.params.waitDuration ?? 1000}
              onChange={(e) => { const n = safeNumber(e.target.value); if (n !== null) handleParamChange('waitDuration', n); }}
              className="flex-1 h-6 px-1.5 text-[11px] font-mono border border-[#D1D5DB] rounded-sm bg-white"
              step={100} min={0} max={10000}
            />
            <span className="text-[10px] text-[#94A3B8] shrink-0">ms</span>
          </div>
        </div>
      )}

      {/* 无参数步骤 */}
      {(step.type === '拍照' ||
        step.type === '删除所有箱子' ||
        step.type === '下降到箱面' || step.type === '吸盘开启' ||
        step.type === '吸盘关闭' || step.type === '归位') && (
        <div className="text-[10px] text-[#94A3B8]">此步骤无需参数</div>
      )}

      {/* 执行状态提示 */}
      {step.execStatus === 'error' && step.execMessage && (
        <div className="text-[10px] text-[#DC2626] bg-[#FEF2F2] px-2 py-1 rounded-sm border border-[#FECACA]">
          {step.execMessage}
        </div>
      )}
    </div>
  );
}
