import { describe, expect, it } from 'vitest';

type CameraState = {
  position: [number, number, number];
  rotation: [number, number, number];
  fov: number;
  near: number;
  far: number;
  showCamera: boolean;
  showFrustum: boolean;
  showModel: boolean;
  resolution: [number, number];
};

const DEFAULT_CAMERA_STATE: CameraState = {
  position: [-1.135, 3.0, 0.056],
  rotation: [-90, 0, 0],
  fov: 60,
  near: 0.1,
  far: 10,
  showCamera: false,
  showFrustum: true,
  showModel: true,
  resolution: [640, 480],
};

function normalizeCameraState(next: CameraState): CameraState {
  return {
    ...next,
    position: [
      Math.round(next.position[0] * 1000) / 1000,
      Math.round(next.position[1] * 1000) / 1000,
      Math.round(next.position[2] * 1000) / 1000,
    ],
    rotation: [
      Math.round(next.rotation[0] * 10) / 10,
      Math.round(next.rotation[1] * 10) / 10,
      Math.round(next.rotation[2] * 10) / 10,
    ],
    fov: Math.max(10, Math.min(120, Math.round(next.fov * 10) / 10)),
    near: Math.max(0.01, Math.min(1, next.near)),
    far: Math.max(1, Math.min(100, next.far)),
  };
}

function applyPatch(
  state: CameraState,
  target: CameraState,
  patch: Partial<Pick<CameraState, 'position' | 'rotation' | 'fov' | 'near' | 'far'>>,
  commit = true
) {
  const nextTarget = normalizeCameraState({
    ...target,
    ...patch,
    position: patch.position ?? target.position,
    rotation: patch.rotation ?? target.rotation,
  });

  const nextState = commit
    ? normalizeCameraState({
        ...state,
        ...patch,
        position: patch.position ?? state.position,
        rotation: patch.rotation ?? state.rotation,
      })
    : state;

  return { nextState, nextTarget };
}

describe('useVirtualCamera controller logic', () => {
  it('updates target only when commit=false', () => {
    const { nextState, nextTarget } = applyPatch(
      DEFAULT_CAMERA_STATE,
      DEFAULT_CAMERA_STATE,
      { position: [1.2345, 2.3456, 3.4567] },
      false
    );

    expect(nextState).toEqual(DEFAULT_CAMERA_STATE);
    expect(nextTarget.position).toEqual([1.235, 2.346, 3.457]);
  });

  it('updates both state and target when commit=true', () => {
    const { nextState, nextTarget } = applyPatch(
      DEFAULT_CAMERA_STATE,
      DEFAULT_CAMERA_STATE,
      { rotation: [12.34, -56.78, 90.12], fov: 75.55 },
      true
    );

    expect(nextState.rotation).toEqual([12.3, -56.8, 90.1]);
    expect(nextTarget.rotation).toEqual([12.3, -56.8, 90.1]);
    expect(nextState.fov).toBe(75.6);
  });

  it('clamps values into valid ranges', () => {
    const { nextState } = applyPatch(
      DEFAULT_CAMERA_STATE,
      DEFAULT_CAMERA_STATE,
      { fov: 200, near: 0.001, far: 999 },
      true
    );

    expect(nextState.fov).toBe(120);
    expect(nextState.near).toBe(0.01);
    expect(nextState.far).toBe(100);
  });
});
