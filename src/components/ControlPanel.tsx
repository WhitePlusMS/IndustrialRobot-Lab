// src/components/ControlPanel.tsx
import { useState, useCallback } from 'react';
import JointAngleCard from './JointAngleCard';
import PoseControlCard from './PoseControlCard';
import WaypointPanel from './WaypointPanel';
import PositionTargetCard from './PositionTargetCard';
import CameraParamsCard from './camera/CameraParamsCard';
import CapturePanel from './camera/CapturePanel';
import DemoPartsCard from './camera/DemoPartsCard';
import SequenceEditor from './sequence/SequenceEditor';
import type { RobotConfig, JointAngles, CoordinateSystem, StatusType } from '@/types/robot';
import type { CameraState, CaptureResult } from '@/types/camera';
import type { ActionStep, SequenceLog, SequenceStatus } from '@/types/sequence';
import type { Waypoint } from '@/hooks/useRobotKinematics';

type TabMode = 'robot' | 'camera' | 'sequence';

interface ControlPanelProps {
  // Robot props
  joints: JointAngles;
  config: RobotConfig;
  jointStep: number;
  onJointStepChange: (v: number) => void;
  onAdjustJoint: (index: number, delta: number, isContinuous?: boolean) => void;
  onReset: () => void;
  onRandom: () => void;
  coordinateSystem: CoordinateSystem;
  onCoordinateChange: (cs: CoordinateSystem) => void;
  posStep: number;
  onPosStepChange: (v: number) => void;
  rotStep: number;
  onRotStepChange: (v: number) => void;
  onMoveDirection: (axis: 'x' | 'y' | 'z' | 'rx' | 'ry' | 'rz', sign: 1 | -1, isLongPress: boolean) => void;
  onGotoWaypoint: (joints: JointAngles) => void;
  onGoToPosition: (x: number, y: number, z: number) => boolean;
  currentGLBPosition: [number, number, number] | null;
  status: StatusType;
  // Camera props
  cameraState: CameraState;
  captureResult: CaptureResult | null;
  cameraPosStep: number;
  onCameraPosStepChange: (v: number) => void;
  cameraRotStep: number;
  onCameraRotStepChange: (v: number) => void;
  cameraFovStep: number;
  onCameraFovStepChange: (v: number) => void;
  setCameraPositionAxis: (axis: 0 | 1 | 2, value: number) => void;
  setCameraRotationAxis: (axis: 0 | 1 | 2, value: number) => void;
  setCameraFov: (v: number) => void;
  setCameraNear: (v: number) => void;
  setCameraFar: (v: number) => void;
  toggleCameraFrustum: () => void;
  toggleCameraModel: () => void;
  setCameraResolution: (w: number, h: number) => void;
  resetCamera: () => void;
  onCapture: (result: CaptureResult) => void;
  // Sequence props
  sequenceSteps: ActionStep[];
  setSequenceSteps: (steps: ActionStep[]) => void;
  sequenceCurrentStep: number;
  sequenceStatus: SequenceStatus;
  sequenceLogs: SequenceLog[];
  onSequenceAddStep: (type: ActionStep['type']) => void;
  onSequenceRemoveStep: (index: number) => void;
  onSequenceMoveStep: (index: number, direction: 'up' | 'down') => void;
  onSequenceUpdateStep: (index: number, updates: Partial<ActionStep>) => void;
  onSequenceRun: () => void;
  onSequenceStep: () => void;
  onSequenceStop: () => void;
  onSequenceReset: () => void;
  waypoints: Waypoint[];
  captureImages: { color?: string; segmentation?: string; depth?: string };
  suckerOn: boolean;
  boxState: string;
  // Demo parts
  onSpawnParts: (count: number, size: number) => void;
  onClearParts: () => void;
  hasDemoParts: boolean;
}

export default function ControlPanel(props: ControlPanelProps) {
  // Tab 状态持久化到 URL query string
  const [activeTab, setActiveTabState] = useState<TabMode>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'camera' || tab === 'sequence') return tab;
    return 'robot';
  });

  const setActiveTab = useCallback((tab: TabMode) => {
    setActiveTabState(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url.toString());
  }, []);

  return (
    <div className="w-full md:w-[360px] md:min-w-[320px] bg-[#FAFAFA] border-r border-[#D1D5DB] flex flex-col overflow-y-auto shrink-0">
      {/* Tab 切换条 */}
      <div className="flex border-b border-[#E5E7EB]" role="tablist">
        <button
          type="button"
          id="tab-robot"
          onClick={() => setActiveTab('robot')}
          role="tab"
          aria-selected={activeTab === 'robot'}
          aria-controls="panel-robot"
          className={`flex-1 py-2.5 text-xs font-semibold tracking-wide transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none ${
            activeTab === 'robot'
              ? 'text-[#2563EB] border-b-2 border-[#2563EB] bg-[#EFF6FF]'
              : 'text-[#64748B] hover:text-[#1E293B] hover:bg-[#F8FAFC]'
          }`}
        >
          机器人控制
        </button>
        <button
          type="button"
          id="tab-camera"
          onClick={() => setActiveTab('camera')}
          role="tab"
          aria-selected={activeTab === 'camera'}
          aria-controls="panel-camera"
          className={`flex-1 py-2.5 text-xs font-semibold tracking-wide transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none ${
            activeTab === 'camera'
              ? 'text-[#2563EB] border-b-2 border-[#2563EB] bg-[#EFF6FF]'
              : 'text-[#64748B] hover:text-[#1E293B] hover:bg-[#F8FAFC]'
          }`}
        >
          相机控制
        </button>
        <button
          type="button"
          id="tab-sequence"
          onClick={() => setActiveTab('sequence')}
          role="tab"
          aria-selected={activeTab === 'sequence'}
          aria-controls="panel-sequence"
          className={`flex-1 py-2.5 text-xs font-semibold tracking-wide transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none ${
            activeTab === 'sequence'
              ? 'text-[#2563EB] border-b-2 border-[#2563EB] bg-[#EFF6FF]'
              : 'text-[#64748B] hover:text-[#1E293B] hover:bg-[#F8FAFC]'
          }`}
        >
          动作编排
        </button>
      </div>

      <div
        className="p-3 space-y-3"
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === 'robot' && (
          <>
            <JointAngleCard
              joints={props.joints}
              config={props.config}
              jointStep={props.jointStep}
              onJointStepChange={props.onJointStepChange}
              onAdjustJoint={props.onAdjustJoint}
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
            <WaypointPanel
              currentJoints={props.joints}
              onGotoWaypoint={props.onGotoWaypoint}
            />
            <PositionTargetCard
              currentGLBPosition={props.currentGLBPosition}
              onGoToPosition={props.onGoToPosition}
              disabled={props.status === 'moving'}
            />
          </>
        )}

        {activeTab === 'camera' && (
          <>
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
            />
            <CapturePanel
              cameraState={props.cameraState}
              captureResult={props.captureResult}
              onCapture={props.onCapture}
              onResolutionChange={props.setCameraResolution}
            />
            <DemoPartsCard
              onSpawn={props.onSpawnParts}
              onClear={props.onClearParts}
              hasParts={props.hasDemoParts}
            />
          </>
        )}

        {activeTab === 'sequence' && (
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
      </div>
    </div>
  );
}
