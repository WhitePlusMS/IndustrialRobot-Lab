// src/lib/waypoint-storage.ts
// 基于 localStorage 的机器人记忆点持久化
// 教学项目无需后端，浏览器本地存储即可满足单用户/单会话数据保留需求

import type { JointAngles } from '@/types/robot';

/** 本地存储的记忆点记录 */
export interface WaypointRecord {
  id: number;
  name: string;
  joints: JointAngles;
  /** 是否被标记为原点（仅作视觉标签，不直接驱动归位逻辑） */
  isOrigin: boolean;
}

const STORAGE_KEY = 'robot-waypoints-v1';
const CHANGE_EVENT = 'robot-waypoints-change';

/** 判断当前是否运行在浏览器环境（避免 SSR/测试时报错） */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** 校验从 localStorage 读出的单条记录是否合法 */
function isValidWaypointRecord(value: unknown): value is WaypointRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'number' &&
    typeof record.name === 'string' &&
    Array.isArray(record.joints) &&
    record.joints.length === 6 &&
    record.joints.every((j) => typeof j === 'number') &&
    typeof record.isOrigin === 'boolean'
  );
}

/** 从 localStorage 加载所有记忆点 */
export function loadWaypoints(): WaypointRecord[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidWaypointRecord);
  } catch {
    // 解析失败时返回空数组，避免脏数据导致页面崩溃
    return [];
  }
}

/** 持久化并通知所有订阅者刷新 */
function persist(waypoints: WaypointRecord[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(waypoints));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // localStorage 写失败（如空间不足）时静默忽略，保证 UI 不卡死
  }
}

/** 订阅记忆点变化事件（用于多个组件共享同一份本地数据） */
export function subscribe(callback: () => void): () => void {
  if (!isBrowser()) return () => {};
  const handler = () => callback();
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

/** 新增记忆点 */
export function saveWaypoint(name: string, joints: JointAngles): void {
  const waypoints = loadWaypoints();
  const id = waypoints.length > 0 ? Math.max(...waypoints.map((wp) => wp.id)) + 1 : 1;
  waypoints.push({ id, name, joints: [...joints] as JointAngles, isOrigin: false });
  persist(waypoints);
}

/** 更新指定记忆点 */
export function updateWaypoint(id: number, updates: Partial<Omit<WaypointRecord, 'id'>>): void {
  const waypoints = loadWaypoints();
  const idx = waypoints.findIndex((wp) => wp.id === id);
  if (idx === -1) return;
  waypoints[idx] = { ...waypoints[idx], ...updates };
  if (updates.joints) {
    waypoints[idx].joints = [...updates.joints] as JointAngles;
  }
  persist(waypoints);
}

/** 删除指定记忆点 */
export function deleteWaypoint(id: number): void {
  const waypoints = loadWaypoints().filter((wp) => wp.id !== id);
  persist(waypoints);
}

/** 将指定记忆点标记为原点，并取消其他记忆点的原点标记 */
export function setOrigin(id: number): void {
  const waypoints = loadWaypoints().map((wp) => ({ ...wp, isOrigin: wp.id === id }));
  persist(waypoints);
}

/** 清除所有记忆点的原点标记 */
export function clearOrigin(): void {
  const waypoints = loadWaypoints().map((wp) => ({ ...wp, isOrigin: false }));
  persist(waypoints);
}

/** 获取当前被标记为原点的记忆点 */
export function getOrigin(waypoints?: WaypointRecord[]): WaypointRecord | null {
  const list = waypoints ?? loadWaypoints();
  return list.find((wp) => wp.isOrigin) ?? null;
}
