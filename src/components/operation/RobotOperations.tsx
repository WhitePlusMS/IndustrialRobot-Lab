// src/components/operation/RobotOperations.tsx
// 机器人操作面板 — 直接读取 RobotContext，不再通过 props 传递
import { useRobotContext } from '@/contexts/RobotContext';
import { useSceneViewport } from '@/contexts/SceneViewportContext';
import JointAngleCard from '@/components/JointAngleCard';
import PoseControlCard from '@/components/PoseControlCard';
import PositionTargetCard from '@/components/PositionTargetCard';
import WaypointPanel from '@/components/WaypointPanel';
import type { CourseStep } from '@/lib/course-config';
import { Eye, EyeOff, Grip } from 'lucide-react';

interface RobotOperationsProps {
  currentStep: CourseStep;
}

export default function RobotOperations({ currentStep }: RobotOperationsProps) {
  const stepId = currentStep.id;
  const robot = useRobotContext();
  const viewport = useSceneViewport();

  const isStructureStep = stepId === 'robot-structure';
  const isCoordinateStep = stepId === 'robot-coordinate';
  const isSingleJointStep = stepId === 'robot-single-joint';
  const isMultiJointStep = stepId === 'robot-multi-joint';
  const isCartesianStep = stepId === 'robot-cartesian';

  const jointCards = [
    { j: 'J1', name: '底座旋转', index: 0, nodeName: '转台' },
    { j: 'J2', name: '肩部俯仰', index: 1, nodeName: '大臂' },
    { j: 'J3', name: '肘部俯仰', index: 2, nodeName: '小臂' },
    { j: 'J4', name: '腕部旋转', index: 3, nodeName: '回转机构' },
    { j: 'J5', name: '腕部俯仰', index: 4, nodeName: '末端关节' },
    { j: 'J6', name: '末端旋转', index: 5, nodeName: '快拆机器人端口' },
  ];

  const handleJointCardClick = (index: number) => {
    robot.setHighlightedJoint(robot.highlightedJoint === index ? null : index);
  };

  const isSuckerVisible = robot.selectedTool === '吸盘';
  const handleToggleSucker = () => {
    robot.setSelectedTool(isSuckerVisible ? '无' : '吸盘');
  };

  return (
    <div className="space-y-4">
      {/* 坐标系显示与模式切换 */}
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

      {/* 关节认识卡片 */}
      {isStructureStep && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {jointCards.map(({ j, name, index }) => {
              const active = robot.highlightedJoint === index;
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

          {/* 末端执行器：显示/隐藏吸盘 */}
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

      {/* 单关节 / 多关节步骤 */}
      {(isSingleJointStep || isMultiJointStep) && (
        <JointAngleCard
          joints={robot.joints}
          config={robot.config}
          jointStep={robot.jointStep}
          onJointStepChange={robot.setJointStep}
          onAdjustJoint={robot.adjustJoint}
          onSetJoint={robot.setJoint}
          sliderTargetRef={robot.sliderTargetRef}
          onReset={robot.resetJoints}
          onRandom={robot.randomJoints}
          collapsible={false}
          enabledJoints={isSingleJointStep ? [0] : [1, 2]}
        />
      )}

      {/* 坐标系步骤 */}
      {isCoordinateStep && (
        <PoseControlCard
          coordinateSystem={robot.coordinateSystem}
          onCoordinateChange={robot.setCoordinateSystem}
          posStep={robot.posStep}
          onPosStepChange={robot.setPosStep}
          rotStep={robot.rotStep}
          onRotStepChange={robot.setRotStep}
          onMoveDirection={robot.moveDirection}
        />
      )}

      {/* 末端位置控制 + 位姿微调 + 记忆点管理 */}
      {isCartesianStep && (
        <>
          <PositionTargetCard
            currentGLBPosition={robot.glbPosition}
            onGoToPosition={robot.goToPosition}
            disabled={robot.status === 'moving'}
          />
          <PoseControlCard
            coordinateSystem={robot.coordinateSystem}
            onCoordinateChange={robot.setCoordinateSystem}
            posStep={robot.posStep}
            onPosStepChange={robot.setPosStep}
            rotStep={robot.rotStep}
            onRotStepChange={robot.setRotStep}
            onMoveDirection={robot.moveDirection}
          />
          <WaypointPanel currentJoints={robot.joints} onGotoWaypoint={robot.goToJoints} />
        </>
      )}
    </div>
  );
}
