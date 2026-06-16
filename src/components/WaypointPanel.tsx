// src/components/WaypointPanel.tsx
import { useState } from 'react';
import { trpc } from '@/providers/trpc';
import { Save, Trash2, Pin } from 'lucide-react';
import type { JointAngles } from '@/types/robot';

interface WaypointPanelProps {
  currentJoints: JointAngles;
  onGotoWaypoint: (joints: JointAngles) => void;
}

export default function WaypointPanel({ currentJoints, onGotoWaypoint }: WaypointPanelProps) {
  const [name, setName] = useState('');
  const utils = trpc.useUtils();

  const { data: waypoints } = trpc.robot.listWaypoints.useQuery();
  const saveMutation = trpc.robot.saveWaypoint.useMutation({
    onSuccess: () => utils.robot.listWaypoints.invalidate(),
  });
  const deleteMutation = trpc.robot.deleteWaypoint.useMutation({
    onSuccess: () => utils.robot.listWaypoints.invalidate(),
  });
  const updateMutation = trpc.robot.updateWaypoint.useMutation({
    onSuccess: () => {
      utils.robot.listWaypoints.invalidate();
      utils.robot.getOrigin.invalidate();
    },
  });
  const clearOriginMutation = trpc.robot.clearOrigin.useMutation();

  const handleSave = () => {
    if (!name.trim()) return;
    saveMutation.mutate({
      name: name.trim(),
      j1: currentJoints[0],
      j2: currentJoints[1],
      j3: currentJoints[2],
      j4: currentJoints[3],
      j5: currentJoints[4],
      j6: currentJoints[5],
      isOrigin: false,
    });
    setName('');
  };

  const handleSetOrigin = (wpId: number) => {
    clearOriginMutation.mutate(undefined, {
      onSuccess: () => {
        updateMutation.mutate({ id: wpId, isOrigin: true });
      },
    });
  };

  const handleDelete = (wpId: number, wpName: string) => {
    if (!confirm(`确定删除记忆点"${wpName}"？`)) return;
    deleteMutation.mutate({ id: wpId });
  };

  return (
    <div className="bg-white border border-[#D1D5DB] rounded-sm p-3 space-y-3">
      <div className="text-sm font-semibold text-[#1E293B] border-b border-[#E5E7EB] pb-1">
        记忆点管理
      </div>

      <div className="flex gap-2">
        <input
          id="waypoint-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="记忆点名称"
          aria-label="记忆点名称"
          className="flex-1 px-2 py-1 text-xs border border-[#D1D5DB] rounded-sm bg-[#FAFAFA] focus:outline-none focus:border-[#2563EB] focus-visible:ring-2 focus-visible:ring-[#2563EB]"
        />
        <button
          onClick={handleSave}
          disabled={!name.trim() || saveMutation.isPending}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-[#2563EB] rounded-sm hover:bg-[#1D4ED8] disabled:opacity-40 transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none"
        >
          <Save className="w-3 h-3" />
          保存
        </button>
      </div>

      <div className="space-y-1 max-h-40 overflow-y-auto">
        {waypoints && waypoints.length > 0 ? (
          waypoints.map((wp) => (
            <div
              key={wp.id}
              className="flex items-center justify-between px-2 py-1.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-sm"
            >
              <button
                onClick={() =>
                  onGotoWaypoint([wp.j1, wp.j2, wp.j3, wp.j4, wp.j5, wp.j6])
                }
                className="flex-1 text-left text-xs text-[#1E293B] hover:text-[#2563EB] transition-colors min-w-0 focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none rounded-sm"
              >
                <span className="font-medium">{wp.name}</span>
                {wp.isOrigin === '1' && (
                  <span className="ml-1.5 px-1 py-0.5 text-[10px] bg-[#FEF3C7] text-[#92400E] rounded-sm">
                    原点
                  </span>
                )}
                <div className="text-[10px] text-[#64748B] font-mono mt-0.5 truncate">
                  J: {wp.j1.toFixed(1)},{wp.j2.toFixed(1)},{wp.j3.toFixed(1)},
                  {wp.j4.toFixed(1)},{wp.j5.toFixed(1)},{wp.j6.toFixed(1)}
                </div>
              </button>
              {wp.isOrigin !== '1' && (
                <button
                  onClick={() => handleSetOrigin(wp.id)}
                  title="设置为原点"
                  aria-label={`将"${wp.name}"设置为原点`}
                  disabled={updateMutation.isPending}
                  className="ml-1 p-1 text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-sm transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none"
                >
                  <Pin className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={() => handleDelete(wp.id, wp.name)}
                title={`删除${wp.name}`}
                aria-label={`删除记忆点"${wp.name}"`}
                className="ml-1 p-1 text-[#EF4444] hover:bg-[#FEF2F2] rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-[#EF4444] focus-visible:outline-none"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        ) : (
          <div className="text-xs text-[#94A3B8] text-center py-2">暂无记忆点</div>
        )}
      </div>
    </div>
  );
}
