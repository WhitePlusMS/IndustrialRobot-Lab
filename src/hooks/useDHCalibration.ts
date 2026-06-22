// src/hooks/useDHCalibration.ts
// DH 标定 Hook — 机械臂首次挂载时采集零位标定数据
// 替代原来混在 GLBRobotArm.tsx 中的 350+ 行标定逻辑

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildCalibrationReport, type CalibrationReport, captureCurrentPivotQuaternions, restorePivotQuaternions } from '@/lib/dh-calibration';
import { robotPoseBridge } from '@/lib/robot-pose-bridge';
import type { JointCalibData, CalibrationData } from '@/lib/robot-pose-bridge';
import type { Pose } from '@/types/robot';
import { quaternionToRotationMatrix, rotationMatrixToEulerZYX } from '@/lib/math/rotation3d';

interface UseDHCalibrationOptions {
  /** 机械臂 Group（buildArticulated 的返回值） */
  arm: THREE.Group | null;
  /** 模型缩放因子 */
  modelScale: number;
  /** 是否输出详细日志，默认 true */
  verbose?: boolean;
}

interface UseDHCalibrationReturn {
  /** 标定报告（仅开发调试用） */
  report: CalibrationReport | null;
  /** 标定是否完成 */
  calibrated: boolean;
}

/**
 * 机械臂首次挂载时：
 * 1. 采集零位标定数据
 * 2. 将标定数据注册到 robotPoseBridge（供 SceneKinematicModel / PoE 模型使用）
 * 3. 控制台输出标定报告摘要
 */
export function useDHCalibration({
  arm,
  modelScale,
  verbose = true,
}: UseDHCalibrationOptions): UseDHCalibrationReturn {
  const calibratedRef = useRef(false);
  const [report, setReport] = useState<CalibrationReport | null>(null);
  const [calibrated, setCalibrated] = useState(false);

  useEffect(() => {
    if (!arm || calibratedRef.current) return;
    calibratedRef.current = true;

    // 采集标定数据
    const calibReport = buildCalibrationReport(arm, modelScale);
    setReport(calibReport);
    setCalibrated(true);

    if (verbose) {
      console.log('[useDHCalibration] 零位标定报告:', calibReport);
    }

    // 构造 CalibrationData 并注册到 bridge（供 PoE 模型使用）
    try {
      const flangePose = extractZeroFlangePose(arm);
      const jointCalibs = calibReport.jointPivots.map(
        (p): JointCalibData => ({
          worldAxis: p.worldAxis,
          pivotPos: p.worldPositionMm,
        })
      );

      // 补齐 6 个关节（collectJointDebugSnapshots 可能漏掉 pivot 不存在的关节）
      while (jointCalibs.length < 6) {
        jointCalibs.push({
          worldAxis: [0, 1, 0],
          pivotPos: [0, 0, 0],
        });
      }

      const calibData: CalibrationData = {
        joints: jointCalibs.slice(0, 6),
        zeroFlangePose: flangePose,
        available: true,
      };

      robotPoseBridge.setCalibration(calibData);

      if (verbose) {
        console.log('[useDHCalibration] PoE 标定数据已注册到 robotPoseBridge');
      }
    } catch (err) {
      console.warn('[useDHCalibration] 注册标定数据失败:', err);
    }
  }, [arm, modelScale, verbose]);

  return { report, calibrated };
}

/** 从场景提取零位法兰位姿（用于 PoE 模型的 M 矩阵）
 *  关键：必须在所有关节归零后读取，否则读到的是当前非零位数据 */
function extractZeroFlangePose(arm: THREE.Group): Pose {
  // 零位化所有关节
  const saved = captureCurrentPivotQuaternions(arm);
  const JOINT_NAMES = ['转台', '大臂', '小臂', '回转机构', '末端关节', '快拆机器人端口'];
  JOINT_NAMES.forEach((name) => {
    const pivot = arm.getObjectByName(`Pivot_${name}`) as THREE.Group | null;
    if (pivot) pivot.quaternion.identity();
  });
  arm.updateMatrixWorld(true);

  // 查找 J6 pivot 或快拆机器人端口
  const flangeNames = ['Pivot_快拆机器人端口', '快拆机器人端口'];
  let flange: THREE.Object3D | null = null;

  for (const name of flangeNames) {
    arm.traverse((child) => {
      if (child.name === name) flange = child;
    });
    if (flange) break;
  }

  let positionMm: [number, number, number] = [0, 0, 0];
  let rotation: number[][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  let euler: [number, number, number] = [0, 0, 0];

  if (flange) {
    const matrix = new THREE.Matrix4();
    flange.updateMatrixWorld(true);
    matrix.copy(flange.matrixWorld);

    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    matrix.decompose(pos, quat, scale);

    // 米 → 毫米
    positionMm = [pos.x * 1000, pos.y * 1000, pos.z * 1000];
    rotation = quaternionToRotationMatrix([quat.x, quat.y, quat.z, quat.w]);
    euler = rotationMatrixToEulerZYX(rotation);
  }

  // 恢复关节
  restorePivotQuaternions(arm, saved);
  return { position: positionMm, euler, rotation };
}
