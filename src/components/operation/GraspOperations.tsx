// src/components/operation/GraspOperations.tsx
import { Box, Power, PowerOff, Play, Grip } from 'lucide-react';
import type { OperationPanelProps } from './OperationPanel';
import SequenceEditor from '@/components/sequence/SequenceEditor';

export default function GraspOperations(props: OperationPanelProps) {
  const stepId = props.currentStep.id;
  const isFree = props.mode === 'free';

  const boxStateText: Record<string, string> = {
    NONE: '无物体',
    FREE: '自由',
    FALLING: '下落中',
    ATTACHED: '已吸附',
    PLACED: '已放置',
    RESTING: '静止',
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 border-l-4 border-l-blue-500 shadow-sm">
        <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">当前任务</p>
        <p className="text-[15px] font-bold text-slate-800">{props.currentStep.title}</p>
      </div>

      {/* 吸盘状态 / 认识吸盘 */}
      {(stepId === 'grasp-sucker' || isFree) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Grip className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">真空吸盘</p>
              <p className="text-xs text-slate-500">末端执行器</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            吸盘通过负压吸附物体表面。开启吸盘时内部气压降低，大气压将物体压在吸盘上。
          </p>
        </div>
      )}

      {/* 生成物体 */}
      {(stepId === 'grasp-spawn' || isFree) && (
        <button
          type="button"
          onClick={() => props.spawnBox([-1135, 400, 56], 40)}
          className="w-full py-3 text-[13px] font-semibold rounded-xl text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100 flex items-center justify-center gap-2"
        >
          <Box className="w-4 h-4" />
          生成物体
        </button>
      )}

      {/* 吸取/释放 */}
      {(stepId === 'grasp-attach' || isFree) && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={props.turnSuckerOn}
            disabled={props.suckerOn}
            className="w-full py-3 text-[13px] font-semibold rounded-xl text-white bg-gradient-to-r from-blue-500 to-blue-600 border border-blue-600 shadow-sm hover:from-blue-600 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Power className="w-4 h-4" />
            开启吸盘
          </button>
          <button
            type="button"
            onClick={props.turnSuckerOff}
            disabled={!props.suckerOn}
            className="w-full py-3 text-[13px] font-semibold rounded-xl text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <PowerOff className="w-4 h-4" />
            关闭吸盘
          </button>
        </div>
      )}

      {/* 抓取状态 */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <p className="text-xs font-semibold text-slate-700 mb-2">抓取状态</p>
        <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200">
          <div
            className={`w-2 h-2 rounded-full ${
              props.suckerOn ? 'bg-green-500 animate-pulse' : 'bg-slate-300'
            }`}
          />
          <span className="text-xs text-slate-600">
            {props.suckerOn ? '吸盘已开启' : '吸盘未开启'} · {boxStateText[props.boxState] ?? props.boxState}
          </span>
        </div>
      </div>

      {/* 动作序列 */}
      {(stepId === 'grasp-sequence' || isFree) && (
        <SequenceEditor
          steps={props.sequenceSteps}
          setStepsList={props.setSequenceSteps}
          currentStepIndex={props.sequenceCurrentStep}
          status={props.sequenceStatus}
          logs={props.sequenceLogs}
          addStep={props.onSequenceAddStep}
          removeStep={props.onSequenceRemoveStep}
          moveStep={props.onSequenceMoveStep}
          updateStep={props.onSequenceUpdateStep}
          runSequence={props.onSequenceRun}
          runSingleStep={props.onSequenceStep}
          stopSequence={props.onSequenceStop}
          resetSequence={props.onSequenceReset}
          waypoints={props.waypoints}
          captureImages={props.captureImages}
          suckerOn={props.suckerOn}
          boxState={props.boxState}
        />
      )}

      {/* 执行完整抓取 */}
      {(stepId === 'grasp-attach' || stepId === 'grasp-sequence' || isFree) && (
        <button
          type="button"
          onClick={() => {
            props.spawnBox([-1135, 400, 56], 40);
            props.turnSuckerOn();
          }}
          className="w-full py-3 text-[13px] font-semibold rounded-xl text-white bg-gradient-to-r from-blue-500 to-blue-600 border border-blue-600 shadow-sm hover:from-blue-600 hover:to-blue-700 flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4" />
          执行完整抓取
        </button>
      )}
    </div>
  );
}
