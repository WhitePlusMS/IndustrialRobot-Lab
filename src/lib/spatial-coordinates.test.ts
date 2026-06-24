import { describe, expect, it } from 'vitest';
import {
  robotScalarToSceneM,
  robotToSceneM,
  sceneScalarToRobotMm,
  sceneToRobotMm,
} from './spatial-coordinates';

describe('spatial-coordinates', () => {
  it('round-trips scene position to robot mm and back', () => {
    const scenePosition: [number, number, number] = [-1.234, 0.567, 2.345];
    const robotPosition = sceneToRobotMm(scenePosition);

    expect(robotPosition).toEqual([-1234, 567, 2345]);
    expect(robotToSceneM(robotPosition)).toEqual(scenePosition);
  });

  it('converts scalars between meters and millimeters', () => {
    expect(sceneScalarToRobotMm(1.25)).toBe(1250);
    expect(robotScalarToSceneM(875)).toBe(0.875);
  });

  it('supports negative and decimal coordinates', () => {
    const scenePosition: [number, number, number] = [-0.001, 0.0005, -2.75];
    const robotPosition = sceneToRobotMm(scenePosition);

    expect(robotPosition).toEqual([-1, 0.5, -2750]);
    expect(robotToSceneM(robotPosition)).toEqual(scenePosition);
  });
});
