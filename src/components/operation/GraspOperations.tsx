// src/components/operation/GraspOperations.tsx
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Box, Power, PowerOff, Grip, MoveUp, AlertCircle, Play } from 'lucide-react';
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
import { useLearning } from '@/contexts/LearningContext';
import { useRobotContext } from '@/contexts/RobotContext';
import { useSuckerContext } from '@/contexts/SuckerContext';
import { useSequenceContext } from '@/contexts/SequenceContext';
import { useDemoPartsContext } from '@/contexts/DemoPartsContext';

const boxStateText: Record<string, string> = {
  NONE: '无物体',
  FREE: '自由',
  FALLING: '下落中',
  ATTACHED: '已吸附',
  PLACED: '已放置',
  RESTING: '静止',
};

export default function GraspOperations() {
  const { currentStep } = useLearning();
  const robot = useRobotContext();
  const sucker = useSuckerContext();
  const sequence = useSequenceContext();
  const demoParts = useDemoPartsContext();
  if (!currentStep) return null;
  const stepId = currentStep.id;
  const { steps: sequenceSteps, setStepsList, waypoints } = sequence;
  const [showSuckerDemo, setShowSuckerDemo] = useState(false);

  const isSuckerVisible = robot.selectedTool === '吸盘';
  const handleToggleSucker = () => {
    robot.setSelectedTool(isSuckerVisible ? '无' : '吸盘');
  };

  useEffect(() => {
    if (stepId !== 'grasp-sequence') return;

    if (sequenceSteps.length === 0 && !sequence.suppressAutoDefaultLoad) {
      sequence.loadDefaultSequence();
      return;
    }

    if (waypoints.length > 0) {
      const validNames = new Set([
        DEFAULT_SEQUENCE_PLACE_PRESET_NAME,
        ...waypoints.map((wp) => wp.name),
      ]);
      const needsUpdate = sequenceSteps.some(
        (s) => s.type === '移动到目标位姿' && s.params.memoryPointName && !validNames.has(s.params.memoryPointName)
      );
      if (needsUpdate) {
        const firstName = waypoints[0].name;
        setStepsList(
          sequenceSteps.map((s) =>
            s.type === '移动到目标位姿' && s.params.memoryPointName && !validNames.has(s.params.memoryPointName)
              ? { ...s, params: { ...s.params, memoryPointName: firstName } }
              : s
          )
        );
      }
    }
  }, [sequence, sequenceSteps, setStepsList, stepId, waypoints]);

  const handleApproachBox = () => {
    if (sucker.boxState === 'NONE') return;
    const [bx, by, bz] = sucker.boxPosition;
    const approachPose = buildGraspApproachPose(sucker.boxPosition);
    console.log('[GraspOperations] 移动到箱子上方', {
      boxState: sucker.boxState,
      boxPositionMm: { x: bx, y: by, z: bz },
      targetPositionMm: {
        x: approachPose.positionMm[0],
        y: approachPose.positionMm[1],
        z: approachPose.positionMm[2],
      },
      approachHeightMm: APPROACH_HEIGHT,
      suckerLengthMm: SUCKER_LENGTH,
      targetOrientationDeg: approachPose.orientationDeg,
      currentGLBPositionM: robot.glbPosition,
      status: robot.status,
    });
    robot.goToPoseMm(approachPose);
  };

  const handleMoveToPlacePose = () => {
    const placePose = buildPlacePose(
      DEFAULT_SEQUENCE_PLACE_POSITION_M,
      DEFAULT_SEQUENCE_PLACE_ORIENTATION_DEG,
    );
    robot.goToPoseMm(placePose);
  };

  return (
    <div className="space-y-4">
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

      {stepId === 'grasp-spawn' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => sucker.spawnBox([-1000, 350, 0], 200)}
            className="w-full py-3 text-[13px] font-semibold rounded-xl text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100 flex items-center justify-center gap-2"
          >
            <Box className="w-4 h-4" />
            固定位置生成
          </button>
          <button
            type="button"
            onClick={() => sucker.spawnBox([-1100 + Math.random() * 250, 350, -100 + Math.random() * 200], 200)}
            className="w-full py-3 text-[13px] font-semibold rounded-xl text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100 flex items-center justify-center gap-2"
          >
            <Box className="w-4 h-4" />
            随机位置生成
          </button>
        </div>
      )}

      {stepId === 'grasp-approach' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleApproachBox}
            disabled={sucker.boxState === 'NONE' || sucker.boxState === 'FALLING' || robot.status === 'moving'}
            className="w-full py-3 text-[13px] font-semibold rounded-xl text-white bg-gradient-to-r from-blue-500 to-blue-600 border border-blue-600 shadow-sm hover:from-blue-600 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <MoveUp className="w-4 h-4" />
            移动到箱子上方
          </button>
          {sucker.boxState === 'NONE' && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>请先在"生成物体"步骤中生成一个箱子。</span>
            </div>
          )}
          <PoseControlCard
            coordinateSystem={robot.coordinateSystem}
            onCoordinateChange={robot.setCoordinateSystem}
            posStep={robot.posStep}
            onPosStepChange={robot.setPosStep}
            rotStep={robot.rotStep}
            onRotStepChange={robot.setRotStep}
            onMoveDirection={robot.moveDirection}
          />
          <PositionTargetCard
            currentGLBPosition={robot.glbPosition}
            onGoToPosition={robot.goToPosition}
            disabled={robot.status === 'moving'}
          />
        </div>
      )}

      {stepId === 'grasp-place' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleMoveToPlacePose}
            disabled={robot.status === 'moving'}
            className="w-full py-3 text-[13px] font-semibold rounded-xl text-white bg-gradient-to-r from-blue-500 to-blue-600 border border-blue-600 shadow-sm hover:from-blue-600 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <MoveUp className="w-4 h-4" />
            移动到预设放置位姿
          </button>
        </div>
      )}

      {stepId === 'grasp-control' && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={sucker.turnSuckerOn}
            disabled={sucker.suckerOn}
            className="py-2.5 text-xs font-semibold rounded-lg text-white bg-gradient-to-r from-blue-500 to-blue-600 border border-blue-600 shadow-sm hover:from-blue-600 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            <Power className="w-3.5 h-3.5" />
            开启吸盘
          </button>
          <button
            type="button"
            onClick={sucker.turnSuckerOff}
            disabled={!sucker.suckerOn}
            className="py-2.5 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            <PowerOff className="w-3.5 h-3.5" />
            关闭吸盘
          </button>
        </div>
      )}

      {stepId === 'grasp-sequence' && (
        <SequenceEditor
          steps={sequence.steps}
          currentStepIndex={sequence.currentStepIndex}
          status={sequence.status}
          logs={sequence.logs}
          loadDefaultSequence={sequence.loadDefaultSequence}
          clearSequence={sequence.clearSequence}
          addStep={sequence.addStep}
          removeStep={sequence.removeStep}
          moveStep={sequence.moveStep}
          updateStep={sequence.updateStep}
          runSequence={sequence.runSequence}
          runSingleStep={sequence.runSingleStep}
          stopSequence={sequence.stopSequence}
          resetSequence={sequence.resetSequence}
          waypoints={sequence.waypoints}
          captureImages={sequence.captureImages}
          suckerOn={sucker.suckerOn}
          boxState={sucker.boxState}
        />
      )}

      {stepId === 'grasp-demo-parts' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => demoParts.spawnParts(5, 60, {
              position: [0, 1.5, 0],
              rotation: [-90, 0, 0],
              fov: 60,
              near: 0.1,
              far: 10,
            })}
            className="w-full py-3 text-[13px] font-semibold rounded-xl text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100 flex items-center justify-center gap-2"
          >
            <Box className="w-4 h-4" />
            生成演示零件
          </button>
          <button
            type="button"
            onClick={demoParts.clearParts}
            disabled={demoParts.parts.length === 0}
            className="w-full py-3 text-[13px] font-semibold rounded-xl text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40"
          >
            清空演示零件
          </button>
          <div className="text-xs text-slate-500">
            当前状态：{boxStateText[sucker.boxState] ?? sucker.boxState}
          </div>
        </div>
      )}

      {showSuckerDemo && createPortal(
        <SuckerDemoModal onClose={() => setShowSuckerDemo(false)} />,
        document.body
      )}
    </div>
  );
}
