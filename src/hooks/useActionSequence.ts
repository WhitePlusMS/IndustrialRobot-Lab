// src/hooks/useActionSequence.ts
import { useState, useCallback, useRef, useEffect, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { forwardKinematics } from '@/lib/kinematics';
import type { RobotConfig, JointAngles } from '@/types/robot';
import type {
  ActionStep,
  SeqContext,
  SequenceLog,
  SequenceStatus,
} from '@/types/sequence';
import { createDefaultContext, createDefaultStep } from '@/types/sequence';
import { captureColorPhoto, captureSegmentationPhoto } from '@/lib/capture-engine';
import type { CameraState } from '@/types/camera';
import type { Waypoint } from '@/hooks/useRobotKinematics';

const SUCKER_LENGTH = 25;
const BOX_HALF_SIZE = 40;

export interface SequenceRobotAPI {
  config: RobotConfig;
  goToJoints: (joints: JointAngles) => void;
  /** GLB 场景坐标定位（m）：优先 GLB 数值 IK，降级 DH 位置 IK */
  goToPosition: (x: number, y: number, z: number) => boolean;
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
    goToPosition: (x: number, y: number, z: number) => boolean;
    stopAnimation: () => void;
    isAnimating: boolean;
    isAnimatingRef: MutableRefObject<boolean>;
  },
): SequenceRobotAPI {
  return {
    config: robot.config,
    goToJoints: robot.goToJoints,
    goToPosition: robot.goToPosition,
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
  /** 强制吸附（序列步骤"下降到箱面"成功后，吸盘开启时直接吸附） */
  onForceAttachBox: () => void;
  onSpawnBox: (pos: [number, number, number], restingHeight?: number) => void;
  onResetBox: () => void;
  abortRef: MutableRefObject<boolean>;
  waypoints: Waypoint[];
  onStepStatusChange: (index: number, status: ActionStep['execStatus'], message?: string) => void;
  stepIndex: number;
  onCaptureSave: (result: { color?: string; segmentation?: string; depth?: string }) => void;
}

/** 返回 true=成功, false=失败(应停止序列) */
async function executeStep(step: ActionStep, api: StepExecutorAPI): Promise<boolean> {
  const {
    log, robot, ctxRef, setCtx, cameraState, onSuckerOn, onSuckerOff, onForceAttachBox, onSpawnBox, onResetBox,
    abortRef, waypoints, onStepStatusChange, stepIndex, onCaptureSave,
  } = api;

  if (abortRef.current) return false;

  onStepStatusChange(stepIndex, 'running');

  const fail = (msg: string) => {
    log('error', msg);
    onStepStatusChange(stepIndex, 'error', msg);
    return false;
  };

  switch (step.type) {
    case '生成箱子': {
      const spawn = step.params.boxSpawn;
      if (!spawn) {
        return fail('未配置箱子生成参数');
      }

      if (spawn.mode === 'fixed') {
        const pos = spawn.fixedPosition ?? [300, 40, 200];
        log('info', `生成箱子(固定): (${pos[0]}, ${pos[1]}, ${pos[2]}) mm`);
        const newCtx = {
          ...ctxRef.current,
          boxPose: { position: pos, rotation: [0, 0, 0] as [number, number, number] },
        };
        setCtx(newCtx);
        ctxRef.current = newCtx;
        log('success', '箱子已生成（固定位置）');
        onStepStatusChange(stepIndex, 'success');
        return true;
      }

      // random 模式
      const cx = spawn.randomCenter?.[0] ?? 300;
      const cz = spawn.randomCenter?.[1] ?? 200;
      const rx = (spawn.randomRangeX ?? 150);
      const rz = (spawn.randomRangeZ ?? 150);
      const minH = spawn.minHeight ?? 200;
      const maxH = spawn.maxHeight ?? 500;
      const restingH = spawn.restingHeight ?? 200;

      const randX = cx + (Math.random() * 2 - 1) * rx;
      const randZ = cz + (Math.random() * 2 - 1) * rz;
      const randY = minH + Math.random() * (maxH - minH);
      const dropPos: [number, number, number] = [Math.round(randX), Math.round(randY), Math.round(randZ)];

      log('info', `生成箱子(随机): (${dropPos[0]}, ${dropPos[1]}, ${dropPos[2]}) mm → 自由落体至 ${restingH}mm`);

      // 触发 3D 场景中的掉落动画，传递停止高度
      api.onSpawnBox(dropPos, restingH);

      const newCtx = {
        ...ctxRef.current,
        boxPose: { position: [dropPos[0], restingH, dropPos[2]], rotation: [0, 0, 0] as [number, number, number] },
      };
      setCtx(newCtx);
      ctxRef.current = newCtx;
      log('success', `箱子已生成（随机位置，落至 ${restingH}mm 悬停）`);
      onStepStatusChange(stepIndex, 'success');
      return true;
    }

    case '拍照': {
      log('info', '执行拍照...');
      const captureInfo = (window as any).__R3F_CAPTURE;
      if (!captureInfo) {
        return fail('渲染器未就绪，无法拍照');
      }
      const { renderer, scene } = captureInfo;
      const captureCamera = new THREE.PerspectiveCamera(
        cameraState.fov,
        cameraState.resolution[0] / cameraState.resolution[1],
        cameraState.near,
        cameraState.far
      );
      captureCamera.position.set(
        cameraState.position[0], cameraState.position[1], cameraState.position[2]
      );
      captureCamera.rotation.set(
        (cameraState.rotation[0] * Math.PI) / 180,
        (cameraState.rotation[1] * Math.PI) / 180,
        (cameraState.rotation[2] * Math.PI) / 180,
        'XYZ'
      );
      captureCamera.updateProjectionMatrix();
      captureCamera.updateMatrixWorld();

      const photoScene = scene.clone();
      photoScene.traverse((obj: any) => {
        if (obj.userData?.isCameraModel) obj.visible = false;
      });

      try {
        const colorURL = captureColorPhoto(renderer, photoScene, captureCamera, cameraState.resolution);
        const segResult = captureSegmentationPhoto(renderer, photoScene, captureCamera, cameraState.resolution);
        onCaptureSave({ color: colorURL, segmentation: segResult.dataURL });
        log('success', '拍照完成（彩色+分割）');
      } catch (e: any) {
        return fail(`拍照失败: ${e.message || e}`);
      }
      onStepStatusChange(stepIndex, 'success');
      return true;
    }

    case '移动到箱子上方': {
      if (!ctxRef.current.boxPose) {
        return fail('未生成箱子，无法移动');
      }
      log('info', '移动到箱子上方...');
      const bp = ctxRef.current.boxPose.position;
      const appH = step.params.approachHeight ?? 50;
      // 目标：场景坐标（米），箱子上方（吸盘+接近高度）
      if (!robot.goToPosition(
        bp[0] / 1000,
        (bp[1] + BOX_HALF_SIZE + SUCKER_LENGTH + appH) / 1000,
        bp[2] / 1000,
      )) {
        return fail('IK 无解：无法到达箱子上方');
      }
      await robot.waitForAnimation();
      if (abortRef.current) return false;
      log('success', '到达箱子上方');
      onStepStatusChange(stepIndex, 'success');
      return true;
    }

    case '下降到箱面': {
      if (!ctxRef.current.boxPose) {
        return fail('未生成箱子，无法下降');
      }
      log('info', '下降到箱面...');
      const bp2 = ctxRef.current.boxPose.position;
      const rot = robot.getCurrentRotation();
      const tz: [number, number, number] = [rot[0][2], rot[1][2], rot[2][2]];
      // 吸盘尖端 → 箱子顶部中心（场景米）
      if (!robot.goToPosition(
        (bp2[0] + tz[0] * SUCKER_LENGTH) / 1000,
        (bp2[1] + BOX_HALF_SIZE + tz[1] * SUCKER_LENGTH) / 1000,
        (bp2[2] + tz[2] * SUCKER_LENGTH) / 1000,
      )) {
        return fail('IK 无解：无法下降到箱面');
      }
      await robot.waitForAnimation();
      if (abortRef.current) return false;
      log('success', '接触箱面');
      onStepStatusChange(stepIndex, 'success');
      return true;
    }

    case '吸盘开启': {
      log('info', '吸盘开启...');
      onSuckerOn();
      onForceAttachBox(); // 强制吸附（上一步已确保吸盘接触箱面）
      const newCtx = { ...ctxRef.current, suckerOn: true };
      setCtx(newCtx);
      ctxRef.current = newCtx;
      log('success', '吸盘已开启，箱子已吸附');
      onStepStatusChange(stepIndex, 'success');
      return true;
    }

    case '吸盘关闭': {
      log('info', '吸盘关闭...');
      onSuckerOff();
      const newCtx2 = { ...ctxRef.current, suckerOn: false };
      setCtx(newCtx2);
      ctxRef.current = newCtx2;
      log('success', '吸盘已关闭，箱子释放');
      onStepStatusChange(stepIndex, 'success');
      return true;
    }

    case '抬升': {
      log('info', '抬升中...');
      const getMat = (window as any).__GLB_getFlangeMatrix;
      const glbResult = getMat?.();
      if (!glbResult) return fail('无法读取 GLB 法兰位置');
      const liftH = step.params.liftHeight ?? 100;
      if (!robot.goToPosition(
        glbResult.position[0],
        glbResult.position[1] + liftH / 1000,
        glbResult.position[2],
      )) {
        return fail('IK 无解：无法抬升');
      }
      await robot.waitForAnimation();
      if (abortRef.current) return false;
      log('success', '抬升完成');
      onStepStatusChange(stepIndex, 'success');
      return true;
    }

    case '移动到目标位姿': {
      const name = step.params.memoryPointName;
      if (!name) {
        return fail('未选择记忆点');
      }
      const wp = waypoints.find((w) => w.name === name);
      if (!wp) {
        return fail(`记忆点"${name}"不存在`);
      }
      log('info', `移动到目标位姿: ${name}`);
      robot.goToJoints([...wp.joints] as JointAngles);
      await robot.waitForAnimation();
      if (abortRef.current) return false;
      log('success', `到达目标位姿: ${name}`);
      onStepStatusChange(stepIndex, 'success');
      return true;
    }

    case '归位': {
      log('info', '归位中...');
      const zero: JointAngles = [0, 0, 0, 0, 0, 0];
      robot.goToJoints(zero);
      await robot.waitForAnimation();
      if (abortRef.current) return false;
      onResetBox(); // 归位后隐藏箱子
      log('success', '归位完成');
      onStepStatusChange(stepIndex, 'success');
      return true;
    }

    case '等待': {
      const duration = step.params.waitDuration ?? 1000;
      log('info', `等待 ${duration}ms...`);
      await new Promise((resolve) => setTimeout(resolve, duration));
      if (abortRef.current) return false;
      log('success', '等待结束');
      onStepStatusChange(stepIndex, 'success');
      return true;
    }
  }

  return true;
}

export function useActionSequence(
  robotAPI: SequenceRobotAPI,
  cameraState: CameraState,
  onSuckerOn: () => void,
  onSuckerOff: () => void,
  onForceAttachBox: () => void,
  onSpawnBox: (pos: [number, number, number], restingHeight?: number) => void,
  onResetBox: () => void,
  waypoints: Waypoint[]
) {
  const [steps, setSteps] = useState<ActionStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [status, setStatus] = useState<SequenceStatus>('idle');
  const [logs, setLogs] = useState<SequenceLog[]>([]);
  const [ctx, setCtx] = useState<SeqContext>(createDefaultContext());
  const [captureImages, setCaptureImages] = useState<{ color?: string; segmentation?: string; depth?: string }>({});

  const abortRef = useRef(false);
  const ctxRef = useRef<SeqContext>(ctx);
  const stepIndexRef = useRef(currentStepIndex);

  useEffect(() => { stepIndexRef.current = currentStepIndex; }, [currentStepIndex]);

  useEffect(() => { ctxRef.current = ctx; }, [ctx]);

  // 使用 ref 实时检查动画状态（避免 React 状态异步更新导致 waitForAnimation 提前返回）
  const waitForAnimation = useCallback(async () => {
    return new Promise<void>((resolve) => {
      const check = () => {
        if (!robotAPI.isAnimatingRef.current) {
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
      prev.map((s, i) => (i === index ? { ...s, execStatus, execMessage: message } : s))
    );
  }, []);

  const onCaptureSave = useCallback((result: { color?: string; segmentation?: string; depth?: string }) => {
    setCaptureImages(result);
  }, []);

  const resetStepStatuses = useCallback(() => {
    setSteps((prev) => prev.map((s) => ({ ...s, execStatus: 'pending' as const, execMessage: undefined })));
  }, []);

  // ========== 运行全部序列 ==========
  const runSequence = useCallback(async () => {
    if (status === 'running') return;
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
      log('info', `[步骤 ${i + 1}/${steps.length}] ${step.type}`);

      const success = await executeStep(step, {
        log,
        robot: { ...robotAPI, waitForAnimation },
        ctxRef,
        setCtx,
        cameraState,
        onSuckerOn,
        onSuckerOff,
        onForceAttachBox,
        onSpawnBox,
        onResetBox,
        abortRef,
        waypoints,
        onStepStatusChange,
        stepIndex: i,
        onCaptureSave,
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
      log('warn', '=== 序列被中止 ===');
    }
    if (!failed) {
      setStatus('idle');
    }
  }, [steps, status, robotAPI, cameraState, onSuckerOn, onSuckerOff, onForceAttachBox, onSpawnBox, onResetBox, waitForAnimation, log, ctxRef, waypoints, onStepStatusChange, onCaptureSave, resetStepStatuses]);

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

    setStatus('paused');
    abortRef.current = false;
    const step = steps[idx];
    log('info', `[单步 ${idx + 1}/${total}] ${step.type}`);

    const success = await executeStep(step, {
      log,
      robot: { ...robotAPI, waitForAnimation },
      ctxRef,
      setCtx,
      cameraState,
      onSuckerOn,
      onSuckerOff,
      onForceAttachBox,
      onSpawnBox,
      onResetBox,
      abortRef,
      waypoints,
      onStepStatusChange,
      stepIndex: idx,
      onCaptureSave,
    });

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
  }, [steps, status, robotAPI, cameraState, onSuckerOn, onSuckerOff, onForceAttachBox, onSpawnBox, onResetBox, waitForAnimation, log, ctxRef, waypoints, onStepStatusChange, onCaptureSave, resetStepStatuses]);

  const stopSequence = useCallback(() => {
    abortRef.current = true;
    robotAPI.stopAnimation();
    setStatus('idle');
    setCurrentStepIndex(0);
    log('warn', '序列停止');
  }, [robotAPI, log]);

  const resetSequence = useCallback(() => {
    abortRef.current = true;
    robotAPI.stopAnimation();
    setStatus('idle');
    setCurrentStepIndex(0);
    setCtx(createDefaultContext());
    ctxRef.current = createDefaultContext();
    clearLogs();
    resetStepStatuses();
    setCaptureImages({});
  }, [robotAPI, clearLogs, resetStepStatuses]);

  const addStep = useCallback((type: ActionStep['type']) => {
    setSteps((prev) => [...prev, createDefaultStep(type)]);
  }, []);

  const removeStep = useCallback((index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
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
    setSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, ...updates } : step))
    );
  }, []);

  const setStepsList = useCallback((newSteps: ActionStep[]) => {
    setSteps(newSteps);
  }, []);

  return {
    steps,
    setStepsList,
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
  };
}
