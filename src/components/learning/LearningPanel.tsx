// src/components/learning/LearningPanel.tsx
import { ListOrdered, Lightbulb, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LearningSubTab } from '@/lib/course-config';
import { getModuleById } from '@/lib/course-config';
import { useLearning } from '@/contexts/LearningContext';
import ModuleTabs from './ModuleTabs';
import ProgressBar from './ProgressBar';
import StepList from './StepList';
import StepExplanation from './StepExplanation';
import TheoryPanel from './TheoryPanel';
import LearningNav from './LearningNav';

interface LearningPanelProps {
  collapsed: boolean;
  onCollapse: () => void;
}

const subTabs: { id: LearningSubTab; label: string; icon: typeof ListOrdered }[] = [
  { id: 'steps', label: '学习步骤', icon: ListOrdered },
  { id: 'explain', label: '步骤讲解', icon: Lightbulb },
  { id: 'knowledge', label: '相关知识', icon: BookOpen },
];

export default function LearningPanel({
  collapsed,
  onCollapse,
}: LearningPanelProps) {
  const {
    currentModule,
    currentStepIndex: currentStep,
    currentStep: step,
    learningSubTab: subTab,
    completedSteps,
    setCurrentModule: onModuleChange,
    setCurrentStepIndex: onStepClick,
    setLearningSubTab: onSubTabChange,
    goToPrevStep: onPrev,
    goToNextStep: onNext,
  } = useLearning();

  const module = getModuleById(currentModule);
  if (!module) return null;

  if (collapsed) {
    return (
      <aside className="w-8 shrink-0 h-full bg-white border border-slate-300 rounded-r-lg shadow-[2px_0_10px_rgba(0,0,0,0.06)] flex items-center justify-center z-10">
        <button
          type="button"
          onClick={onCollapse}
          className="w-full h-full flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-blue-50/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-r-lg"
          aria-label="展开学习面板"
          title="展开学习面板"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[400px] shrink-0 bg-white border-r border-slate-200 flex flex-col shadow-[2px_0_12px_rgba(0,0,0,0.03)] z-10">
      {/* 折叠按钮 */}
      <div className="flex items-center justify-end px-2 py-1.5 border-b border-slate-100 bg-slate-50/50">
        <button
          type="button"
          onClick={onCollapse}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="折叠学习面板"
          title="折叠学习面板"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <ModuleTabs activeModule={currentModule} onModuleChange={onModuleChange} />

      <ProgressBar
        title={module.progressTitle}
        current={currentStep + 1}
        total={module.steps.length}
      />

      {/* 子 Tab */}
      <div className="flex border-b border-slate-200 bg-slate-50/50 px-2">
        {subTabs.map(({ id, label, icon: Icon }) => {
          const active = subTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSubTabChange(id)}
              className={`flex-1 py-3 text-[13px] font-semibold rounded-t-lg flex items-center justify-center gap-1.5 transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                active
                  ? 'text-blue-600 bg-white'
                  : 'text-slate-600 hover:text-slate-700 hover:bg-white/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {active && <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-blue-500 rounded-t-full" />}
            </button>
          );
        })}
      </div>

      {/* Tab 内容 */}
      <div className="flex-1 overflow-hidden relative bg-slate-50/30">
        {subTab === 'steps' && (
          <div className="absolute inset-0 overflow-y-auto">
            <StepList
              steps={module.steps}
              currentStep={currentStep}
              completedSteps={completedSteps}
              onStepClick={onStepClick}
            />
          </div>
        )}

        {subTab === 'explain' && step && (
          <div className="absolute inset-0 overflow-y-auto p-5">
            <StepExplanation step={step} />
          </div>
        )}

        {subTab === 'knowledge' && (
          <div className="absolute inset-0 overflow-y-auto p-5">
            <TheoryPanel items={module.theory} currentStep={step} />
          </div>
        )}
      </div>

      <LearningNav
        canGoPrev={currentStep > 0}
        canGoNext={currentStep < module.steps.length - 1}
        onPrev={onPrev}
        onNext={onNext}
      />
    </aside>
  );
}
