// src/components/operation/OperationPanel.tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ModuleId, CourseStep, LearningMode } from '@/lib/course-config';
import type { RobotConfig, JointAngles, CoordinateSystem, StatusType } from '@/types/robot';
import type { CameraState, CaptureResult } from '@/types/camera';
import type { ActionStep, SequenceLog, SequenceStatus } from '@/types/sequence';
import type { Waypoint } from '@/hooks/useRobotKinematics';
import RobotOperations from './RobotOperations';
import CameraOperations from './CameraOperations';
import GraspOperations from './GraspOperations';
import FreeOperationPanel from './FreeOperationPanel';

export interface OperationPanelProps {
  currentModule: ModuleId;
  currentStep: CourseStep;
  mode: LearningMode;
  collapsed: boolean;
  onCollapse: () => void;
  // Robot
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
  // Camera
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
  // Sequence
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
  // Demo parts / grasp
  onSpawnParts: (count: number, size: number) => void;
  onClearParts: () => void;
  hasDemoParts: boolean;
  // Sucker direct actions
  turnSuckerOn: () => void;
  turnSuckerOff: () => void;
  forceAttachBox: () => void;
  spawnBox: (position: [number, number, number], restingHeight?: number) => void;
  resetBox: () => void;
}

export default function OperationPanel(props: OperationPanelProps) {
  if (props.collapsed) {
    return (
      <aside className="w-8 shrink-0 h-full bg-white border border-slate-300 rounded-l-lg shadow-[-2px_0_10px_rgba(0,0,0,0.06)] flex items-center justify-center z-10">
        <button
          type="button"
          onClick={props.onCollapse}
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
          onClick={props.onCollapse}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="折叠操作面板"
          title="折叠操作面板"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-700">操作区</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {props.mode === 'guided' ? props.currentStep.subtitle : '自由练习模式：所有控件可用'}
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        {props.mode === 'free' ? (
          <FreeOperationPanel {...props} />
        ) : (
          <div className="h-full overflow-y-auto p-5">
            {props.currentModule === 'robot' && <RobotOperations {...props} />}
            {props.currentModule === 'camera' && <CameraOperations {...props} />}
            {props.currentModule === 'grasp' && <GraspOperations {...props} />}
          </div>
        )}
      </div>
    </aside>
  );
}
