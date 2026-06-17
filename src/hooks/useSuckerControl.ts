// src/hooks/useSuckerControl.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { forwardKinematics } from '@/lib/kinematics';
import { Matrix4x4 } from '@/lib/matrix4x4';
import type { RobotConfig, JointAngles } from '@/types/robot';

export const SUCKER_LENGTH = 25;
export const BOX_SIZE = 80;
export const BOX_HALF_SIZE = BOX_SIZE / 2;
export const ATTACH_THRESHOLD = 15;
export const APPROACH_HEIGHT = 50;
export const INITIAL_BOX_POSITION: [number, number, number] = [-1135, 40, 56];

/** 箱子状态 */
export type BoxState = 'NONE' | 'FREE' | 'FALLING' | 'ATTACHED' | 'PLACED' | 'RESTING';

export function getSuckerTipPosition(
  flangePos: [number, number, number],
  rotation: number[][]
): [number, number, number] {
  const localOffset: [number, number, number] = [0, 0, -SUCKER_LENGTH];
  const worldOffset = Matrix4x4.mat3Vec3Mul(rotation, localOffset);
  return [
    flangePos[0] + worldOffset[0],
    flangePos[1] + worldOffset[1],
    flangePos[2] + worldOffset[2],
  ];
}

function norm(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

interface UseSuckerControlProps {
  joints: JointAngles;
  config: RobotConfig;
  initialBoxPosition: [number, number, number];
}

export function useSuckerControl({ joints, config, initialBoxPosition }: UseSuckerControlProps) {
  const [suckerOn, setSuckerOn] = useState(false);
  const [boxState, setBoxState] = useState<BoxState>('NONE');
  const [boxPosition, setBoxPosition] = useState<[number, number, number]>(initialBoxPosition);
  const [velocityY, setVelocityY] = useState(0);
  const [restingY, setRestingY] = useState(BOX_HALF_SIZE); // 自由落体停止高度

  const boxStateRef = useRef<BoxState>('NONE');
  const boxPosRef = useRef<[number, number, number]>(initialBoxPosition);
  const velocityYRef = useRef(0);
  const suckerOnRef = useRef(false);
  const jointsRef = useRef(joints);
  const restingYRef = useRef(BOX_HALF_SIZE);

  useEffect(() => { boxStateRef.current = boxState; }, [boxState]);
  useEffect(() => { boxPosRef.current = boxPosition; }, [boxPosition]);
  useEffect(() => { velocityYRef.current = velocityY; }, [velocityY]);
  useEffect(() => { suckerOnRef.current = suckerOn; }, [suckerOn]);
  useEffect(() => { jointsRef.current = joints; }, [joints]);
  useEffect(() => { restingYRef.current = restingY; }, [restingY]);

  const getEndEffectorPose = useCallback(() => {
    const jointsRad = jointsRef.current.map((j) => (j * Math.PI) / 180) as JointAngles;
    const T = forwardKinematics(jointsRad, config);
    return { position: T.getPosition(), rotation: T.getRotation() };
  }, [config]);

  // 吸附检测
  const checkAttachment = useCallback(
    (boxPosMM: [number, number, number]) => {
      if (!suckerOnRef.current) return;
      const pose = getEndEffectorPose();
      const suckerTip = getSuckerTipPosition(pose.position, pose.rotation);
      const boxTopCenter: [number, number, number] = [
        boxPosMM[0],
        boxPosMM[1] + BOX_HALF_SIZE,
        boxPosMM[2],
      ];
      const distance = norm(suckerTip, boxTopCenter);
      if (distance < ATTACH_THRESHOLD && boxStateRef.current === 'FREE') {
        setBoxState('ATTACHED');
        boxStateRef.current = 'ATTACHED';
      }
    },
    [getEndEffectorPose]
  );

  // 箱子跟随（ATTACHED）— 使用 GLB 法兰矩阵获取真实视觉位置
  const updateBoxFollow = useCallback(() => {
    if (boxStateRef.current !== 'ATTACHED') return;

    // 优先使用 GLB 法兰矩阵（场景米坐标，视觉精确）
    const getMat = (window as any).__GLB_getFlangeMatrix as (() => {
      position: [number, number, number];
      rotation: number[][];
    }) | undefined;
    const glb = getMat?.();
    if (glb?.position && glb?.rotation) {
      const [fx, fy, fz] = glb.position;
      // rotation 现在为真实旋转矩阵（行主序），工具 Z 轴为世界坐标系下的第三列
      const tz: [number, number, number] = [
        glb.rotation[0][2], glb.rotation[1][2], glb.rotation[2][2],
      ];
      // 吸盘尖端 = 法兰 - 工具Z * 吸盘长度（场景米）
      const sx = fx - tz[0] * (SUCKER_LENGTH / 1000);
      const sy = fy - tz[1] * (SUCKER_LENGTH / 1000);
      const sz = fz - tz[2] * (SUCKER_LENGTH / 1000);
      // 箱子中心 = 吸盘尖端 + 工具Z * 半箱高（场景米）
      const boxScene: [number, number, number] = [
        sx + tz[0] * (BOX_HALF_SIZE / 1000),
        sy + tz[1] * (BOX_HALF_SIZE / 1000),
        sz + tz[2] * (BOX_HALF_SIZE / 1000),
      ];
      // ×1000 转为 "DH mm" 格式（dhPosToScene 除1000→场景米）
      const boxMM: [number, number, number] = [
        Math.round(boxScene[0] * 1000),
        Math.round(boxScene[1] * 1000),
        Math.round(boxScene[2] * 1000),
      ];
      setBoxPosition(boxMM);
      boxPosRef.current = boxMM;
      return;
    }

    // 降级 DH FK
    const pose = getEndEffectorPose();
    const suckerTip = getSuckerTipPosition(pose.position, pose.rotation);
    const toolZ: [number, number, number] = [
      pose.rotation[0][2],
      pose.rotation[1][2],
      pose.rotation[2][2],
    ];
    const boxCenterMM: [number, number, number] = [
      suckerTip[0] + toolZ[0] * BOX_HALF_SIZE,
      suckerTip[1] + toolZ[1] * BOX_HALF_SIZE,
      suckerTip[2] + toolZ[2] * BOX_HALF_SIZE,
    ];
    setBoxPosition(boxCenterMM);
    boxPosRef.current = boxCenterMM;
  }, [getEndEffectorPose]);

  // 自由落体（FALLING 状态）
  const applyGravity = useCallback((deltaTime: number) => {
    const dt = Math.min(deltaTime, 0.05);
    const GRAVITY = -9.8 * 1000; // mm/s²
    const GROUND_Y = restingYRef.current;

    // FALLING 状态：从空中掉落到 restingHeight
    if (boxStateRef.current === 'FALLING') {
      let vy = velocityYRef.current;
      let y = boxPosRef.current[1];

      vy += GRAVITY * dt;
      y += vy * dt;

      if (y <= GROUND_Y) {
        y = GROUND_Y;
        vy = 0;
        setBoxState('FREE');
        boxStateRef.current = 'FREE';
      }

      setVelocityY(vy);
      velocityYRef.current = vy;
      setBoxPosition((prev) => [prev[0], y, prev[2]]);
      boxPosRef.current = [boxPosRef.current[0], y, boxPosRef.current[2]];
      return;
    }

    // PLACED 状态：释放后掉落到 restingHeight
    if (boxStateRef.current === 'PLACED') {
      let vy = velocityYRef.current;
      let y = boxPosRef.current[1];

      vy += GRAVITY * dt;
      y += vy * dt;

      if (y <= GROUND_Y) {
        y = GROUND_Y;
        vy = 0;
        setBoxState('RESTING');
        boxStateRef.current = 'RESTING';
      }

      setVelocityY(vy);
      velocityYRef.current = vy;
      setBoxPosition((prev) => [prev[0], y, prev[2]]);
      boxPosRef.current = [boxPosRef.current[0], y, boxPosRef.current[2]];
    }
  }, []);

  // 生成箱子（带掉落）
  const spawnBox = useCallback((position: [number, number, number], restingHeight?: number) => {
    setBoxState('FALLING');
    boxStateRef.current = 'FALLING';
    setBoxPosition(position);
    boxPosRef.current = position;
    setVelocityY(0);
    velocityYRef.current = 0;
    setSuckerOn(false);
    suckerOnRef.current = false;
    if (restingHeight !== undefined && restingHeight > 0) {
      setRestingY(restingHeight);
      restingYRef.current = restingHeight;
    }
  }, []);

  // 设置箱子位置（外部控制，不触发掉落）
  const setBoxPositionExternal = useCallback((pos: [number, number, number]) => {
    setBoxState('FREE');
    boxStateRef.current = 'FREE';
    setBoxPosition(pos);
    boxPosRef.current = pos;
    setVelocityY(0);
    velocityYRef.current = 0;
  }, []);

  // 开启吸盘
  const turnSuckerOn = useCallback(() => {
    setSuckerOn(true);
    suckerOnRef.current = true;
  }, []);

  // 强制吸附（序列用：前序步骤已确保吸盘接触箱面，直接进入 ATTACHED 状态）
  const forceAttachBox = useCallback(() => {
    if (boxStateRef.current === 'FREE') {
      setBoxState('ATTACHED');
      boxStateRef.current = 'ATTACHED';
    }
  }, []);

  // 关闭吸盘
  const turnSuckerOff = useCallback(() => {
    setSuckerOn(false);
    suckerOnRef.current = false;
    if (boxStateRef.current === 'ATTACHED') {
      setBoxState('PLACED');
      boxStateRef.current = 'PLACED';
      setVelocityY(0);
      velocityYRef.current = 0;
      // 释放后落回地面，不用 spawn 时的 restingHeight
      setRestingY(BOX_HALF_SIZE);
      restingYRef.current = BOX_HALF_SIZE;
    }
  }, []);

  // 重置箱子
  const resetBox = useCallback(() => {
    setBoxState('NONE');
    boxStateRef.current = 'NONE';
    setBoxPosition(initialBoxPosition);
    boxPosRef.current = initialBoxPosition;
    setVelocityY(0);
    velocityYRef.current = 0;
    setSuckerOn(false);
    suckerOnRef.current = false;
  }, [initialBoxPosition]);

  return {
    suckerOn,
    boxState,
    boxPosition,
    restingY,
    turnSuckerOn,
    turnSuckerOff,
    forceAttachBox,
    resetBox,
    spawnBox,
    setBoxPositionExternal,
    checkAttachment,
    updateBoxFollow,
    applyGravity,
    getEndEffectorPose,
  };
}
