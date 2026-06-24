// src/components/operation/OperationPanel.tsx
// 右侧操作面板：只负责布局、折叠和模块分发，子面板自行消费所需 context
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
    <aside className="relative w-[340px] shrink-0 bg-white border-l border-slate-200 flex flex-col shadow-[-2px_0_12px_rgba(0,0,0,0.03)] z-10">
      {/* 左侧边缘折叠把手 */}
      <button
        type="button"
        onClick={onCollapse}
        title="折叠操作面板"
        aria-label="折叠操作面板"
        className="absolute top-1/2 -left-3 -translate-y-1/2 z-20 flex items-center justify-center w-6 h-12 bg-white border border-slate-200 border-r-0 rounded-l-md shadow-md text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      <div className="flex-1 overflow-hidden">
        {learning.learningMode === 'free' ? (
          <FreeOperationPanel />
        ) : (
          <div className="h-full overflow-y-auto p-5 space-y-4">
            <TeachingGuidePanel step={learning.currentStep} />
            {learning.currentModule === 'robot' && <RobotOperations />}
            {learning.currentModule === 'camera' && <CameraOperations />}
            {learning.currentModule === 'grasp' && <GraspOperations />}
          </div>
        )}
      </div>
    </aside>
  );
}
