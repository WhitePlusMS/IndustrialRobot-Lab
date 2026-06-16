// src/components/DHParamOverlay.tsx
import type { RobotConfig  } from '@/types/robot';

interface DHParamOverlayProps {
  config: RobotConfig;
  visible: boolean;
}

export default function DHParamOverlay({ config, visible }: DHParamOverlayProps) {
  if (!visible) return null;

  const dh = config.dhParams;
  const joints = [dh.joint1, dh.joint2, dh.joint3, dh.joint4, dh.joint5, dh.joint6];

  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm border border-[#D1D5DB] rounded-sm p-3 shadow-lg z-10">
      <div className="text-xs font-semibold text-[#1E293B] mb-2 text-center">DH 参数表 (改进DH法)</div>
      <table className="text-xs font-mono" aria-label="DH参数表">
        <caption className="sr-only">DH 参数表 (改进DH法)</caption>
        <thead>
          <tr className="border-b border-[#E5E7EB]">
            <th className="px-2 py-1 text-[#64748B] text-left">关节</th>
            <th className="px-2 py-1 text-[#64748B] text-right">aᵢ₋₁ (mm)</th>
            <th className="px-2 py-1 text-[#64748B] text-right">αᵢ₋₁ (rad)</th>
            <th className="px-2 py-1 text-[#64748B] text-right">dᵢ (mm)</th>
            <th className="px-2 py-1 text-[#64748B] text-right">θ 范围 (°)</th>
          </tr>
        </thead>
        <tbody>
          {joints.map((j, i) => (
            <tr key={i} className="border-b border-[#F3F4F6]">
              <td className="px-2 py-1 text-[#1E293B]">{i + 1}</td>
              <td className="px-2 py-1 text-[#0F172A] text-right">{j.a.toFixed(0)}</td>
              <td className="px-2 py-1 text-[#0F172A] text-right">{j.alpha.toFixed(4)}</td>
              <td className="px-2 py-1 text-[#0F172A] text-right">{j.d.toFixed(0)}</td>
              <td className="px-2 py-1 text-[#0F172A] text-right">
                [{j.thetaRange[0]} ~ {j.thetaRange[1]}]
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
