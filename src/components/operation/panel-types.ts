import type { ModuleId, CourseStep, LearningMode } from '@/lib/course-config';
import type { RobotConfig, JointAngles, CoordinateSystem, StatusType, TaskPoseConstraintProfile } from '@/types/robot';
import type { CameraState, CaptureResult } from '@/types/camera';
import type { ActionStep, SequenceLog, SequenceStatus } from '@/types/sequence';
import type { Waypoint } from '@/hooks/useRobot';

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
  onGoToPosition: (x: number, y: number, z: number, rx?: number, ry?: number, rz?: number, profile?: TaskPoseConstraintProfile) => boolean;
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

export type RobotOperationsProps = LayoutPanelData & RobotPanelData;
export type CameraOperationsProps = LayoutPanelData & CameraPanelData;
export type GraspOperationsProps = LayoutPanelData & RobotPanelData & GraspPanelData & SequencePanelData;
export type FreeOperationPanelProps = RobotPanelData & CameraPanelData & SequencePanelData & GraspPanelData;
