// src/lib/kinematics.ts
import { Matrix4x4 } from './matrix4x4';
import type { RobotConfig, JointAngles  } from '@/types/robot';

export function dhTransform(theta: number, d: number, a: number, alpha: number): Matrix4x4 {
  const ct = Math.cos(theta),
    st = Math.sin(theta);
  const ca = Math.cos(alpha),
    sa = Math.sin(alpha);
  return new Matrix4x4([
    [ct, -st, 0, a],
    [st * ca, ct * ca, -sa, -d * sa],
    [st * sa, ct * sa, ca, d * ca],
    [0, 0, 0, 1],
  ]);
}

export function forwardKinematics(joints: JointAngles, config: RobotConfig): Matrix4x4 {
  const dh = config.dhParams;
  const T1 = dhTransform(
    joints[0] * (dh.joint1.thetaSign ?? 1) + (dh.joint1.thetaOffset ?? 0),
    dh.joint1.d,
    dh.joint1.a,
    dh.joint1.alpha
  );
  const T2 = dhTransform(
    joints[1] * (dh.joint2.thetaSign ?? 1) + (dh.joint2.thetaOffset ?? 0),
    dh.joint2.d,
    dh.joint2.a,
    dh.joint2.alpha
  );
  const T3 = dhTransform(
    joints[2] * (dh.joint3.thetaSign ?? 1) + (dh.joint3.thetaOffset ?? 0),
    dh.joint3.d,
    dh.joint3.a,
    dh.joint3.alpha
  );
  const T4 = dhTransform(
    joints[3] * (dh.joint4.thetaSign ?? 1) + (dh.joint4.thetaOffset ?? 0),
    dh.joint4.d,
    dh.joint4.a,
    dh.joint4.alpha
  );
  const T5 = dhTransform(
    joints[4] * (dh.joint5.thetaSign ?? 1) + (dh.joint5.thetaOffset ?? 0),
    dh.joint5.d,
    dh.joint5.a,
    dh.joint5.alpha
  );
  const T6 = dhTransform(
    joints[5] * (dh.joint6.thetaSign ?? 1) + (dh.joint6.thetaOffset ?? 0),
    dh.joint6.d,
    dh.joint6.a,
    dh.joint6.alpha
  );
  return T1.multiply(T2).multiply(T3).multiply(T4).multiply(T5).multiply(T6);
}

export function extractPose(T: Matrix4x4): {
  position: [number, number, number];
  eulerZYX: [number, number, number];
} {
  const m = T.data;
  const px = m[0][3],
    py = m[1][3],
    pz = m[2][3];

  const sy = -m[2][0];
  const cy = Math.sqrt(m[0][0] ** 2 + m[1][0] ** 2);
  const ry = Math.atan2(sy, cy);

  let rx: number, rz: number;
  if (Math.abs(cy) > 1e-6) {
    rx = Math.atan2(m[2][1], m[2][2]);
    rz = Math.atan2(m[1][0], m[0][0]);
  } else {
    rx = Math.atan2(-m[1][2], m[1][1]);
    rz = 0;
  }

  return {
    position: [px, py, pz],
    eulerZYX: [rx, ry, rz],
  };
}
