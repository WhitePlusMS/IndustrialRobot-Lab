// src/components/operation/OperationPanel.tsx
// 右侧操作面板：从各 Context 读取数据，只保留折叠状态作为组件级 UI props
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ModuleId, CourseStep, LearningMode } from '@/lib/course-config';
import type { RobotConfig, JointAngles, CoordinateSystem, StatusType } from '@/types/robot';
import type { CameraState, CaptureResult } from '@/types/camera';
import type { ActionStep, SequenceLog, SequenceStatus } from '@/types/sequence';
import type { Waypoint } from '@/hooks/useRobot';
import { useLearning } from '@/contexts/LearningContext';
import { useRobotContext } from '@/contexts/RobotContext';
import { useVirtualCameraContext } from '@/contexts/VirtualCameraContext';
import { useSceneViewport } from '@/contexts/SceneViewportContext';
import { useSequenceContext } from '@/contexts/SequenceContext';
import { useSuckerContext } from '@/contexts/SuckerContext';
import { useDemoPartsContext } from '@/contexts/DemoPartsContext';
import RobotOperations from './RobotOperations';
import CameraOperations from './CameraOperations';
import GraspOperations from './GraspOperations';
import FreeOperationPanel from './FreeOperationPanel';
import TeachingGuidePanel from './TeachingGuidePanel';

export interface OperationPanelProps {
  collapsed: boolean;
  onCollapse: () => void;
}

// 供内部子组件使用的聚合 props（保持子组件接口不变，减少侵入式修改）
export interface LayoutPanelData {
  currentModule: ModuleId;
  currentStep: CourseStep;
  mode: LearningMode;
  collapsed: boolean;
  onCollapse: () => void;
}

export interface RobotPanelData {
  sliderTargetRef: React.MutableRefObject<JointAngles>;
  joints: JointAngles;
  config: RobotConfig;
  jointStep: number;
  onJointStepChange: (v: number) => void;
  onAdjustJoint: (index: number, delta: number, isContinuous?: boolean) => void;
  onSetJoint: (index: number, value: number) => void;
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
  onGoToPosition: (x: number, y: number, z: number, rx?: number, ry?: number, rz?: number) => boolean;
  currentGLBPosition: [number, number, number] | null;
  status: StatusType;
  highlightedJoint: number | null;
  setHighlightedJoint: (index: number | null) => void;
  selectedTool: string;
  setSelectedTool: (tool: string) => void;
}

export interface CameraPanelData {
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
  setCameraPositionAxisTarget: (axis: 0 | 1 | 2, value: number) => void;
  setCameraRotationAxisTarget: (axis: 0 | 1 | 2, value: number) => void;
  setCameraFovTarget: (value: number) => void;
  setCameraNearTarget: (value: number) => void;
  setCameraFarTarget: (value: number) => void;
  showCamera: boolean;
  onCapture: (result: CaptureResult) => void;
}

export interface SceneCameraPanelData {
  sceneCameraPosition: [number, number, number];
  setSceneCameraPositionAxis: (axis: 0 | 1 | 2, value: number) => void;
  setSceneCameraView: (view: 'front' | 'side' | 'top' | 'free') => void;
  resetSceneCamera: () => void;
}

export interface SequencePanelData {
  sequenceSteps: ActionStep[];
  setSequenceSteps: (steps: ActionStep[]) => void;
  loadDefaultSequence: () => void;
  clearSequence: () => void;
  suppressAutoDefaultLoad: boolean;
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
}

export interface GraspPanelData {
  suckerOn: boolean;
  boxState: string;
  boxPosition: [number, number, number];
  onSpawnParts: (count: number, size: number) => void;
  onClearParts: () => void;
  hasDemoParts: boolean;
  turnSuckerOn: () => void;
  turnSuckerOff: () => void;
  spawnBox: (position: [number, number, number], restingHeight?: number) => void;
  resetBox: () => void;
}

export interface OperationPanelData extends LayoutPanelData, RobotPanelData, CameraPanelData, SceneCameraPanelData, SequencePanelData, GraspPanelData {}

function useOperationPanelData(props: OperationPanelProps): OperationPanelData {
  const learning = useLearning();
  const robot = useRobotContext();
  const camera = useVirtualCameraContext();
  const viewport = useSceneViewport();
  const sequence = useSequenceContext();
  const sucker = useSuckerContext();
  const demoParts = useDemoPartsContext();

  if (!learning.currentStep) {
    throw new Error('OperationPanel must be rendered within LearningProvider');
  }

  const layout: LayoutPanelData = {
    currentModule: learning.currentModule,
    currentStep: learning.currentStep,
    mode: learning.learningMode,
    collapsed: props.collapsed,
    onCollapse: props.onCollapse,
  };

  const robotData: RobotPanelData = {
    sliderTargetRef: robot.sliderTargetRef,
    joints: robot.joints,
    config: robot.config,
    jointStep: robot.jointStep,
    onJointStepChange: robot.setJointStep,
    onAdjustJoint: robot.adjustJoint,
    onSetJoint: robot.setJoint,
    onReset: robot.resetJoints,
    onRandom: robot.randomJoints,
    coordinateSystem: robot.coordinateSystem,
    onCoordinateChange: robot.setCoordinateSystem,
    posStep: robot.posStep,
    onPosStepChange: robot.setPosStep,
    rotStep: robot.rotStep,
    onRotStepChange: robot.setRotStep,
    onMoveDirection: robot.moveDirection,
    onGotoWaypoint: robot.goToJoints,
    onGoToPosition: robot.goToPosition,
    currentGLBPosition: robot.glbPosition,
    status: robot.status,
    highlightedJoint: robot.highlightedJoint,
    setHighlightedJoint: robot.setHighlightedJoint,
    selectedTool: robot.selectedTool,
    setSelectedTool: robot.setSelectedTool,
  };

  const cameraData: CameraPanelData = {
    cameraState: camera.cameraState,
    captureResult: camera.captureResult,
    cameraPosStep: camera.posStep,
    onCameraPosStepChange: camera.setPosStep,
    cameraRotStep: camera.rotStep,
    onCameraRotStepChange: camera.setRotStep,
    cameraFovStep: camera.fovStep,
    onCameraFovStepChange: camera.setFovStep,
    setCameraPositionAxis: camera.setPositionAxis,
    setCameraRotationAxis: camera.setRotationAxis,
    setCameraFov: camera.setFov,
    setCameraNear: camera.setNear,
    setCameraFar: camera.setFar,
    toggleCameraFrustum: camera.toggleFrustum,
    toggleCameraModel: camera.toggleModel,
    setCameraResolution: camera.setResolution,
    resetCamera: camera.resetCamera,
    setCameraPositionAxisTarget: camera.setPositionAxisTarget,
    setCameraRotationAxisTarget: camera.setRotationAxisTarget,
    setCameraFovTarget: camera.setFovTarget,
    setCameraNearTarget: camera.setNearTarget,
    setCameraFarTarget: camera.setFarTarget,
    showCamera: camera.cameraState.showCamera,
    onCapture: camera.saveCapture,
  };

  const sceneCameraData: SceneCameraPanelData = {
    sceneCameraPosition: viewport.cameraPosition,
    setSceneCameraPositionAxis: viewport.setCameraPositionAxis,
    setSceneCameraView: viewport.setCameraView,
    resetSceneCamera: viewport.resetCamera,
  };

  const sequenceData: SequencePanelData = {
    sequenceSteps: sequence.steps,
    setSequenceSteps: sequence.setStepsList,
    loadDefaultSequence: sequence.loadDefaultSequence,
    clearSequence: sequence.clearSequence,
    suppressAutoDefaultLoad: sequence.suppressAutoDefaultLoad,
    sequenceCurrentStep: sequence.currentStepIndex,
    sequenceStatus: sequence.status,
    sequenceLogs: sequence.logs,
    onSequenceAddStep: sequence.addStep,
    onSequenceRemoveStep: sequence.removeStep,
    onSequenceMoveStep: sequence.moveStep,
    onSequenceUpdateStep: sequence.updateStep,
    onSequenceRun: sequence.runSequence,
    onSequenceStep: sequence.runSingleStep,
    onSequenceStop: sequence.stopSequence,
    onSequenceReset: sequence.resetSequence,
    waypoints: sequence.waypoints,
    captureImages: sequence.captureImages,
  };

  const graspData: GraspPanelData = {
    suckerOn: sucker.suckerOn,
    boxState: sucker.boxState,
    boxPosition: sucker.boxPosition,
    onSpawnParts: (n, s) =>
      demoParts.spawnParts(n, s, {
        position: camera.cameraState.position,
        rotation: camera.cameraState.rotation,
        fov: camera.cameraState.fov,
        near: camera.cameraState.near,
        far: camera.cameraState.far,
      }),
    onClearParts: demoParts.clearParts,
    hasDemoParts: demoParts.parts.length > 0,
    turnSuckerOn: sucker.turnSuckerOn,
    turnSuckerOff: sucker.turnSuckerOff,
    spawnBox: sucker.spawnBox,
    resetBox: sucker.resetBox,
  };

  return {
    ...layout,
    ...robotData,
    ...cameraData,
    ...sceneCameraData,
    ...sequenceData,
    ...graspData,
  };
}

export default function OperationPanel(props: OperationPanelProps) {
  const data = useOperationPanelData(props);

  if (data.collapsed) {
    return (
      <aside className="w-8 shrink-0 h-full bg-white border border-slate-300 rounded-l-lg shadow-[-2px_0_10px_rgba(0,0,0,0.06)] flex items-center justify-center z-10">
        <button
          type="button"
          onClick={data.onCollapse}
          className="w-full h-full flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-blue-50/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-l-lg"
          aria-label="展开操作面板"
          title="展开操作面板"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[340px] shrink-0 bg-white border-l border-slate-200 flex flex-col shadow-[-2px_0_12px_rgba(0,0,0,0.03)] z-10">
      {/* 折叠按钮 */}
      <div className="flex items-center justify-start px-2 py-1.5 border-b border-slate-100 bg-slate-50/50">
        <button
          type="button"
          onClick={data.onCollapse}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="折叠操作面板"
          title="折叠操作面板"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {data.mode === 'free' ? (
          <FreeOperationPanel {...data} />
        ) : (
          <div className="h-full overflow-y-auto p-5 space-y-4">
            <TeachingGuidePanel step={data.currentStep} />
            {data.currentModule === 'robot' && <RobotOperations {...data} />}
            {data.currentModule === 'camera' && <CameraOperations {...data} />}
            {data.currentModule === 'grasp' && <GraspOperations {...data} />}
          </div>
        )}
      </div>
    </aside>
  );
}
