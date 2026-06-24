// src/hooks/useSuckerControl.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { Matrix4x4 } from '@/lib/matrix4x4';
import { useRobotPoseAPI } from './useRobotPoseAPI';
import type { JointAngles, Pose } from '@/types/robot';
import type { RobotModel } from '@/lib/robot-model';
import { sceneToRobotMm } from '@/lib/spatial-coordinates';
import {
  buildBoxTopCenter,
  canAttachBox,
  computeAttachedBoxPositionFromContact,
  simulateBoxVerticalMotion,
  type SuckerBoxState,
} from '@/lib/sucker-box-motion';

// 真实吸盘相对“快拆机器人端口”存在约 125mm 级下探偏移。
// 主抓取链路统一用这个有效接触长度，避免继续按法兰贴箱面。
export const SUCKER_LENGTH = 125;
export const BOX_SIZE = 480;
export const BOX_HALF_SIZE = BOX_SIZE / 2;
export const ATTACH_THRESHOLD = 55; // 吸盘尖端到箱面中心距离阈值（mm）—— 放宽后接近位可直接吸附
export const ATTACH_SETTLE_THRESHOLD = 5; // 箱子中心与目标附着中心的最大允许偏差
export const APPROACH_HEIGHT = 50;
// 默认箱子位置：机械臂可达区域（负X方向，水平距离 ≥ 最小可达半径 812mm）
// Y 取 BOX_HALF_SIZE，确保箱子底部贴地
export const INITIAL_BOX_POSITION: [number, number, number] = [-1000, 240, 0];

/** 箱子状态 */
export type BoxState = SuckerBoxState;

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
  model: RobotModel;
  initialBoxPosition: [number, number, number];
}

export function useSuckerControl({ joints, model, initialBoxPosition }: UseSuckerControlProps) {
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
  const attachCycleRef = useRef(0);
  const lastFollowCycleRef = useRef(-1);

  useEffect(() => { boxStateRef.current = boxState; }, [boxState]);
  useEffect(() => { boxPosRef.current = boxPosition; }, [boxPosition]);
  useEffect(() => { velocityYRef.current = velocityY; }, [velocityY]);
  useEffect(() => { suckerOnRef.current = suckerOn; }, [suckerOn]);
  useEffect(() => { jointsRef.current = joints; }, [joints]);
  useEffect(() => { restingYRef.current = restingY; }, [restingY]);

  const getEndEffectorPose = useCallback((): Pose | null => {
    return model.forwardKinematics(jointsRef.current);
  }, [model]);

  // GLB 位姿采样能力（用于吸附检测和箱子跟随）
  const poseApi = useRobotPoseAPI();

  // 吸附检测：优先使用 GLB 法兰矩阵（与 3D 画面一致），降级 DH FK
  const checkAttachment = useCallback(
    (boxPosMM: [number, number, number]) => {
      if (!suckerOnRef.current) {
        return;
      }

      let suckerTip: [number, number, number];
      // 优先使用真实吸盘下表面中心，保证接触点和 3D 画面一致。
      const suckerContact = poseApi.getSuckerContactPose();
      if (suckerContact?.position) {
        suckerTip = sceneToRobotMm(suckerContact.position);
      } else {
        const pose = getEndEffectorPose();
        if (!pose) {
          return;
        }
        suckerTip = getSuckerTipPosition(pose.position, pose.rotation);
      }

      const boxTopCenter: [number, number, number] = [
        ...buildBoxTopCenter(boxPosMM, BOX_HALF_SIZE),
      ];
      const distance = norm(suckerTip, boxTopCenter);
      const canAttach = canAttachBox(boxStateRef.current);

      // console.log('[useSuckerControl] checkAttachment', {
      //   poseSource,
      //   suckerOn: suckerOnRef.current,
      //   boxState: boxStateRef.current,
      //   canAttach,
      //   suckerTipMm: {
      //     x: Math.round(suckerTip[0]),
      //     y: Math.round(suckerTip[1]),
      //     z: Math.round(suckerTip[2]),
      //   },
      //   boxTopCenterMm: {
      //     x: boxTopCenter[0],
      //     y: boxTopCenter[1],
      //     z: boxTopCenter[2],
      //   },
      //   distanceMm: Math.round(distance * 100) / 100,
      //   thresholdMm: ATTACH_THRESHOLD,
      // });

      if (distance < ATTACH_THRESHOLD && canAttach) {
        console.log('[useSuckerControl] checkAttachment -> ATTACHED', {
          distanceMm: Math.round(distance * 100) / 100,
          thresholdMm: ATTACH_THRESHOLD,
        });
        setBoxState('ATTACHED');
        boxStateRef.current = 'ATTACHED';
      }
    },
    [getEndEffectorPose, poseApi]
  );

  // 箱子跟随（ATTACHED）— 使用 GLB 法兰矩阵获取真实视觉位置
  const getExpectedAttachedBoxPosition = useCallback((): [number, number, number] | null => {
    // 优先使用真实吸盘下表面中心（场景米坐标，视觉精确）
    const suckerContact = poseApi.getSuckerContactPose();
    if (suckerContact?.position && suckerContact.direction) {
      return computeAttachedBoxPositionFromContact(suckerContact, BOX_HALF_SIZE);
    }

    // 降级到当前统一 RobotModel（GLB/PoE 由 useRobot 内部决定）
    const pose = getEndEffectorPose();
    if (!pose) {
      return null;
    }
    const suckerTip = getSuckerTipPosition(pose.position, pose.rotation);
    const toolZ: [number, number, number] = [
      pose.rotation[0][2],
      pose.rotation[1][2],
      pose.rotation[2][2],
    ];
    const boxCenterMM: [number, number, number] = [
      suckerTip[0] - toolZ[0] * BOX_HALF_SIZE,
      suckerTip[1] - toolZ[1] * BOX_HALF_SIZE,
      suckerTip[2] - toolZ[2] * BOX_HALF_SIZE,
    ];
    return boxCenterMM;
  }, [getEndEffectorPose, poseApi]);

  const isBoxAttachedStable = useCallback(() => {
    if (boxStateRef.current !== 'ATTACHED') {
      return false;
    }

    if (lastFollowCycleRef.current !== attachCycleRef.current) {
      return false;
    }

    const expectedBoxMM = getExpectedAttachedBoxPosition();
    if (!expectedBoxMM) {
      return false;
    }

    const currentBoxMM = boxPosRef.current;
    return norm(currentBoxMM, expectedBoxMM) <= ATTACH_SETTLE_THRESHOLD;
  }, [getExpectedAttachedBoxPosition]);

  const updateBoxFollow = useCallback(() => {
    if (boxStateRef.current !== 'ATTACHED') return;

    const nextBoxCenterMM = getExpectedAttachedBoxPosition();
    if (!nextBoxCenterMM) {
      return;
    }

    setBoxPosition(nextBoxCenterMM);
    boxPosRef.current = nextBoxCenterMM;
    lastFollowCycleRef.current = attachCycleRef.current;
  }, [getExpectedAttachedBoxPosition]);

  // 自由落体（FALLING 状态）
  const applyGravity = useCallback((deltaTime: number) => {
    const nextMotion = simulateBoxVerticalMotion({
      boxState: boxStateRef.current,
      boxPosition: boxPosRef.current,
      velocityY: velocityYRef.current,
      deltaTime,
      groundY: restingYRef.current,
    });

    if (nextMotion.boxState === boxStateRef.current
      && nextMotion.velocityY === velocityYRef.current
      && nextMotion.boxPosition[1] === boxPosRef.current[1]) {
      return;
    }

    setVelocityY(nextMotion.velocityY);
    velocityYRef.current = nextMotion.velocityY;
    setBoxPosition(nextMotion.boxPosition);
    boxPosRef.current = nextMotion.boxPosition;

    if (nextMotion.boxState !== boxStateRef.current) {
      setBoxState(nextMotion.boxState);
      boxStateRef.current = nextMotion.boxState;
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
    lastFollowCycleRef.current = -1;
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
    lastFollowCycleRef.current = -1;
  }, []);

  // 开启吸盘
  const turnSuckerOn = useCallback(() => {
    attachCycleRef.current += 1;
    lastFollowCycleRef.current = -1;
    console.log('[useSuckerControl] turnSuckerOn', {
      attachCycle: attachCycleRef.current,
      previousSuckerOn: suckerOnRef.current,
      boxState: boxStateRef.current,
      boxPositionMm: {
        x: boxPosRef.current[0],
        y: boxPosRef.current[1],
        z: boxPosRef.current[2],
      },
    });
    setSuckerOn(true);
    suckerOnRef.current = true;
    checkAttachment(boxPosRef.current);
  }, [checkAttachment]);

  // 关闭吸盘
  const turnSuckerOff = useCallback(() => {
    setSuckerOn(false);
    suckerOnRef.current = false;
    lastFollowCycleRef.current = -1;
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
    lastFollowCycleRef.current = -1;
  }, [initialBoxPosition]);

  const getBoxState = useCallback(() => boxStateRef.current, []);
  const getSuckerOn = useCallback(() => suckerOnRef.current, []);

  return {
    suckerOn,
    boxState,
    boxPosition,
    restingY,
    turnSuckerOn,
    turnSuckerOff,
    resetBox,
    spawnBox,
    setBoxPositionExternal,
    checkAttachment,
    updateBoxFollow,
    applyGravity,
    getEndEffectorPose,
    getBoxState,
    getSuckerOn,
    isBoxAttachedStable,
  };
}
