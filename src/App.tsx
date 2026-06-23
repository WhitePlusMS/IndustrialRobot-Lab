// src/App.tsx
// 根组件：组合各领域 Provider；AppContent 只负责读取 Context 并渲染页面骨架
import { useState, useEffect } from 'react';
import { LearningProvider, useLearning } from '@/contexts/LearningContext';
import { SceneViewportProvider, useSceneViewport } from '@/contexts/SceneViewportContext';
import { RobotProvider, useRobotContext } from '@/contexts/RobotContext';
import { VirtualCameraProvider, useVirtualCameraContext } from '@/contexts/VirtualCameraContext';
import { SuckerProvider, useSuckerContext } from '@/contexts/SuckerContext';
import { DemoPartsProvider, useDemoPartsContext } from '@/contexts/DemoPartsContext';
import { SequenceProvider, useSequenceContext } from '@/contexts/SequenceContext';
import Header from '@/components/layout/Header';
import LearningPanel from '@/components/learning/LearningPanel';
import OperationPanel from '@/components/operation/OperationPanel';
import RobotScene from '@/components/RobotScene';
import StatusBar from '@/components/layout/StatusBar';
import DataOverlay from '@/components/DataOverlay';
import ViewportHUD from '@/components/ViewportHUD';
import DHParamOverlay from '@/components/DHParamOverlay';

export default function App() {
  return (
    <LearningProvider>
      <SceneViewportProvider>
        <RobotProvider>
          <VirtualCameraProvider>
            <SuckerProvider>
              <DemoPartsProvider>
                <SequenceProvider>
                  <AppContent />
                </SequenceProvider>
              </DemoPartsProvider>
            </SuckerProvider>
          </VirtualCameraProvider>
        </RobotProvider>
      </SceneViewportProvider>
    </LearningProvider>
  );
}

function AppContent() {
  const robot = useRobotContext();
  const camera = useVirtualCameraContext();
  const viewport = useSceneViewport();
  const learning = useLearning();
  const sucker = useSuckerContext();
  const demoParts = useDemoPartsContext();
  const sequence = useSequenceContext();

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // 切换步骤时，自动清除不属于当前步骤的 3D 高亮与临时工具显示
  useEffect(() => {
    const stepId = learning.currentStep?.id;
    if (stepId !== 'robot-structure') {
      robot.setHighlightedJoint(null);
    }

  }, [learning.currentStep?.id, robot]);

  if (!learning.currentStep) {
    return <div className="h-screen w-screen flex items-center justify-center">课程加载失败</div>;
  }

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 overflow-hidden">
      <Header mode={learning.learningMode} onModeChange={learning.setLearningMode} />

      <div className="flex flex-1 overflow-hidden min-w-0">
        <LearningPanel
          collapsed={leftCollapsed}
          onCollapse={() => setLeftCollapsed(!leftCollapsed)}
        />

        <div className="flex-1 relative min-w-0 bg-gradient-to-b from-slate-50 to-slate-100">
          <RobotScene
            joints={robot.joints}
            sliderTargetRef={robot.sliderTargetRef}
            trajectory={robot.trajectory}
            showGrid={viewport.showGrid}
            showTrajectory={viewport.showTrajectory}
            cameraPosition={viewport.cameraPosition}
            onTrajectoryPoint={robot.addTrajectoryPoint}
            selectedTool={robot.selectedTool}
            onToolList={robot.setToolList}
            cameraState={camera.cameraState}
            cameraSliderTargetRef={camera.cameraSliderTargetRef}
            coordinateSystem={robot.coordinateSystem}
            gizmoIKRef={robot.gizmoIKRef}
            showTransformGizmo={viewport.showTransformGizmo}
            gizmoMode={viewport.gizmoMode}
            onStopAnimation={robot.stopAnimation}
            // 箱子/吸盘
            boxPosition={sucker.boxPosition}
            boxState={sucker.boxState}
            checkAttachment={sucker.checkAttachment}
            updateBoxFollow={sucker.updateBoxFollow}
            applyGravity={sucker.applyGravity}
            spawnFence={
              sequence.steps.find((s) => s.type === '生成箱子')?.params?.boxSpawn
              ?? (learning.currentStep?.id === 'grasp-spawn'
                ? { mode: 'random' as const, randomCenter: [1000, 0] as [number, number], randomRangeX: 150, randomRangeZ: 150, restingHeight: 200, minHeight: 350, maxHeight: 450 }
                : null)
            }
            demoParts={demoParts.parts}
          />

          {!viewport.suppressHUD && (
            <ViewportHUD
              onSaveOrigin={robot.saveOrigin}
              onGoToOrigin={robot.goToOrigin}
              onGoToZero={robot.goToZero}
              hasOrigin={robot.originJoints !== null}
            />
          )}

          {viewport.showDataOverlay && !viewport.suppressHUD && (
            <DataOverlay
              coordinateSystem={robot.coordinateSystem}
              position={robot.endEffectorPose.position}
              euler={robot.endEffectorPose.euler}
              joints={robot.joints}
            />
          )}

          <DHParamOverlay config={robot.config} visible={viewport.showDH} />
        </div>

        <OperationPanel
          collapsed={rightCollapsed}
          onCollapse={() => setRightCollapsed(!rightCollapsed)}
        />
      </div>

      <StatusBar
        status={robot.status}
        coordinateSystem={robot.coordinateSystem}
        position={robot.endEffectorPose.position}
        euler={robot.endEffectorPose.euler}
        joints={robot.joints}
      />
    </div>
  );
}
