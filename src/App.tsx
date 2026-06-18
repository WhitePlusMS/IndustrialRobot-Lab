// src/App.tsx
import { useState, useCallback, useEffect } from 'react';
import { useRobotKinematics, type Waypoint } from '@/hooks/useRobotKinematics';
import { useCameraControl } from '@/hooks/useCameraControl';
import { useSuckerControl, INITIAL_BOX_POSITION } from '@/hooks/useSuckerControl';
import { useDemoParts } from '@/hooks/useDemoParts';
import { useActionSequence, buildSequenceRobotAPI } from '@/hooks/useActionSequence';
import { trpc } from '@/providers/trpc';
import Header from '@/components/layout/Header';
import LearningPanel from '@/components/learning/LearningPanel';
import OperationPanel from '@/components/operation/OperationPanel';
import RobotScene from '@/components/RobotScene';
import StatusBar from '@/components/layout/StatusBar';
import DataOverlay from '@/components/DataOverlay';
import ViewportHUD from '@/components/ViewportHUD';
import DHParamOverlay from '@/components/DHParamOverlay';
import { getModuleById, type ModuleId, type LearningSubTab, type LearningMode } from '@/lib/course-config';
import type { JointAngles } from '@/types/robot';

export default function App() {
  const robot = useRobotKinematics();
  const camera = useCameraControl();

  // 3D视口显示状态
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [showDH, setShowDH] = useState(false);
  const [showDataOverlay, setShowDataOverlay] = useState(true);

  // 视角控制（场景单位：米）
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>([3, 2, 3]);

  // 教学状态
  const [currentModule, setCurrentModule] = useState<ModuleId>('robot');
  const [currentStep, setCurrentStep] = useState(0);
  const [learningSubTab, setLearningSubTab] = useState<LearningSubTab>('steps');
  const [learningMode, setLearningMode] = useState<LearningMode>('guided');
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const module = getModuleById(currentModule);
  const step = module?.steps[currentStep];

  const handleCameraView = useCallback((view: 'front' | 'side' | 'top' | 'free') => {
    switch (view) {
      case 'front':
        setCameraPosition([0, 1.5, 4]);
        break;
      case 'side':
        setCameraPosition([4, 1.5, 0]);
        break;
      case 'top':
        setCameraPosition([0, 5, 0.01]);
        break;
      case 'free':
        setCameraPosition([3, 2, 3]);
        break;
    }
  }, []);

  // 跳转到记忆点
  const handleGotoWaypoint = useCallback(
    (joints: JointAngles) => robot.goToJoints(joints),
    [robot]
  );

  // ===== 记忆点（从 tRPC 服务端读取，转换为本地 Waypoint 格式） =====
  const { data: waypointsData } = trpc.robot.listWaypoints.useQuery();
  const waypoints: Waypoint[] = (waypointsData ?? []).map((wp) => ({
    name: wp.name,
    joints: [wp.j1, wp.j2, wp.j3, wp.j4, wp.j5, wp.j6],
  }));

  // ===== 吸盘/箱子控制 =====
  const sucker = useSuckerControl({
    joints: robot.joints,
    config: robot.config,
    initialBoxPosition: INITIAL_BOX_POSITION,
  });

  // ===== 演示零件 =====
  const demoParts = useDemoParts();

  // ===== 动作序列 =====
  const robotAPI = buildSequenceRobotAPI({
    config: robot.config,
    joints: robot.joints,
    goToJoints: robot.goToJoints,
    goToPosition: robot.goToPosition,
    stopAnimation: robot.stopAnimation,
    isAnimating: robot.isAnimating,
    isAnimatingRef: robot.isAnimatingRef,
  });

  const sequence = useActionSequence(
    robotAPI,
    camera.cameraState,
    sucker.turnSuckerOn,
    sucker.turnSuckerOff,
    sucker.forceAttachBox,
    sucker.spawnBox,
    sucker.resetBox,
    waypoints
  );

  // 同步序列箱子位置到场景
  useEffect(() => {
    if (
      sequence.ctx.boxPose &&
      sucker.boxState !== 'FALLING' &&
      sucker.boxState !== 'ATTACHED'
    ) {
      sucker.setBoxPositionExternal(sequence.ctx.boxPose.position);
    }
  }, [sequence.ctx.boxPose, sucker]);

  // 步骤切换时自动切到讲解 Tab
  const handleStepChange = useCallback(
    (index: number) => {
      setCurrentStep(index);
      setLearningSubTab('explain');
    },
    []
  );

  // 模块切换时重置步骤
  const handleModuleChange = useCallback(
    (moduleId: ModuleId) => {
      setCurrentModule(moduleId);
      setCurrentStep(0);
      setLearningSubTab('steps');
    },
    []
  );

  // 上一步/下一步
  const handlePrev = useCallback(() => {
    if (!module) return;
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setLearningSubTab('explain');
    }
  }, [currentStep, module]);

  const handleNext = useCallback(() => {
    if (!module) return;
    if (currentStep < module.steps.length - 1) {
      setCompletedSteps((prev) => new Set([...prev, module.steps[currentStep].id]));
      setCurrentStep(currentStep + 1);
      setLearningSubTab('explain');
    }
  }, [currentStep, module]);

  if (!module || !step) {
    return <div className="h-screen w-screen flex items-center justify-center">课程加载失败</div>;
  }

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 overflow-hidden">
      <Header mode={learningMode} onModeChange={setLearningMode} />

      <div className="flex flex-1 overflow-hidden min-w-0">
        <LearningPanel
          currentModule={currentModule}
          currentStep={currentStep}
          subTab={learningSubTab}
          completedSteps={completedSteps}
          collapsed={leftCollapsed}
          onCollapse={() => setLeftCollapsed(!leftCollapsed)}
          onModuleChange={handleModuleChange}
          onStepClick={handleStepChange}
          onSubTabChange={setLearningSubTab}
          onPrev={handlePrev}
          onNext={handleNext}
        />

        <div className="flex-1 relative min-w-0 bg-gradient-to-b from-slate-50 to-slate-100">
          <RobotScene
            joints={robot.joints}
            trajectory={robot.trajectory}
            showGrid={showGrid}
            showAxes={showAxes}
            showTrajectory={showTrajectory}
            cameraPosition={cameraPosition}
            onTrajectoryPoint={robot.addTrajectoryPoint}
            selectedTool={robot.selectedTool}
            onToolList={robot.setToolList}
            cameraState={camera.cameraState}
            // 箱子/吸盘
            boxPosition={sucker.boxPosition}
            boxState={sucker.boxState}
            checkAttachment={sucker.checkAttachment}
            updateBoxFollow={sucker.updateBoxFollow}
            applyGravity={sucker.applyGravity}
            spawnFence={sequence.steps.find((s) => s.type === '生成箱子')?.params?.boxSpawn ?? null}
            demoParts={demoParts.parts}
          />

          <ViewportHUD
            showGrid={showGrid}
            onToggleGrid={() => setShowGrid(!showGrid)}
            showAxes={showAxes}
            onToggleAxes={() => setShowAxes(!showAxes)}
            showTrajectory={showTrajectory}
            onToggleTrajectory={() => setShowTrajectory(!showTrajectory)}
            showDH={showDH}
            onToggleDH={() => setShowDH(!showDH)}
            showDataOverlay={showDataOverlay}
            onToggleDataOverlay={() => setShowDataOverlay(!showDataOverlay)}
            onCameraView={handleCameraView}
            onSaveOrigin={robot.saveOrigin}
            onGoToOrigin={robot.goToOrigin}
            onGoToZero={robot.goToZero}
            hasOrigin={robot.originJoints !== null}
          />

          {showDataOverlay && (
            <DataOverlay
              coordinateSystem={robot.coordinateSystem}
              position={robot.endEffectorPose.position}
              euler={robot.endEffectorPose.euler}
              joints={robot.joints}
            />
          )}

          <DHParamOverlay config={robot.config} visible={showDH} />
        </div>

        <OperationPanel
          currentModule={currentModule}
          currentStep={step}
          mode={learningMode}
          collapsed={rightCollapsed}
          onCollapse={() => setRightCollapsed(!rightCollapsed)}
          // Robot
          joints={robot.joints}
          config={robot.config}
          jointStep={robot.jointStep}
          onJointStepChange={robot.setJointStep}
          onAdjustJoint={robot.adjustJoint}
          onReset={robot.resetJoints}
          onRandom={robot.randomJoints}
          coordinateSystem={robot.coordinateSystem}
          onCoordinateChange={robot.setCoordinateSystem}
          posStep={robot.posStep}
          onPosStepChange={robot.setPosStep}
          rotStep={robot.rotStep}
          onRotStepChange={robot.setRotStep}
          onMoveDirection={robot.moveDirection}
          onGotoWaypoint={handleGotoWaypoint}
          onGoToPosition={robot.goToPosition}
          currentGLBPosition={robot.glbPosition}
          status={robot.status}
          // Camera
          cameraState={camera.cameraState}
          captureResult={camera.captureResult}
          cameraPosStep={camera.posStep}
          onCameraPosStepChange={camera.setPosStep}
          cameraRotStep={camera.rotStep}
          onCameraRotStepChange={camera.setRotStep}
          cameraFovStep={camera.fovStep}
          onCameraFovStepChange={camera.setFovStep}
          setCameraPositionAxis={camera.setPositionAxis}
          setCameraRotationAxis={camera.setRotationAxis}
          setCameraFov={camera.setFov}
          setCameraNear={camera.setNear}
          setCameraFar={camera.setFar}
          toggleCameraFrustum={camera.toggleFrustum}
          toggleCameraModel={camera.toggleModel}
          setCameraResolution={camera.setResolution}
          resetCamera={camera.resetCamera}
          onCapture={camera.saveCapture}
          // Sequence
          sequenceSteps={sequence.steps}
          setSequenceSteps={sequence.setStepsList}
          sequenceCurrentStep={sequence.currentStepIndex}
          sequenceStatus={sequence.status}
          sequenceLogs={sequence.logs}
          onSequenceAddStep={sequence.addStep}
          onSequenceRemoveStep={sequence.removeStep}
          onSequenceMoveStep={sequence.moveStep}
          onSequenceUpdateStep={sequence.updateStep}
          onSequenceRun={sequence.runSequence}
          onSequenceStep={sequence.runSingleStep}
          onSequenceStop={sequence.stopSequence}
          onSequenceReset={sequence.resetSequence}
          waypoints={waypoints}
          captureImages={sequence.captureImages}
          suckerOn={sucker.suckerOn}
          boxState={sucker.boxState}
          // Demo parts
          onSpawnParts={(n, s) =>
            demoParts.spawnParts(n, s, {
              position: camera.cameraState.position,
              rotation: camera.cameraState.rotation,
              fov: camera.cameraState.fov,
              near: camera.cameraState.near,
              far: camera.cameraState.far,
            })
          }
          onClearParts={demoParts.clearParts}
          hasDemoParts={demoParts.parts.length > 0}
          // Sucker direct
          turnSuckerOn={sucker.turnSuckerOn}
          turnSuckerOff={sucker.turnSuckerOff}
          forceAttachBox={sucker.forceAttachBox}
          spawnBox={sucker.spawnBox}
          resetBox={sucker.resetBox}
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
