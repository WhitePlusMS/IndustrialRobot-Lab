# Domain Glossary

Domain language for the IndustrialRobot-Lab (机臂实验室) codebase. Terms here name good seams; architecture discussions should prefer these names over implementation-specific labels.

## Coordinate & Kinematics

- **Joint（关节）** — 机械臂的旋转轴，本项目为 6 轴（J1~J6），用 `JointAngles` 表示。
- **EndEffector / Flange（末端/法兰）** — 机械臂最末端的连接面，安装工具（如吸盘）的位置。
- **Pose（位姿）** — 三维空间中的位置 + 姿态，由 `position`（mm）、`euler`（ZYX 欧拉角 rad）、`rotation`（3×3 矩阵）组成。
- **DH Parameters（DH 参数）** — 修正 Denavit-Hartenberg 参数，描述相邻关节之间的连杆几何。
- **Forward Kinematics（FK，正运动学）** — 由关节角计算末端位姿。
- **Inverse Kinematics（IK，逆运动学）** — 由目标位姿求解可行关节角；本项目采用 Jacobian LM-DLS 数值方法。
- **RobotModel** — 运动学模型适配器接口（seam），抽象 FK 与 Jacobian 来源（PoE 解析模型 / GLB 采样模型）。
- **SceneKinematicModel** — 基于零位标定数据的 Product-of-Exponentials 解析运动学模型。
- **GLBRobotModel** — 基于 GLB 场景逐关节微扰采样 FK 与数值 Jacobian 的模型适配器。

## Motion & Task

- **Waypoint（记忆点）** — 保存的关节角配置，存储于 `localStorage`，用于快速回放或序列目标。
- **MotionProfile / TaskPoseConstraintProfile** — 任务位姿约束配置，决定位置/姿态容差、是否允许位置-only 回退等。
- **MotionQueue（运动队列）** — `goToPosition` 使用的分段关节路径执行队列。
- **Sucker（吸盘）** — 真空吸盘末端执行器，本项目简化为距离阈值吸附 + 跟随/释放物理状态机。
- **BoxState** — 箱子状态：NONE / FREE / FALLING / ATTACHED / PLACED / RESTING。
- **Action Sequence（动作序列）** — 拖拽式步骤列表，支持生成箱子、移动、吸盘开关、拍照、等待等步骤。

## Perception & Scene

- **VirtualCamera（虚拟工业相机）** — 可调整内参/外参的透视相机，支持彩色、分割、深度图捕获。
- **CoordinateSystem（坐标系）** — World（基坐标系）或 Tool（工具坐标系），用于位姿方向键控制。
- **Scene Scale（场景尺度）** — Three.js 场景使用米，运动学/规划使用毫米，二者通过 ×1000 / ÷1000 转换。
