// src/components/operation/OperationPanel.tsx
// 右侧操作面板：从各 Context 读取数据，只保留折叠状态作为组件级 UI props
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
import type {
  CameraOperationsProps,
  CameraPanelData,
  FreeOperationPanelProps,
  GraspOperationsProps,
  GraspPanelData,
  LayoutPanelData,
  OperationPanelData,
  RobotOperationsProps,
  RobotPanelData,
  SceneCameraPanelData,
  SequencePanelData,
} from './panel-types';

export interface OperationPanelProps {
  collapsed: boolean;
  onCollapse: () => void;
}

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
  const robotOperationsProps: RobotOperationsProps = {
    currentModule: data.currentModule,
    currentStep: data.currentStep,
    mode: data.mode,
    collapsed: data.collapsed,
    onCollapse: data.onCollapse,
    sliderTargetRef: data.sliderTargetRef,
    joints: data.joints,
    config: data.config,
    jointStep: data.jointStep,
    onJointStepChange: data.onJointStepChange,
    onAdjustJoint: data.onAdjustJoint,
    onSetJoint: data.onSetJoint,
    onReset: data.onReset,
    onRandom: data.onRandom,
    coordinateSystem: data.coordinateSystem,
    onCoordinateChange: data.onCoordinateChange,
    posStep: data.posStep,
    onPosStepChange: data.onPosStepChange,
    rotStep: data.rotStep,
    onRotStepChange: data.onRotStepChange,
    onMoveDirection: data.onMoveDirection,
    onGotoWaypoint: data.onGotoWaypoint,
    onGoToPosition: data.onGoToPosition,
    currentGLBPosition: data.currentGLBPosition,
    status: data.status,
    highlightedJoint: data.highlightedJoint,
    setHighlightedJoint: data.setHighlightedJoint,
    selectedTool: data.selectedTool,
    setSelectedTool: data.setSelectedTool,
  };
  const cameraOperationsProps: CameraOperationsProps = {
    currentModule: data.currentModule,
    currentStep: data.currentStep,
    mode: data.mode,
    collapsed: data.collapsed,
    onCollapse: data.onCollapse,
    cameraState: data.cameraState,
    captureResult: data.captureResult,
    cameraPosStep: data.cameraPosStep,
    onCameraPosStepChange: data.onCameraPosStepChange,
    cameraRotStep: data.cameraRotStep,
    onCameraRotStepChange: data.onCameraRotStepChange,
    cameraFovStep: data.cameraFovStep,
    onCameraFovStepChange: data.onCameraFovStepChange,
    setCameraPositionAxis: data.setCameraPositionAxis,
    setCameraRotationAxis: data.setCameraRotationAxis,
    setCameraFov: data.setCameraFov,
    setCameraNear: data.setCameraNear,
    setCameraFar: data.setCameraFar,
    toggleCameraFrustum: data.toggleCameraFrustum,
    toggleCameraModel: data.toggleCameraModel,
    setCameraResolution: data.setCameraResolution,
    resetCamera: data.resetCamera,
    setCameraPositionAxisTarget: data.setCameraPositionAxisTarget,
    setCameraRotationAxisTarget: data.setCameraRotationAxisTarget,
    setCameraFovTarget: data.setCameraFovTarget,
    setCameraNearTarget: data.setCameraNearTarget,
    setCameraFarTarget: data.setCameraFarTarget,
    showCamera: data.showCamera,
    onCapture: data.onCapture,
  };
  const graspOperationsProps: GraspOperationsProps = {
    currentModule: data.currentModule,
    currentStep: data.currentStep,
    mode: data.mode,
    collapsed: data.collapsed,
    onCollapse: data.onCollapse,
    sliderTargetRef: data.sliderTargetRef,
    joints: data.joints,
    config: data.config,
    jointStep: data.jointStep,
    onJointStepChange: data.onJointStepChange,
    onAdjustJoint: data.onAdjustJoint,
    onSetJoint: data.onSetJoint,
    onReset: data.onReset,
    onRandom: data.onRandom,
    coordinateSystem: data.coordinateSystem,
    onCoordinateChange: data.onCoordinateChange,
    posStep: data.posStep,
    onPosStepChange: data.onPosStepChange,
    rotStep: data.rotStep,
    onRotStepChange: data.onRotStepChange,
    onMoveDirection: data.onMoveDirection,
    onGotoWaypoint: data.onGotoWaypoint,
    onGoToPosition: data.onGoToPosition,
    currentGLBPosition: data.currentGLBPosition,
    status: data.status,
    highlightedJoint: data.highlightedJoint,
    setHighlightedJoint: data.setHighlightedJoint,
    selectedTool: data.selectedTool,
    setSelectedTool: data.setSelectedTool,
    suckerOn: data.suckerOn,
    boxState: data.boxState,
    boxPosition: data.boxPosition,
    onSpawnParts: data.onSpawnParts,
    onClearParts: data.onClearParts,
    hasDemoParts: data.hasDemoParts,
    turnSuckerOn: data.turnSuckerOn,
    turnSuckerOff: data.turnSuckerOff,
    spawnBox: data.spawnBox,
    resetBox: data.resetBox,
    sequenceSteps: data.sequenceSteps,
    setSequenceSteps: data.setSequenceSteps,
    loadDefaultSequence: data.loadDefaultSequence,
    clearSequence: data.clearSequence,
    suppressAutoDefaultLoad: data.suppressAutoDefaultLoad,
    sequenceCurrentStep: data.sequenceCurrentStep,
    sequenceStatus: data.sequenceStatus,
    sequenceLogs: data.sequenceLogs,
    onSequenceAddStep: data.onSequenceAddStep,
    onSequenceRemoveStep: data.onSequenceRemoveStep,
    onSequenceMoveStep: data.onSequenceMoveStep,
    onSequenceUpdateStep: data.onSequenceUpdateStep,
    onSequenceRun: data.onSequenceRun,
    onSequenceStep: data.onSequenceStep,
    onSequenceStop: data.onSequenceStop,
    onSequenceReset: data.onSequenceReset,
    waypoints: data.waypoints,
    captureImages: data.captureImages,
  };
  const freeOperationPanelProps: FreeOperationPanelProps = {
    sliderTargetRef: data.sliderTargetRef,
    joints: data.joints,
    config: data.config,
    jointStep: data.jointStep,
    onJointStepChange: data.onJointStepChange,
    onAdjustJoint: data.onAdjustJoint,
    onSetJoint: data.onSetJoint,
    onReset: data.onReset,
    onRandom: data.onRandom,
    coordinateSystem: data.coordinateSystem,
    onCoordinateChange: data.onCoordinateChange,
    posStep: data.posStep,
    onPosStepChange: data.onPosStepChange,
    rotStep: data.rotStep,
    onRotStepChange: data.onRotStepChange,
    onMoveDirection: data.onMoveDirection,
    onGotoWaypoint: data.onGotoWaypoint,
    onGoToPosition: data.onGoToPosition,
    currentGLBPosition: data.currentGLBPosition,
    status: data.status,
    highlightedJoint: data.highlightedJoint,
    setHighlightedJoint: data.setHighlightedJoint,
    selectedTool: data.selectedTool,
    setSelectedTool: data.setSelectedTool,
    cameraState: data.cameraState,
    captureResult: data.captureResult,
    cameraPosStep: data.cameraPosStep,
    onCameraPosStepChange: data.onCameraPosStepChange,
    cameraRotStep: data.cameraRotStep,
    onCameraRotStepChange: data.onCameraRotStepChange,
    cameraFovStep: data.cameraFovStep,
    onCameraFovStepChange: data.onCameraFovStepChange,
    setCameraPositionAxis: data.setCameraPositionAxis,
    setCameraRotationAxis: data.setCameraRotationAxis,
    setCameraFov: data.setCameraFov,
    setCameraNear: data.setCameraNear,
    setCameraFar: data.setCameraFar,
    toggleCameraFrustum: data.toggleCameraFrustum,
    toggleCameraModel: data.toggleCameraModel,
    setCameraResolution: data.setCameraResolution,
    resetCamera: data.resetCamera,
    setCameraPositionAxisTarget: data.setCameraPositionAxisTarget,
    setCameraRotationAxisTarget: data.setCameraRotationAxisTarget,
    setCameraFovTarget: data.setCameraFovTarget,
    setCameraNearTarget: data.setCameraNearTarget,
    setCameraFarTarget: data.setCameraFarTarget,
    showCamera: data.showCamera,
    onCapture: data.onCapture,
    sequenceSteps: data.sequenceSteps,
    setSequenceSteps: data.setSequenceSteps,
    loadDefaultSequence: data.loadDefaultSequence,
    clearSequence: data.clearSequence,
    suppressAutoDefaultLoad: data.suppressAutoDefaultLoad,
    sequenceCurrentStep: data.sequenceCurrentStep,
    sequenceStatus: data.sequenceStatus,
    sequenceLogs: data.sequenceLogs,
    onSequenceAddStep: data.onSequenceAddStep,
    onSequenceRemoveStep: data.onSequenceRemoveStep,
    onSequenceMoveStep: data.onSequenceMoveStep,
    onSequenceUpdateStep: data.onSequenceUpdateStep,
    onSequenceRun: data.onSequenceRun,
    onSequenceStep: data.onSequenceStep,
    onSequenceStop: data.onSequenceStop,
    onSequenceReset: data.onSequenceReset,
    waypoints: data.waypoints,
    captureImages: data.captureImages,
    suckerOn: data.suckerOn,
    boxState: data.boxState,
    boxPosition: data.boxPosition,
    onSpawnParts: data.onSpawnParts,
    onClearParts: data.onClearParts,
    hasDemoParts: data.hasDemoParts,
    turnSuckerOn: data.turnSuckerOn,
    turnSuckerOff: data.turnSuckerOff,
    spawnBox: data.spawnBox,
    resetBox: data.resetBox,
  };

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
          <FreeOperationPanel {...freeOperationPanelProps} />
        ) : (
          <div className="h-full overflow-y-auto p-5 space-y-4">
            <TeachingGuidePanel step={data.currentStep} />
            {data.currentModule === 'robot' && <RobotOperations {...robotOperationsProps} />}
            {data.currentModule === 'camera' && <CameraOperations {...cameraOperationsProps} />}
            {data.currentModule === 'grasp' && <GraspOperations {...graspOperationsProps} />}
          </div>
        )}
      </div>
    </aside>
  );
}
