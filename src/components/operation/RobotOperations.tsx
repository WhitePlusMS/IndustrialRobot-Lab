import JointAngleCard from '@/components/JointAngleCard';
import PoseControlCard from '@/components/PoseControlCard';
import PositionTargetCard from '@/components/PositionTargetCard';
import WaypointPanel from '@/components/WaypointPanel';
import { useSceneViewport } from '@/contexts/SceneViewportContext';
import { useLearning } from '@/contexts/LearningContext';
import { useRobotActionsContext, useRobotStateContext } from '@/contexts/RobotContext';
import { Eye, EyeOff, Grip } from 'lucide-react';

export default function RobotOperations() {
  const { currentStep } = useLearning();
  const robotState = useRobotStateContext();
  const robotActions = useRobotActionsContext();
  const viewport = useSceneViewport();
  if (!currentStep) return null;
  const stepId = currentStep.id;

  const isStructureStep = stepId === 'robot-structure';
  const isCoordinateStep = stepId === 'robot-coordinate';
  const isSingleJointStep = stepId === 'robot-single-joint';
  const isMultiJointStep = stepId === 'robot-multi-joint';
  const isCartesianStep = stepId === 'robot-cartesian';

  const jointCards = [
    { j: 'J1', name: '底座旋转', index: 0 },
    { j: 'J2', name: '肩部俯仰', index: 1 },
    { j: 'J3', name: '肘部俯仰', index: 2 },
    { j: 'J4', name: '腕部旋转', index: 3 },
    { j: 'J5', name: '腕部俯仰', index: 4 },
    { j: 'J6', name: '末端旋转', index: 5 },
  ];

  const handleJointCardClick = (index: number) => {
    robotActions.setHighlightedJoint(robotState.highlightedJoint === index ? null : index);
  };

  const isSuckerVisible = robotState.selectedTool === '吸盘';
  const handleToggleSucker = () => {
    robotActions.setSelectedTool(isSuckerVisible ? '无' : '吸盘');
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-800">坐标系可视化</p>
          <button
            type="button"
            onClick={viewport.toggleCoordinateSystems}
            className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
              viewport.showCoordinateSystems
                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {viewport.showCoordinateSystems ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {viewport.showCoordinateSystems ? '隐藏坐标系' : '显示坐标系'}
          </button>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          开启后，3D 场景中同时显示底座处的基坐标系（World）和末端法兰处的工具坐标系（Tool），便于观察两者之间的区别。
        </p>
      </div>

      {isStructureStep && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {jointCards.map(({ j, name, index }) => {
              const active = robotState.highlightedJoint === index;
              return (
                <button
                  key={j}
                  type="button"
                  onClick={() => handleJointCardClick(index)}
                  className={`text-left px-3 py-3 rounded-xl text-xs font-semibold flex flex-col gap-1 border shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    active
                      ? 'bg-blue-50 border-blue-400 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <span className={`text-sm ${active ? 'text-blue-700' : 'text-blue-600'}`}>{j}</span>
                  <span className="text-slate-500 font-normal">{name}</span>
                </button>
              );
            })}
          </div>

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
              吸盘安装在末端法兰下方，是机械臂与物体交互的工具。开启后可在 3D 场景中观察它与末端法兰的连接方式。
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
        </div>
      )}

      {(isSingleJointStep || isMultiJointStep) && (
        <JointAngleCard
          joints={robotState.joints}
          config={robotState.config}
          jointStep={robotState.jointStep}
          onJointStepChange={robotActions.setJointStep}
          onAdjustJoint={robotActions.adjustJoint}
          onSetJoint={robotActions.setJoint}
          sliderTargetRef={robotActions.sliderTargetRef}
          onReset={robotActions.resetJoints}
          onRandom={robotActions.randomJoints}
          collapsible={false}
          enabledJoints={isSingleJointStep ? [0] : [1, 2]}
        />
      )}

      {isCoordinateStep && (
        <PoseControlCard
          coordinateSystem={robotState.coordinateSystem}
          onCoordinateChange={robotActions.setCoordinateSystem}
          posStep={robotState.posStep}
          onPosStepChange={robotActions.setPosStep}
          rotStep={robotState.rotStep}
          onRotStepChange={robotActions.setRotStep}
          onMoveDirection={robotActions.moveDirection}
        />
      )}

      {isCartesianStep && (
        <>
          <PositionTargetCard
            currentGLBPosition={robotState.glbPosition}
            onGoToPosition={robotActions.goToPosition}
            disabled={robotState.status === 'moving'}
          />
          <PoseControlCard
            coordinateSystem={robotState.coordinateSystem}
            onCoordinateChange={robotActions.setCoordinateSystem}
            posStep={robotState.posStep}
            onPosStepChange={robotActions.setPosStep}
            rotStep={robotState.rotStep}
            onRotStepChange={robotActions.setRotStep}
            onMoveDirection={robotActions.moveDirection}
          />
          <WaypointPanel currentJoints={robotState.joints} onGotoWaypoint={robotActions.goToJoints} />
        </>
      )}
    </div>
  );
}
