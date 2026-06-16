# 更新说明

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

# 更新说明 - 移除Kimi OAuth鉴权系统

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
