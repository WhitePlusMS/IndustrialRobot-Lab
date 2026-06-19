// src/contexts/LearningContext.tsx
// 教学课程状态：当前模块、步骤、子 Tab、学习模式、已完成步骤
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { getModuleById, type ModuleId, type LearningSubTab, type LearningMode, type CourseStep } from '@/lib/course-config';

interface LearningContextValue {
  currentModule: ModuleId;
  currentStepIndex: number;
  currentStep: CourseStep | undefined;
  learningSubTab: LearningSubTab;
  learningMode: LearningMode;
  completedSteps: Set<string>;
  setCurrentModule: (moduleId: ModuleId) => void;
  setCurrentStepIndex: (index: number) => void;
  setLearningSubTab: (tab: LearningSubTab) => void;
  setLearningMode: (mode: LearningMode) => void;
  goToPrevStep: () => void;
  goToNextStep: () => void;
  completeCurrentStep: () => void;
}

const LearningContext = createContext<LearningContextValue | null>(null);

export function LearningProvider({ children }: { children: ReactNode }) {
  const [currentModule, setCurrentModuleState] = useState<ModuleId>('robot');
  const [currentStepIndex, setCurrentStepIndexState] = useState(0);
  const [learningSubTab, setLearningSubTab] = useState<LearningSubTab>('steps');
  const [learningMode, setLearningModeState] = useState<LearningMode>('guided');
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const module = getModuleById(currentModule);
  const currentStep = module?.steps[currentStepIndex];

  const setCurrentModule = useCallback((moduleId: ModuleId) => {
    setCurrentModuleState(moduleId);
    setCurrentStepIndexState(0);
    setLearningSubTab('steps');
  }, []);

  const setCurrentStepIndex = useCallback((index: number) => {
    setCurrentStepIndexState(index);
    setLearningSubTab('explain');
  }, []);

  const setLearningMode = useCallback((mode: LearningMode) => {
    setLearningModeState(mode);
  }, []);

  const goToPrevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndexState((prev) => prev - 1);
      setLearningSubTab('explain');
    }
  }, [currentStepIndex]);

  const goToNextStep = useCallback(() => {
    if (module && currentStepIndex < module.steps.length - 1) {
      setCompletedSteps((prev) => new Set([...prev, module.steps[currentStepIndex].id]));
      setCurrentStepIndexState((prev) => prev + 1);
      setLearningSubTab('explain');
    }
  }, [currentStepIndex, module]);

  const completeCurrentStep = useCallback(() => {
    if (currentStep) {
      setCompletedSteps((prev) => new Set([...prev, currentStep.id]));
    }
  }, [currentStep]);

  return (
    <LearningContext.Provider
      value={{
        currentModule,
        currentStepIndex,
        currentStep,
        learningSubTab,
        learningMode,
        completedSteps,
        setCurrentModule,
        setCurrentStepIndex,
        setLearningSubTab,
        setLearningMode,
        goToPrevStep,
        goToNextStep,
        completeCurrentStep,
      }}
    >
      {children}
    </LearningContext.Provider>
  );
}

export function useLearning(): LearningContextValue {
  const ctx = useContext(LearningContext);
  if (!ctx) {
    throw new Error('useLearning must be used within LearningProvider');
  }
  return ctx;
}
