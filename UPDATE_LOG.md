# 更新日志

## 2026-06-20 位姿控制方向键连续点击/长按动画卡顿修复

- **问题**：连续点击或长按方向键时，每次调用都 `cancelAnimationFrame` + `requestAnimationFrame` 重启动画，导致帧间隙卡顿；长按姿态操作使用缓动动画（固定 400ms），与连续触发不兼容
- **修复**：
  - `useMotion.ts` 新增 `activeAnimTypeRef` 跟踪活跃动画类型；同类型重复调用时仅更新目标 ref，不重启 RAF 循环，消除帧间隙
  - `finishAnimation` / `markUnreachable` / `stopAnimation` 重置 `activeAnimTypeRef = 'none'`
  - `moveDirection` 长按姿态操作改用 `startSpeedLimitedAnimation`（连续追目标），单击保持 `startEasedAnimation`（缓动曲线）
  - `moveDirection` 位置操作统一 `ikAnimDuration`，长按不再用 50ms 短间隔
- 涉及文件：`useMotion.ts`、`useRobot.ts`

## 2026-06-20 位姿控制方向键运动卡死修复

- **问题**：教学模式下 `PoseControlCard` / `JointAngleCard` 的方向键点击后机械臂一直处于"运动中"，界面反复刷新直至卡死
- **原因**：`RobotOperations` / `GraspOperations` 中额外传了 `disabled={props.status === 'moving'}`，与 `FreeOperationPanel` 行为不一致。`DirectionButton` 在 disabled 切换过程中长按定时器清理时机不可控，导致动画循环被反复重入
- **修复**：移除 `RobotOperations` 和 `GraspOperations` 中 `PoseControlCard` 和 `JointAngleCard` 的 `disabled` prop，与 `FreeOperationPanel` 完全一致
- 涉及文件：`RobotOperations.tsx`、`GraspOperations.tsx`、`DirectionButton.tsx`

## 2026-06-20 教学全流程缺陷并发修复（以学生视角）

以学生视角全流程复核机械臂、相机系统、抓取实训三个模块，并发修改右侧操作区与左侧讲解中的问题。

- **机械臂**
  - `PoseControlCard` / `JointAngleCard` 新增 `disabled` prop，机械臂运动期间禁用方向键/关节滑块/输入/重置随机
  - `RobotOperations` 删除顶部重复 World/Tool 切换按钮；删除单关节步骤的"检查答案"按钮及相关校验逻辑
  - `RobotOperations` 在 `robot-structure` 步骤增加"在 3D 场景中显示吸盘"按钮，可直接显示/隐藏末端吸盘
  - `course-config.ts` 删除 `ValidationType` 与 `CourseStep.validation` 字段
- **相机**
  - 删除 `camera-model` 重复的"成像平面"按钮
  - `camera-calibration` "显示标定板"改为"显示视野锥"，标定结果增加完成提示与说明
  - `CameraParamsCard` 增加内参/外参分区标题；分辨率统一使用 `CAMERA_RESOLUTIONS`
- **抓取**
  - `grasp-attach` 增加放置区参考卡片与"移动到放置区"按钮；开启吸盘增加箱子状态检查
  - `grasp-approach` 增加位姿/笛卡尔手动控制
  - `grasp-spawn` 拆分为固定/随机生成
  - `grasp-sequence` 未选择记忆点时禁用运行并提示
- **共享**
  - `PositionTargetCard` 输入单位统一为 mm（内部转换为 m）
  - `course-config.ts` 修复 `robot-multi-joint` 文案，清理 `grasp-approach`/`grasp-attach` 的重复内容
  - 新增 `src/lib/camera-config.ts` 共享分辨率常量
- **验证**：`npm run check` 通过；本次修改的所有文件 ESLint 通过

## 2026-06-20 合并"相关知识"到"步骤讲解"

- 左侧 `LearningPanel` 移除"相关知识" Tab，子 Tab 只保留"学习步骤"和"步骤讲解"
- `StepExplanation.tsx` 新增"本步相关知识"卡片，按 `relatedTheoryIds` 排序并标蓝
- 效果：学生在"步骤讲解"内即可看到术语、相关知识、目标和注意事项，流程更连贯

## 2026-06-20 教学文案与联动高亮

- 重写 3 个模块共 15 个步骤的教学内容，增加"关键术语""操作步骤""重点观察""完成检查"
- 新增 `TeachingGuidePanel` 作为右侧唯一教学引导区
- 实现步骤与 3D 场景联动：点击关节卡片可在 3D 中高亮对应关节

## 2026-06-19 World/Tool 坐标系可视化

- `RobotScene` 中基坐标系与工具坐标系受统一开关控制
- World 模式下工具坐标系与世界坐标系同向；Tool 模式下跟随末端法兰旋转
- `ViewportHUD` "坐标系"按钮同步控制两者显隐

## 2026-06-19 相机/机械臂/抓取面板修复

- `CameraParamsCard` 改为滑块样式，并增加"内参矩阵 K"只读展示
- 相机快捷视角改为控制虚拟工业相机本身
- `JointAngleCard` 增加 `enabledJoints` 与 `collapsible` 支持
- `RobotOperations` 教学步骤改用 `JointAngleCard` / `PoseControlCard`
- 抓取默认箱子位置调整到可达区域；`grasp-approach` 增加"移动到箱子上方"按钮

## 2026-06-18 架构重构与性能优化

- Context + Provider 分层：新增 `RobotContext`、`VirtualCameraContext`、`SuckerContext` 等
- `OperationPanel` 外部接口从 74+ props 收敛为 2 个
- 统一 IK 引擎，删除 DH 数值后备逻辑
- 滑块拖动改为 ref + `useFrame` 插值，解决卡顿与瞬移
- 移除后端，记忆点改为浏览器 localStorage 存储

## 2026-06-18 教学版界面与自由练习模式

- 左侧新增 `LearningPanel`，右侧新增 `OperationPanel`
- 自由练习模式采用 Tab 结构：机器人控制 / 相机控制 / 动作编排
- 操作卡片视觉统一升级为白色卡片 + blue/slate 主题
- 修复折叠条样式、侧边栏折叠联动等问题

## 2026-06-17 - 按 Web Interface Guidelines 优化界面可访问性与语义化

### 修改
- `src/App.css` / `index.html`：全局焦点环 fallback、theme-color
- `src/components/Header.tsx` / `Toolbar.tsx` / `StatusBar.tsx`：语义化标签（header/nav/footer）、Intl 日期、状态 role
- `src/components/ControlPanel.tsx` / `DataOverlay.tsx` / `ViewportHUD.tsx`：补全 tabpanel、aria-controls、aria-pressed、region 角色
- `src/components/JointAngleCard.tsx` / `PoseControlCard.tsx` / `PositionTargetCard.tsx` / `WaypointPanel.tsx`：按钮补 `type="button"`、aria-label、反馈文本
- `src/components/sequence/SequenceEditor.tsx` / `SequenceStepList.tsx` / `SequenceStepParams.tsx`：步骤行改用 `<button>`、删除确认、输入框补 label/aria-label、SVG aria-hidden
- `src/components/camera/CapturePanel.tsx` / `CameraParamsCard.tsx` / `DemoPartsCard.tsx`：图片尺寸与 loading、模态框 role/aria-modal/Escape、输入框 autocomplete/inputmode
- `src/components/DHParamOverlay.tsx` / `RobotScene.tsx`：标题层级、tabular-nums、prefers-reduced-motion、touch-action

### Bug 修复
- `ControlPanel.tsx`：Tab panel 由三个独立 `<div hidden>` 改回单一容器，避免非激活面板产生空白滚动区域
- `DHParamOverlay.tsx`：`<h3>` 标题补 `mt-0`，防止浏览器默认 heading margin 导致额外空白
- 滚动条 Bug（页面级上下/左右滚动）：
  - 根因：为辅助阅读器添加的 `.sr-only` 元素被放在 `space-y-3` 容器内；`sr-only` 虽为 `absolute`，但 `space-y-3` 仍会向其注入 `margin-top`，且元素自身无固定 `top/left`，结果被推到页面最底部，撑开了 `<html>` 的 `scrollHeight`
  - 修复：给所有手动添加的 `.sr-only` 元素补 `top-0 left-0`（必要时再加 `mt-0`），使其不再参与文档流撑开
  - 涉及文件：`src/components/PositionTargetCard.tsx`、`src/components/ToolCard.tsx`、`src/components/DHParamOverlay.tsx`

### 验证
- `npx tsc --noEmit` 通过
- CDP 实测：`html.scrollWidth === clientWidth` 且 `html.scrollHeight === clientHeight`，页面级滚动条已消除；左侧 `ControlPanel` 仅保留内部垂直滚动（内容确实超出容器高度）

## 2026-06-17 - 拆分 DH 零位语义对照与几何位置拟合，对 wrist/主链诊断去伪存真

### 修改
- `src/components/GLBRobotArm.tsx`
- 为 mesh 调试快照补充几何中心信息：
  - `geometryCenterLocal`
  - `geometryCenterWorldMm`
  - `boundingBoxSizeWorldMm`
- 原因：
  - 之前日志只记录对象原点，无法区分“pivot 原点偏了”还是“mesh 几何中心本来就不在对象原点”
  - 这会直接误导 wrist `J5/J6` 的 DH 参数判断
- 新增 `buildBestFitRigidAlignment()`：
  - 用 SVD 对 DH 关节中心与真实 GLB pivot 做最佳刚体位置拟合
  - 目的不是替代 DH 语义对齐，而是单独看“几何中心还能差多少”
- 重新整理 `__GLB_compareDhForJoints()` 的输出：
  - `zeroPoseFrameAlignment` 继续只负责 DH 零位基坐标/轴向语义对照
  - `bestFitRigidAlignment` 单独负责关节中心的最优位置拟合
  - `alignedFrameComparisons` 现在同时给出：
    - `pivotErrorNormMm`
      - 表示最佳刚体拟合后的剩余几何位置误差
    - `zeroPosePivotErrorNormMm`
      - 表示原 DH 零位语义对照下的剩余误差
  - 这样后续不会再把“全链零位基坐标偏差”和“单个 DH 参数不准”混为一谈
- 修复本轮新增诊断逻辑带来的两处运行时问题：
  - 去掉一次错误的 `buildBestFitRigidAlignment(jointPivots, jointPivots)` 调用
  - `ml-matrix` 浏览器运行时没有 `Matrix.det()`，改为本地 `determinant3()`
  - 页面白屏已恢复

### 本轮新的真实判断
- 重新导出零位标定后确认：
  - 之前 `J2~J6` 那组约 `1600mm` 量级的误差，确实混入了大量“零位坐标语义对照方式”的假大误差
- 使用新的最佳刚体位置拟合后，零位关节中心剩余误差收敛到更可信的量级：
  - `转台 ≈ 232.7mm`
  - `大臂 ≈ 220.6mm`
  - `小臂 ≈ 153.8mm`
  - `回转机构 ≈ 179.6mm`
  - `末端关节 ≈ 195.7mm`
  - `快拆机器人端口 ≈ 88.0mm`
- 同时 `zeroPosePivotErrorNormMm` 仍保留了原本的轴向/零位语义对照信号：
  - `J4/J5/J6` 轴向误差仍是 `0°`
  - 说明“后腕三轴轴向约定已经对上”这一结论仍成立
- 几何中心日志还确认：
  - `末端关节` 的 mesh 几何中心相对对象原点约有几十毫米量级偏置
  - `快拆机器人端口` 本体 mesh 也有小量级局部偏置
  - 吸盘几何中心相对端口原点约有 `125mm` 级偏置
  - 但并没有出现“单个 mesh 自身就偏了 397mm”的证据

### 当前结论
- 这轮把一个非常关键的误判打掉了：
  - 不能再把“零位对照下整条链都偏 1.6m”直接解释成“DH 主链长度全错”
- 现在更可信的结论是：
  - 已经修好的部分：
    - `World X/Y/Z` 连续直线平移
    - `J4/J5/J6` 轴向约定
  - 仍需继续收敛的部分：
    - 关节中心几何位置残差仍有约 `88~233mm`
    - 这更像是当前项目这套 `dhTransform` 约定下，若干 `a/d` 分量被过度简化为 `0`
    - 下一轮应继续围绕：
      - `joint2.d`
      - `joint4.a`
      - `joint5.d`
      - `joint6.a/d`
    - 但必须基于新的“去伪后”残差继续验证，不能再直接相信旧的 `1600mm` 级数值

## 2026-06-17 - 真实 GLB 标定继续核对 DH 主链，同时修正视觉位置阶段“用姿态换位置”的错误接受条件

### 修改
- `src/hooks/useRobotKinematics.ts`
  - 为 `solveVisualServoStep()` 增加更严格的“位置优先”接受条件：
    - `position` 阶段现在不再仅以总加权误差变小作为成功条件
    - 改为优先要求位置误差真实下降
    - 仅在位置几乎不退化时，才允许用更好的姿态一起通过
  - 给 `orientation -> position` 的再平衡加上单次预算：
    - 只允许有限次数回切
    - 避免第二次 `World X+ 50mm` 中出现 `position / orientation` 无限来回抖动
  - 位置步进链路补充“真实旋转矩阵传递”：
    - 位置控制不再只锁 `euler`
    - 同时把当前真实 GLB `rotation` 传入视觉求解
  - `orientation` 阶段由单一 Jacobian nudge 改为“小邻域多候选搜索”：
    - 优先围绕腕部关节 `J4/J5/J6` 和肘部 `J3` 尝试小幅组合微调
    - 目的：突破第二次 `World X+` 的固定卡点，而不是一直 `visual_retry`
  - 继续补 `orientation` 多种子恢复：
    - 从多组邻近腕部种子出发做完整视觉位姿恢复
    - 验证当前卡点是否只是单一种子掉进了局部极小值
  - 为视觉位姿恢复补 `best effort` 返回：
    - 允许在严格收敛失败时保留受控范围内的最好中间解
    - 只在 `orientation` 的 pose recovery 分支启用，避免污染主平移路径
  - 逐帧位置插补改为直接使用真实 `rotation` 做姿态误差计算：
    - 不再在中途用 Euler 重建出来的姿态继续锁定平移
  - 新增 `orientation` 零空间恢复尝试：
    - 先用位置 Jacobian 的零空间方向去压姿态
    - 再回退到原有的多种子/邻域恢复链路
  - 试过一版“单次位置点击优先走完整多种子视觉位姿求解”的主路径
    - 实测会显著拖重页面，导致 `__ROBOT_DEBUG` 注册不稳定
    - 已撤回，不保留在主路径中
  - 补了 GLB pivot 中心的局部偏置实验：
    - `大臂` 约 `-53mm`
    - `回转机构` 约 `-89mm`
    - 目的：验证关节中心残余偏置是否就是世界坐标画弧的主因

### 本轮真实网页标定结论
- 再次通过 `window.__GLB_dumpCalibration()` 导出真实 GLB 零位标定
- `suggestedDh` 仍然稳定在：
  - `joint1d ≈ 459.3`
  - `joint2a ≈ 353.7`
  - `joint3a ≈ 940.5`
  - `joint4d ≈ 704.9`
  - `joint5a ≈ 272.1`
  - `joint6d ≈ 201.4`
- 结论保持不变：
  - KUKA 主链 `a/d` 长度与真实 GLB 仍然基本一致
  - 当前剩余问题不能直接归因为“主 DH 连杆长度明显不对”

### 本轮真实网页回归
- 基准姿态：
  - `J=[0,-30,60,0,0,0]`
  - `World`
  - `50mm`
- 连续三次 `World X+`
  - 第 1 次：
    - `remainingPosMm ≈ 0.11`
    - `remainingOriDeg ≈ 0.005`
    - `lastReason = visual_target_reached`
  - 第 2 次：
    - 上一轮：`3.64mm / 1.92°`
    - 本轮：`2.48mm / 2.31°`
    - 之后再加“单次再平衡预算”后：`3.24mm / 2.07°`
    - 再补“真实旋转矩阵传递 + orientation 邻域候选”后：
      - `2.91mm / 2.29°`
    - 再补“orientation 多种子完整恢复”后：
      - `3.94mm / 1.91°`
    - 再补“best effort pose recovery”后：
      - 结果与上一轮基本相同，仍约 `3.94mm / 1.91°`
    - 再补“逐帧真实 rotation + 零空间姿态恢复”后：
      - 结果仍基本不变，约 `3.95mm / 1.91°`
    - pivot 偏置实验后：
      - 零位标定中的局部候选量级几乎不变
      - 未形成决定性改善证据
  - 第 3 次：
    - 仍未完成，约 `4.74mm / 12.72°`

### 新的关键诊断
- 第二次 `World X+` 的逐帧采样表明：
  - 旧的 `position` 阶段会接受“位置变差但姿态更好”的候选步
  - 这会直接破坏世界直线平移目标
  - 修正后，第二次 `X+` 的位置残差确实下降了
- 当前最新卡点已经进一步收敛为：
  - 第二次 `X+` 在切入 `orientation` 阶段后，仍会落入固定的“位置/姿态 tradeoff”
  - 当前几轮最好点大致在：
    - `2.48mm / 2.31°`
    - `2.91mm / 2.29°`
    - `3.24mm / 2.07°`
    - `3.94mm / 1.91°`
  - 之后长期 `visual_retry`，说明现在不是 DH 主链长度错误
  - 而是当前零位/关节轴映射与后段姿态恢复之间仍存在真实几何不一致

### 当前判断
- 这轮又确认了一次：
  - 需要保留原 KUKA GLB 外观
  - 主 DH 长度不要再盲改
  - 剩余问题继续集中在视觉闭环后段，而不是主链参数本身
- 后续更合理的方向是：
  - 现在单纯继续增强 `orientation` 恢复策略的边际收益已经变小
  - 下一轮更值得优先转向：
    - 补更精确的零位/关节轴映射
    - 尤其是 `thetaOffset / alpha / 局部 d 偏置`
    - 更具体地说，需要先补“GLB 几何到当前 DH 约定”的映射层
    - 因为标定导出的 `candidateDhFromPivots` 不能直接落进当前 `dhTransform` 约定
  - 仍然不建议直接大改主链 `a/d`

## 2026-06-17 - DH 标定日志与局部视觉伺服继续收敛：确认主链长度基本成立，第三次 X+ 仍剩姿态漂移

### 修改
- `src/components/GLBRobotArm.tsx`
  - 扩展零位标定报告：
    - 新增 `zeroPoseFrameAlignment`
    - 新增 `alignedFkErrorsMm`
  - 目的：
    - 把“原始 DH 零位”和“GLB 世界零位”分开看
    - 避免继续把固定基座坐标映射误差误判成 `a/d` 链长错误
- `src/hooks/useRobotKinematics.ts`
  - 新增真正的单帧局部视觉伺服步：
    - `solveVisualServoStep()`
  - `runCartesianAnimation()` 的位置控制分支改为：
    - 优先按小步局部伺服推进
    - 只在更小窗口内允许 position-only fallback
    - 收紧中后段 `maxDeltaDeg / orientationScale / positionClamp`
  - 新增 `pickNextOrientationLock()`
    - 只有姿态尾差足够小时，才把当前姿态写回下一次位置步进的锁定姿态
    - 避免把已漂移姿态继续滚入后续 `X/Y/Z` 平移基准

### 本轮真实网页回归
- 零位标定再次确认：
  - `suggestedDh`
    - `joint1d ≈ 459.3`
    - `joint2a ≈ 353.7`
    - `joint3a ≈ 940.5`
    - `joint4d ≈ 704.9`
    - `joint5a ≈ 272.1`
    - `joint6d ≈ 201.4`
  - 结论：
    - 主链长度仍然与真实 KUKA GLB 基本一致
    - 当前主问题不能再简单归因到“几根连杆长度明显错了”
- `World X+ 50mm`
  - 单次点击：
    - `[-1134.80, 1319.30, -487.69] -> [-1086.11, 1319.40, -487.79]`
    - `remainingPosMm ≈ 1.31`
    - `remainingOriDeg ≈ 0.08`
    - `lastReason = visual_target_reached`
- 连续三次 `World X+ 50mm`
  - 第 1 次：
    - `[-1086.11, 1319.40, -487.79]`
    - `remainingPosMm ≈ 1.31`
    - `remainingOriDeg ≈ 0.08`
  - 第 2 次：
    - `[-1036.67, 1319.03, -488.02]`
    - `remainingPosMm ≈ 0.71`
    - `remainingOriDeg ≈ 2.52`
  - 第 3 次：
    - `[-989.61, 1315.48, -489.17]`
    - `remainingPosMm ≈ 4.75`
    - `remainingOriDeg ≈ 13.18`
    - `lastReason = visual_timeout_after_progress`

### 当前判断
- 这轮确认了两件事：
  - `a/d` 主链长度不是当前第一矛盾
  - 局部视觉伺服方向是对的，第三次 `X+` 已不再像早前那样停在十几毫米外完全不前进
- 但目前仍未最终解决：
  - 第三次连续平移时，位置还能继续逼近
  - 姿态却会明显漂移，并最终以超时收尾
- 因此当前剩余主问题进一步收敛为：
  - “连续世界坐标平移”下的姿态锁定策略仍不够稳
  - 尤其是第二次开始产生的小姿态尾差，会在第三次被继续放大

### 验证
- `tsc --noEmit --pretty false` ✅
- 真实浏览器页面 `http://localhost:18081/?tab=robot` 已回归，结论以上述真实采样为准

## 2026-06-17 - 连续平移卡点诊断：第二次 X+ 会卡在“位置已到位但姿态尾差约 2.9°”的近目标状态

### 修改
- `src/hooks/useRobotKinematics.ts`
  - 继续收紧位置步进完成条件：
    - 只有 `remainingPos < 1.2mm` 且 `remainingOri < 0.03rad` 才直接判完成
  - 增加末段近目标姿态恢复尝试：
    - `solveVisualOrientationNudge()`
    - 在“无新位置解但位置几乎到位”时，允许小范围牺牲位置裕量，换取姿态恢复
  - 同时收紧会导致“原地不动也算近目标解”的 fallback 触发窗口

### 本轮真实网页诊断
- 单次 `World X+ 50mm`
  - 仍然很好：
    - `[-1134.80, 1319.30, -487.69] -> [-1084.94, 1319.32, -487.72]`
    - `remainingPosMm ≈ 0.14`
    - `remainingOriDeg ≈ 0.02`
- 第二次 `World X+ 50mm`
  - 最终仍停在：
    - `[-1035.48, 1318.96, -487.94]`
    - `remainingPosMm ≈ 0.69`
    - `remainingOriDeg ≈ 2.88`
    - `lastReason = visual_timeout_after_progress`
- 对第二次 `X+` 的逐帧采样显示：
  - 前段正常收敛：
    - `5.85mm / 0.98°`
    - `5.10mm / 1.40°`
  - 到近目标后卡住：
    - `0.69mm / 2.88°`
    - 随后数秒内反复保持同一组 joints，不再产生新的关节步，直到超时

### 额外离线诊断结论
- 针对该卡点姿态做单步局部 Jacobian 试算后确认：
  - 其实存在“姿态更好一点”的候选步
  - 但它往往会把位置误差从 `0.69mm` 拉到约 `1.4~2.0mm`
  - 当前链路仍然过于保守，不愿接受这种“先轻微退位置，再继续把姿态收回来”的过渡
- 这说明剩余主问题已非常具体：
  - 不是单次 `50mm` 走不动
  - 也不是主链长度明显错误
  - 而是连续世界坐标平移在中后段缺少一个“近目标姿态恢复迭代”

### 当前判断
- 继续堆阈值补丁的收益已经明显下降
- 下一轮更正确的方向应该是：
  - 明确拆出“位置已基本到位后的姿态恢复子阶段”
  - 在该子阶段允许很小的 `1~2mm` 位置回退
  - 只要最终能把姿态重新拉回，再继续完成本次平移

## 2026-06-17 - 两阶段视觉平移开始生效：第二次 X+ 已能进入独立姿态恢复阶段

### 修改
- `src/hooks/useRobotKinematics.ts`
  - 为视觉位置动画新增阶段状态：
    - `cartesianPhaseRef`
    - `cartesianOrientationRecoveryBudgetRef`
  - `runCartesianAnimation()` 现在按两个阶段工作：
    - `position`
      - 先把位置误差推进到近目标窗口
    - `orientation`
      - 再单独尝试姿态恢复，不再继续和前面的中段位置步抢条件
  - `window.__ROBOT_DEBUG.getCartesianDebug()` 新增：
    - `phase`
  - 目的：
    - 让真实网页回归时可以直接看到“当前是在吃位置还是在拉姿态”
    - 不再把近目标姿态恢复混在一大串 fallback 中间

### 本轮真实网页回归
- 第一次 `World X+ 50mm`
  - `[-1134.80, 1319.30, -487.69] -> [-1084.91, 1319.32, -487.71]`
  - `remainingPosMm ≈ 0.11`
  - `remainingOriDeg ≈ 0.0055`
  - `lastReason = visual_target_reached`
- 第二次 `World X+ 50mm`
  - 新日志已明确显示：
    - 前半段处于 `phase = position`
    - 近目标后切到 `phase = orientation`
  - 最终停在：
    - `[-1036.59, 1318.38, -488.36]`
    - `remainingPosMm ≈ 2.03`
    - `remainingOriDeg ≈ 2.46`
    - `lastReason = visual_timeout_or_unsolved`
- 第三次 `World X+ 50mm`
  - 仍未收口：
    - `[-989.48, 1314.84, -489.50]`
    - `remainingPosMm ≈ 4.70`
    - `remainingOriDeg ≈ 13.09`
    - `lastReason = visual_timeout_after_progress`

### 关键结论
- 两阶段链路已经比“单循环 + 阈值补丁”更接近正确方向：
  - 第一次 `X+` 更干净
  - 第二次 `X+` 不再卡在旧的 `0.69mm / 2.88°` 状态
  - 说明独立姿态恢复阶段确实开始发挥作用
- 但当前姿态恢复阶段还只走出了一小步：
  - 第二次 `X+` 仍然在 `2.03mm / 2.46°` 处超时
  - 第三次 `X+` 仍然会继续把尾差放大
- 因此剩余主问题已经进一步具体化为：
  - `orientation` 阶段能启动，但还缺少“持续多步恢复”的能力
  - 当前更像是切进姿态恢复后做了一次修正，然后再次停住

## 2026-06-17 - Orientation 阶段继续增强：允许小范围位置回退以持续换取姿态收敛

### 修改
- `src/hooks/useRobotKinematics.ts`
  - 对 `orientation` 阶段做卡点诊断后确认：
    - 该阶段并非“完全无解”
    - 而是很多候选步能继续改善姿态，但会把位置误差从约 `2mm` 暂时放宽到 `3~4mm`
  - 基于这个证据，给 `orientation` 阶段新增第二档更宽松的恢复策略：
    - `visual_orientation_phase_relaxed_recovery`
    - 允许更大的 `maxAllowedPositionMm`
    - 降低姿态改善门槛，优先把姿态尾差继续往下压

### 本轮真实网页回归
- 第一次 `World X+ 50mm`
  - 仍保持很好：
    - `[-1134.80, 1319.30, -487.69] -> [-1084.91, 1319.32, -487.71]`
    - `remainingPosMm ≈ 0.11`
    - `remainingOriDeg ≈ 0.005`
- 第二次 `World X+ 50mm`
  - 上一轮结果：
    - `remainingPosMm ≈ 2.03`
    - `remainingOriDeg ≈ 2.46`
  - 本轮结果：
    - 结束位置：`[-1037.95, 1317.68, -488.88]`
    - `remainingPosMm ≈ 3.64`
    - `remainingOriDeg ≈ 1.92`
    - `lastReason = visual_timeout_or_unsolved`
- 第三次 `World X+ 50mm`
  - 仍未完成：
    - `[-990.91, 1314.17, -490.04]`
    - `remainingPosMm ≈ 4.74`
    - `remainingOriDeg ≈ 12.60`
    - `lastReason = visual_timeout_after_progress`

### 最新判断
- 这轮再次证明：
  - 当前剩余问题已经不是主链长度
  - 而是连续平移后段“位置与姿态”的权衡策略
- 更具体地说：
  - 为了让第二次 `X+` 的姿态尾差继续下降，系统现在愿意接受少量位置回退
  - 这让姿态从 `2.46°` 进一步压到 `1.92°`
  - 但位置也从 `2.03mm` 放宽到了 `3.64mm`
- 也就是说，现在已经从“完全不会恢复姿态”进化成了“会恢复姿态，但位置与姿态之间还没达到最终平衡”

## 2026-06-17 - 位置步进触发链路继续收敛：去掉整步终点门卫，确认当前剩余问题在视觉位置插补尺度

### 修改
- `src/hooks/useRobotKinematics.ts`
  - 调整 `moveDirection()` 的位置控制分支：
    - `X/Y/Z` 不再先用一次“整步终点视觉 IK”做门卫判定
    - 改为通过工作空间预检后，直接进入逐帧笛卡尔插补
    - 保留 `RX/RY/RZ` 的原有视觉姿态求解链路不变
  - 原因：
    - 真实网页回归证明，之前 `World 50mm X+` 第一次能成功、第二次开始直接 `success:false`
    - 根因不是主链长错误，而是“整步终点视觉 IK”过于保守，提前把可通过逐帧局部修正到达的目标误判为失败
  - 同轮试过一版“放宽逐帧视觉 IK 容错”的参数
    - 虽然能让 `X+` 继续走更远
    - 但会明显放大姿态漂移
    - 已撤回，避免污染当前更稳的姿态保持链路

### 本轮真实网页回归
- 基准姿态：
  - `J=[0,-30,60,0,0,0]`
  - 法兰：`[-1134.8, 1319.3, -487.69]`
- 去掉整步终点门卫后：
  - `World 50mm X+`
    - 第 1 次：`[-1134.8,1319.3,-487.69] -> [-1134.04,1319.34,-487.70]`
    - 第 2 次：`[-1133.27,1319.38,-487.72]`
    - 第 3 次：`[-1132.51,1319.42,-487.74]`
    - 第 4 次：`[-1131.74,1319.47,-487.76]`
  - 结论：
    - 不再出现“第二次 X+ 直接 success:false 完全不动”的硬失败
    - 当前问题已从“按钮第二步就死掉”收敛成“位置插补每步实际前进量仍明显小于 50mm”
- 混合动作回归：
  - `X+ -> RZ+ -> Y+`
  - 当前结果：
    - `afterX`: `[-1134.00,1319.34,-487.70]`
    - `afterRZ`: `[-1134.00,1319.34,-487.70]`
    - `afterY`: `[-1133.96,1320.08,-487.69]`
  - 结论：
    - 当前姿态保持链路依旧更稳定
    - 但连续平移尺度仍远小于目标 50mm，说明剩余主问题集中在“逐帧视觉位置 IK 的收敛尺度/目标逼近能力”

### 当前判断
- 现在主问题已经不是：
  - 大圆弧
  - 第二次点击直接完全失败
- 当前主问题更具体地收敛为：
  - 在真实 GLB 视觉 IK 下，`X/Y/Z` 的逐帧插补仍然过于保守
  - 位置目标没有被完整吃掉，导致一次 `50mm` 命令只前进了不到 `1mm`
  - 如果继续单纯放宽姿态误差权重，会重新引入明显姿态漂移，因此后续要更精细地区分“位置优先”和“姿态锁定”策略，而不是简单全局放宽参数

## 2026-06-17 - 位置插补根因继续缩小：第二次 X+ 失败不是 DH 主链长问题，而是视觉位置插补超时前还剩约 9mm

### 修改
- `src/hooks/useRobotKinematics.ts`
  - 将 `runCartesianAnimation()` 的位置控制分支改为：
    - 每一帧不再直接追逐整个终点残差
    - 而是从当前真实 GLB 法兰位姿，朝最终目标走一个小步
    - 如果该小步解不出来，再自动回退到更小的小步重试
  - 位置视觉插补不再沿用原先固定 `400ms` 到时就停的老条件
    - 增加视觉位置插补专用超时窗口
    - 优先以“真实位置/姿态是否到位”决定完成
  - 新增 `window.__ROBOT_DEBUG.getCartesianDebug()`
    - 可直接查看当前/上一段笛卡尔动画的：
      - 模式
      - 目标位姿
      - 剩余位置误差
      - 剩余姿态误差
      - 停机原因

### 本轮真实网页结论
- 第一次 `World 50mm X+`
  - 已能完整吃到接近 `50mm`
  - 停机原因：
    - `visual_target_reached`
  - 停止时剩余误差：
    - 位置约 `0.36mm`
    - 姿态约 `0.078°`
- 第二次 `World 50mm X+`
  - 目标应为：
    - `[-1035.02, 1319.31, -487.73]`
  - 实际停在：
    - `[-1044.41, 1317.98, -488.51]`
  - 调试接口返回：
    - `lastReason = visual_timeout_or_unsolved`
    - `remainingPosMm ≈ 9.37`
    - `remainingOriDeg ≈ 0.19`

### 关键判断
- 这说明当前主问题已经进一步缩小为：
  - 位置插补在中后段还不够积极
  - 不是姿态误差太大在主导失败
  - 也不是 DH 主链长一开始就把目标拉偏
- 因为在失败点：
  - 姿态误差已经很小（仅约 `0.19°`）
  - 真正没吃掉的是最后约 `9mm` 的位置残差
- 所以后续优化重点应该是：
  - 提升视觉位置插补中后段的位移吃入能力
  - 而不是继续全局放松姿态约束或盲目改链长

## 2026-06-17 - 位置步进再收敛：第二次 X+ 已可判完成，第三次剩余问题集中在中段位置推进量不足

### 修改
- `src/hooks/useRobotKinematics.ts`
  - 新增末段 `visual position-only fallback`
    - 当位置误差已进入小量级、姿态误差也较小时
    - 允许临时退化为“位置优先、姿态尽量保持”的视觉求解
  - 新增连续位置点击的姿态锁更新策略
    - 如果一次位置步进以“位置已到位”结束
    - 会把当前真实姿态更新为下一次位置步进的锁定姿态
    - 避免后续继续死磕更早之前的旧姿态

### 本轮真实网页回归
- 第一次 `World 50mm X+`
  - 结束位置：`[-1085.16, 1319.30, -487.75]`
  - `lastReason = visual_target_reached`
  - 剩余位置误差约 `0.36mm`
  - 剩余姿态误差约 `0.078°`
- 第二次 `World 50mm X+`
  - 结束位置：`[-1035.29, 1319.18, -487.79]`
  - 这次已不再记为失败
  - `lastReason = visual_target_reached`
  - 剩余位置误差约 `0.18mm`
  - 剩余姿态误差约 `3.00°`
- 第三次 `World 50mm X+`
  - 结束位置：`[-1030.93, 1315.79, -490.46]`
  - `lastReason = visual_timeout_or_unsolved`
  - 剩余位置误差约 `45.85mm`
  - 剩余姿态误差约 `0.36°`

### 最新判断
- 当前问题已不再是：
  - 第二次 `X+` 直接失败
  - 末段 `9mm` 收不进去
  - 旧姿态锁把后续步进拖死
- 当前剩余问题进一步收敛为：
  - 第三次及之后的 `X+`，位置推进在中段就明显衰减
  - 此时姿态误差很小，说明不是姿态锁定在主导失败
  - 真正该继续优化的是“中段位置推进量 / 步进策略 / 超时策略”

## 2026-06-17 - 中近段位置推进继续增强：第三次 X+ 的位置残差从约 17mm 压到约 12.5mm，但姿态误差仍偏大

### 修改
- `src/hooks/useRobotKinematics.ts`
  - 为视觉位置插补新增：
    - 中段 `midstep` 位置推进 fallback
    - 中近段 `nudge budget`
  - 目的：
    - 不改 DH 主参数
    - 只在第三次 `X+` 这种“前半段已经在收敛、但还差十几毫米时卡住”的场景下，增加少量位置推进能力

### 本轮真实网页回归
- 第一次 `World 50mm X+`
  - 仍稳定到位
  - 剩余位置误差约 `0.36mm`
- 第二次 `World 50mm X+`
  - 仍可判完成
  - 剩余位置误差约 `1.10mm`
  - 姿态尾差约 `3.18°`
- 第三次 `World 50mm X+`
  - 本轮结束位置：
    - `[-997.54, 1314.52, -490.79]`
  - 调试信息：
    - `remainingPosMm ≈ 12.55`
    - `remainingOriDeg ≈ 8.71`
    - `lastReason = visual_timeout_or_unsolved`

### 最新判断
- 这轮改动证明：
  - 中近段位置推进增强是有效的
  - 因为第三次 `X+` 的位置残差已从之前约 `17.27mm` 下降到约 `12.55mm`
- 但同时也暴露出新的约束：
  - 为了继续往前推进而加入的 `nudge` 让姿态误差重新抬高到了约 `8.7°`
  - 所以当前主问题已经不是“完全不往前走”，而是“位置还能继续收敛，但姿态约束和位置推进之间还没有达到最终平衡”

## 2026-06-17 - 补真实关节轴/节点标定日志：确认当前主问题更偏向坐标系与零位定义，而不是继续改链长

### 修改
- `src/components/GLBRobotArm.tsx`
  - 新增真实调试接口：
    - `window.__GLB_getCurrentDebugState()`
    - `window.__GLB_captureDebugStateForJoints(angles)`
  - 新增调试输出内容：
    - 每个关节 `Pivot_*` 的世界坐标
    - 每个关节配置轴在世界坐标中的真实方向
    - 当前法兰节点快照
  - 在零位标定报告 `__GLB_dumpCalibration()` 中补充：
    - `jointPivots`
    - `candidateDhFromPivots`
  - `candidateDhFromPivots` 会把相邻真实关节中心在前一关节局部坐标里分解为：
    - `localTranslationMm`
    - 候选 `a`
    - 候选 `d`
    - 候选 `alphaDeg`
    - 候选 `thetaOffsetDeg`

### 修改原因
- 现在纯 `X/Y/Z` 世界坐标直线运动已经基本正确，继续直接修改 `robot-config.ts` 的链长参数风险很高
- 需要先把真实 KUKA GLB 的：
  - 关节原点
  - 关节轴方向
  - 关节间局部平移分量
  全部打印出来，才能判断问题到底在：
  - `a/d`
  - `alpha`
  - `thetaOffset`
  - 还是基座坐标系与 DH 坐标系没有对齐

### 本轮浏览器标定结论
- 零位下真实世界关节轴向：
  - `J1/J4/J6` 轴基本沿世界 `+Y`
  - `J2/J3` 轴基本沿世界 `+X`
  - `J5` 轴基本沿世界 `-Z`
- 零位下由真实 pivot 推导出的候选局部分解显示：
  - `J2`: `localTranslation ≈ [354.2, 0, 53.1]`
  - `J3`: `localTranslation ≈ [940.5, 0, -3.0]`
  - `J4`: `localTranslation ≈ [88.6, 0, -699.3]`
  - `J5`: `localTranslation ≈ [272.1, 0, 1.5]`
  - `J6`: `localTranslation ≈ [196.7, 0, 43.5]`
- 这说明：
  - 关键主链长度 `354 / 940 / 705 / 272 / 201` 仍然基本成立
  - 但真实模型里还存在不能简单忽略的小 `d` / 局部偏置
  - 更重要的是，候选 `thetaOffsetDeg` 出现了大角度偏置，说明主矛盾仍然集中在零位定义和坐标系对齐层

### 回归验证
- 重新编译：
  - `tsc --noEmit --pretty false` ✅
- 真实网页再次回归 `World` 下单步 `50mm`：
  - 起点：`[-1134.80, 1319.30, -487.69]`
  - `X+` 后：`[-1134.03, 1319.34, -487.70]`
  - `Y+` 后：`[-1134.76, 1320.03, -487.67]`
  - `Z+` 后：`[-1134.83, 1319.32, -486.86]`
- 结论：
  - 本轮新增标定逻辑没有破坏现有已经收敛的真实直线运动链路
  - 当前问题已经从“盲调链长”进一步收敛为“真实 GLB 坐标系 / 零位 / 局部偏置辨识”

### 影响
- 现在可以直接在浏览器里查看：
  - 每个关节真实 pivot 位置
  - 每个关节真实世界轴向
  - 候选 DH 局部分解
- 后续如果继续做 DH 收敛，不需要再靠肉眼猜测或只看法兰末端轨迹
- 本轮没有修改 `src/lib/robot-config.ts`，避免再次把原本已经稳定的运动行为改坏

## 2026-06-17 - KUKA DH 对齐继续收敛：补内部调试接口，确认当前主问题集中在零位定义

### 修改
- `src/hooks/useRobotKinematics.ts`
  - 新增 `window.__ROBOT_DEBUG`
  - 暴露内部调试入口：
    - `getState()`
    - `moveDirection()`
    - `setCoordinateSystem()`
    - `setPosStep()`
    - `setRotStep()`
    - `goToJoints()`
    - `goToZero()`
    - `stopAnimation()`
  - 目的不是改功能，而是让浏览器自动化直接调用与真实按钮相同的位姿控制逻辑，避免 DOM 事件模拟误差污染回归结果
- `src/lib/ik-solver.ts`
  - 保留 `thetaOffset` 对 Jacobian 的参与
  - 补充当前 `dhTransform()` 约定说明，明确该项目使用的矩阵展开顺序
  - 重新核对后，未改动当前 Jacobian 轴索引基线，避免把原本可达的 `50mm` 工况误改成不可达

### 浏览器复测
- 通过 `window.__ROBOT_DEBUG` 直接切到工作姿态 `J=[0,-30,60,0,0,0]`
- 在 `World` 坐标、`50mm` 步进下连续调用 `X+`
- 当前基线下结果仍然表现为：
  - DH 位姿 `X` 基本按 `951.5 -> 1001.4 -> 1051.0 -> 1101.0 -> 1150.6 mm` 递增
  - 但 GLB 法兰世界坐标仍为：
    - `[-1.1348, 1.3193, -0.4877]`
    - `[-1.1488, 1.3152, -0.4872]`
    - `[-1.1621, 1.3138, -0.4823]`
    - `[-1.1748, 1.3148, -0.4737]`
    - `[-1.1868, 1.3180, -0.4621]`
  - 结论：视觉法兰轨迹仍不是单轴直线，仍存在弧线偏移

### 新确认的技术结论
- 本轮已经排除一个干扰项：
  - 先前怀疑 Jacobian 列索引错位，但结合 `dhTransform()` 的真实矩阵顺序重新推导后，确认当前轴索引基线不能直接改，否则会把原本可达的 `50mm` 工况改坏
- 当前最稳定的结论仍然是：
  - IK 主链路没有根本性错误
  - GLB 显示层当前基线不应再动
  - 链长 `a/d` 量级已与真实模型接近
  - 剩余误差高度集中在前几轴的零位定义 / `thetaOffset` / 轴系对齐层

### 影响
- 后续可以继续直接通过 `window.__ROBOT_DEBUG` 高频自动回归，不再依赖脆弱的按钮事件模拟
- 本轮没有引入新的外观替代方案，也没有再次移除 KUKA 工业机械臂模型
- 当前还没有完成最终 DH 参数收敛，后续应继续围绕前 3 轴零位定义做小范围验证

## 2026-06-17 - 新增真实法兰采样接口：开始用多姿态 GLB 数据直接约束 DH

### 修改
- `src/components/GLBRobotArm.tsx`
  - 新增 `window.__GLB_capturePoseForJoints(angles)`
  - 可直接输出任意关节角下真实 GLB 法兰的：
    - 世界位置
    - 四元数
    - 旋转矩阵
    - 缩放
- `src/types/robot.ts`
  - 为 DH 参数补充 `thetaSign?: 1 | -1`
- `src/lib/kinematics.ts`
  - 正运动学支持 `thetaSign`
- `src/lib/ik-solver.ts`
  - Jacobian 构造支持 `thetaSign`
- `src/lib/robot-config.ts`
  - 最终已回退到当前安全基线：
    - `thetaOffset` 仍全部为 `0`
    - `thetaSign` 仍全部为 `1`

### 本轮真实采样
- 采样了 11 组真实 GLB 法兰位姿，覆盖：
  - `J2/J3` 折叠变化
  - `J1` 正负回转
  - `J4/J5` 局部腕部变化
  - 两组混合姿态
- 结论：
  - 当前 DH 通过单一固定刚体变换对齐到 GLB 后，
    多姿态下法兰位置误差不是常量，而会随着 `J1~J4` 姿态明显变化
  - 这进一步证明剩余问题不是“场景坐标系整体偏了”，而是“关节定义层没完全对齐”

### 已验证并排除的候选
- 粗暴加入 `J2` 反向 + `J2/J3` 大偏置
  - 会把默认工作姿态对应的 DH 位姿明显拉坏
  - 已回退
- 单独给 `J3` 加 `-10° thetaOffset`
  - 多姿态法兰误差离线有一定下降趋势
  - 但真实网页中会把默认工作姿态数值显著拉偏
  - 已回退

### 当前最有价值的新判断
- 在不改变链长的前提下，单关节灵敏度扫描显示：
  - `J3 thetaOffset` 对多姿态法兰误差最敏感
  - `J2 thetaOffset` 次之
  - `J1` 的单独偏置几乎只会被整体刚体对齐吸收，不是首要矛盾
- 因此后续更值得继续收敛的顺序是：
  - `J3`
  - `J2`
  - 再考虑 `J4`

## 2026-06-17 - 位姿控制改为基于真实 GLB 法兰位置求解：世界坐标 50mm 连点显著收敛

### 修改
- `src/components/GLBRobotArm.tsx`
  - 修复 `__GLB_capturePoseForJoints()` 的副作用
  - 现在采样前会保存当前 Pivot 四元数，采样后恢复
  - 避免“仅做求解采样却把真实 KUKA 外壳偷偷留在候选姿态上”
- `src/hooks/useRobotKinematics.ts`
  - 新增基于真实 GLB 法兰的局部位置 IK：
    - `getGlbPoseForJoints()`
    - `estimateVisualPositionJacobian()`
    - `solveVisualPositionIK()`
  - `World/Tool` 下的位置按钮（`X/Y/Z`）现在优先按真实 GLB 法兰位置求解，不再只依赖偏掉的 DH 末端
  - `PositionTargetCard` 的绝对定位同样改为优先走真实 GLB 法兰位置求解
  - `glbPosition` / `endEffectorPose` / `__ROBOT_DEBUG.getState().poseMm`
    统一改为优先返回真实 GLB 法兰位姿，保证 UI 面板与真实机械臂外壳一致

### 关键修复效果
- 修复前：
  - `World + 50mm + 连续 X+`
    - 真实法兰会同时在其他轴上明显漂移，轨迹呈圆弧
- 修复后：
  - 真实法兰与 UI 位姿数值已经一致
  - `World + 50mm + 连续 X+` 真实回归：
    - `[-1134.8, 1319.3, -487.7]`
    - `[-1084.8, 1319.3, -487.7]`
    - `[-1034.9, 1319.4, -487.7]`
  - 结论：当前 `X+` 已经接近纯世界 `X` 轴直线推进

### 额外真实回归
- `World + 50mm + 连续 Y+`
  - 法兰 `Y` 主导增加
  - `X/Z` 漂移明显小于之前的大圆弧阶段
- `World + 50mm + 连续 Z+`
  - 法兰 `Z` 主导增加
  - `X/Y` 漂移同样明显缩小

### 当前剩余问题
- 虽然 `X/Y/Z` 的世界坐标直线性已经明显改善，但仍需要继续观察：
  - 连续长按时是否还存在残余抖动
  - 大步进、多次连续点按下是否会进入新的关节分支
  - 姿态按钮 `RX/RY/RZ` 仍主要沿原 DH 姿态链路工作，暂未切到视觉求解

## 2026-06-17 - 位置按钮改为真实法兰直线插补：过程轨迹也收敛到单轴运动

### 修改
- `src/hooks/useRobotKinematics.ts`
  - 位置按钮不再只做“先求终点，再关节缓动”
  - 改为：
    - 使用真实 GLB 法兰位姿作为当前位置
    - 生成世界坐标下的目标位置
    - 运动过程中按真实法兰做直线插补
    - 每帧使用视觉位置 Jacobian 做局部 IK 修正
  - `__ROBOT_DEBUG.getState().poseMm` 也改为优先返回真实 GLB 法兰位姿，方便自动化真实回归

### 过程轨迹真实采样
- `World + 50mm + 单次 X+`
  - 起点：`[-1134.8, 1319.3, -487.69]`
  - 中间采样：
    - `[-1126.04, 1319.43, -487.72]`
    - `[-1097.41, 1319.38, -487.71]`
    - `[-1085.24, 1319.34, -487.70]`
  - 结论：过程里也主要沿 `X` 方向推进，`Y/Z` 漂移已很小
- `World + 50mm + 单次 Y+`
  - 起点：`[-1134.8, 1319.3, -487.69]`
  - 终点：`[-1134.76, 1369.23, -487.67]`
  - 结论：主要沿 `Y` 方向推进
- `World + 50mm + 单次 Z+`
  - 起点：`[-1134.8, 1319.3, -487.69]`
  - 终点：`[-1134.85, 1319.35, -437.72]`
  - 结论：主要沿 `Z` 方向推进

### 长按真实采样
- `World + 50mm + 连续 X+`（每 `120ms` 连续触发）
  - `[-1134.8, 1319.3, -487.69]`
  - `[-1089.16, 1319.47, -487.72]`
  - `[-1035.10, 1319.56, -487.77]`
  - `[-985.20, 1319.64, -487.80]`
  - `[-935.36, 1319.70, -487.84]`
  - `[-885.81, 1319.77, -487.91]`
  - `[-836.31, 1319.86, -488.05]`
  - `[-786.35, 1319.87, -488.07]`
  - `[-736.51, 1319.93, -488.19]`
  - `[-686.61, 1319.95, -488.28]`
  - `[-636.65, 1319.95, -488.31]`
- 结论：
  - 连续长按下已不再出现之前那种明显圆弧
  - 真实法兰基本稳定沿 `X` 轴推进
  - `Y/Z` 仅剩小量级残差

## 2026-06-17 - 姿态按钮恢复：RX/RY/RZ 现在可动且法兰位置基本稳定

### 修改
- `src/hooks/useRobotKinematics.ts`
  - 新增真实 GLB 法兰 6D 视觉 IK：
    - `estimateVisualPoseJacobian()`
    - `solveVisualPoseIK()`
  - `RX/RY/RZ` 不再走旧 DH 姿态链路，而是改为基于真实法兰位姿求解

### 姿态按钮真实回归
- `RX +10°`
  - 起点：`[-1134.8, 1319.3, -487.69]`
  - 终点：`[-1134.74, 1319.62, -487.82]`
  - 姿态从约 `-59.26°` 变化到 `-49.95°`
- `RY +10°`
  - 起点：`[-1134.8, 1319.3, -487.69]`
  - 终点：`[-1135.24, 1318.89, -487.32]`
  - 法兰位置仅小量级漂移
- `RZ +10°`
  - 起点：`[-1134.8, 1319.3, -487.69]`
  - 终点：`[-1134.6, 1319.05, -487.47]`
  - `RZ` 已接近目标增量

### 当前新增发现
- 纯平移时，真实法兰轨迹已经基本按世界坐标单轴推进
- 纯旋转时，真实法兰位置也已基本稳定
- 但混合序列测试（`X+ -> RZ+ -> Y+`）显示：
  - 位置控制过程中姿态还会有可见漂移
  - 这说明“位置按钮的真实法兰 IK”目前仍然偏向位置优先，没有完全把当前姿态锁死
- 因此最终剩余主问题已进一步收敛为：
  - 继续收紧“平移时的姿态保持”

## 2026-06-16 - KUKA 模型真实标定复测：链长接近，主要误差不在纯长度

### 修改
- `src/components/GLBRobotArm.tsx`
  - 新增 `__GLB_CALIBRATION` / `__GLB_dumpCalibration()` 调试接口
  - 输出 KUKA 零位下各关节节点、关键 mesh、法兰位置、相邻关节距离
  - 恢复并保留 KUKA 外观显示，不再使用 DH 几何替代
  - 修正显示驱动关节轴：`大臂/小臂 -> X`，`回转机构 -> Z`
- `src/types/robot.ts`
  - 为 DH 参数结构补充 `thetaOffset`
- `src/lib/kinematics.ts`
  - 正运动学支持 `thetaOffset`
- `src/lib/ik-solver.ts`
  - Jacobian 构造支持 `thetaOffset`
- `src/lib/robot-config.ts`
  - 保留当前链长标定值：
    - `joint1.d = 459`
    - `joint2.a = 354`
    - `joint3.a = 941`
    - `joint4.d = 705`
    - `joint5.a = 272`
    - `joint6.d = 201`
  - 试验性 `thetaOffset` 已撤回，避免污染当前零位

### 标定结果
- 零位真实相邻距离（mm）：
  - 基座->转台 `330.2`
  - 转台->大臂 `358.2`
  - 大臂->小臂 `940.5`
  - 小臂->回转机构 `704.9`
  - 回转机构->末端关节 `272.1`
  - 末端关节->快拆法兰 `201.4`
- 其中与 DH 直接对应的关键链长：
  - `J2.a ≈ 353.7`
  - `J3.a ≈ 940.5`
  - `J4.d ≈ 704.9`
  - `J5.a ≈ 272.1`
  - `J6.d ≈ 201.4`

### 结论
- 仅从真实节点距离看，当前 `a/d` 链长已经非常接近 KUKA 模型
- 继续只调长度参数不会有效消除 `World + 50mm + 连点 X+` 的法兰弧线偏移
- 当前剩余主要误差更像是：
  - 真实模型零位定义与数学零位不一致
  - 或者某些关节旋转轴 / 扭转角约定与当前 DH 轴系还有偏差
  - 用 `motor004 / 小臂电机` 节点替代 `大臂 / 小臂` 节点去重定义 `joint2.a / joint3.a`
    的试验已验证不可直接采用：
    虽然得到约 `262 / 912 mm` 的候选长度，但它会显著拉偏默认位姿数值，且 `50mm X+`
    连点时法兰弧线没有明显改善，因此该方案已回退
  - 基于法兰微分位移直接重写 `GLBRobotArm` 显示层关节轴映射的试验同样不可直接采用：
    会导致 KUKA 整机姿态明显失真，`X+/Y+/Z+` 连点轨迹整体更差，因此也已回退

### 浏览器复测
- 当前恢复后的 KUKA 外观正常
- `World + 50mm + 连续 X+` 时：
  - 位姿面板仍按 `951.5 -> 1001.4 -> 1051.4 -> 1101.4 -> 1151.4 mm` 递增
  - 但法兰世界坐标仍伴随其他轴变化，说明视觉末端轨迹仍未完全对齐 DH 世界坐标直线

## 2026-06-16 - 50mm 连点仍画圆弧：移除 GLB 关节映射依赖，改为 DH 直接渲染

### 问题
用户反馈在 `World` 坐标系、`50mm` 步进下连续点击 `X+` 时，机械臂末端视觉轨迹仍然是圆弧。

### 根因
- `src/hooks/useRobotKinematics.ts` 中 DH 位姿数值已经按世界坐标线性递增。
- 但原 `src/components/GLBRobotArm.tsx` 的 GLB 枢轴层级与 DH 关节原点/轴向并不严格一致，导致“逆解数学结果正确、视觉机械臂仍然走弧线”。
- 这不是继续微调单个关节轴就能稳定解决的问题，属于视觉模型和运动学模型分叉。

### 修复
- 新增 `src/components/DHKinematicRobotArm.tsx`
  直接用 DH 正运动学帧渲染机械臂连杆、关节和末端工具，不再依赖 GLB 关节层级做运动可视化。
- 修改 `src/components/RobotScene.tsx`
  将 3D 机械臂从 `GLBRobotArm` 切换为 `DHKinematicRobotArm`。
  同时统一 DH → 场景坐标变换，让法兰采样、箱子显示与位姿面板使用同一套空间定义。

### 验证
- `tsc -b --pretty false` ✅
- 浏览器自动化复测：
  `World + 50mm + 连续 X+` 时，位姿 `X` 从 `835 → 885 → 934 → 984 → 1034` 线性增加。
  同时法兰世界坐标 `X` 从 `0.835 → 0.885 → 0.934 → 0.984 → 1.034` 同步线性增加，其余轴仅剩极小误差，不再出现大幅圆弧偏移。
  `World Y+ / Z+`、`Tool X+ / Y+ / Z+` 单击均可响应。
  `World + 50mm + 长按 X+` 时，法兰世界坐标连续前进，无明显抖动或大幅侧向漂移。

### 影响
- 机械臂视觉轨迹现在与 DH/IK 数学链路强一致，不再出现“数值正确但模型画圆弧”的分叉。
- 代价是当前 3D 机械臂外观改为 DH 直接渲染的几何模型，而不是 KUKA GLB 外壳。

## 2026-06-16 - 位姿控制逆解修复：世界坐标直线插补 + GLB关节基准姿态保留

### 问题
位姿控制下机械臂不是按世界坐标直线运动，而是出现弧线和抖动；长按时问题更明显。

### 根因
- `src/hooks/useRobotKinematics.ts`
  位置按钮原来是“只解终点 IK，再做关节空间缓动”，末端天然会走关节空间弧线，不是笛卡尔直线。
  位置移动还调用了 `solvePositionOnlyIK`，没有锁定当前姿态，导致末端在移动时姿态自由漂移。
  长按时目标按当前姿态反复累计，工具坐标方向基准会漂。
- `src/components/GLBRobotArm.tsx`
  GLB 枢轴节点本身带初始旋转，但 `applyJointAngles()` 每次直接覆盖为 `setFromAxisAngle(...)`，破坏了模型原始局部坐标系，导致视觉轨迹进一步偏弯。

### 修复
- `src/hooks/useRobotKinematics.ts`
  新增笛卡尔位姿插补：单击位姿控制改为“中间位姿逐帧 IK”而不是“终点关节缓动”。
  位置移动统一改为 `solveIK()`，默认锁定当前姿态，消除位置移动时的姿态漂移。
  长按位置移动改为笛卡尔目标跟踪，并固定长按会话中的工具坐标旋转基准，减少方向漂移和抖动。
  `goToPosition()` 同样锁定当前姿态，行为与位姿控制保持一致。
- `src/components/GLBRobotArm.tsx`
  为每个 Pivot 保存原始 `baseQuaternion`，应用关节角时在原始局部朝向上叠加旋转，而不是覆盖原始朝向。
- 同步清理本次编译过程中发现的低风险 TypeScript 报错：
  `src/App.tsx`
  `src/components/PositionTargetCard.tsx`
  `src/components/camera/CameraModel.tsx`
  `src/components/camera/CapturePanel.tsx`
  `src/components/RobotScene.tsx`
  `src/components/sequence/SequenceEditor.tsx`
  `src/components/sequence/SequenceStepList.tsx`
  `src/components/sequence/SequenceStepParams.tsx`
  `src/hooks/useActionSequence.ts`

### 验证
- `tsc -b --pretty false` ✅
- 浏览器自动化回归：
  `World X+` 连续单击时，位姿从 `835.1 → 838.1 mm` 线性递增，`Rx/Ry/Rz` 保持稳定。
  `World X+` 长按时，位姿持续前进且姿态不再漂移。
  `World Y+ / Z+ / RZ+` 单击可正常响应。
  `Tool X+` 单击可沿工具坐标方向运动。

### 影响
- 位姿控制现在优先满足“世界/工具坐标下的笛卡尔运动直觉”，不再默认走关节空间弧线。
- GLB 视觉模型与 DH 求解结果的一致性明显提升。
- 仍建议继续观察 `Tool Y+` 等特殊姿态下的工具坐标响应，这部分已进入可复现、可继续细调的状态。

## 2026-06-16 - IK 跳变修复：refs 初始值修正

### 问题
点击方向按钮时机械臂会从当前位置瞬间跳到全伸展位姿（X=1432mm），跳跃 ~600mm。

### 根因
`useRobotKinematics.ts` 中 `jointsRef` 和 `displayJointsRef` 初始化为 `[0,0,0,0,0,0]` 而非 `DEFAULT_JOINTS`（`[0,-30,60,0,0,0]`）。
GLB 模型异步加载 + React 严格模式双重挂载时，`useEffect` 更新 refs 可能晚于用户首次点击，
此时 IK 求解器从零关节位姿出发，收敛到完全错误的配置。

### 修复
- `src/hooks/useRobotKinematics.ts`: `jointsRef` 和 `displayJointsRef` 初始值改为 `DEFAULT_JOINTS`
- `src/lib/ik-solver.ts`: 清理调试日志（无功能变化）

### 验证
- `npm run build` ✅
- `npx vitest run src/lib/ik-solver.test.ts` ✅ 4 passed
- 浏览器手动测试：50mm 步进 × 5 次 X+，X 835→1085，每次精准 +50mm，无跳变

## 2026-06-16 - 全面可访问性 (Accessibility) 修复

### 修改内容

#### 1. `index.html`
- `lang="en"` → `lang="zh-CN"`（应用语言中文）
- `<title>` 改为 "6F Robot 机械臂仿真平台"

#### 2. `src/App.css`
- 移除 Vite 默认 `#root` 冲突样式（`max-width`, `margin`, `padding`）
- 新增 `prefers-reduced-motion` 媒体查询，尊重用户减少动效偏好

#### 3. `src/components/ViewportHUD.tsx`
- 所有按钮添加 `focus-visible:ring-2` 焦点环
- 显示开关按钮添加 `aria-pressed` 明确开关状态
- 视角按钮添加 `aria-hidden` 装饰性图标

#### 4. `src/components/WaypointPanel.tsx`
- 记忆点名称输入框添加 `aria-label` 和 `id`
- "设为原点" 图标按钮添加 `aria-label`
- 删除图标按钮添加 `aria-label` 和 `title`
- 删除操作前添加 `confirm()` 二次确认
- 跳转按钮添加焦点环

#### 5. `src/components/LongPressButton.tsx`
- 新增 `'aria-label'` prop 支持，透传至 `<button>` 元素

#### 6. `src/components/ControlPanel.tsx`
- Tab 按钮实现 `role="tablist"` / `role="tab"`、`aria-selected`、`aria-controls`
- Tab 状态持久化到 URL query string（`?tab=camera`）
- 控制面板宽度添加响应式（`w-full md:w-[360px]`）
- Tab 按钮添加焦点环

#### 7. `src/components/DHParamOverlay.tsx`
- `<table>` 添加 `aria-label` 和 `<caption className="sr-only">`

#### 8. `src/components/PositionTargetCard.tsx`
- X/Y/Z 输入框添加 `<label>` 关联、`aria-label`、`onKeyDown` Enter 提交
- "运动到此点" 按钮添加 `aria-live="polite"` 和动态 `aria-label`
- "填入" 按钮和 Go 按钮添加焦点环
- "加载中…" 使用省略号字符 `…`
- 修复 feedback timeout 竞态（使用 ref 存储）

#### 9. `src/components/JointAngleCard.tsx`
- 折叠按钮添加 `aria-expanded` 和焦点环

#### 10. `src/components/PoseControlCard.tsx`
- 折叠按钮添加 `aria-expanded` 和焦点环

#### 11. `src/components/DirectionButton.tsx`
- `transition-all` → `transition-colors`（仅动画变化属性）
- 添加焦点环

#### 12. `src/components/StepValueSelector.tsx`
- 步进按钮添加焦点环

#### 13. `src/components/ToolCard.tsx`
- `<select>` 添加 `<label>` 关联
- 折叠按钮添加 `aria-expanded` 和焦点环

#### 14. `src/components/DataOverlay.tsx`
- 折叠按钮添加 `aria-expanded` 和焦点环

#### 15. `src/components/StatusBar.tsx`
- 错误状态文案增加解决指引：
  - "接近奇异，精度下降" → "接近奇异点，精度可能下降。尝试微调关节角度"
  - "目标不可达" → "目标不可达 — 请检查目标位置是否在工作空间内"
  - "目标超出关节范围" → "目标超出关节范围 — 请调整目标位置"
  - "关节超限" → "关节超限 — 请重置关节角度"

#### 16. `src/components/Toolbar.tsx`
- 所有按钮添加焦点环

#### 17. `src/components/camera/CameraParamsCard.tsx`
- 所有 `<input>` 添加 `aria-label`
- "近/远" 标签添加 `title="近裁剪面/远裁剪面"` 说明
- 步进选择按钮添加焦点环

#### 18. `src/components/camera/CapturePanel.tsx`
- 大图查看关闭按钮添加 `aria-label="关闭"`
- "正在渲染..." → "正在渲染…"（省略号字符）
- 拍照按钮禁用时在按钮内嵌 spinner 而非外部文字
- 加载状态增加最小展示时长 ~300ms（`MIN_LOADING_MS`）
- 图片预览实现键盘可访问：添加 `tabIndex={0}`、`role="button"`、Enter/Space 键触发
- step 按钮添加焦点环

#### 19. `src/components/camera/DemoPartsCard.tsx`
- 数量/尺寸输入添加 `<label htmlFor="...">`
- "清除" 按钮添加 `confirm()` 二次确认
- 按钮添加焦点环

#### 20. `src/components/sequence/SequenceEditor.tsx`
- "清空" 序列按钮添加 `confirm()` 二次确认

### 设计原则
- 所有可交互元素统一使用 `focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none` 提供可见焦点环
- 所有 `<input>` 通过 `<label htmlFor>` 或 `aria-label` 关联标签
- 破坏性操作（删除、清空）增加 `confirm()` 二次确认
- UI 状态（Tab）通过 URL SearchParams 持久化
- 遵循"最简原则"，不引入新依赖，不破坏现有功能

## [2026-05-07] 教学模式设计文档 v5.2 — ASCII → 组件化样式描述

### 修改
- `docs/TeachingMode_Design.md` v5.2 — 全局替换 ASCII 框线面板为 Tailwind CSS 组件化样式描述
- v5.1→v5.2 改动：
  - 新增 UI 样式系统章节：定义布局/卡片/文字/交互/状态色/浮层共 6 类 token，全文引用
  - 所有 ~60 个 ASCII 面板替换为结构化组件描述（组件名 + Tailwind 类名 + 内容说明）
  - 新增 DataFlowPanel 组件：深色终端风格数据流追踪面板
  - 阶段 2B 实验步骤改为 3 张独立卡片布局
  - 阶段 3B 三种图像改为独立卡片 + 深度图内嵌说明块
  - 课程总结数据流图改为三列卡片布局（相机感知/坐标转换/机械臂执行），卡片间 → 连接
  - 所有样式描述与现有代码库中的 Tailwind 类名一致

## [2026-05-07] 教学模式设计文档 v5.1 — 新增算法直觉层

### 修改
- `docs/TeachingMode_Design.md` v5.1 — 在 5 个位置加入算法直觉解释
- v5.0→v5.1 改动：
  - 阶段 1 知识点区：新增 DH 参数与 FK 链式计算说明（4 参数 × 6 关节 = 24 个几何量 → 末端位姿）
  - 阶段 2A 左面板：新增 IK 迭代循环过程（①FK得当前位置→②算差距→③微调关节→④重复）
  - 阶段 2A 状态提示：奇异点几何直觉（所有关节旋转方向垂直于运动方向）
  - 阶段 3B 深度图区：针孔投影与深度补偿（3D→2D丢失Z，深度图补回）
  - 阶段 4B 数据流面板：三层坐标系变换链（相机系→世界系→IK求解→FK验证→执行）

## [2026-05-07] 教学模式设计文档 v5.0 — 全局语气重写

### 修改
- `docs/TeachingMode_Design.md` v5.0 — 从课堂授课风格改为自主学习软件文档风格
- v4.2→v5.0 改动：
  - "学时"→"章"，"学生"→"用户"，"教师"引用全部移除
  - 删除"下节课揭晓""试试看""想一想""你知道吗"等低龄化口语
  - 删除"恭喜""欢迎"等课堂用语
  - "今天你学会了"→"本章要点"，"上次我们学会了"→"上一章要点"
  - 章节衔接从"预告"改为客观技术描述
  - 4B 数据流关键节点从"教师暂停"改为"暂停观察数据面板"
  - 全程使用准确技术术语（FK/IK/坐标系/深度图/世界坐标等），首次出现给出直觉解释

## [2026-05-07] 教学模式设计文档 v4.2 — 修复教学脉络漏洞

### 修改
- `docs/TeachingMode_Design.md` v4.2 — 从学生视角审查后修复 5 个漏洞
- v4.1→v4.2 改动：
  - 阶段 4B 左面板重写：每一步显示"数据从哪来、到哪去"（深度图→世界坐标→IK→执行）
  - 4B 新增②→③之间的关键连接点：教师暂停展示"相机坐标→世界坐标"转换
  - 阶段 1 新增"为什么是 6 个关节"：前 3 管位置 + 后 3 管朝向
  - 阶段 3A 新增"相机位置=翻译器"概念：相机坐标+相机世界位置=物体世界坐标
  - 阶段 3B 深度图部分新增"距离→3D坐标→IK输入"的显式连接
  - 阶段 2B 结尾新增相机坐标系预告
  - 阶段 3 结尾新增"手眼系统"直觉总结
  - 课程总结面板加入完整数据流架构图（相机→电脑→机械臂）
  - 清除 v4.1 删除挑战任务后残留的文字

## [2026-05-07] 教学模式设计文档 v4.1 — 删除挑战任务，精简收尾

### 修改
- `docs/TeachingMode_Design.md` v4.1 — 简化阶段 4 收尾
- v4→v4.1 改动：
  - 删除阶段 4C 全部挑战任务（★改参数/★★加步骤/★★★随机抓取/★★★★自编序列）
  - 阶段 4A 从 8min→10min，阶段 4B 从 10min→20min，每步执行+讨论时间更充裕
  - 4B 增加 6min 全流程知识复盘，明确每步用到了前面学的哪个概念
  - 课程总结从 6min→12min，8 步执行完即显示总结
  - 实现工作量从 6 天→5 天

## [2026-05-07] 教学模式设计文档 v4.0 — 拆分为 4 学时

### 修改
- `docs/TeachingMode_Design.md` v4.0 — 从 2 学时(87min)拆分为 4 学时(180min)
- v3→v4 核心改动：
  - 每学时 45min × 4 = 180min，每个阶段有充裕时间消化概念
  - 新增学时节奏设计：前 3min 回顾+预告 → 38min 核心教学 → 4min 回顾+预告
  - 阶段 1 自由探索从 3min 扩展到 14min（含思考讨论环节）
  - 阶段 2A 从 10min 扩展到 18min（含粗调-精调-姿态-总结四步骤）
  - 阶段 2B 从 10min 扩展到 20min（含 3 个动手实验）
  - 阶段 3A 从 15min 扩展到 22min（位置/朝向/镜头分组教学，每轴 2min）
  - 阶段 3B 从 10min 扩展到 16min（三种图像各有充分时间）
  - 阶段 4C 从 12min 扩展到 18min（4 个挑战从★到★★★★）
  - 新增 SessionReview/SessionPreview 组件设计
  - 新增 CourseSummary 课程总结页 + 实验截图

## [2026-05-07] 教学模式设计文档 v3.0 — 补齐知识缺口

### 修改
- `docs/TeachingMode_Design.md` v3.0 — 基于已有 UI 实现全面重写，补齐 6 大知识缺口
- v2→v3 核心改动：
  - 新增 FK/IK/坐标系概念阶段（关节空间 vs 笛卡尔空间）
  - 相机阶段从 2 参数扩展到全部 6DOF + FOV + near/far + 分辨率 + 三种图像类型
  - 阶段 4 整合动作编排系统，用序列编辑器完成抓取
  - 新增第三章"UI 元素 → 知识点 → 教学阶段"映射表
  - 新增第九章"知识体系对照表"
  - 每阶段明确标注对应的已有 UI 元素文件名
  - 阶段数从 5 个重组为 5 个但内容完全重组（87 分钟）

## [2026-05-07] 新增教学模式设计文档

### 新增
- `docs/TeachingMode_Design.md` — 面向零基础初学者的机器人实验课设计文档 v2.0
- 涵盖：导览认识设备 → 关节控制 → 目标定位 → 相机视野 → 完整抓取流程 五个阶段
- 每个阶段含：左面板 UI 设计、3D 场景行为、完成判定逻辑
- 与现有自由模式解耦，通过 toggle 切换

## [2026-05-06] 相机地面投影 + 演示零件掉落

### 新增
- `src/lib/camera-ground.ts` — 相机视锥体与 Y=0 地面交线计算工具函数
- `src/components/camera/CameraGroundProjection.tsx` — 相机视野地面投影虚线框组件（含半透明填充）
- `src/hooks/useDemoParts.ts` — 演示零件状态管理 hook（视野内随机生成、清除）
- `src/components/camera/DemoPartsCard.tsx` — 演示零件控制面板（数量输入、生成、清除按钮）
- `src/components/camera/DemoPartsRenderer.tsx` — 零件 3D 渲染组件（独立 useFrame 重力物理）

### 修改
- `RobotScene.tsx` — 集成 CameraGroundProjection、DemoPartsRenderer
- `ControlPanel.tsx` — 相机 tab 新增 DemoPartsCard
- `App.tsx` — 引入 useDemoParts hook 并传递 props

### 功能
- 视锥体投影：地面虚线框 + 浅蓝半透明填充，距离不够地面时不显示
- 演示零件：球/立方体/圆柱/六棱柱随机类型，6 色随机，视野内圈 80% 随机位置
- 物理：0.5-1.5m 随机高度掉落，重力 9.8m/s²，静止在地面

---

## [2026-04-29] 新增眼在手外相机系统需求文档

### 新增
- `docs/MVP_RobotCameraSystem.md` — 相机系统的完整需求文档
- 文档涵盖：UI Tab分离设计、相机3D模型表示、参数控制面板、拍照渲染引擎（彩色+分割）、演示工件场景

### 修正
- 修复旋转顺序矛盾：统一使用 Three.js 默认 XYZ 顺序（原文档同时描述了 XYZ 和 ZYX 两种顺序，自相矛盾）
- 修正 Segment 调色板：>12 个物体时循环使用
- 补充分割颜色映射表的 UI 显示位置说明
- 增加 DemoObjects 组件到文件结构清单

## [2026-04-29] 更新 MVP_RobotArmKinematics.md 与实际代码同步

### 修改
- `docs/MVP_RobotArmKinematics.md` 全面重写为 v3.0，从设计文档更新为实际实现文档
- 修正技术栈：Vite 7 + React 19 + Hono（原 Next.js 14）
- 增加 GLB模型加载/关节构建/工具管理/IK回退等实际功能描述
- 移除已废弃的 jointLimitProtection/singularityDetection 开关设计
- 更新 DH 参数为 KUKA_LIKE、初始姿态、模型缩放比例
- 更新文件结构为 Vite 项目实际结构

## [2026-04-29] 新增末端工具管理卡片/GLB内置工具节点显隐

### 修改
- `ToolCard` 组件重写：下拉菜单动态显示从 GLB 扫描到的工具节点名，当前为 `吸盘`
- `GLBRobotArm`：新增 `selectedTool`/`onToolList` prop；加载后自动扫描 `快拆机器人端口` 下的子节点作为工具列表上报；`selectedTool` 变化时切换对应工具节点的 `visible`
- `RobotScene`：透传 `selectedTool`/`onToolList`
- `useRobotKinematics`：新增 `toolList` state，`setToolList` 接收 GLBRobotArm 上报的工具列表
- `ControlPanel`/`App`：透传 `tools`/`selectedTool`/`onToolList` props
- 效果：选择"无"隐藏所有工具，选择"吸盘"显示吸盘模型

## [2026-04-29] 移除关节限位保护/奇异点检测开关，内置保护与检测

### 修改
- 移除 `PoseControlCard` 中的"安全开关"复选框（关节限位保护、奇异点检测）
- 移除 `ControlPanel` / `App` 中相关 prop 传递
- `useRobotKinematics`：移除 `jointLimitProtection`、`singularityDetection` state 及 setter
- 关节限位保护始终开启：IK 结果接近限位边界时标记 `jointLimited` 警告
- 实现奇异点检测：计算 Jacobian JJ^T 可逆性，不可逆时标记 `nearSingularity` 警告
- 从 `@/lib/ik-solver` 导入 `computeJacobian`

## [2026-04-29] DataOverlay 展开/折叠

### 修改
- `DataOverlay` 新增 `showPose` / `showJoints` 两个状态，"当前位姿"和"关节角度"各自独立折叠/展开
- 默认均展开，折叠图标复用 `ChevronUp`/`ChevronDown`

## [2026-04-29] 修复视角切换按钮无效，加入镜头过渡

### 问题
`cameraPosition` prop 仅在 Canvas 初始化时读取，切换后不更新相机位置。

### 修改
- `RobotScene`/`SceneContent` 接收 `cameraPosition`，使用 `useEffect` + `requestAnimationFrame` 做 400ms easeInOutCubic 平滑过渡
- 简化 `SceneContent` 类型，不再 Omit `cameraPosition`

## [2026-04-29] 修复轨迹线缩放不匹配问题

### 问题
轨迹线使用FK计算坐标 + SCENE_SCALE(0.001)缩放，与模型的缩放链(KUKA_6D×MODEL_SCALE)不匹配，导致轨迹线位置偏移。

### 修改方案
轨迹线改为从模型末端法兰节点(`快拆机器人端口`)直接读取世界位置，跳过所有缩放/坐标转换，确保轨迹始终在法兰位置。

### 修改文件
- `src/components/GLBRobotArm.tsx` — 新增 `onTrajectoryPoint` 属性，关节更新后读取末端世界位置回调
- `src/components/RobotScene.tsx` — 透传 `onTrajectoryPoint`，移除 `SCENE_SCALE`/`dhPosToThreeJS`，轨迹线直接使用场景空间坐标
- `src/hooks/useRobotKinematics.ts` — 移除FK-based轨迹记录useEffect，新增 `addTrajectoryPoint` 回调
- `src/App.tsx` — 传入 `robot.addTrajectoryPoint`

---

## [2026-04-28] 替换为KUKA官方GLB模型

### 修改概述
将项目中程序化生成的机械臂3D模型替换为KUKA官方GLB模型，所有关节参数根据模型节点动态计算。

### 新增文件
- `public/models/KUKA_V1.glb` — KUKA官方GLB模型文件（约4MB）
- `src/components/GLBRobotArm.tsx` — 机械臂组件，负责加载GLB并构建可动关节层级

### 修改文件
- `src/components/RobotScene.tsx` — 简化，移除所有程序化几何体生成代码，改用GLBRobotArm
- `src/App.tsx` — 调整相机位置为新尺度

### 删除内容
- `LinkCylinder` `JointAxis` `ShoulderHousing` `RobotArm` 等程序化几何体组件
- `CameraController`、`dhVecToThreeJS`、`computeJointTransforms` 不再需要的函数
- `config`、`coordinateSystem` 从RobotSceneProps移除

### 技术要点
- 动态遍历场景节点按名称识别6个关节，参数动态匹配无硬编码
- MODEL_SCALE=0.1缩放模型，SCENE_SCALE=0.001转换DH参数(mm)→场景(米)
- 基座底部通过模型包围盒自动对齐原点
- 关节旋转轴：J1=Z, J2=X, J3=X, J4=Z, J5=Y, J6=Z

---

## 移除Kimi OAuth鉴权系统

## 删除文件

- `api/kimi/` — 整个目录（auth.ts, session.ts, platform.ts, types.ts）
- `api/auth-router.ts` — 认证 tRPC 路由（me, logout）
- `api/queries/users.ts` — 用户数据库查询（findUserByUnionId, upsertUser）
- `api/lib/cookies.ts` — Cookie 安全选项
- `src/pages/Login.tsx` — Kimi OAuth 登录页
- `src/pages/Home.tsx` — 未使用的首页stub
- `src/pages/NotFound.tsx` — 未使用的404页
- `src/hooks/useAuth.ts` — 前端鉴权 hook
- `src/components/AuthLayout.tsx` — 认证布局
- `src/components/AuthLayoutSkeleton.tsx` — 认证骨架屏
- `src/const.ts` — LOGIN_PATH 常量
- `contracts/constants.ts, errors.ts, types.ts` — 不再被引用的合约

## 修改文件

- `api/middleware.ts` — 移除 requireAuth, requireRole, authedQuery, adminQuery，只保留 createRouter + publicQuery
- `api/context.ts` — 简化为无用户上下文的纯请求上下文
- `api/router.ts` — 移除 auth 子路由
- `api/boot.ts` — 移除 GET /api/oauth/callback 路由
- `api/lib/env.ts` — 移除 APP_ID, APP_SECRET, KIMI_AUTH_URL, KIMI_OPEN_URL, OWNER_UNION_ID，只保留 DATABASE_URL
- `db/schema.ts` — 移除 users 表，移除 robotConfigs/robotWaypoints 的 userId 列
- `src/main.tsx` — 移除 BrowserRouter（不再需要路由）
- `src/providers/trpc.tsx` — 移除 credentials: "include"

## 影响

- 编译通过，构建成功
- 所有 tRPC 接口现为公开，无需登录即可使用
- 记忆点管理不再绑定用户
- .env 文件不再需要 Kimi OAuth 相关变量，只需 DATABASE_URL
## [2026-06-17] 位姿控制改为纯位置视觉插补，去除世界坐标平移的姿态锁污染

### 修改
- `src/hooks/useRobotKinematics.ts`
- 为笛卡尔插补新增 `preserveOrientation` 开关，支持“纯位置视觉插补”与“带姿态保持”的两条路径
- `X/Y/Z` 位移按钮默认改为 `useVisualPositionIK: true + preserveOrientation: false`
- 世界/工具坐标下的位置平移不再自动复用 `positionOrientationLockRef` / `positionOrientationRotationLockRef`
- `runCartesianAnimation()` 在纯位置模式下只使用 `solveVisualPositionOnlyIK()` 逐帧逼近位置目标，不再进入 orientation 恢复阶段
- 纯位置模式完成条件改为仅检查位置误差，调试原因新增 `visual_position_only_started` / `visual_position_only_step` / `visual_position_target_reached`

### 原因
- 真实页面回归已经反复证明：当前 KUKA GLB 的主链 `a/d` 长度基本贴近实物，连续 `World X+ 50mm` 画圆弧的主因不是“再改一轮连杆长度”，而是“平移阶段仍然强绑姿态锁”，导致第二步开始出现位置与姿态的冲突收敛
- 在 DH 映射层尚未完全对齐前，世界坐标平移应先保证“按世界直线移动”，不能让姿态恢复逻辑继续污染 DH 参数判断

### 真实页面回归
- 稳定联调页：`http://localhost:18081/?tab=robot` 的可控 tab（另一个重复 tab 已确认会卡死，不参与结果判断）
- 基准姿态：`J=[0,-30,60,0,0,0]`
- `World X+ 50mm` 连续 3 次：
- 第 1 次后位置约 `[-1084.87, 1319.30, -487.92]`，剩余位置误差 `0.088mm`
- 第 2 次后位置约 `[-1034.94, 1319.37, -487.94]`，剩余位置误差 `0.099mm`
- 第 3 次后位置约 `[-985.02, 1319.43, -487.97]`，剩余位置误差 `0.104mm`
- `World Y+ 50mm` 连续 3 次：
- 第 1 次后位置约 `[-1134.76, 1369.18, -487.88]`，剩余位置误差 `0.088mm`
- 第 2 次后位置约 `[-1134.71, 1419.12, -487.86]`，剩余位置误差 `0.073mm`
- 第 3 次后位置约 `[-1134.68, 1469.06, -487.84]`，剩余位置误差 `0.067mm`
- `World Z+ 50mm` 连续 3 次：
- 第 1 次后位置约 `[-1134.83, 1319.28, -437.91]`，剩余位置误差 `0.045mm`
- 第 2 次后位置约 `[-1134.86, 1319.31, -387.92]`，剩余位置误差 `0.042mm`
- 第 3 次后位置约 `[-1134.88, 1319.33, -337.93]`，剩余位置误差 `0.037mm`

### 影响
- 世界坐标位置点按已经不再出现之前那种“第一步好、第二步开始画圆弧”的行为
- 这轮修改优先修复了真实操作路径；`robot-config.ts` 的主链长度未再盲改，原 KUKA GLB 外观保持不变
- 目前剩余的 DH 问题收敛为“GLB 几何坐标到当前 DH 约定的映射层”，重点应继续放在 `thetaOffset / thetaSign / alpha` 与零位基坐标对齐，而不是再随意改 `a/d`

## [2026-06-17] 新增 DH/GLB 逐关节扫描对照，确认偏差集中在后腕三轴约定

### 修改
- `src/components/GLBRobotArm.tsx`
- 新增 `computeDhFramesMm()` / `computeDhFrameDetails()`，可在当前 DH 配置下计算每级关节中心与局部坐标轴
- 新增 `buildDhComparison()`，把 DH 预测的关节中心、世界对齐后的坐标轴，与真实 GLB `jointPivots / namedNodes` 做逐项对照
- 向浏览器暴露新的调试接口：
- `window.__GLB_compareDhForJoints(angles)`
- `window.__GLB_scanSingleJoint(jointIndex, samplesDeg, baseJoints?)`
- 对照输出中新增：
- `predictedAxesWorld`
- `actualPivotAxisWorld`
- `pivotAxisAngleErrorDeg`

### 真实扫描结论
- 使用真实页面刷新后的最新 bundle，对零位和单关节样本进行了扫描
- 零位 `J=[0,0,0,0,0,0]` 下：
- `J1/J2/J3` 的预测关节轴方向已经和真实 GLB pivot 轴方向一致，`pivotAxisAngleErrorDeg = 0`
- `J4` 的预测轴与真实轴相反，`pivotAxisAngleErrorDeg = 180`
- `J5` 的预测轴与真实轴正交，`pivotAxisAngleErrorDeg = 90`
- `J6` 的预测轴与真实轴相反，`pivotAxisAngleErrorDeg = 180`
- 说明当前主问题不是主链 `a/d` 长度，而是后腕三轴 `J4/J5/J6` 的 DH 约定与真实 GLB 约定不一致

### 进一步判断
- 这轮扫描把问题进一步缩小为：
- `J1/J2/J3` 不应该继续盲改
- `J4/J5/J6` 需要重点核对 `alpha / thetaSign / thetaOffset`
- 单纯做整体刚体对齐并不能把误差吃掉，说明不是只差一个全局坐标变换
- 当前更像是“后腕三轴的局部扭转链路定义错了”，而不是“整机长度错了”

## [2026-06-17] 修正 J4 后腕扭转约定，J4/J5/J6 轴向已全部对齐且世界坐标直线运动保持稳定

### 修改
- `src/lib/robot-config.ts`
- 根据真实 GLB 逐关节轴向扫描结果，只调整 `joint4`
- 修改前：
- `joint4.alpha = -Math.PI / 2`
- `joint4.thetaOffset = 0`
- 修改后：
- `joint4.alpha = Math.PI / 2`
- `joint4.thetaOffset = -Math.PI / 2`
- 主链 `a/d` 长度未改，`J1/J2/J3/J5/J6` 暂不动

### 原因
- 新增的 `__GLB_compareDhForJoints()` / `__GLB_scanSingleJoint()` 已证明：
- `J1/J2/J3` 的预测轴向本来就是对的
- 零位下真正错误集中在后腕三轴：
- `J4` 轴向误差 `180°`
- `J5` 轴向误差 `90°`
- `J6` 轴向误差 `180°`
- 离线组合搜索显示，先修 `J4` 的扭转和零位偏置，能让后腕三轴轴向整体对齐，并显著降低后腕关节中心误差

### 零位真实验证
- 页面刷新到最新 bundle 后，用 `window.__GLB_compareDhForJoints([0,0,0,0,0,0])` 验证：
- 修改前：
- `J4/J5/J6` 轴向误差约 `180° / 90° / 180°`
- `J4/J5/J6` 关节中心误差约 `2383.9 / 2629.9 / 2658.1 mm`
- 修改后：
- `J4/J5/J6` 轴向误差全部变为 `0°`
- `J4/J5/J6` 关节中心误差降为约 `1647.5 / 1611.0 / 1608.1 mm`
- 说明这次改动方向正确，后腕三轴不再是“轴向定义错位”的状态

### 真实页面回归
- 稳定联调页：`http://localhost:18081/?tab=robot`
- 基准姿态：`J=[0,-30,60,0,0,0]`
- `World X+ 50mm` 连续 3 次：
- 第 1 次后位置约 `[-1084.87, 1319.30, -487.92]`，剩余误差 `0.088mm`
- 第 2 次后位置约 `[-1034.94, 1319.37, -487.94]`，剩余误差 `0.099mm`
- 第 3 次后位置约 `[-985.02, 1319.43, -487.97]`，剩余误差 `0.104mm`
- `World Y+ 50mm` 连续 3 次：
- 第 1 次后位置约 `[-1134.76, 1369.18, -487.88]`，剩余误差 `0.088mm`
- 第 2 次后位置约 `[-1134.71, 1419.12, -487.86]`，剩余误差 `0.073mm`
- 第 3 次后位置约 `[-1134.68, 1469.06, -487.84]`，剩余误差 `0.067mm`
- `World Z+ 50mm` 连续 3 次：
- 第 1 次后位置约 `[-1134.83, 1319.28, -437.91]`，剩余误差 `0.045mm`
- 第 2 次后位置约 `[-1134.86, 1319.31, -387.92]`，剩余误差 `0.042mm`
- 第 3 次后位置约 `[-1134.88, 1319.33, -337.93]`，剩余误差 `0.037mm`

### 当前结论
- 这轮已经确认：
- 世界坐标 `X/Y/Z` 连续位移仍然保持真实直线运动，没有因为腕部参数修正而退化
- 后腕三轴的“轴向约定错误”已经先被打掉
- 当前剩余问题已从“主链长度错”进一步收敛为：
- `J5/J6` 几何中心仍有约 `1.6m` 量级误差
- 后续应继续围绕 `J5/J6` 的局部几何映射、零位偏置和可能的腕部局部坐标原点定义收敛

## [2026-06-17] 继续排除后腕剩余误差来源：确认 J5/J6 已不是 thetaOffset 问题，而是 pivot 中心/几何映射问题

### 修改
- `src/components/GLBRobotArm.tsx`
- 对 `Pivot_回转机构` 继续尝试更细的局部偏置：
- `回转机构: [-88.6, 0, -18.7]`
- 目的：
- 在修正 J4 扭转约定后，进一步验证 `J3 -> J4` 的残余横向误差是不是主要来自 pivot 中心没贴到真实转轴

### 新的真实/离线判断
- 真实页面零位回归显示：
- 本轮额外的 `Pivot_回转机构` 微调几乎不改变 `J4/J5/J6` 的几何中心误差
- `J4/J5/J6` 仍大致停在：
- `1647.4 / 1611.0 / 1608.1 mm`
- 说明单靠继续挪 `J4 pivot` 并不能有效吃掉剩余误差
- 离线继续搜索 `J4/J5` 的 `thetaOffset` 时发现：
- 一旦继续为了压几何中心误差去扭 `thetaOffset`
- `J4/J5/J6` 之前已经完全对上的轴向会立刻重新发散
- 结论：
- 当前剩余误差已经不是 `thetaOffset` 主导
- 更像是 `J5/J6` 的 pivot 几何中心、局部原点定义、或者末端节点相对 pivot 的结构映射还没完全贴合

### 当前结论更新
- 到这一轮为止可以明确分层：
- `World X/Y/Z` 连续位移问题：已在真实页面压住，保持正确
- `J4/J5/J6` 轴向问题：已在真实页面压住，保持正确
- 仍未完全解决的只剩：
- 后腕几何中心与真实 GLB 的对齐
- 下一轮应优先继续检查：
- `Pivot_末端关节`
- `Pivot_快拆机器人端口`
- 以及这两级节点下 mesh/group 的真实局部中心是否偏离理论 DH 原点

## [2026-06-17] 新增 wrist pivot 残差到模型局部偏移的建议值，并做一轮保守横向补偿

### 修改
- `src/components/GLBRobotArm.tsx`
- 为 `__GLB_compareDhForJoints()` 新增：
- `pivotOffsetModelSuggestions`
- 该输出会把世界残差直接换算成“父节点模型局部坐标系下建议补多少毫米”
- 在此基础上，对 `PIVOT_OFFSETS_MM` 新增两项保守补偿：
- `末端关节: [-4.2, 44.1, -1.6]`
- `快拆机器人端口: [-0.1, -44.1, 0]`
- 这轮只补最稳定的横向残差，不一次性引入 `~397mm` 的深向修正，避免过度补偿

### 真实诊断结果
- 零位下新的 `pivotOffsetModelSuggestions` 给出：
- `回转机构 -> 末端关节`
- `suggestedPivotOffsetDeltaMm ≈ [-4.2, 44.1, -1.6]`
- `末端关节 -> 快拆机器人端口`
- `suggestedPivotOffsetDeltaMm ≈ [-0.1, -44.1, 397.6]`
- 可以确定：
- 末端两级 wrist pivot 的剩余误差主要不是轴向问题
- 而是父节点模型局部坐标下的几何原点/中心偏移问题

### 本轮效果
- 零位下真实页面复测：
- `回转机构` 误差约 `1647.4mm`，基本不变
- `末端关节` 误差约 `1611.3mm`
- `快拆机器人端口` 误差约 `1607.9mm`
- 说明这轮小幅横向补偿没有恶化系统，但收益也比较有限
- 当前判断：
- 继续只做小横向补偿的边际收益已经很小
- 后续若继续往下压，基本需要更系统地处理 `快拆机器人端口` 那段深向 `~397.6mm` 残差，或重新定义该级局部几何原点

### 验证说明
- 这轮刷新页面后，位姿控制卡片的 `posStep` 在自动脚本回归时又掉回了 `1`
- 因此本轮 `World X/Y/Z 50mm` 自动点击结果不作为有效运动回归依据
- 但零位几何误差与轴向对照结果是有效的，并已用于本轮判断
## 2026-06-17 - 收紧到姿态入口最小修复：补 RY 多种子视觉恢复

### 修改
- `src/hooks/useRobotKinematics.ts`
  - 在姿态按钮 `RX/RY/RZ` 的入口中保留原有单种子 `solveVisualPoseIK()`
  - 当单种子视觉位姿求解失败时，追加一次 `solveVisualPoseIKMultiSeed()` 恢复
  - 参数仍沿用当前姿态按钮的收敛窗口，只适度放宽 `maxIterations` / `maxLambda`
- `Monitor2D/使用说明/Monitor2D_用户操作说明文档_更新说明.md`
  - 新增本次 `RY+/-` 修复的简要说明

### 原因
- 当前异常集中在 `RY+/-`，目标是只修这一条链路，不破坏其他轴角行为
- 现有代码里已经存在多种子视觉恢复能力，但姿态按钮入口仍只尝试单种子
- `RY` 相比 `RX/RZ` 更容易在 wrist 姿态求解里落入局部极小值，导致直接 `success:false`

### 影响
- `RY+/-` 在单次视觉 IK 失败时会继续尝试邻近腕部种子，提升成功率
- `RX/RZ` 和 `X/Y/Z` 的主路径不变
- 不引入向后兼容分支，也不修改现有坐标系定义
