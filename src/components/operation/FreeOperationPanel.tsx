// src/components/operation/FreeOperationPanel.tsx
// 自由练习模式右侧面板：方案 5 落地
// 保留原 ControlPanel 的 Tab + 可折叠卡片结构，换用当前项目的新视觉风格
import { useState } from 'react';
import type { FreeOperationPanelProps } from './panel-types';
import JointAngleCard from '@/components/JointAngleCard';
import PoseControlCard from '@/components/PoseControlCard';
import PositionTargetCard from '@/components/PositionTargetCard';
import WaypointPanel from '@/components/WaypointPanel';
import CameraParamsCard from '@/components/camera/CameraParamsCard';
import CapturePanel from '@/components/camera/CapturePanel';
import SequenceEditor from '@/components/sequence/SequenceEditor';
import { useSceneViewport } from '@/contexts/SceneViewportContext';
import { Box, Power, PowerOff, Play, Grip, Eye, EyeOff, MoveUp } from 'lucide-react';
import { buildGraspApproachPose } from '@/lib/grasp-planning';

type FreeTab = 'robot' | 'camera' | 'sequence';

const tabs: { id: FreeTab; label: string }[] = [
  { id: 'robot', label: '机器人控制' },
  { id: 'camera', label: '相机控制' },
  { id: 'sequence', label: '动作编排' },
];

const boxStateText: Record<string, string> = {
  NONE: '无物体',
  FREE: '自由',
  FALLING: '下落中',
  ATTACHED: '已吸附',
  PLACED: '已放置',
  RESTING: '静止',
};

export default function FreeOperationPanel(props: FreeOperationPanelProps) {
  const [activeTab, setActiveTab] = useState<FreeTab>('robot');

  return (
    <div className="flex flex-col h-full">
      {/* Tab 切换条 */}
      <div className="flex border-b border-slate-200 bg-white shrink-0" role="tablist">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-3 text-xs font-semibold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              activeTab === id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'robot' && <RobotTab {...props} />}
        {activeTab === 'camera' && <CameraTab {...props} />}
        {activeTab === 'sequence' && <SequenceTab {...props} />}
      </div>
    </div>
  );
}

function RobotTab(props: FreeOperationPanelProps) {
  const viewport = useSceneViewport();
  return (
    <div className="space-y-4">
      <StatusBar>
        坐标系：{props.coordinateSystem} · 吸盘：{props.suckerOn ? '开启' : '关闭'}
      </StatusBar>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">坐标系可视化</p>
          <p className="text-xs text-slate-500">控制基坐标系和工具坐标系显隐</p>
        </div>
        <button
          type="button"
          onClick={viewport.toggleCoordinateSystems}
          className={`text-xs font-semibold px-3 py-2 rounded-lg border flex items-center gap-1.5 transition-colors ${
            viewport.showCoordinateSystems
              ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
          }`}
        >
          {viewport.showCoordinateSystems ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {viewport.showCoordinateSystems ? '隐藏坐标系' : '显示坐标系'}
        </button>
      </div>

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

      <PositionTargetCard
        currentGLBPosition={props.currentGLBPosition}
        onGoToPosition={props.onGoToPosition}
        disabled={props.status === 'moving'}
      />

      <WaypointPanel currentJoints={props.joints} onGotoWaypoint={props.onGotoWaypoint} />
    </div>
  );
}

function CameraTab(props: FreeOperationPanelProps) {
  return (
    <div className="space-y-4">
      <StatusBar>
        相机：{props.cameraState.showModel ? '模型显示中' : '隐藏'} · FOV {props.cameraState.fov.toFixed(0)}°
      </StatusBar>

      <CameraParamsCard
        cameraState={props.cameraState}
        posStep={props.cameraPosStep}
        onPosStepChange={props.onCameraPosStepChange}
        rotStep={props.cameraRotStep}
        onRotStepChange={props.onCameraRotStepChange}
        fovStep={props.cameraFovStep}
        onFovStepChange={props.onCameraFovStepChange}
        setPositionAxis={props.setCameraPositionAxis}
        setRotationAxis={props.setCameraRotationAxis}
        setFov={props.setCameraFov}
        setNear={props.setCameraNear}
        setFar={props.setCameraFar}
        toggleFrustum={props.toggleCameraFrustum}
        toggleModel={props.toggleCameraModel}
        resetCamera={props.resetCamera}
        showCamera={props.showCamera}
        setPositionAxisTarget={props.setCameraPositionAxisTarget}
        setRotationAxisTarget={props.setCameraRotationAxisTarget}
        setFovTarget={props.setCameraFovTarget}
        setNearTarget={props.setCameraNearTarget}
        setFarTarget={props.setCameraFarTarget}
      />

      <CapturePanel
        cameraState={props.cameraState}
        captureResult={props.captureResult}
        onCapture={props.onCapture}
        onResolutionChange={props.setCameraResolution}
      />
    </div>
  );
}

function SequenceTab(props: FreeOperationPanelProps) {
  const isSuckerVisible = props.selectedTool === '吸盘';
  const handleToggleSucker = () => {
    props.setSelectedTool(isSuckerVisible ? '无' : '吸盘');
  };

  // 一键移动到箱子上方（与 GraspOperations 中逻辑一致）
  const handleApproachBox = () => {
    if (props.boxState === 'NONE') return;
    const approachPose = buildGraspApproachPose(props.boxPosition);
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

  return (
    <div className="space-y-4">
      <StatusBar>
        {props.suckerOn ? '吸盘已开启' : '吸盘未开启'} · {boxStateText[props.boxState] ?? props.boxState}
      </StatusBar>

      {/* 抓取控制 */}
      <OperationCard title="抓取控制" defaultOpen>
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleToggleSucker}
            className={`w-full py-2.5 text-xs font-semibold rounded-lg border shadow-sm flex items-center justify-center gap-2 transition-colors ${
              isSuckerVisible
                ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {isSuckerVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {isSuckerVisible ? '隐藏吸盘' : '在 3D 场景中显示吸盘'}
          </button>
          <button
            type="button"
            onClick={() => props.spawnBox([-1000, 200, 0], 50)}
            className="w-full py-2.5 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100 flex items-center justify-center gap-2 transition-colors"
          >
            <Box className="w-3.5 h-3.5" />
            生成物体
          </button>
          <button
            type="button"
            onClick={handleApproachBox}
            disabled={props.boxState === 'NONE' || props.boxState === 'FALLING' || props.status === 'moving'}
            className="w-full py-2.5 text-xs font-semibold rounded-lg text-white bg-gradient-to-r from-blue-500 to-blue-600 border border-blue-600 shadow-sm hover:from-blue-600 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            <MoveUp className="w-3.5 h-3.5" />
            移动到箱子上方
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={props.turnSuckerOn}
              disabled={props.suckerOn}
              className="py-2.5 text-xs font-semibold rounded-lg text-white bg-gradient-to-r from-blue-500 to-blue-600 border border-blue-600 shadow-sm hover:from-blue-600 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              <Power className="w-3.5 h-3.5" />
              开启吸盘
            </button>
            <button
              type="button"
              onClick={props.turnSuckerOff}
              disabled={!props.suckerOn}
              className="py-2.5 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              <PowerOff className="w-3.5 h-3.5" />
              关闭吸盘
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              props.spawnBox([-1000, 200, 0], 50);
              props.turnSuckerOn();
            }}
            className="w-full py-2.5 text-xs font-semibold rounded-lg text-white bg-gradient-to-r from-blue-500 to-blue-600 border border-blue-600 shadow-sm hover:from-blue-600 hover:to-blue-700 flex items-center justify-center gap-2 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            生成物体并开启吸盘
          </button>
        </div>
      </OperationCard>

      {/* 动作序列 */}
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
  );
}

/** 可折叠卡片外壳：方案 5 的新视觉 */
function OperationCard({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/80 border-b border-slate-100 text-sm font-semibold text-slate-700 hover:bg-slate-100/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-expanded={open}
      >
        <span>{title}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-slate-400 transition-transform ${open ? '' : 'rotate-180'}`}
        >
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

/** 状态条 */
function StatusBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg text-xs text-slate-600 border border-slate-200">
      <Grip className="w-3.5 h-3.5 text-blue-500" />
      <span>{children}</span>
    </div>
  );
}
