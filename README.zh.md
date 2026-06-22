[English](README.md) | [中文](README.zh.md)

# IndustrialRobot-Lab · 机臂实验室

> 工业机器人交互式学习工作台。将六轴机械臂的运动学、相机视觉、抓取仿真、码垛等功能拆解为可观察、可调参、可操作的逐步实验，让抽象的数学与算法直观可见。

🌐 **在线演示：** [https://whiteplusms.github.io/IndustrialRobot-Lab/](https://whiteplusms.github.io/IndustrialRobot-Lab/)

*© 2026 WhitePlusMS*

## 总览

基于真实 KUKA 六轴 GLB 模型的纯前端工业机器人仿真平台。融合交互式 3D 可视化与结构化教学模式（约 180 分钟课程），并提供一个自由练习沙箱供深入实验。

### 核心功能

| 模块 | 内容 |
|------|------|
| **正运动学** | 修正 DH 参数链，4×4 齐次变换矩阵，末端位姿（位置 + ZYX 欧拉角） |
| **逆运动学** | Jacobian LM-DLS 数值求解，双策略降级（6-DOF → 3-DOF 回退），奇异位形检测 |
| **关节与位姿控制** | 六轴滑块（4 档步长）；世界/工具坐标系下的笛卡尔位姿控制；支持长按连续触发 |
| **记忆点系统** | 保存/回放关节配置，设定原点，浏览器 localStorage 持久化 |
| **虚拟相机** | 工业相机模型，可调内参/外参，镜头与视锥可视化，拍照（彩色/分割/深度图） |
| **吸盘与抓取** | 真空吸盘末端执行器，物理仿真（吸附、提升、自由落体、地面碰撞），生成区域围栏 |
| **码垛** | 即将上线 — 多箱取放、模式生成、循环优化 |
| **动作序列编程** | 拖拽式可视化序列编辑器，10 种步骤类型，支持全流程运行与单步调试 |
| **教学课程** | 3 个模块，15+ 引导步骤 — 机械臂基础 / 相机系统 / 抓取实训 — 任务描述、检查项、关键术语、场景联动高亮 |

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | React 19 + Vite 7 |
| 语言 | TypeScript 5 |
| 3D 渲染 | Three.js + @react-three/fiber + @react-three/drei |
| 样式 | Tailwind CSS 3 + shadcn/ui (New York) |
| 线性代数 | ml-matrix（SVD、矩阵求逆） |
| 状态管理 | React Context API + 自定义 Hooks |
| 持久化 | 浏览器 localStorage |
| 测试 | Vitest |

## 架构亮点

- **纯前端，零后端** — 所有运动学、逆运动学求解、物理仿真均在浏览器内运行，无需任何服务端依赖。
- **GLB 模型即真实源** — Jacobian 矩阵通过对 3D 场景中实际关节逐阶微扰估计，运动学计算与视觉表现完全一致。
- **双策略降级逆解** — 6-DOF（位置+姿态）IK 失败时自动降级为 3-DOF（仅位置）IK，避免静默失败。
- **RAF 动画引擎** — 基于类型的非重启优化：同类型重复调用仅更新目标引用，不重启 RAF 循环，消除帧间隙卡顿。
- **帧级插值** — 关节滑块与相机控制使用 ref + `useFrame` 插值，绕过 React 重渲染，保证 60fps 流畅交互。
- **结构化教学** — 每个引导步骤包含任务描述、操作步骤、自检项、观察点、关键术语及理论关联。

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:18081`。可在**引导教学**（左侧面板）和**自由练习**（右侧面板）模式间切换。

## 项目结构

```
src/
  lib/                    # 核心算法
    kinematics.ts             # 正运动学（DH 变换链）
    ik-solver.ts              # 逆运动学（LM-DLS）
    matrix4x4.ts              # 4×4 齐次变换矩阵
    robot-config.ts           # KUKA 型 DH 参数
    glb-robot-model.ts        # 基于 GLB 的模型实现（3D 场景计算 Jacobian）
    motion-smoothing.ts       # 缓动函数与关节插值
    motion-planner.ts         # 笛卡尔空间分步运动规划
    capture-engine.ts         # 彩色 / 分割 / 深度拍照引擎
    waypoint-storage.ts       # 记忆点 localStorage 持久化
    course-config.ts          # 完整教学课程配置
    camera-config.ts          # 相机分辨率常量
  components/             # React 组件
    GLBRobotArm.tsx           # GLB 模型加载与关节操控
    RobotScene.tsx            # 3D 场景组合
    JointAngleCard.tsx        # 关节控制面板
    PoseControlCard.tsx       # 笛卡尔位姿控制
    DirectionButton.tsx       # 支持长按的方向按钮
    WaypointPanel.tsx         # 记忆点管理界面
    DataOverlay.tsx           # 实时位姿显示
    StatusBar.tsx             # 底部状态栏
    camera/                   # 虚拟相机组件
    operation/                # 操作面板（机器人、相机、抓取、自由）
    learning/                 # 学习面板（步骤、讲解、理论）
    sequence/                 # 序列编辑器
  hooks/                  # React Hooks
    useRobot.ts               # 核心机器人控制
    useMotion.ts              # RAF 动画引擎
    useVirtualCamera.ts       # 相机状态管理
    useSuckerControl.ts       # 吸盘物理与吸附
    useActionSequence.ts      # 序列执行引擎
    useWaypoints.ts           # 记忆点封装
  contexts/               # React Context 提供者
```

## 许可证

保留所有权利。本项目为专有教育产品 — 详见 [LICENSE](LICENSE)。
