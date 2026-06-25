// src/components/layout/LabContent.tsx
// 实验室内容：由 App.tsx 迁移而来，保持原有逻辑不变
import { useState, useEffect } from 'react';
import { useLearning } from '@/contexts/LearningContext';
import { useSceneViewport } from '@/contexts/SceneViewportContext';
import { useRobotActionsContext, useRobotStateContext } from '@/contexts/RobotContext';
import { useVirtualCameraContext } from '@/contexts/VirtualCameraContext';
import { useSuckerContext } from '@/contexts/SuckerContext';
import { useDemoPartsContext } from '@/contexts/DemoPartsContext';
import { useSequenceContext } from '@/contexts/SequenceContext';
import Header from '@/components/layout/Header';
import LearningPanel from '@/components/learning/LearningPanel';
import OperationPanel from '@/components/operation/OperationPanel';
import RobotScene from '@/components/RobotScene';
import StatusBar from '@/components/layout/StatusBar';
import DataOverlay from '@/components/DataOverlay';
import ViewportHUD from '@/components/ViewportHUD';
import DHParamOverlay from '@/components/DHParamOverlay';

export default function LabContent() {
  const robotState = useRobotStateContext();
  const robotActions = useRobotActionsContext();
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
      robotActions.setHighlightedJoint(null);
    }
  }, [learning.currentStep?.id, robotActions]);

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
            joints={robotState.joints}
            sliderTargetRef={robotActions.sliderTargetRef}
            trajectory={robotState.trajectory}
            showGrid={viewport.showGrid}
            showTrajectory={viewport.showTrajectory}
            cameraPosition={viewport.cameraPosition}
            onTrajectoryPoint={robotActions.addTrajectoryPoint}
            selectedTool={robotState.selectedTool}
            onToolList={robotActions.setToolList}
            cameraState={camera.cameraState}
            cameraSliderTargetRef={camera.cameraTargetRef}
            coordinateSystem={robotState.coordinateSystem}
            gizmoIKRef={robotActions.gizmoIKRef}
            showTransformGizmo={viewport.showTransformGizmo}
            gizmoMode={viewport.gizmoMode}
            onStopAnimation={robotActions.stopAnimation}
            // 箱子/吸盘
            boxPosition={sucker.boxPosition}
            boxState={sucker.boxState}
            checkAttachment={sucker.checkAttachment}
            updateBoxFollow={sucker.updateBoxFollow}
            applyGravity={sucker.applyGravity}
            spawnFence={
              sequence.steps.find((s) => s.type === '生成箱子')?.params?.boxSpawn
              ?? (learning.currentStep?.id === 'grasp-spawn'
                ? { mode: 'random' as const, randomCenter: [-975, 0] as [number, number], randomRangeX: 125, randomRangeZ: 100, restingHeight: 240, minHeight: 350, maxHeight: 450 }
                : null)
            }
            demoParts={demoParts.parts}
          />

          {!viewport.suppressHUD && (
            <ViewportHUD
              onSaveOrigin={robotActions.saveOrigin}
              onGoToOrigin={robotActions.goToOrigin}
              onGoToZero={robotActions.goToZero}
              hasOrigin={robotState.originJoints !== null}
            />
          )}

          {viewport.showDataOverlay && !viewport.suppressHUD && (
            <DataOverlay
              coordinateSystem={robotState.coordinateSystem}
              position={robotState.endEffectorPose.position}
              euler={robotState.endEffectorPose.euler}
              joints={robotState.joints}
            />
          )}

          <DHParamOverlay config={robotState.config} visible={viewport.showDH} />
        </div>

        <OperationPanel
          collapsed={rightCollapsed}
          onCollapse={() => setRightCollapsed(!rightCollapsed)}
        />
      </div>

      <StatusBar
        status={robotState.status}
        coordinateSystem={robotState.coordinateSystem}
        position={robotState.endEffectorPose.position}
        euler={robotState.endEffectorPose.euler}
        joints={robotState.joints}
      />
    </div>
  );
}
