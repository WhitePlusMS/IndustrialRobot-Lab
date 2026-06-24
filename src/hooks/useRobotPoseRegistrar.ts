import { useEffect } from 'react';
import * as THREE from 'three';
import { robotPoseBridge, type RobotPoseAPI } from '@/lib/robot-pose-bridge';
import { quaternionToRotationMatrix, rotationMatrixToEulerZYX } from '@/lib/math/rotation3d';
import {
  captureCurrentPivotQuaternions,
  findNode,
  JOINT_AXES,
  JOINT_NAMES,
  restorePivotQuaternions,
} from '@/lib/dh-calibration';

export function useRobotPoseRegistrar(arm: THREE.Group | null) {
  useEffect(() => {
    if (!arm) {
      robotPoseBridge.setAPI(null);
      return;
    }

    const currentArm = arm;
    const getFlangeMatrix = () => {
      currentArm.updateMatrixWorld(true);
      const flange = findNode(currentArm, '快拆机器人端口');
      if (!flange) return null;
      const matrix = new THREE.Matrix4();
      flange.updateMatrixWorld(true);
      matrix.copy(flange.matrixWorld);

      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      matrix.decompose(pos, quat, new THREE.Vector3());

      return {
        position: [pos.x, pos.y, pos.z] as [number, number, number],
        rotation: quaternionToRotationMatrix([quat.x, quat.y, quat.z, quat.w]),
      };
    };

    const getSuckerContactPose = () => {
      const flange = findNode(currentArm, '快拆机器人端口');
      const sucker = findNode(currentArm, '吸盘');
      if (!flange || !sucker) return null;

      flange.updateMatrixWorld(true);
      sucker.updateMatrixWorld(true);

      const bbox = new THREE.Box3().setFromObject(sucker);
      if (bbox.isEmpty()) return null;

      const contactWorld = new THREE.Vector3(
        (bbox.min.x + bbox.max.x) / 2,
        bbox.min.y,
        (bbox.min.z + bbox.max.z) / 2,
      );
      const flangeWorld = new THREE.Vector3();
      flange.getWorldPosition(flangeWorld);

      const flangeToContact = contactWorld.clone().sub(flangeWorld);
      const direction = flangeToContact.lengthSq() < 1e-10
        ? new THREE.Vector3(0, -1, 0)
        : flangeToContact.normalize();

      return {
        position: [contactWorld.x, contactWorld.y, contactWorld.z] as [number, number, number],
        direction: [direction.x, direction.y, direction.z] as [number, number, number],
      };
    };

    const capturePoseForJoints = (angles: number[]) => {
      const savedQuaternions = captureCurrentPivotQuaternions(currentArm);
      applyJointAngles(currentArm, angles);
      currentArm.updateMatrixWorld(true);
      const flange = findNode(currentArm, '快拆机器人端口');
      if (!flange) {
        restorePivotQuaternions(currentArm, savedQuaternions);
        return null;
      }

      const matrix = new THREE.Matrix4();
      flange.updateMatrixWorld(true);
      matrix.copy(flange.matrixWorld);

      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(pos, quat, scale);

      const rotation = quaternionToRotationMatrix([quat.x, quat.y, quat.z, quat.w]);
      const snapshot = {
        position: [pos.x, pos.y, pos.z] as [number, number, number],
        euler: rotationMatrixToEulerZYX(rotation),
        rotation,
      };
      restorePivotQuaternions(currentArm, savedQuaternions);
      return snapshot;
    };

    const api: RobotPoseAPI = {
      isAvailable: () => true,
      getFlangeMatrix,
      getSuckerContactPose,
      capturePoseForJoints,
    };

    robotPoseBridge.setAPI(api);
    return () => {
      robotPoseBridge.setAPI(null);
    };
  }, [arm]);
}

function applyJointAngles(root: THREE.Group, joints: number[]) {
  JOINT_NAMES.forEach((name, i) => {
    const pivot = findNode(root, `Pivot_${name}`) as THREE.Group | null;
    if (!pivot) return;

    const axis = JOINT_AXES[name];
    if (!axis) return;

    const angleRad = (joints[i] * Math.PI) / 180;
    const baseQuaternionArray = pivot.userData.baseQuaternion as
      | [number, number, number, number]
      | undefined;
    const baseQuaternion = baseQuaternionArray
      ? new THREE.Quaternion(
          baseQuaternionArray[0],
          baseQuaternionArray[1],
          baseQuaternionArray[2],
          baseQuaternionArray[3],
        )
      : new THREE.Quaternion();
    const deltaQuaternion = new THREE.Quaternion().setFromAxisAngle(axis, angleRad);
    pivot.quaternion.copy(baseQuaternion).multiply(deltaQuaternion);
  });
}
