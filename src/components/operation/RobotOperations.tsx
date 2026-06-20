// src/components/operation/RobotOperations.tsx
import type { OperationPanelData } from './OperationPanel';
import JointAngleCard from '@/components/JointAngleCard';
import PoseControlCard from '@/components/PoseControlCard';
import PositionTargetCard from '@/components/PositionTargetCard';
import WaypointPanel from '@/components/WaypointPanel';
import { useSceneViewport } from '@/contexts/SceneViewportContext';
import { Eye, EyeOff, Globe, Anchor } from 'lucide-react';

export default function RobotOperations(props: OperationPanelData) {
  const stepId = props.currentStep.id;
  const isFree = props.mode === 'free';
  const viewport = useSceneViewport();

  const isStructureStep = stepId === 'robot-structure' || isFree;
  const isCoordinateStep = stepId === 'robot-coordinate' || isFree;
  const isSingleJointStep = stepId === 'robot-single-joint' || isFree;
  const isMultiJointStep = stepId === 'robot-multi-joint' || isFree;
  const isCartesianStep = stepId === 'robot-cartesian' || isFree;

  const jointCards = [
    { j: 'J1', name: '底座旋转', index: 0, nodeName: '转台' },
    { j: 'J2', name: '肩部俯仰', index: 1, nodeName: '大臂' },
    { j: 'J3', name: '肘部俯仰', index: 2, nodeName: '小臂' },
    { j: 'J4', name: '腕部旋转', index: 3, nodeName: '回转机构' },
    { j: 'J5', name: '腕部俯仰', index: 4, nodeName: '末端关节' },
    { j: 'J6', name: '末端旋转', index: 5, nodeName: '快拆机器人端口' },
  ];

  const handleJointCardClick = (index: number) => {
    props.setHighlightedJoint(props.highlightedJoint === index ? null : index);
  };

  return (
    <div className="space-y-4">
      {/* 坐标系显示与模式切换：机器臂模块通用 */}
      {!isFree && (
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

          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'World' as const, title: 'World', desc: '基坐标系', icon: Globe },
              { value: 'Tool' as const, title: 'Tool', desc: '工具坐标系', icon: Anchor },
            ].map((opt) => {
              const Icon = opt.icon;
              const active = props.coordinateSystem === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => props.onCoordinateChange(opt.value)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-colors ${
                    active
                      ? 'bg-blue-50 border-blue-400 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div>
                    <p className="text-[13px] font-semibold">{opt.title}</p>
                    <p className="text-[11px] text-slate-500">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 关节认识卡片 */}
      {isStructureStep && (
        <div className="grid grid-cols-2 gap-2">
          {jointCards.map(({ j, name, index }) => {
            const active = props.highlightedJoint === index;
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
      )}

      {/* 单关节 / 多关节步骤：显示全部 J1~J6 滑块，复用 JointAngleCard 不卡顿逻辑 */}
      {(isSingleJointStep || isMultiJointStep) && !isFree && (
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
          collapsible={false}
        />
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

    </div>
  );
}
