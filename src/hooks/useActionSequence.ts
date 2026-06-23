// src/hooks/useActionSequence.ts
import { useState, useCallback, useRef, useEffect, type MutableRefObject } from 'react';
import { forwardKinematics } from '@/lib/kinematics';
import type { RobotConfig, JointAngles } from '@/types/robot';
import type {
  ActionStep,
  SeqContext,
  SequenceLog,
  SequenceStatus,
} from '@/types/sequence';
import { createDefaultContext, createDefaultStep } from '@/types/sequence';
import type { RobotPoseAPI } from '@/lib/robot-pose-bridge';
import type { SceneRendererAPI } from '@/contexts/SceneRendererContext';
import { useRobotPoseAPI } from './useRobotPoseAPI';
import { useSceneRendererAPI } from './useSceneRendererAPI';
import type { CameraState } from '@/types/camera';
import type { Waypoint } from '@/hooks/useRobot';
import type { BoxState } from '@/hooks/useSuckerControl';
import type { TaskPoseConstraintProfile } from '@/types/robot';
import {
  createDefaultGraspSequence,
  DEFAULT_SEQUENCE_PLACE_PRESET_NAME,
} from '@/types/sequence';
import { dispatchStep } from '@/lib/sequence-steps';

export interface SequenceRobotAPI {
  config: RobotConfig;
  goToJoints: (joints: JointAngles) => void;
  /** GLB 场景坐标定位（m）：优先 GLB 数值 IK，降级 DH 位置 IK */
  goToPosition: (x: number, y: number, z: number, rx?: number, ry?: number, rz?: number, profile?: TaskPoseConstraintProfile) => boolean;
  isMotionQueueIdle: () => boolean;
  stopAnimation: () => void;
  isAnimating: boolean;
  isAnimatingRef: MutableRefObject<boolean>;
  getCurrentJointsDeg: () => JointAngles;
  getCurrentJointsRad: () => JointAngles;
  getCurrentRotation: () => number[][];
  waitForAnimation: () => Promise<void>;
}

export function buildSequenceRobotAPI(
  robot: {
    config: RobotConfig;
    joints: JointAngles;
    goToJoints: (joints: JointAngles) => void;
    goToPosition: (x: number, y: number, z: number, rx?: number, ry?: number, rz?: number, profile?: TaskPoseConstraintProfile) => boolean;
    isMotionQueueIdle: () => boolean;
    stopAnimation: () => void;
    isAnimating: boolean;
    isAnimatingRef: MutableRefObject<boolean>;
  },
): SequenceRobotAPI {
  return {
    config: robot.config,
    goToJoints: robot.goToJoints,
    goToPosition: robot.goToPosition,
    isMotionQueueIdle: robot.isMotionQueueIdle,
    stopAnimation: robot.stopAnimation,
    isAnimating: robot.isAnimating,
    isAnimatingRef: robot.isAnimatingRef,
    getCurrentJointsDeg: () => [...robot.joints] as JointAngles,
    getCurrentJointsRad: () => robot.joints.map((j) => (j * Math.PI) / 180) as JointAngles,
    getCurrentRotation: () => {
      const jointsRad = robot.joints.map((j) => (j * Math.PI) / 180) as JointAngles;
      const T = forwardKinematics(jointsRad, robot.config);
      return T.getRotation();
    },
    waitForAnimation: async () => {},
  };
}

export interface StepExecutorAPI {
  log: (level: SequenceLog['level'], message: string) => void;
  robot: SequenceRobotAPI;
  ctxRef: React.MutableRefObject<SeqContext>;
  setCtx: React.Dispatch<React.SetStateAction<SeqContext>>;
  cameraState: CameraState;
  onSuckerOn: () => void;
  onSuckerOff: () => void;
  onSpawnBox: (pos: [number, number, number], restingHeight?: number) => void;
  onDeleteAllBoxes: () => void;
  onResetBox: () => void;
  getBoxState: () => BoxState;
  isBoxAttachedStable: () => boolean;
  abortRef: MutableRefObject<boolean>;
  waypoints: Waypoint[];
  onStepStatusChange: (index: number, status: ActionStep['execStatus'], message?: string) => void;
  stepIndex: number;
  onCaptureSave: (result: { color?: string; segmentation?: string; depth?: string }) => void;
  robotPoseApi: RobotPoseAPI;
  sceneRendererApi: SceneRendererAPI | null;
}


/** 返回 true=成功, false=失败(应停止序列) */
async function executeStep(step: ActionStep, api: StepExecutorAPI): Promise<boolean> {
  const { robot, cameraState, robotPoseApi, sceneRendererApi } = api;
  return dispatchStep(step.type, {
    step,
    stepIndex: api.stepIndex,
    deps: { robot, cameraState, robotPoseApi, sceneRendererApi },
    ctx: { ctxRef: api.ctxRef, setCtx: api.setCtx, abortRef: api.abortRef, waypoints: api.waypoints },
    callbacks: {
      log: api.log,
      onStepStatusChange: api.onStepStatusChange,
      onSuckerOn: api.onSuckerOn,
      onSuckerOff: api.onSuckerOff,
      onSpawnBox: api.onSpawnBox,
      onDeleteAllBoxes: api.onDeleteAllBoxes,
      onResetBox: api.onResetBox,
      onCaptureSave: api.onCaptureSave,
      getBoxState: api.getBoxState,
      isBoxAttachedStable: api.isBoxAttachedStable,
    },
  });
}

export function useActionSequence(
  robotAPI: SequenceRobotAPI,
  cameraState: CameraState,
  onSuckerOn: () => void,
  onSuckerOff: () => void,
  onSpawnBox: (pos: [number, number, number], restingHeight?: number) => void,
  onDeleteAllBoxes: () => void,
  onResetBox: () => void,
  getBoxState: () => BoxState,
  isBoxAttachedStable: () => boolean,
  waypoints: Waypoint[]
) {
  const [steps, setSteps] = useState<ActionStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [status, setStatus] = useState<SequenceStatus>('idle');
  const [logs, setLogs] = useState<SequenceLog[]>([]);
  const [ctx, setCtx] = useState<SeqContext>(createDefaultContext());
  const [captureImages, setCaptureImages] = useState<{ color?: string; segmentation?: string; depth?: string }>({});
  const [suppressAutoDefaultLoad, setSuppressAutoDefaultLoad] = useState(false);

  const robotPoseApi = useRobotPoseAPI();
  const sceneRendererApi = useSceneRendererAPI();

  const abortRef = useRef(false);
  const ctxRef = useRef<SeqContext>(ctx);
  const stepIndexRef = useRef(currentStepIndex);

  useEffect(() => { stepIndexRef.current = currentStepIndex; }, [currentStepIndex]);

  useEffect(() => { ctxRef.current = ctx; }, [ctx]);

  // 使用 ref 实时检查动画状态（避免 React 状态异步更新导致 waitForAnimation 提前返回）
  const waitForAnimation = useCallback(async () => {
    return new Promise<void>((resolve) => {
      const check = () => {
        if (!robotAPI.isAnimatingRef.current && robotAPI.isMotionQueueIdle()) {
          resolve();
        } else {
          requestAnimationFrame(check);
        }
      };
      check();
    });
  }, [robotAPI]);

  const log = useCallback((level: SequenceLog['level'], message: string) => {
    setLogs((prev) => {
      const next = [...prev, { timestamp: Date.now(), level, message }];
      if (next.length > 200) next.shift();
      return next;
    });
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const onStepStatusChange = useCallback((index: number, execStatus?: ActionStep['execStatus'], message?: string) => {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === index
          ? {
              ...s,
              execStatus,
              execMessage: execStatus === 'error' ? message : undefined,
            }
          : s
      )
    );
  }, []);

  const onCaptureSave = useCallback((result: { color?: string; segmentation?: string; depth?: string }) => {
    setCaptureImages(result);
  }, []);

  const resetStepStatuses = useCallback(() => {
    setSteps((prev) => prev.map((s) => ({ ...s, execStatus: 'pending' as const, execMessage: undefined })));
  }, []);

  const clearRunningStepStatuses = useCallback(() => {
    setSteps((prev) =>
      prev.map((step) =>
        step.execStatus === 'running'
          ? { ...step, execStatus: 'pending', execMessage: undefined }
          : step
      )
    );
  }, []);

  const buildDefaultSequenceWithWaypoints = useCallback((): ActionStep[] => {
    const defaultSteps = createDefaultGraspSequence();
    return defaultSteps.map((step) =>
      step.type === '移动到目标位姿'
        ? { ...step, params: { ...step.params, memoryPointName: DEFAULT_SEQUENCE_PLACE_PRESET_NAME } }
        : step
    );
  }, []);

  const loadDefaultSequence = useCallback(() => {
    abortRef.current = true;
    robotAPI.stopAnimation();
    setStatus('idle');
    setCurrentStepIndex(0);
    setCtx(createDefaultContext());
    ctxRef.current = createDefaultContext();
    clearLogs();
    setCaptureImages({});
    setSuppressAutoDefaultLoad(false);
    setSteps(buildDefaultSequenceWithWaypoints());
  }, [buildDefaultSequenceWithWaypoints, clearLogs, robotAPI]);

  const clearSequence = useCallback(() => {
    abortRef.current = true;
    robotAPI.stopAnimation();
    setStatus('idle');
    setCurrentStepIndex(0);
    setCtx(createDefaultContext());
    ctxRef.current = createDefaultContext();
    clearLogs();
    clearRunningStepStatuses();
    setCaptureImages({});
    setSuppressAutoDefaultLoad(true);
    setSteps([]);
    onResetBox();
  }, [clearLogs, clearRunningStepStatuses, onResetBox, robotAPI]);

  // ========== 运行全部序列 ==========
  const runSequence = useCallback(async () => {
    if (status === 'running') return;

    // 前置校验：所有"移动到目标位姿"步骤必须已选择记忆点
    const missingMemoryPoint = steps.some(
      (s) => s.type === '移动到目标位姿' && !s.params.memoryPointName
    );
    if (missingMemoryPoint) {
      log('error', '存在未选择记忆点的"移动到目标位姿"步骤，序列未执行');
      setStatus('error');
      return;
    }

    resetStepStatuses();
    setStatus('running');
    setCurrentStepIndex(0);
    abortRef.current = false;
    log('info', '=== 序列开始 ===');

    let failed = false;
    for (let i = 0; i < steps.length; i++) {
      if (abortRef.current || failed) break;
      setCurrentStepIndex(i);
      const step = steps[i];
      onStepStatusChange(i, 'running');
      log('info', `[步骤 ${i + 1}/${steps.length}] ${step.type}`);

      const success = await executeStep(step, {
        log,
        robot: { ...robotAPI, waitForAnimation },
        ctxRef,
        setCtx,
        cameraState,
        onSuckerOn,
        onSuckerOff,
        onSpawnBox,
        onDeleteAllBoxes,
        onResetBox,
        getBoxState,
        isBoxAttachedStable,
        abortRef,
        waypoints,
        onStepStatusChange,
        stepIndex: i,
        onCaptureSave,
        robotPoseApi,
        sceneRendererApi,
      });

      if (!success) {
        failed = true;
        setStatus('error');
        log('error', '=== 序列因错误终止 ===');
        // 将后续未执行步骤标记为 pending（灰色即不执行）
        setSteps((prev) =>
          prev.map((s, idx) =>
            idx > i && (!s.execStatus || s.execStatus === 'pending')
              ? { ...s, execStatus: 'pending' }
              : s
          )
        );
        break;
      }

    }

    if (!failed && !abortRef.current) {
      log('success', '=== 序列完成 ===');
    }
    if (!failed && abortRef.current) {
      clearRunningStepStatuses();
      log('warn', '=== 序列被中止 ===');
    }
    if (!failed) {
      setStatus('idle');
    }
  }, [steps, status, robotAPI, cameraState, onSuckerOn, onSuckerOff, onSpawnBox, onDeleteAllBoxes, onResetBox, getBoxState, isBoxAttachedStable, waitForAnimation, log, ctxRef, waypoints, onStepStatusChange, onCaptureSave, resetStepStatuses, robotPoseApi, sceneRendererApi, clearRunningStepStatuses]);

  // ========== 单步执行 ==========
  const runSingleStep = useCallback(async () => {
    if (status === 'error') {
      log('warn', '序列已出错，请先重置');
      return;
    }

    const idx = stepIndexRef.current;
    const total = steps.length;
    if (idx >= total) {
      setCurrentStepIndex(0);
      resetStepStatuses();
      return;
    }

    setStatus('running');
    abortRef.current = false;
    const step = steps[idx];
    onStepStatusChange(idx, 'running');
    log('info', `[单步 ${idx + 1}/${total}] ${step.type}`);

    const success = await executeStep(step, {
      log,
      robot: { ...robotAPI, waitForAnimation },
      ctxRef,
      setCtx,
      cameraState,
      onSuckerOn,
      onSuckerOff,
      onSpawnBox,
      onDeleteAllBoxes,
      onResetBox,
      getBoxState,
      isBoxAttachedStable,
      abortRef,
      waypoints,
      onStepStatusChange,
      stepIndex: idx,
      onCaptureSave,
      robotPoseApi,
      sceneRendererApi,
    });

    if (abortRef.current) {
      clearRunningStepStatuses();
      setStatus('idle');
      setCurrentStepIndex(0);
      return;
    }

    if (!success) {
      setStatus('error');
      log('error', '单步执行出错，序列已终止');
      return;
    }

    const nextIdx = idx + 1;
    setCurrentStepIndex(nextIdx);
    if (nextIdx >= total) {
      setStatus('idle');
      setCurrentStepIndex(0);
    } else {
      setStatus('paused');
    }
  }, [steps, status, robotAPI, cameraState, onSuckerOn, onSuckerOff, onSpawnBox, onDeleteAllBoxes, onResetBox, getBoxState, isBoxAttachedStable, waitForAnimation, log, ctxRef, waypoints, onStepStatusChange, onCaptureSave, resetStepStatuses, robotPoseApi, sceneRendererApi, clearRunningStepStatuses]);

  const stopSequence = useCallback(() => {
    abortRef.current = true;
    robotAPI.stopAnimation();
    clearRunningStepStatuses();
    setStatus('idle');
    setCurrentStepIndex(0);
    log('warn', '序列停止');
  }, [robotAPI, log, clearRunningStepStatuses]);

  const resetSequence = useCallback(() => {
    abortRef.current = true;
    robotAPI.stopAnimation();
    onResetBox();
    setStatus('idle');
    setCurrentStepIndex(0);
    setCtx(createDefaultContext());
    ctxRef.current = createDefaultContext();
    clearLogs();
    resetStepStatuses();
    setCaptureImages({});
  }, [robotAPI, clearLogs, resetStepStatuses, onResetBox]);

  const addStep = useCallback((type: ActionStep['type']) => {
    setSuppressAutoDefaultLoad(false);
    setSteps((prev) => [...prev, createDefaultStep(type)]);
  }, []);

  const removeStep = useCallback((index: number) => {
    setSteps((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setSuppressAutoDefaultLoad(true);
      }
      return next;
    });
  }, []);

  const moveStep = useCallback((index: number, direction: 'up' | 'down') => {
    setSteps((prev) => {
      const newSteps = [...prev];
      if (direction === 'up' && index > 0) {
        [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
      } else if (direction === 'down' && index < newSteps.length - 1) {
        [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
      }
      return newSteps;
    });
  }, []);

  const updateStep = useCallback((index: number, updates: Partial<ActionStep>) => {
    setSuppressAutoDefaultLoad(false);
    setSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, ...updates } : step))
    );
  }, []);

  const setStepsList = useCallback((newSteps: ActionStep[]) => {
    setSteps(newSteps);
    setSuppressAutoDefaultLoad(newSteps.length === 0);
  }, []);

  return {
    steps,
    setStepsList,
    loadDefaultSequence,
    clearSequence,
    suppressAutoDefaultLoad,
    currentStepIndex,
    status,
    logs,
    ctx,
    captureImages,
    addStep,
    removeStep,
    moveStep,
    updateStep,
    runSequence,
    runSingleStep,
    stopSequence,
    resetSequence,
    clearLogs,
    log,
    waypoints,
  };
}
