// src/components/operation/GraspOperations.tsx
// 抓取实训右侧操作面板：按步骤提供吸盘显示、生成物体、一键接近、吸盘开关、动作序列
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Box, Power, PowerOff, Grip, MoveUp, AlertCircle, Play } from 'lucide-react';
import type { GraspOperationsProps } from './panel-types';
import SequenceEditor from '@/components/sequence/SequenceEditor';
import PoseControlCard from '@/components/PoseControlCard';
import PositionTargetCard from '@/components/PositionTargetCard';
import { SUCKER_LENGTH, APPROACH_HEIGHT } from '@/hooks/useSuckerControl';
import SuckerDemoModal from '@/components/learning/SuckerDemoModal';
import { buildGraspApproachPose, buildPlacePose } from '@/lib/grasp-planning';
import {
  DEFAULT_SEQUENCE_PLACE_ORIENTATION_DEG,
  DEFAULT_SEQUENCE_PLACE_POSITION_M,
  DEFAULT_SEQUENCE_PLACE_PRESET_NAME,
} from '@/types/sequence';

const boxStateText: Record<string, string> = {
  NONE: '无物体',
  FREE: '自由',
  FALLING: '下落中',
  ATTACHED: '已吸附',
  PLACED: '已放置',
  RESTING: '静止',
};

export default function GraspOperations(props: GraspOperationsProps) {
  const stepId = props.currentStep.id;
  const { sequenceSteps, setSequenceSteps, waypoints } = props;
  const [showSuckerDemo, setShowSuckerDemo] = useState(false);

  const isSuckerVisible = props.selectedTool === '吸盘';
  const handleToggleSucker = () => {
    props.setSelectedTool(isSuckerVisible ? '无' : '吸盘');
  };

  // grasp-sequence 步骤进入时自动加载默认完整抓取序列
  useEffect(() => {
    if (stepId !== 'grasp-sequence') return;

    // 首次进入且未被用户手动清空时，自动加载默认序列
    if (sequenceSteps.length === 0 && !props.suppressAutoDefaultLoad) {
      props.loadDefaultSequence();
      return;
    }

    // 如果记忆点发生变化，确保"移动到目标位姿"步骤仍然指向有效记忆点
    if (waypoints.length > 0) {
      const validNames = new Set([
        DEFAULT_SEQUENCE_PLACE_PRESET_NAME,
        ...waypoints.map((wp) => wp.name),
      ]);
      const needsUpdate = sequenceSteps.some(
        (s) =>
          s.type === '移动到目标位姿' &&
          s.params.memoryPointName &&
          !validNames.has(s.params.memoryPointName)
      );
      if (needsUpdate) {
        const firstName = waypoints[0].name;
        setSequenceSteps(
          sequenceSteps.map((s) =>
            s.type === '移动到目标位姿' && s.params.memoryPointName && !validNames.has(s.params.memoryPointName)
              ? { ...s, params: { ...s.params, memoryPointName: firstName } }
              : s
          )
        );
      }
    }
  }, [
    stepId,
    sequenceSteps,
    setSequenceSteps,
    waypoints,
    props.loadDefaultSequence,
    props.suppressAutoDefaultLoad,
  ]);

  // 一键移动到箱子上方（grasp-approach 步骤使用）
  const handleApproachBox = () => {
    if (props.boxState === 'NONE') return;
    const [bx, by, bz] = props.boxPosition;
    const approachPose = buildGraspApproachPose(props.boxPosition);
    console.log('[GraspOperations] 移动到箱子上方', {
      boxState: props.boxState,
      boxPositionMm: { x: bx, y: by, z: bz },
      targetPositionMm: { x: bx, y: approachPose.targetYMm, z: bz },
      approachHeightMm: APPROACH_HEIGHT,
      suckerLengthMm: SUCKER_LENGTH,
      targetOrientationDeg: {
        rx: approachPose.rx,
        ry: approachPose.ry,
        rz: approachPose.rz,
      },
      currentGLBPositionM: props.currentGLBPosition,
      status: props.status,
    });
    props.onGoToPosition(
      approachPose.targetXM,
      approachPose.targetYM,
      approachPose.targetZM,
      approachPose.rx,
      approachPose.ry,
      approachPose.rz,
      approachPose.profile,
    );
  };

  const handleMoveToPlacePose = () => {
    const placePose = buildPlacePose(
      DEFAULT_SEQUENCE_PLACE_POSITION_M,
      DEFAULT_SEQUENCE_PLACE_ORIENTATION_DEG,
    );

    props.onGoToPosition(
      placePose.targetXM,
      placePose.targetYM,
      placePose.targetZM,
      placePose.rx,
      placePose.ry,
      placePose.rz,
      placePose.profile,
    );
  };

  return (
    <div className="space-y-4">
      {/* 认识吸盘：显示/隐藏吸盘 */}
      {stepId === 'grasp-sucker' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Grip className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">真空吸盘</p>
              <p className="text-xs text-slate-500">末端执行器</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            吸盘内部被抽成低压后，外部大气压会把物体压在吸盘上。只要吸盘与物体表面贴合、不漏气，就能产生稳定吸附力。
          </p>
          <button
            type="button"
            onClick={handleToggleSucker}
            className={`w-full py-2.5 text-[13px] font-semibold rounded-xl border shadow-sm flex items-center justify-center gap-2 transition-colors ${
              isSuckerVisible
                ? 'bg-amber-50 text-amber-700 border-amber-300'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {isSuckerVisible ? '隐藏吸盘' : '在 3D 场景中显示吸盘'}
          </button>

          {/* 真空吸盘原理演示 */}
          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowSuckerDemo(true)}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm hover:from-blue-700 hover:to-blue-600 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Play className="w-3.5 h-3.5" />
              演示真空吸盘原理
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-1">
              点击按钮打开互动演示，手动操作吸盘体验真空吸附
            </p>
          </div>
        </div>
      )}

      {/* 生成物体 */}
      {stepId === 'grasp-spawn' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => props.spawnBox([-1000, 350, 0], 200)}
            className="w-full py-3 text-[13px] font-semibold rounded-xl text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100 flex items-center justify-center gap-2"
          >
            <Box className="w-4 h-4" />
            固定位置生成
          </button>
          <button
            type="button"
            onClick={() =>
              props.spawnBox([-1100 + Math.random() * 250, 350, -100 + Math.random() * 200], 200)
            }
            className="w-full py-3 text-[13px] font-semibold rounded-xl text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100 flex items-center justify-center gap-2"
          >
            <Box className="w-4 h-4" />
            随机位置生成
          </button>
        </div>
      )}

      {/* 接近物体：一键移动到箱子上方 */}
      {stepId === 'grasp-approach' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleApproachBox}
            disabled={props.boxState === 'NONE' || props.boxState === 'FALLING' || props.status === 'moving'}
            className="w-full py-3 text-[13px] font-semibold rounded-xl text-white bg-gradient-to-r from-blue-500 to-blue-600 border border-blue-600 shadow-sm hover:from-blue-600 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <MoveUp className="w-4 h-4" />
            移动到箱子上方
          </button>
          {props.boxState === 'NONE' && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>请先在"生成物体"步骤中生成一个箱子。</span>
            </div>
          )}
          {/* 手动微调位姿与目标坐标 */}
          <PoseControlCard
            coordinateSystem={props.coordinateSystem}
            onCoordinateChange={props.onCoordinateChange}
            posStep={props.posStep}
            onPosStepChange={props.onPosStepChange}
            rotStep={props.rotStep}
            onRotStepChange={props.onRotStepChange}
            onMoveDirection={props.onMoveDirection}
          />
          <PositionTargetCard
            currentGLBPosition={props.currentGLBPosition}
            onGoToPosition={props.onGoToPosition}
          />
        </div>
      )}

      {/* 吸取/释放 */}
      {stepId === 'grasp-attach' && (
        <div className="space-y-3">
          {/* 放置区参考：提供预设放置坐标与一键到达 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <p className="text-sm font-bold text-slate-800">放置区参考</p>
            <p className="text-xs text-slate-500">
              预设放置位姿：[0.102, 1.115, 1.143] m · [-126.3°, 87.8°, -38.2°]
            </p>
            <button
              type="button"
              onClick={handleMoveToPlacePose}
              disabled={props.status === 'moving'}
              className="w-full py-2.5 text-[13px] font-semibold rounded-xl text-white bg-gradient-to-r from-emerald-500 to-emerald-600 border border-emerald-600 shadow-sm hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <MoveUp className="w-4 h-4" />
              移动到放置区
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              console.log('[GraspOperations] 开启吸盘点击', {
                boxState: props.boxState,
                boxPositionMm: {
                  x: props.boxPosition[0],
                  y: props.boxPosition[1],
                  z: props.boxPosition[2],
                },
                suckerOn: props.suckerOn,
                currentGLBPositionM: props.currentGLBPosition,
                status: props.status,
              });
              props.turnSuckerOn();
            }}
            disabled={
              props.suckerOn ||
              props.boxState === 'NONE' ||
              props.boxState === 'FALLING'
            }
            className="w-full py-3 text-[13px] font-semibold rounded-xl text-white bg-gradient-to-r from-blue-500 to-blue-600 border border-blue-600 shadow-sm hover:from-blue-600 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Power className="w-4 h-4" />
            开启吸盘
          </button>
          {(props.boxState === 'NONE' || props.boxState === 'FALLING') && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>请先生成箱子并接近箱面。</span>
            </div>
          )}
          {props.boxState === 'FREE' && (
            <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>请确认吸盘已贴近箱面，然后开启吸盘进行吸附。</span>
            </div>
          )}
          <button
            type="button"
            onClick={props.turnSuckerOff}
            disabled={!props.suckerOn}
            className="w-full py-3 text-[13px] font-semibold rounded-xl text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <PowerOff className="w-4 h-4" />
            关闭吸盘
          </button>

          {/* 搬运控制：位姿方向键 + 目标坐标，用于把箱子移动到放置区 */}
          <PoseControlCard
            coordinateSystem={props.coordinateSystem}
            onCoordinateChange={props.onCoordinateChange}
            posStep={props.posStep}
            onPosStepChange={props.onPosStepChange}
            rotStep={props.rotStep}
            onRotStepChange={props.onRotStepChange}
            onMoveDirection={props.onMoveDirection}
          />
          <PositionTargetCard
            currentGLBPosition={props.currentGLBPosition}
            onGoToPosition={props.onGoToPosition}
          />
        </div>
      )}

      {/* 抓取状态：仅在 grasp-attach 步骤显示 */}
      {stepId === 'grasp-attach' && (
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
      )}

      {/* 动作序列： grasp-sequence 步骤显示 */}
      {stepId === 'grasp-sequence' && (
        <div className="space-y-3">
          <SequenceEditor
            steps={props.sequenceSteps}
            currentStepIndex={props.sequenceCurrentStep}
            status={props.sequenceStatus}
            logs={props.sequenceLogs}
            loadDefaultSequence={props.loadDefaultSequence}
            clearSequence={props.clearSequence}
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
        </div>
      )}

      {/* 真空吸盘原理演示弹窗（Portal 到 body，确保渲染在最顶层） */}
      {showSuckerDemo &&
        createPortal(
          <SuckerDemoModal onClose={() => setShowSuckerDemo(false)} />,
          document.body
        )}
    </div>
  );
}
