// src/components/operation/OperationPanel.tsx
// 右侧操作面板：负责折叠/展开布局 + 按模块选择子面板
// 数据获取下沉到各子组件（RobotOperations/CameraOperations/GraspOperations/FreeOperationPanel）
// 各自直接读取对应 Context，删除中间的 OperationPanelData 数据总线
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLearning } from '@/contexts/LearningContext';
import RobotOperations from './RobotOperations';
import CameraOperations from './CameraOperations';
import GraspOperations from './GraspOperations';
import FreeOperationPanel from './FreeOperationPanel';
import TeachingGuidePanel from './TeachingGuidePanel';

export interface OperationPanelProps {
  collapsed: boolean;
  onCollapse: () => void;
}

export default function OperationPanel({ collapsed, onCollapse }: OperationPanelProps) {
  const learning = useLearning();

  if (!learning.currentStep) {
    throw new Error('OperationPanel must be rendered within LearningProvider');
  }

  const { currentStep, currentModule, learningMode } = learning;

  if (collapsed) {
    return (
      <aside className="w-8 shrink-0 h-full bg-white border border-slate-300 rounded-l-lg shadow-[-2px_0_10px_rgba(0,0,0,0.06)] flex items-center justify-center z-10">
        <button
          type="button"
          onClick={onCollapse}
          className="w-full h-full flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-blue-50/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-l-lg"
          aria-label="展开操作面板"
          title="展开操作面板"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[340px] shrink-0 bg-white border-l border-slate-200 flex flex-col shadow-[-2px_0_12px_rgba(0,0,0,0.03)] z-10">
      {/* 折叠按钮 */}
      <div className="flex items-center justify-start px-2 py-1.5 border-b border-slate-100 bg-slate-50/50">
        <button
          type="button"
          onClick={onCollapse}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="折叠操作面板"
          title="折叠操作面板"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {learningMode === 'free' ? (
          <FreeOperationPanel />
        ) : (
          <div className="h-full overflow-y-auto p-5 space-y-4">
            <TeachingGuidePanel step={currentStep} />
            {currentModule === 'robot' && <RobotOperations currentStep={currentStep} />}
            {currentModule === 'camera' && <CameraOperations currentStep={currentStep} />}
            {currentModule === 'grasp' && <GraspOperations currentStep={currentStep} />}
          </div>
        )}
      </div>
    </aside>
  );
}
