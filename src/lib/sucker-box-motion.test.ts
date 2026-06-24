import { describe, expect, it } from 'vitest';
import {
  buildBoxTopCenter,
  canAttachBox,
  computeAttachedBoxPositionFromContact,
  simulateBoxVerticalMotion,
} from './sucker-box-motion';

describe('sucker-box-motion', () => {
  it('identifies attachable box states', () => {
    expect(canAttachBox('FREE')).toBe(true);
    expect(canAttachBox('RESTING')).toBe(true);
    expect(canAttachBox('ATTACHED')).toBe(false);
  });

  it('builds box top center in robot mm', () => {
    expect(buildBoxTopCenter([-1000, 240, 0], 240)).toEqual([-1000, 480, 0]);
  });

  it('converts sucker contact pose into attached box center', () => {
    expect(computeAttachedBoxPositionFromContact({
      position: [1, 0.5, -0.2],
      direction: [0, 1, 0],
    }, 240)).toEqual([1000, 740, -200]);
  });

  it('settles a falling box onto the resting height', () => {
    const next = simulateBoxVerticalMotion({
      boxState: 'FALLING',
      boxPosition: [-1000, 250, 0],
      velocityY: -400,
      deltaTime: 0.1,
      groundY: 240,
    });

    expect(next.boxState).toBe('FREE');
    expect(next.boxPosition[1]).toBe(240);
    expect(next.velocityY).toBe(0);
  });

  it('settles a placed box into resting state', () => {
    const next = simulateBoxVerticalMotion({
      boxState: 'PLACED',
      boxPosition: [-1000, 245, 0],
      velocityY: -200,
      deltaTime: 0.1,
      groundY: 240,
    });

    expect(next.boxState).toBe('RESTING');
    expect(next.boxPosition[1]).toBe(240);
  });
});
