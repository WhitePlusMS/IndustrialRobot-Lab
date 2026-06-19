// src/hooks/useWaypoints.ts
// 记忆点本地存储的 React 封装，多个组件独立使用时会通过自定义事件保持同步

import { useState, useEffect } from 'react';
import type { JointAngles } from '@/types/robot';
import * as storage from '@/lib/waypoint-storage';

export type { WaypointRecord } from '@/lib/waypoint-storage';

export interface UseWaypointsReturn {
  /** 当前记忆点列表 */
  waypoints: storage.WaypointRecord[];
  /** 保存新记忆点 */
  saveWaypoint: (name: string, joints: JointAngles) => void;
  /** 更新已有记忆点 */
  updateWaypoint: (id: number, updates: Partial<Omit<storage.WaypointRecord, 'id'>>) => void;
  /** 删除记忆点 */
  deleteWaypoint: (id: number) => void;
  /** 将某条记忆点设为原点 */
  setOrigin: (id: number) => void;
  /** 清除原点标记 */
  clearOrigin: () => void;
}

/**
 * 记忆点本地存储 Hook
 *
 * 说明：
 * - 数据存在浏览器 localStorage，刷新页面后保留
 * - 同一页面的多个组件可独立调用该 Hook，通过 `robot-waypoints-change`
 *   自定义事件保持同步
 * - 换浏览器/清缓存会丢失数据，符合教学演示场景的预期
 */
export function useWaypoints(): UseWaypointsReturn {
  // 使用懒加载初始值避免在 effect 中同步 setState，同时减少一次无意义渲染
  const [waypoints, setWaypoints] = useState<storage.WaypointRecord[]>(() => storage.loadWaypoints());

  useEffect(() => {
    // 订阅 localStorage 变化事件，保证多组件实例间数据同步
    return storage.subscribe(() => {
      setWaypoints(storage.loadWaypoints());
    });
  }, []);

  const saveWaypoint = (name: string, joints: JointAngles) => {
    storage.saveWaypoint(name, joints);
  };

  const updateWaypoint = (id: number, updates: Partial<Omit<storage.WaypointRecord, 'id'>>) => {
    storage.updateWaypoint(id, updates);
  };

  const deleteWaypoint = (id: number) => {
    storage.deleteWaypoint(id);
  };

  const setOrigin = (id: number) => {
    storage.setOrigin(id);
  };

  const clearOrigin = () => {
    storage.clearOrigin();
  };

  return {
    waypoints,
    saveWaypoint,
    updateWaypoint,
    deleteWaypoint,
    setOrigin,
    clearOrigin,
  };
}
