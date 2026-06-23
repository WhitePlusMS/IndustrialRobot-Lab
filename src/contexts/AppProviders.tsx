// src/contexts/AppProviders.tsx
// 应用级 Provider 编排：
// 1. LearningProvider：课程与模式总状态
// 2. SceneViewportProvider：3D 视口显示与场景相机
// 3. RobotProvider：机器人状态与控制命令
// 4. SuckerProvider：依赖 RobotProvider，仅管理吸盘/箱子状态
// 5. VirtualCameraProvider：虚拟相机状态，供相机面板和序列系统使用
// 6. DemoPartsProvider：演示零件状态
// 7. SequenceProvider：依赖 Robot/Sucker/VirtualCamera，负责动作序列

import type { ReactNode } from 'react';
import { LearningProvider } from '@/contexts/LearningContext';
import { SceneViewportProvider } from '@/contexts/SceneViewportContext';
import { RobotProvider } from '@/contexts/RobotContext';
import { VirtualCameraProvider } from '@/contexts/VirtualCameraContext';
import { SuckerProvider } from '@/contexts/SuckerContext';
import { DemoPartsProvider } from '@/contexts/DemoPartsContext';
import { SequenceProvider } from '@/contexts/SequenceContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LearningProvider>
      <SceneViewportProvider>
        <RobotProvider>
          <SuckerProvider>
            <VirtualCameraProvider>
              <DemoPartsProvider>
                <SequenceProvider>{children}</SequenceProvider>
              </DemoPartsProvider>
            </VirtualCameraProvider>
          </SuckerProvider>
        </RobotProvider>
      </SceneViewportProvider>
    </LearningProvider>
  );
}
