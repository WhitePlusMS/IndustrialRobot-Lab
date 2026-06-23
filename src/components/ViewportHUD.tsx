// src/components/ViewportHUD.tsx
import { Eye, Grid3X3, Route, Table, Camera, Pin, RotateCcw, Home, MapPin, Move, Rotate3D } from 'lucide-react';
import { useSceneViewport } from '@/contexts/SceneViewportContext';
import { useVirtualCameraContext } from '@/contexts/VirtualCameraContext';

interface ViewportHUDProps {
  onSaveOrigin: () => void;
  onGoToOrigin: () => void;
  onGoToZero: () => void;
  hasOrigin: boolean;
}

export default function ViewportHUD({
  onSaveOrigin,
  onGoToOrigin,
  onGoToZero,
  hasOrigin,
}: ViewportHUDProps) {
  const {
    showGrid,
    showCoordinateSystems,
    showTrajectory,
    showDH,
    showDataOverlay,
    showTransformGizmo,
    gizmoMode,
    toggleGrid,
    toggleCoordinateSystems,
    toggleTrajectory,
    toggleDH,
    toggleDataOverlay,
    toggleTransformGizmo,
    setGizmoMode,
    setCameraView,
    cameraView,
  } = useSceneViewport();
  const { cameraState, toggleCamera } = useVirtualCameraContext();
  const showCamera = cameraState.showCamera;
  const viewButtons = [
    { label: '正视', view: 'front' as const },
    { label: '侧视', view: 'side' as const },
    { label: '俯视', view: 'top' as const },
    { label: '自由', view: 'free' as const },
  ];

  const toggleButtons = [
    { label: '网格', icon: Grid3X3, active: showGrid, onClick: toggleGrid },
    { label: '坐标系', icon: Eye, active: showCoordinateSystems, onClick: toggleCoordinateSystems },
    { label: '轨迹', icon: Route, active: showTrajectory, onClick: toggleTrajectory },
    { label: '相机', icon: Camera, active: showCamera, onClick: toggleCamera },
    { label: 'DH表', icon: Table, active: showDH, onClick: toggleDH },
    { label: '位置', icon: MapPin, active: showDataOverlay, onClick: toggleDataOverlay },
  ];

  return (
    <div role="region" aria-label="视口控制" className="absolute top-3 right-3 flex flex-col gap-2 z-10">
      {/* 原点控制 */}
      <div className="flex gap-1 bg-white/90 backdrop-blur-sm border border-[#D1D5DB] rounded-sm p-1 shadow-sm">
        <button
          type="button"
          onClick={onSaveOrigin}
          className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-[#1E293B] hover:bg-[#F3F4F6] rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none"
        >
          <Pin className="w-3 h-3" />
          设置原点
        </button>
        <button
          type="button"
          onClick={onGoToOrigin}
          disabled={!hasOrigin}
          title={!hasOrigin ? '请先设置原点' : ''}
          className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-[#1E293B] hover:bg-[#F3F4F6] rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none"
        >
          <RotateCcw className="w-3 h-3" />
          回原点
        </button>
        <button
          type="button"
          onClick={onGoToZero}
          className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-[#1E293B] hover:bg-[#F3F4F6] rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none"
        >
          <Home className="w-3 h-3" />
          回零位
        </button>
      </div>

      {/* 视角预设 */}
      <div className="flex gap-1 bg-white/90 backdrop-blur-sm border border-[#D1D5DB] rounded-sm p-1 shadow-sm">
        <Camera className="w-3.5 h-3.5 text-[#64748B] mx-1 my-auto" aria-hidden="true" />
        {viewButtons.map((btn) => (
          <button
            type="button"
            key={btn.view}
            onClick={() => setCameraView(btn.view)}
            aria-pressed={cameraView === btn.view}
            className={`px-2 py-0.5 text-xs font-medium rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none ${
              cameraView === btn.view
                ? 'bg-[#2563EB] text-white'
                : 'text-[#1E293B] hover:bg-[#F3F4F6]'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* 操作轴控制 */}
      <div className="flex flex-col gap-1 bg-white/90 backdrop-blur-sm border border-[#D1D5DB] rounded-sm p-1 shadow-sm">
        <button
          type="button"
          onClick={toggleTransformGizmo}
          aria-pressed={showTransformGizmo}
          className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none ${
            showTransformGizmo
              ? 'bg-[#2563EB] text-white'
              : 'text-[#1E293B] hover:bg-[#F3F4F6]'
          }`}
        >
          <Move className="w-3.5 h-3.5" />
          操作轴
        </button>
        {showTransformGizmo && (
          <div className="flex gap-1" role="group" aria-label="操作轴模式">
            {(['translate', 'rotate'] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                onClick={() => setGizmoMode(mode)}
                aria-pressed={gizmoMode === mode}
                className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none ${
                  gizmoMode === mode
                    ? 'bg-[#2563EB]/10 text-[#2563EB]'
                    : 'text-[#64748B] hover:bg-[#F3F4F6]'
                }`}
              >
                {mode === 'translate' ? <Move className="w-3 h-3" /> : <Rotate3D className="w-3 h-3" />}
                {mode === 'translate' ? '平移' : '旋转'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 显示开关 */}
      <div className="flex gap-1 bg-white/90 backdrop-blur-sm border border-[#D1D5DB] rounded-sm p-1 shadow-sm" role="group" aria-label="显示开关">
        {toggleButtons.map((btn) => {
          const Icon = btn.icon;
          return (
            <button
              type="button"
              key={btn.label}
              onClick={btn.onClick}
              title={btn.label}
              aria-pressed={btn.active}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none ${
                btn.active
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[#1E293B] hover:bg-[#F3F4F6]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {btn.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
