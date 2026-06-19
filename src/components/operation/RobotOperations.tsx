// src/components/operation/RobotOperations.tsx
import { useState } from 'react';
import { Bot, RotateCcw } from 'lucide-react';
import type { OperationPanelData } from './OperationPanel';
import JointAngleCard from '@/components/JointAngleCard';
import PoseControlCard from '@/components/PoseControlCard';
import PositionTargetCard from '@/components/PositionTargetCard';
import WaypointPanel from '@/components/WaypointPanel';

export default function RobotOperations(props: OperationPanelData) {
  const stepId = props.currentStep.id;
  const isFree = props.mode === 'free';

  // J1 single joint control state
  const [j1Value, setJ1Value] = useState(props.joints[0]);

  const handleJ1Change = (value: number) => {
    const clamped = Math.max(-180, Math.min(180, value));
    setJ1Value(clamped);
    const delta = clamped - props.joints[0];
    if (Math.abs(delta) > 0.01) {
      props.onAdjustJoint(0, delta, false);
    }
  };

  const isStructureStep = stepId === 'robot-structure' || isFree;
  const isCoordinateStep = stepId === 'robot-coordinate' || isFree;
  const isSingleJointStep = stepId === 'robot-single-joint' || isFree;
  const isMultiJointStep = stepId === 'robot-multi-joint' || isFree;
  const isCartesianStep = stepId === 'robot-cartesian' || isFree;

  return (
    <div className="space-y-4">
      {/* 当前任务 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 border-l-4 border-l-blue-500 shadow-sm">
        <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">当前任务</p>
        <p className="text-[15px] font-bold text-slate-800">{props.currentStep.title}</p>
      </div>

      {/* 关节认识卡片 */}
      {isStructureStep && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { j: 'J1', name: '底座旋转' },
            { j: 'J2', name: '肩部俯仰' },
            { j: 'J3', name: '肘部俯仰' },
            { j: 'J4', name: '腕部旋转' },
            { j: 'J5', name: '腕部俯仰' },
            { j: 'J6', name: '末端旋转' },
          ].map(({ j, name }) => (
            <button
              key={j}
              type="button"
              className="text-left px-3 py-3 rounded-xl text-xs font-semibold text-slate-700 flex flex-col gap-1 bg-white border border-slate-200 shadow-sm hover:border-blue-300 hover:bg-blue-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span className="text-blue-600 text-sm">{j}</span>
              <span className="text-slate-500 font-normal">{name}</span>
            </button>
          ))}
        </div>
      )}

      {/* 坐标系切换 */}
      {isCoordinateStep && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          {[
            { value: 'World' as const, title: '基坐标系', desc: '固定在机械臂底座' },
            { value: 'Tool' as const, title: '工具坐标系', desc: '固定在末端执行器' },
          ].map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-3 p-4 rounded-xl cursor-pointer border border-slate-200 hover:border-blue-300 transition-colors bg-white"
            >
              <input
                type="radio"
                name="coord-system"
                value={opt.value}
                checked={props.coordinateSystem === opt.value}
                onChange={() => props.onCoordinateChange(opt.value)}
                className="w-4 h-4 text-blue-600 accent-blue-600"
              />
              <div>
                <p className="text-[13px] font-semibold text-slate-700">{opt.title}</p>
                <p className="text-[11px] text-slate-500">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      )}

      {/* J1 单关节控制 */}
      {(isSingleJointStep || isFree) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <label className="text-[13px] font-semibold text-slate-700">J1 关节角度</label>
            <span className="font-mono text-lg font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
              {props.joints[0].toFixed(1)}°
            </span>
          </div>
          <input
            type="range"
            min={-180}
            max={180}
            step={0.1}
            value={j1Value}
            onChange={(e) => handleJ1Change(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500 mb-4"
          />
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-4">
            <span>-180°</span>
            <span>0°</span>
            <span>180°</span>
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => handleJ1Change(j1Value - 5)}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-lg font-bold text-slate-600 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => handleJ1Change(0)}
              className="px-4 h-10 text-xs font-medium text-slate-600 rounded-lg bg-white border border-slate-200 shadow-sm hover:bg-slate-50"
            >
              归零
            </button>
            <button
              type="button"
              onClick={() => handleJ1Change(j1Value + 5)}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-lg font-bold text-slate-600 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100"
            >
              +
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[-30, 0, 30, 60, 90, 180].map((deg) => (
              <button
                key={deg}
                type="button"
                onClick={() => handleJ1Change(deg)}
                className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                  Math.abs(j1Value - deg) < 0.1
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {deg}°
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 多关节联动 J2/J3 */}
      {(isMultiJointStep || isFree) && (
        <div className="space-y-3">
          {[1, 2].map((idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[13px] font-semibold text-slate-700">J{idx + 1} 关节角度</label>
                <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {props.joints[idx].toFixed(1)}°
                </span>
              </div>
              <input
                type="range"
                min={-90}
                max={90}
                step={0.1}
                value={props.joints[idx]}
                onChange={(e) => props.onAdjustJoint(idx, parseFloat(e.target.value) - props.joints[idx], false)}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          ))}
        </div>
      )}

      {/* 末端位置控制 */}
      {isCartesianStep && (
        <PositionTargetCard
          currentGLBPosition={props.currentGLBPosition}
          onGoToPosition={props.onGoToPosition}
          disabled={props.status === 'moving'}
        />
      )}

      {/* 自由模式额外控件 */}
      {isFree && (
        <>
          <JointAngleCard
            joints={props.joints}
            config={props.config}
            jointStep={props.jointStep}
            onJointStepChange={props.onJointStepChange}
            onAdjustJoint={props.onAdjustJoint}
            onSetJoint={props.onSetJoint}
            sliderTargetRef={props.sliderTargetRef}
            onReset={props.onReset}
            onRandom={props.onRandom}
          />
          <PoseControlCard
            coordinateSystem={props.coordinateSystem}
            onCoordinateChange={props.onCoordinateChange}
            posStep={props.posStep}
            onPosStepChange={props.onPosStepChange}
            rotStep={props.rotStep}
            onRotStepChange={props.onRotStepChange}
            onMoveDirection={props.onMoveDirection}
          />
          <WaypointPanel currentJoints={props.joints} onGotoWaypoint={props.onGotoWaypoint} />
        </>
      )}

      {/* 检查答案按钮（单关节步骤） */}
      {stepId === 'robot-single-joint' && (
        <button
          type="button"
          onClick={() => {
            if (Math.abs(props.joints[0] - 30) < 0.5) {
              alert('✅ 回答正确！J1 已旋转到 30°。');
            } else {
              alert(`❌ 当前 J1 为 ${props.joints[0].toFixed(1)}°，请调整到 30°。`);
            }
          }}
          className="w-full py-3 text-[13px] font-semibold rounded-xl text-white bg-gradient-to-r from-blue-500 to-blue-600 border border-blue-600 shadow-sm hover:from-blue-600 hover:to-blue-700"
        >
          检查答案
        </button>
      )}

      {/* 认识完成按钮 */}
      {stepId === 'robot-structure' && (
        <button
          type="button"
          className="w-full py-3 text-[13px] font-semibold rounded-xl text-white bg-gradient-to-r from-green-500 to-green-600 border border-green-600 shadow-sm hover:from-green-600 hover:to-green-700 flex items-center justify-center gap-2"
        >
          <Bot className="w-4 h-4" />
          我已认识所有关节
        </button>
      )}

      {/* 坐标系理解按钮 */}
      {stepId === 'robot-coordinate' && (
        <button
          type="button"
          onClick={() => {
            props.onCoordinateChange('World');
            alert('✅ 已重置为基坐标系显示。');
          }}
          className="w-full py-3 text-[13px] font-semibold rounded-xl text-white bg-gradient-to-r from-green-500 to-green-600 border border-green-600 shadow-sm hover:from-green-600 hover:to-green-700 flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          我理解了坐标系
        </button>
      )}
    </div>
  );
}
