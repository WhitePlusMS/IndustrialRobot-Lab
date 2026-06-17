// src/components/DataOverlay.tsx
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { CoordinateSystem, JointAngles } from '@/types/robot';

interface DataOverlayProps {
  coordinateSystem: CoordinateSystem;
  position: [number, number, number];
  euler: [number, number, number];
  joints: JointAngles;
}

export default function DataOverlay({ coordinateSystem, position, euler, joints }: DataOverlayProps) {
  const [showPose, setShowPose] = useState(true);
  const [showJoints, setShowJoints] = useState(true);

  return (
    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm border border-[#D1D5DB] rounded-sm p-2.5 shadow-sm z-10 min-w-[180px]">
      <button
        type="button"
        onClick={() => setShowPose(!showPose)}
        className="w-full flex items-center justify-between text-xs font-semibold text-[#1E293B] mb-1.5 border-b border-[#E5E7EB] pb-1 hover:text-[#2563EB] transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none"
        aria-expanded={showPose}
        aria-controls="overlay-pose"
      >
        <span>当前位姿</span>
        {showPose ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {showPose && (
        <div id="overlay-pose">
          <div className="text-xs text-[#64748B] mb-1">坐标系: {coordinateSystem}</div>
          <div className="space-y-0.5 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-[#64748B]">X:</span>
              <span className="text-[#0F172A] tabular-nums">{position[0].toFixed(2)} mm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Y:</span>
              <span className="text-[#0F172A] tabular-nums">{position[1].toFixed(2)} mm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Z:</span>
              <span className="text-[#0F172A] tabular-nums">{position[2].toFixed(2)} mm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Rx:</span>
              <span className="text-[#0F172A] tabular-nums">{euler[0].toFixed(1)}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Ry:</span>
              <span className="text-[#0F172A] tabular-nums">{euler[1].toFixed(1)}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Rz:</span>
              <span className="text-[#0F172A] tabular-nums">{euler[2].toFixed(1)}°</span>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowJoints(!showJoints)}
        className="w-full flex items-center justify-between text-xs font-semibold text-[#1E293B] mt-2.5 mb-1.5 border-b border-[#E5E7EB] pb-1 hover:text-[#2563EB] transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none"
        aria-expanded={showJoints}
        aria-controls="overlay-joints"
      >
        <span>关节角度</span>
        {showJoints ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {showJoints && (
        <div id="overlay-joints" className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-xs">
          {joints.map((angle, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-[#64748B]">J{i + 1}:</span>
              <span className="text-[#0F172A] tabular-nums">{angle.toFixed(1)}°</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
