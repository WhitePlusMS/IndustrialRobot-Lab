// src/hooks/useRobotKinematics.ts
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { forwardKinematics, extractPose } from '@/lib/kinematics';
import { solveIK, solvePositionOnlyIK, computeJacobian } from '@/lib/ik-solver';
import { KUKA_LIKE, DEFAULT_JOINTS } from '@/lib/robot-config';
import { Matrix4x4 } from '@/lib/matrix4x4';
import { lerpJoints, updateJointAngles, DEFAULT_MOTION_CONFIG } from '@/lib/motion-smoothing';
import type { CoordinateSystem, StatusType, JointAngles } from '@/types/robot';

/** 记忆点类型（供动作序列系统使用） */
export interface Waypoint {
  name: string;
  joints: JointAngles;
}

export function useRobotKinematics() {
  const config = KUKA_LIKE;

  const [joints, setJoints] = useState<JointAngles>(DEFAULT_JOINTS);
  const [displayJoints, setDisplayJoints] = useState<JointAngles>(DEFAULT_JOINTS);
  const [originJoints, setOriginJoints] = useState<JointAngles | null>(null);
  const [coordinateSystem, setCoordinateSystem] = useState<CoordinateSystem>('World');
  const [jointStep, setJointStep] = useState(1);
  const [posStep, setPosStep] = useState(1);
  const [rotStep, setRotStep] = useState(1);
  const [selectedTool, setSelectedTool] = useState('无');
  const [toolList, setToolList] = useState<string[]>([]);
  const [status, setStatus] = useState<StatusType>('ready');
  const [isAnimating, setIsAnimating] = useState(false);
  const isAnimatingRef = useRef(false);
  const [glbPosition, setGlbPosition] = useState<[number, number, number] | null>(null);

  // 轨迹记录（直接从模型采样，与缩放无关）
  const [trajectory, setTrajectory] = useState<[number, number, number][]>([]);

  // ===== Refs for real-time access during RAF loops =====
  const jointsRef = useRef<JointAngles>([0, 0, 0, 0, 0, 0]);
  const displayJointsRef = useRef<JointAngles>([0, 0, 0, 0, 0, 0]);

  useEffect(() => { jointsRef.current = joints; }, [joints]);
  useEffect(() => { displayJointsRef.current = displayJoints; }, [displayJoints]);

  // 动画 refs
  const animIdRef = useRef<number>(0);
  const targetJointsRef = useRef<number[]>([0, 0, 0, 0, 0, 0]);
  const startJointsRef = useRef<number[]>([0, 0, 0, 0, 0, 0]);
  const startTimeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const isLongPressRef = useRef(false);

  // 长按目标累加：追踪长按会话的累积目标，避免每tick从当前位置重新计算
  const longPressGLBTargetRef = useRef<[number, number, number] | null>(null);
  const longPressDHTargetRef = useRef<[number, number, number] | null>(null);
  const longPressEulerRef = useRef<[number, number, number] | null>(null);
  const longPressKeyRef = useRef<string>('');

  // 计算末端位姿（基于当前显示角度）
  const endEffectorPose = useMemo(() => {
    const jointsRad = displayJoints.map((j) => (j * Math.PI) / 180) as JointAngles;
    const T = forwardKinematics(jointsRad, config);
    const { position, eulerZYX } = extractPose(T);
    return {
      position: position.map((v) => Math.round(v * 10) / 10) as [number, number, number],
      euler: eulerZYX.map((rad) => Math.round((rad * 180) / Math.PI * 10) / 10) as [number, number, number],
      rotation: T.getRotation(),
      matrix: T,
    };
  }, [displayJoints, config]);

  // 添加轨迹点（由 GLBRobotArm 在关节更新后直接回调，使用模型采样坐标）
  const addTrajectoryPoint = useCallback((pos: [number, number, number]) => {
    setTrajectory((prev) => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        const dist = Math.sqrt(
          (pos[0] - last[0]) ** 2 + (pos[1] - last[1]) ** 2 + (pos[2] - last[2]) ** 2
        );
        if (dist < 0.001) return prev;
      }
      const next = [...prev, pos];
      if (next.length > 200) next.shift();
      return next;
    });
  }, []);

  // 停止动画
  const stopAnimation = useCallback(() => {
    cancelAnimationFrame(animIdRef.current);
    animIdRef.current = 0;
    setIsAnimating(false); isAnimatingRef.current = false;
  }, []);

  // 缓动动画循环
  const runEasedAnimation = useCallback(() => {
    const now = performance.now();
    const elapsed = now - startTimeRef.current;
    const duration = DEFAULT_MOTION_CONFIG.ikAnimDuration;
    const t = Math.min(elapsed / duration, 1);

    const next = lerpJoints(startJointsRef.current, targetJointsRef.current, t);
    setDisplayJoints(next as JointAngles);
    setJoints(next as JointAngles);
    // 同步 ref，避免 useEffect 延迟导致的竞态
    displayJointsRef.current = next as JointAngles;
    jointsRef.current = next as JointAngles;

    if (t < 1) {
      animIdRef.current = requestAnimationFrame(runEasedAnimation);
    } else {
      animIdRef.current = 0;
      setIsAnimating(false); isAnimatingRef.current = false;
      setStatus('complete');
      setTimeout(() => setStatus('ready'), 500);
    }
  }, []);

  // 速度限制动画循环
  const runSpeedLimitedAnimation = useCallback(() => {
    const now = performance.now();
    const deltaTime = lastTimeRef.current ? now - lastTimeRef.current : 16;
    lastTimeRef.current = now;

    const current = displayJointsRef.current;
    const next = updateJointAngles(
      [...current],
      targetJointsRef.current,
      deltaTime,
      DEFAULT_MOTION_CONFIG.jointSpeedLimit
    );
    setDisplayJoints(next as JointAngles);
    setJoints(next as JointAngles);
    // 同步 ref，避免 useEffect 延迟导致的竞态
    displayJointsRef.current = next as JointAngles;
    jointsRef.current = next as JointAngles;

    const allClose = next.every((v, i) => Math.abs(v - targetJointsRef.current[i]) < 0.1);
    if (!allClose) {
      animIdRef.current = requestAnimationFrame(runSpeedLimitedAnimation);
    } else {
      animIdRef.current = 0;
      setIsAnimating(false); isAnimatingRef.current = false;
      setStatus('complete');
      setTimeout(() => setStatus('ready'), 500);
    }
  }, []);

  // 启动缓动动画
  const startEasedAnimation = useCallback(
    (target: number[]) => {
      cancelAnimationFrame(animIdRef.current);
      targetJointsRef.current = [...target];
      startJointsRef.current = [...displayJointsRef.current];
      startTimeRef.current = performance.now();
      isLongPressRef.current = false;
      setIsAnimating(true); isAnimatingRef.current = true;
      setStatus('moving');
      animIdRef.current = requestAnimationFrame(runEasedAnimation);
    },
    [runEasedAnimation]
  );

  // 启动速度限制动画
  const startSpeedLimitedAnimation = useCallback(
    (target: number[]) => {
      cancelAnimationFrame(animIdRef.current);
      targetJointsRef.current = [...target];
      lastTimeRef.current = 0;
      isLongPressRef.current = true;
      setIsAnimating(true); isAnimatingRef.current = true;
      setStatus('moving');
      animIdRef.current = requestAnimationFrame(runSpeedLimitedAnimation);
    },
    [runSpeedLimitedAnimation]
  );

  // ===== 关节微调（±按钮）=====
  // 单击：启动缓动动画
  // 长按连续触发：直接累加，不使用动画
  const adjustJoint = useCallback(
    (index: number, delta: number, isContinuous = false) => {
      const range = Object.values(config.dhParams)[index].thetaRange;

      // 使用 ref 获取最新值，避免 stale closure
      const current = jointsRef.current;
      const step = jointStep;
      let newVal = current[index] + delta * step;

      // 限位
      newVal = Math.max(range[0], Math.min(range[1], newVal));

      const newJoints = [...current] as JointAngles;
      newJoints[index] = Math.round(newVal * 10) / 10;

      if (isContinuous) {
        // 连续模式：直接设置，无动画
        setJoints(newJoints);
        setDisplayJoints(newJoints);
      } else {
        // 单击模式：启动缓动动画
        startEasedAnimation([...newJoints]);
      }
    },
    [jointStep, config, startEasedAnimation]
  );

  // ===== 方向键移动（位姿控制）=====

  // GLB 数值雅可比 IK：直接用 GLB 模型求解，不依赖 DH
  const glbSolveIK = useCallback(
    (targetWorldMeters: [number, number, number], startJoints: number[]): number[] | null => {
      const glb = (window as any).__GLB_getFlangeMatrix;
      const apply = (window as any).__GLB_applyJoints;
      if (!glb || !apply) return null;

      const PERTURB = 0.3; // deg
      const MAX_ITER = 30;
      const TOL = 0.0005; // 0.5mm in meters

      let theta = [...startJoints];
      let lambda = 0.3;

      for (let iter = 0; iter < MAX_ITER; iter++) {
        apply(theta);
        const fk = glb();
        if (!fk) return null;
        const pos: number[] = fk.position;
        const err = [targetWorldMeters[0] - pos[0], targetWorldMeters[1] - pos[1], targetWorldMeters[2] - pos[2]];
        const errNorm = Math.sqrt(err[0]*err[0] + err[1]*err[1] + err[2]*err[2]);
        if (errNorm < TOL) { apply(startJoints); return theta; }

        // 数值雅可比 (3×6)
        const J: number[][] = [[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0]];
        for (let j = 0; j < 6; j++) {
          const saved = theta[j];
          theta[j] += PERTURB;
          apply(theta);
          const p2 = glb()?.position;
          theta[j] = saved;
          if (!p2) { apply(startJoints); return null; }
          const dθ = PERTURB * Math.PI / 180;
          J[0][j] = (p2[0] - pos[0]) / dθ;
          J[1][j] = (p2[1] - pos[1]) / dθ;
          J[2][j] = (p2[2] - pos[2]) / dθ;
        }

        // DLS: Δθ = J^T(JJ^T + λ²I)^-1 · err
        const JJt = [[0,0,0],[0,0,0],[0,0,0]];
        for (let r=0;r<3;r++) for (let c=0;c<3;c++) for (let k=0;k<6;k++) JJt[r][c] += J[r][k]*J[c][k];
        JJt[0][0] += lambda*lambda; JJt[1][1] += lambda*lambda; JJt[2][2] += lambda*lambda;

        const det = JJt[0][0]*(JJt[1][1]*JJt[2][2]-JJt[1][2]*JJt[2][1])
                  - JJt[0][1]*(JJt[1][0]*JJt[2][2]-JJt[1][2]*JJt[2][0])
                  + JJt[0][2]*(JJt[1][0]*JJt[2][1]-JJt[1][1]*JJt[2][0]);
        if (Math.abs(det) < 1e-10) { lambda *= 2; if (lambda > 50) { apply(startJoints); return null; } continue; }
        const id = 1/det;
        const inv = [
          [(JJt[1][1]*JJt[2][2]-JJt[1][2]*JJt[2][1])*id, (JJt[0][2]*JJt[2][1]-JJt[0][1]*JJt[2][2])*id, (JJt[0][1]*JJt[1][2]-JJt[0][2]*JJt[1][1])*id],
          [(JJt[1][2]*JJt[2][0]-JJt[1][0]*JJt[2][2])*id, (JJt[0][0]*JJt[2][2]-JJt[0][2]*JJt[2][0])*id, (JJt[0][2]*JJt[1][0]-JJt[0][0]*JJt[1][2])*id],
          [(JJt[1][0]*JJt[2][1]-JJt[1][1]*JJt[2][0])*id, (JJt[0][1]*JJt[2][0]-JJt[0][0]*JJt[2][1])*id, (JJt[0][0]*JJt[1][1]-JJt[0][1]*JJt[1][0])*id]];
        const dθ = [0,0,0,0,0,0];
        for (let i=0;i<6;i++) for (let j=0;j<3;j++) { let s=0; for (let k=0;k<3;k++) s+=inv[j][k]*err[k]; dθ[i] += J[j][i]*s; }

        for (let i=0;i<6;i++) {
          theta[i] += dθ[i] * 180 / Math.PI;
          const range = Object.values(config.dhParams)[i].thetaRange;
          theta[i] = Math.max(range[0], Math.min(range[1], theta[i]));
        }
        lambda *= 0.9;
      }
      apply(startJoints);
      return null;
    }, [config]);
  const moveDirection = useCallback(
    (axis: 'x' | 'y' | 'z' | 'rx' | 'ry' | 'rz', sign: 1 | -1, isLongPress: boolean) => {
      const step = ['x', 'y', 'z'].includes(axis) ? posStep : rotStep;
      const delta = step * sign;

      // 使用 ref 获取最新关节值
      const currentJoints = jointsRef.current;
      const jointsRad = currentJoints.map((j) => (j * Math.PI) / 180) as JointAngles;
      const T = forwardKinematics(jointsRad, config);
      const currentPos = T.getPosition();
      const currentEuler = extractPose(T).eulerZYX;
      const currentRot = T.getRotation();

      const isPos = ['x', 'y', 'z'].includes(axis);
      console.log(`[moveDir] ${coordinateSystem} ${axis}${sign > 0 ? '+' : '−'}  delta=${delta}${isPos ? 'mm' : '°'}  ` +
        `前: pos=[${currentPos.map(v=>v.toFixed(1)).join(',')}] euler=[${currentEuler.map(r=>(r*180/Math.PI).toFixed(1)).join(',')}]°`);

      let targetPos: [number, number, number] = currentPos;
      let targetEuler: [number, number, number] = currentEuler;

      const isPositionAxis = axis === 'x' || axis === 'y' || axis === 'z';
      const isRotationAxis = axis === 'rx' || axis === 'ry' || axis === 'rz';

      // 同时计算 DH 目标 (mm) 和 GLB 目标 (m) —— 长按用 DH，单击用 GLB
      let glbTargetM: [number,number,number] | null = null;
      if (isPositionAxis) {
        // DH 目标 (mm)
        const axisIndexMap: Record<string, number> = { x: 0, y: 1, z: 2 };
        const axisIndex = axisIndexMap[axis];
        const offset = [0, 0, 0] as [number, number, number];
        offset[axisIndex] = delta;
        if (coordinateSystem === 'Tool') {
          const worldOffset = Matrix4x4.mat3Vec3Mul(currentRot, offset);
          targetPos = [currentPos[0] + worldOffset[0], currentPos[1] + worldOffset[1], currentPos[2] + worldOffset[2]];
        } else {
          targetPos = [currentPos[0] + offset[0], currentPos[1] + offset[1], currentPos[2] + offset[2]];
        }

        // GLB 目标 (m) —— 供单击精确 IK
        const deltaM = delta / 1000;
        const glbM = (window as any).__GLB_getFlangeMatrix;
        if (glbM) {
          const m = glbM();
          if (m) {
            const gp = m.position as [number,number,number];
            const gr = m.rotation as number[][];
            if (coordinateSystem === 'Tool') {
              const col = {x:0,y:1,z:2}[axis]!;
              glbTargetM = [gp[0] + gr[0][col]*deltaM, gp[1] + gr[1][col]*deltaM, gp[2] + gr[2][col]*deltaM];
            } else {
              const o = [0,0,0]; o[axisIndex] = deltaM;
              glbTargetM = [gp[0]+o[0], gp[1]+o[1], gp[2]+o[2]];
            }
          }
        }
        targetEuler = currentEuler;
      } else {
        const axisIndexMap: Record<'rx' | 'ry' | 'rz', number> = { rx: 0, ry: 1, rz: 2 };
        const axisIndex = axisIndexMap[axis as 'rx' | 'ry' | 'rz'];
        const deltaRad = (delta * Math.PI) / 180;
        const eulerOffset = [0, 0, 0] as [number, number, number];
        eulerOffset[axisIndex] = deltaRad;

        targetPos = currentPos;
        targetEuler = [
          currentEuler[0] + eulerOffset[0],
          currentEuler[1] + eulerOffset[1],
          currentEuler[2] + eulerOffset[2],
        ];
      }

      // 长按目标累加：每tick在上次目标基础上扩展，避免从当前位置重新计算导致位移不累积
      if (isLongPress) {
        const pressKey = `${axis}:${sign}:${coordinateSystem}`;
        // 新会话判断：方向/坐标系改变 或 动画未运行
        const isNewSession = longPressKeyRef.current !== pressKey || animIdRef.current === 0;

        if (isPositionAxis) {
          if (!isNewSession && longPressDHTargetRef.current && longPressGLBTargetRef.current) {
            // 后续tick：在上次累加目标基础上扩展delta
            const idx = { x: 0, y: 1, z: 2 }[axis]!;
            const dhOffset = [0, 0, 0]; dhOffset[idx] = delta;
            const deltaM = (delta * sign) / 1000;
            if (coordinateSystem === 'Tool') {
              const wo = Matrix4x4.mat3Vec3Mul(currentRot, dhOffset);
              longPressDHTargetRef.current = [
                longPressDHTargetRef.current[0] + wo[0],
                longPressDHTargetRef.current[1] + wo[1],
                longPressDHTargetRef.current[2] + wo[2],
              ];
              const col = { x: 0, y: 1, z: 2 }[axis]!;
              longPressGLBTargetRef.current = [
                longPressGLBTargetRef.current[0] + currentRot[0][col] * deltaM,
                longPressGLBTargetRef.current[1] + currentRot[1][col] * deltaM,
                longPressGLBTargetRef.current[2] + currentRot[2][col] * deltaM,
              ];
            } else {
              longPressDHTargetRef.current = [
                longPressDHTargetRef.current[0] + dhOffset[0],
                longPressDHTargetRef.current[1] + dhOffset[1],
                longPressDHTargetRef.current[2] + dhOffset[2],
              ];
              const o = [0, 0, 0]; o[idx] = deltaM;
              longPressGLBTargetRef.current = [
                longPressGLBTargetRef.current[0] + o[0],
                longPressGLBTargetRef.current[1] + o[1],
                longPressGLBTargetRef.current[2] + o[2],
              ];
            }
          } else {
            // 新会话首tick：从当前位置初始化累加目标
            longPressDHTargetRef.current = [...targetPos];
            longPressGLBTargetRef.current = glbTargetM ? [...glbTargetM] : null;
            longPressKeyRef.current = pressKey;
          }
          targetPos = longPressDHTargetRef.current!;
          glbTargetM = longPressGLBTargetRef.current;
        } else {
          // 姿态轴累加
          if (!isNewSession && longPressEulerRef.current) {
            const idx = { rx: 0, ry: 1, rz: 2 }[axis as 'rx' | 'ry' | 'rz']!;
            const next = [...longPressEulerRef.current];
            next[idx] += (delta * Math.PI) / 180;
            longPressEulerRef.current = next as [number, number, number];
          } else {
            longPressEulerRef.current = [...targetEuler];
            longPressKeyRef.current = pressKey;
          }
          targetEuler = longPressEulerRef.current;
        }
      } else {
        // 短按：清除累加状态
        longPressDHTargetRef.current = null;
        longPressGLBTargetRef.current = null;
        longPressEulerRef.current = null;
        longPressKeyRef.current = '';
      }

      // IK求解: 统一使用 GLB 数值 IK（精度最高），失败降级到 DH
      let resultDeg: number[] | null = null;

      if (isPositionAxis && glbTargetM) {
        // 位置轴: GLB 数值 IK（单击和长按同一套逻辑）
        const glbResult = glbSolveIK(glbTargetM, [...currentJoints]);
        if (glbResult) resultDeg = glbResult;
      }
      if (!resultDeg && isPositionAxis) {
        // GLB 失败降级: DH 位置 IK
        const result = solvePositionOnlyIK(targetPos, jointsRad, config);
        if (result) resultDeg = result.map((rad) => (rad * 180) / Math.PI);
      }
      if (!resultDeg && !isPositionAxis) {
        // 姿态轴: DH IK
        const result = solveIK(targetPos, targetEuler, jointsRad, config);
        if (result) resultDeg = result.map((rad) => (rad * 180) / Math.PI);
      }

      if (!resultDeg) {
        setStatus('unreachable');
        setTimeout(() => setStatus('ready'), 1500);
        return { success: false };
      }

      const targetDeg = resultDeg;

      // 关节限位保护：检查是否接近限位边界
      let wasLimited = false;
      for (let i = 0; i < 6; i++) {
        const range = Object.values(config.dhParams)[i].thetaRange;
        const deg = targetDeg[i];
        if (deg <= range[0] + 0.01 || deg >= range[1] - 0.01) {
          wasLimited = true;
        }
      }

      // 奇异点检测：计算Jacobian可操作度，当 JJ^T 不可逆时处于奇异位姿
      let isSingular = false;
      try {
        const J = computeJacobian(jointsRad, config);
        const JJt = Matrix4x4.mat6Mul(J, Matrix4x4.mat6Transpose(J));
        if (!Matrix4x4.mat6Inverse(JJt)) isSingular = true;
      } catch {
        isSingular = true;
      }

      if (isSingular) {
        setStatus('nearSingularity');
        setTimeout(() => setStatus('ready'), 1500);
      }

      if (isLongPress) {
        if (animIdRef.current !== 0) {
          // 动画已在运行：只更新目标，不重启动画（避免取消累积位移）
          targetJointsRef.current = [...targetDeg];
          lastTimeRef.current = 0;
        } else {
          startSpeedLimitedAnimation(targetDeg);
        }
      } else {
        startEasedAnimation(targetDeg);
      }

      if (wasLimited) {
        setStatus('jointLimited');
        setTimeout(() => setStatus('ready'), 1500);
      }

      return { success: true };
    },
    [coordinateSystem, posStep, rotStep, config, startEasedAnimation, startSpeedLimitedAnimation]
  );

  // 设置为原点
  const saveOrigin = useCallback(() => {
    setOriginJoints([...jointsRef.current]);
  }, []);

  // 回原点
  const goToOrigin = useCallback(() => {
    if (!originJoints) return;
    startEasedAnimation([...originJoints]);
  }, [originJoints, startEasedAnimation]);

  // 回零位
  const goToZero = useCallback(() => {
    const zero: JointAngles = [0, 0, 0, 0, 0, 0];
    startEasedAnimation([...zero]);
  }, [startEasedAnimation]);

  // 重置
  const resetJoints = useCallback(() => goToZero(), [goToZero]);

  // 随机配置
  const randomJoints = useCallback(() => {
    const random = Array(6)
      .fill(0)
      .map((_, i) => {
        const range = Object.values(config.dhParams)[i].thetaRange;
        return range[0] + Math.random() * (range[1] - range[0]);
      }) as JointAngles;
    startEasedAnimation([...random]);
  }, [config, startEasedAnimation]);

  // 跳转到指定关节角
  const goToJoints = useCallback(
    (target: JointAngles) => {
      startEasedAnimation([...target]);
    },
    [startEasedAnimation]
  );

  // 绝对定位：将末端移动到笛卡尔空间指定坐标 (GLB模型坐标，米)
  const goToPosition = useCallback(
    (x: number, y: number, z: number): boolean => {
      const target: [number, number, number] = [x, y, z];
      const currentJoints = jointsRef.current;
      // 优先使用 GLB 数值 IK
      const glbResult = glbSolveIK(target, [...currentJoints]);
      if (glbResult) {
        startEasedAnimation(glbResult);
        return true;
      }
      // 降级：DH 位置 IK（单位处理为mm）
      const jointsRad = currentJoints.map((j) => (j * Math.PI) / 180) as JointAngles;
      const dhTarget = [x * 1000, y * 1000, z * 1000] as [number, number, number];
      const dhResult = solvePositionOnlyIK(dhTarget, jointsRad, config);
      if (dhResult) {
        startEasedAnimation(dhResult.map((rad) => (rad * 180) / Math.PI));
        return true;
      }
      setStatus('unreachable');
      setTimeout(() => setStatus('ready'), 1500);
      return false;
    },
    [glbSolveIK, config, startEasedAnimation, setStatus]
  );

  // 同步 GLB 模型末端位置（响应式，随关节更新同步变化）
  useEffect(() => {
    let cancelled = false;
    const read = () => {
      const fn = (window as any).__GLB_getFlangeMatrix as (() => { position: [number, number, number] }) | undefined;
      const pos = fn?.()?.position;
      if (pos) {
        if (!cancelled) setGlbPosition([pos[0], pos[1], pos[2]]);
      } else {
        // GLB 模型尚未就绪，下一帧重试
        if (!cancelled) requestAnimationFrame(read);
      }
    };
    requestAnimationFrame(read);
    return () => { cancelled = true; };
  }, [displayJoints]);

  return {
    joints: displayJoints,
    rawJoints: joints,
    endEffectorPose,
    originJoints,
    trajectory,
    addTrajectoryPoint,
    adjustJoint,
    moveDirection,
    saveOrigin,
    goToOrigin,
    goToZero,
    resetJoints,
    randomJoints,
    goToJoints,
    goToPosition,
    glbPosition,
    stopAnimation,
    coordinateSystem,
    setCoordinateSystem,
    jointStep,
    setJointStep,
    posStep,
    setPosStep,
    rotStep,
    setRotStep,
    selectedTool,
    setSelectedTool,
    toolList,
    setToolList,
    status,
    setStatus,
    isAnimating,
    isAnimatingRef,
    config,
  };
}
