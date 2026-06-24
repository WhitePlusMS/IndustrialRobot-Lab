import { ATTACH_THRESHOLD, BOX_HALF_SIZE } from '@/hooks/useSuckerControl';
import {
  buildGraspApproachPose,
  buildGraspContactPose,
  buildLiftPose,
} from '@/lib/grasp-planning';
import type { TaskTargetPoseMm } from '@/types/robot';
import type { RobotPoseAPI } from '@/lib/robot-pose-bridge';
import type { SequenceRobotAPI, SequenceStepRuntime } from '@/lib/sequence-runtime';
import { robotToSceneM, sceneToRobotMm } from './spatial-coordinates';

interface SequenceTaskRobotOptions {
  robot: SequenceRobotAPI;
  runtime: SequenceStepRuntime;
  robotPoseApi: RobotPoseAPI;
  log: (message: string) => void;
}

function distanceMm(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 +
    (a[1] - b[1]) ** 2 +
    (a[2] - b[2]) ** 2
  );
}

export function createSequenceTaskRobot({ robot, runtime, robotPoseApi, log }: SequenceTaskRobotOptions) {
  return {
    approachBox: async (boxPoseMm: [number, number, number], approachHeightMm: number) => {
      const target = buildGraspApproachPose(boxPoseMm, approachHeightMm);
      log(`[TaskRobot] 移动到箱子上方: (${target.positionMm[0]}, ${target.positionMm[1]}, ${target.positionMm[2]}) mm`);
      if (!robot.goToPoseMm(target)) {
        return false;
      }
      await runtime.waitForAnimation();
      return true;
    },

    descendToBox: async (boxPoseMm: [number, number, number]) => {
      const contactPose = buildGraspContactPose(boxPoseMm);
      log(`[TaskRobot] 下降到箱面: (${contactPose.positionMm[0]}, ${contactPose.positionMm[1]}, ${contactPose.positionMm[2]}) mm`);
      if (!robot.goToPoseMm(contactPose)) {
        return false;
      }
      await runtime.waitForAnimation();

      const boxTopCenterMm: [number, number, number] = [
        boxPoseMm[0],
        boxPoseMm[1] + BOX_HALF_SIZE,
        boxPoseMm[2],
      ];

      for (let correctionIndex = 0; correctionIndex < 2; correctionIndex++) {
        const suckerContact = robotPoseApi.getSuckerContactPose();
        const flangePose = robotPoseApi.getFlangeMatrix();
        if (!suckerContact?.position || !flangePose?.position) {
          log('[TaskRobot] 接触校正跳过：无法读取吸盘或法兰位姿');
          break;
        }

        const suckerContactMm = sceneToRobotMm(suckerContact.position);
        const offsetMm: [number, number, number] = [
          boxTopCenterMm[0] - suckerContactMm[0],
          boxTopCenterMm[1] - suckerContactMm[1],
          boxTopCenterMm[2] - suckerContactMm[2],
        ];
        const currentDistance = distanceMm(suckerContactMm, boxTopCenterMm);

        log(`[TaskRobot] 接触校正 ${correctionIndex + 1}: distance=${currentDistance.toFixed(2)}mm`);
        if (currentDistance <= ATTACH_THRESHOLD - 2) {
          return true;
        }

        const correctedTargetScene = [
          flangePose.position[0] + robotToSceneM(offsetMm)[0],
          flangePose.position[1] + robotToSceneM(offsetMm)[1],
          flangePose.position[2] + robotToSceneM(offsetMm)[2],
        ] as [number, number, number];

        const correctedTarget: TaskTargetPoseMm = {
          positionMm: sceneToRobotMm(correctedTargetScene),
          orientationDeg: contactPose.orientationDeg,
          profile: contactPose.profile,
        };

        if (!robot.goToPoseMm(correctedTarget)) {
          return false;
        }
        await runtime.waitForAnimation();
      }

      const finalSuckerContact = robotPoseApi.getSuckerContactPose();
      if (!finalSuckerContact?.position) {
        log('[TaskRobot] 接触校验失败：无法读取最终吸盘位姿');
        return false;
      }

      const finalDistanceMm = distanceMm(sceneToRobotMm(finalSuckerContact.position), boxTopCenterMm);
      log(`[TaskRobot] 最终接触距离: ${finalDistanceMm.toFixed(2)}mm`);
      return finalDistanceMm <= ATTACH_THRESHOLD;
    },

    liftCurrentFlange: async (liftHeightMm: number) => {
      const flangePose = robotPoseApi.getFlangeMatrix();
      if (!flangePose?.position) {
        log('[TaskRobot] 抬升失败：无法读取法兰位姿');
        return false;
      }
      const target = buildLiftPose(flangePose.position, liftHeightMm);
      log(`[TaskRobot] 抬升: (${target.positionMm[0]}, ${target.positionMm[1]}, ${target.positionMm[2]}) mm`);
      if (!robot.goToPoseMm(target)) {
        return false;
      }
      await runtime.waitForAnimation();
      return true;
    },

    moveToPlacePose: async (target: TaskTargetPoseMm) => {
      log(`[TaskRobot] 移动到放置位姿: (${target.positionMm[0]}, ${target.positionMm[1]}, ${target.positionMm[2]}) mm`);
      if (!robot.goToPoseMm(target)) {
        return false;
      }
      await runtime.waitForAnimation();
      return true;
    },
  };
}
