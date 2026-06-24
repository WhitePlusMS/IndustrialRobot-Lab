// src/types/sequence.ts

/** 动作步骤类型 */
export type ActionStepType =
  | '删除所有箱子'
  | '生成箱子'
  | '拍照'
  | '移动到箱子上方'
  | '下降到箱面'
  | '吸盘开启'
  | '吸盘关闭'
  | '抬升'
  | '移动到目标位姿'
  | '归位'
  | '等待';

export const DEFAULT_SEQUENCE_BOX_FIXED_POSITION: [number, number, number] = [-1000, 350, 0];
export const DEFAULT_SEQUENCE_BOX_RANDOM_CENTER: [number, number] = [-975, 0];
export const DEFAULT_SEQUENCE_BOX_RANDOM_RANGE_X = 125;
export const DEFAULT_SEQUENCE_BOX_RANDOM_RANGE_Z = 100;
export const DEFAULT_SEQUENCE_BOX_MIN_HEIGHT = 350;
export const DEFAULT_SEQUENCE_BOX_MAX_HEIGHT = 450;
export const DEFAULT_SEQUENCE_BOX_RESTING_HEIGHT = 240;
export const DEFAULT_SEQUENCE_APPROACH_HEIGHT = 50;
export const DEFAULT_SEQUENCE_LIFT_HEIGHT = 200;
export const DEFAULT_SEQUENCE_PLACE_PRESET_NAME = '__DEFAULT_PLACE_POSE__';
export const DEFAULT_SEQUENCE_PLACE_PRESET_LABEL = '预设放置位姿';
export const DEFAULT_SEQUENCE_PLACE_POSITION_M: [number, number, number] = [0.1018, 1.1154, 1.1429];
export const DEFAULT_SEQUENCE_PLACE_ORIENTATION_DEG: [number, number, number] = [-126.3, 87.8, -38.2];

/** 箱子生成参数 */
export interface BoxSpawnParams {
  mode: 'fixed' | 'random';
  /** 固定模式：箱子位置 [X, Y, Z] mm */
  fixedPosition?: [number, number, number];
  /** 随机模式：区域中心 [X, Z] mm（XZ平面，Y由高度范围决定） */
  randomCenter?: [number, number];
  /** 随机模式：X方向半宽 mm */
  randomRangeX?: number;
  /** 随机模式：Z方向半宽 mm */
  randomRangeZ?: number;
  /** 随机模式：最小掉落高度 mm（必须大于 restingHeight） */
  minHeight?: number;
  /** 随机模式：最大掉落高度 mm */
  maxHeight?: number;
  /** 自由落体停止高度 mm，箱子落到此高度悬停（默认 200） */
  restingHeight?: number;
}

/** 动作步骤参数 */
export interface ActionStepParams {
  /** 箱子生成参数（步骤'生成箱子'使用） */
  boxSpawn?: BoxSpawnParams;
  /** 接近安全高度，默认 50mm（步骤'移动到箱子上方'使用） */
  approachHeight?: number;
  /** 抬升高度，默认 100mm（步骤'抬升'使用） */
  liftHeight?: number;
  /** 记忆点名称（步骤'移动到目标位姿'使用） */
  memoryPointName?: string;
  /** 等待时长，单位 ms（步骤'等待'使用） */
  waitDuration?: number;
}

/** 动作步骤 */
export interface ActionStep {
  id: string;
  type: ActionStepType;
  params: ActionStepParams;
  execStatus?: 'pending' | 'running' | 'success' | 'error';
  execMessage?: string;
}

/** 序列执行上下文 */
export interface SeqContext {
  boxPose: {
    position: [number, number, number];
    rotation: [number, number, number];
  } | null;
  suckerOn: boolean;
}

/** 序列日志 */
export interface SequenceLog {
  timestamp: number;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

/** 序列执行状态 */
export type SequenceStatus = 'idle' | 'running' | 'paused' | 'error';

export function createDefaultContext(): SeqContext {
  return { boxPose: null, suckerOn: false };
}

export function generateStepId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createDefaultStep(type: ActionStepType): ActionStep {
  const defaults: Record<ActionStepType, ActionStepParams> = {
    '删除所有箱子': {},
    '生成箱子': {
      boxSpawn: {
        mode: 'fixed',
        fixedPosition: DEFAULT_SEQUENCE_BOX_FIXED_POSITION,
        randomCenter: DEFAULT_SEQUENCE_BOX_RANDOM_CENTER,
        randomRangeX: DEFAULT_SEQUENCE_BOX_RANDOM_RANGE_X,
        randomRangeZ: DEFAULT_SEQUENCE_BOX_RANDOM_RANGE_Z,
        minHeight: DEFAULT_SEQUENCE_BOX_MIN_HEIGHT,
        maxHeight: DEFAULT_SEQUENCE_BOX_MAX_HEIGHT,
        restingHeight: DEFAULT_SEQUENCE_BOX_RESTING_HEIGHT,
      },
    },
    '拍照': {},
    '移动到箱子上方': { approachHeight: DEFAULT_SEQUENCE_APPROACH_HEIGHT },
    '下降到箱面': {},
    '吸盘开启': {},
    '吸盘关闭': {},
    '抬升': { liftHeight: DEFAULT_SEQUENCE_LIFT_HEIGHT },
    '移动到目标位姿': { memoryPointName: DEFAULT_SEQUENCE_PLACE_PRESET_NAME },
    '归位': {},
    '等待': { waitDuration: 1000 },
  };
  return {
    id: generateStepId(),
    type,
    params: { ...defaults[type] },
    execStatus: 'pending',
  };
}

/** 预设抓取序列 */
export function createDefaultGraspSequence(): ActionStep[] {
  return [
    createDefaultStep('删除所有箱子'),
    createDefaultStep('生成箱子'),
    createDefaultStep('移动到箱子上方'),
    createDefaultStep('下降到箱面'),
    createDefaultStep('吸盘开启'),
    { ...createDefaultStep('抬升'), params: { liftHeight: 200 } },
    { ...createDefaultStep('移动到目标位姿'), params: { memoryPointName: DEFAULT_SEQUENCE_PLACE_PRESET_NAME } },
    createDefaultStep('吸盘关闭'),
    createDefaultStep('归位'),
  ];
}
