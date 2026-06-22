// src/components/operation/GraspOperations.tsx
// 抓取实训右侧操作面板：直接读取 Context，不再通过 props 传递
import { useEffect } from 'react';
import { Box, Power, PowerOff, Grip, MoveUp, AlertCircle } from 'lucide-react';
import { useRobotContext } from '@/contexts/RobotContext';
import { useSuckerContext } from '@/contexts/SuckerContext';
import { useSequenceContext } from '@/contexts/SequenceContext';
import type { CourseStep } from '@/lib/course-config';
import SequenceEditor from '@/components/sequence/SequenceEditor';
import PoseControlCard from '@/components/PoseControlCard';
import PositionTargetCard from '@/components/PositionTargetCard';
import { BOX_HALF_SIZE, SUCKER_LENGTH, APPROACH_HEIGHT } from '@/hooks/useSuckerControl';
import { createDefaultGraspSequence } from '@/types/sequence';

interface GraspOperationsProps {
  currentStep: CourseStep;
}

const boxStateText: Record<string, string> = {
  NONE: '无物体',
  FREE: '自由',
  FALLING: '下落中',
  ATTACHED: '已吸附',
  PLACED: '已放置',
  RESTING: '静止',
};

export default function GraspOperations({ currentStep }: GraspOperationsProps) {
  const stepId = currentStep.id;
  const robot = useRobotContext();
  const sucker = useSuckerContext();
  const sequence = useSequenceContext();

  const isSuckerVisible = robot.selectedTool === '吸盘';
  const handleToggleSucker = () => {
    robot.setSelectedTool(isSuckerVisible ? '无' : '吸盘');
  };

  // grasp-sequence 步骤进入时自动加载默认完整抓取序列
  useEffect(() => {
    if (stepId !== 'grasp-sequence') return;

    if (sequence.steps.length === 0) {
      const defaultSteps = createDefaultGraspSequence();
      if (sequence.waypoints.length > 0) {
        const firstWaypoint = sequence.waypoints[0];
        defaultSteps.forEach((s) => {
          if (s.type === '移动到目标位姿') {
            s.params.memoryPointName = firstWaypoint.name;
          }
        });
      }
      sequence.setStepsList(defaultSteps);
      return;
    }

    if (sequence.waypoints.length > 0) {
      const validNames = new Set(sequence.waypoints.map((wp) => wp.name));
      const needsUpdate = sequence.steps.some(
        (s) =>
          s.type === '移动到目标位姿' &&
          s.params.memoryPointName &&
          !validNames.has(s.params.memoryPointName)
      );
      if (needsUpdate) {
        const firstName = sequence.waypoints[0].name;
        sequence.setStepsList(
          sequence.steps.map((s) =>
            s.type === '移动到目标位姿' && s.params.memoryPointName && !validNames.has(s.params.memoryPointName)
              ? { ...s, params: { ...s.params, memoryPointName: firstName } }
              : s
          )
        );
      }
    }
  }, [stepId, sequence]);

  // 一键移动到箱子上方
  const handleApproachBox = () => {
    if (sucker.boxState === 'NONE') return;
    const [bx, by, bz] = sucker.boxPosition;
    const targetY = by + BOX_HALF_SIZE + SUCKER_LENGTH + APPROACH_HEIGHT;
    robot.goToPosition(bx / 1000, targetY / 1000, bz / 1000);
  };

  return (
    <div className="space-y-4">
      {/* 认识吸盘 */}
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
        </div>
      )}

      {/* 生成物体 */}
      {stepId === 'grasp-spawn' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => sucker.spawnBox([400, 200, 250], 50)}
            className="w-full py-3 text-[13px] font-semibold rounded-xl text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100 flex items-center justify-center gap-2"
          >
            <Box className="w-4 h-4" />
            固定位置生成
          </button>
          <button
            type="button"
            onClick={() =>
              sucker.spawnBox([300 + Math.random() * 200, 200, 200 + Math.random() * 200], 50)
            }
            className="w-full py-3 text-[13px] font-semibold rounded-xl text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100 flex items-center justify-center gap-2"
          >
            <Box className="w-4 h-4" />
            随机位置生成
          </button>
        </div>
      )}

      {/* 接近物体 */}
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
          />
        </div>
      )}

      {/* 吸取/释放 */}
      {stepId === 'grasp-attach' && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <p className="text-sm font-bold text-slate-800">放置区参考</p>
            <p className="text-xs text-slate-500">
              预设放置坐标：[-0.4, 0.3, 0.25] m
            </p>
            <button
              type="button"
              onClick={() => robot.goToPosition(-0.4, 0.3, 0.25)}
              disabled={robot.status === 'moving'}
              className="w-full py-2.5 text-[13px] font-semibold rounded-xl text-white bg-gradient-to-r from-emerald-500 to-emerald-600 border border-emerald-600 shadow-sm hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <MoveUp className="w-4 h-4" />
              移动到放置区
            </button>
          </div>

          <button
            type="button"
            onClick={sucker.turnSuckerOn}
            disabled={
              sucker.suckerOn ||
              sucker.boxState === 'NONE' ||
              sucker.boxState === 'FALLING' ||
              sucker.boxState === 'FREE' ||
              sucker.boxState === 'RESTING'
            }
            className="w-full py-3 text-[13px] font-semibold rounded-xl text-white bg-gradient-to-r from-blue-500 to-blue-600 border border-blue-600 shadow-sm hover:from-blue-600 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Power className="w-4 h-4" />
            开启吸盘
          </button>
          {(sucker.boxState === 'NONE' || sucker.boxState === 'FALLING') && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>请先生成箱子并接近箱面。</span>
            </div>
          )}
          {(sucker.boxState === 'FREE' || sucker.boxState === 'RESTING') && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>请先移动到箱子上方让吸盘贴近箱面。</span>
            </div>
          )}
          <button
            type="button"
            onClick={sucker.turnSuckerOff}
            disabled={!sucker.suckerOn}
            className="w-full py-3 text-[13px] font-semibold rounded-xl text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <PowerOff className="w-4 h-4" />
            关闭吸盘
          </button>

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
          />
        </div>
      )}

      {/* 抓取状态 */}
      {stepId === 'grasp-attach' && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-slate-700 mb-2">抓取状态</p>
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200">
            <div
              className={`w-2 h-2 rounded-full ${
                sucker.suckerOn ? 'bg-green-500 animate-pulse' : 'bg-slate-300'
              }`}
            />
            <span className="text-xs text-slate-600">
              {sucker.suckerOn ? '吸盘已开启' : '吸盘未开启'} · {boxStateText[sucker.boxState] ?? sucker.boxState}
            </span>
          </div>
        </div>
      )}

      {/* 动作序列 */}
      {stepId === 'grasp-sequence' && (
        <div className="space-y-3">
          {sequence.waypoints.length === 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium">还没有记忆点</p>
                <p>
                  动作序列中的"移动到目标位姿"需要记忆点。请先到"末端位置控制"步骤，把机械臂移动到放置位置，然后在"记忆点管理"中保存一个点。
                </p>
              </div>
            </div>
          )}
          <SequenceEditor
            steps={sequence.steps}
            setStepsList={sequence.setStepsList}
            currentStepIndex={sequence.currentStepIndex}
            status={sequence.status}
            logs={sequence.logs}
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
        </div>
      )}
    </div>
  );
}
