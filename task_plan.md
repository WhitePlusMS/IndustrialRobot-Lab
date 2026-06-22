# 实施计划：PoE 解析运动学模型替换场景采样

## 目标

用 Product of Exponentials 解析运动学模型替换当前 `GLBRobotModel` 的数值场景采样方案，消除：
1. IK Jacobian 的浮点噪声（导致 ~40% 边界姿态无解）
2. IK/FK 对 Three.js 场景的运行时依赖
3. IK 模块的不可测试性

## 已完成调研

- [x] DH FK vs 场景 FK 偏差量化（1500-4400mm，根本性坐标系不匹配）
- [x] 场景关节轴实测（Z/Y/Y/X/Y/Z 混合轴，非 DH 标准）
- [x] IK 闭环测试（3/5 通过，2 个因数值 Jacobian 噪声失败）
- [x] PoE 可行性验证（每个关节的世界轴和 pivot 位置可在零位提取）

---

## Phase 1: 标定数据结构 — bridge API 扩展

**目标**：GLBRobotArm 挂载时一次性提取场景几何参数，通过 bridge 暴露

**涉及文件**：
- `src/lib/robot-pose-bridge.ts` — 新增 `CalibrationData` 类型 + setCalibration/getCalibration

**具体改动**：
1. 新增 `JointCalibData` 接口：`{ worldAxis: [number,number,number]; pivotPos: [number,number,number] }`（零位世界坐标系）
2. 新增 `CalibrationData` 接口：`{ joints: JointCalibData[]; zeroFlangePose: Pose; available: boolean }`
3. `RobotPoseBridge` 新增 `setCalibration(data)` / `getCalibration()` / 对应 subscribe
4. **保留** `RobotPoseAPI` 接口不变（`getFlangeMatrix` 仍用于轨迹采样等实时用途）

**验证标准**：GLBRobotArm 能在零位提取 6 个关节的 worldAxis 和 pivotPos，精度在浮点误差内

---

## Phase 2: PoE 解析运动学模型 — 核心新模块

**目标**：实现不依赖 Three.js 的 FK + 解析 Jacobian

**新建文件**：`src/lib/scene-kinematic-model.ts`

**具体改动**：
1. 实现 `SceneKinematicModel` 类，constructor 接收 `CalibrationData`
2. `forwardKinematics(jointsDeg)`：
   - 逐关节计算 $T_i = e^{[\xi_i] \cdot \theta_i}$
   - 使用 Rodrigues 公式计算旋量指数映射
   - 链式乘积 × zeroFlangePose → 返回末端 `Pose`（位置 mm，欧拉角 rad，旋转矩阵）
3. `spatialJacobian(jointsDeg)`：
   - 空间 Jacobian：$J_i = \text{Ad}_{T_{i-1}}(\xi_i)$
   - 每列 = `[ω_i × (p_flange - p_pivot_i); ω_i]`
   - ω_i 和 p_pivot_i 通过当前姿态变换到世界系
4. `isAvailable()` → `true`（因为参数已在构造时注入）

**验证标准**：
- Golden Test：随机 20 个姿态，PoE FK 与 `capturePoseForJoints` 结果偏差 < 1mm
- IK 闭环测试：全部 5 个测试用例收敛，含之前失败的 `[-60, -30, 60, 30, 0, 0]`

---

## Phase 3: RobotModel 接口适配

**目标**：让 `SceneKinematicModel` 实现 `RobotModel` 接口，无侵入替换

**涉及文件**：
- `src/lib/glb-robot-model.ts` — 标记 deprecated（暂不删，回退用）
- `src/hooks/useRobot.ts` — 切换模型构造
- `src/lib/ik-solver.ts` — 无需修改（接口不变）
- `src/lib/motion-planner.ts` — 无需修改（接口不变）

**具体改动**：
1. `SceneKinematicModel` 补 `estimateJacobian()` → 返回 `spatialJacobian()` 的数组形式
2. `useRobot.ts` 从 `new GLBRobotModel(poseApi)` 改为 `new SceneKinematicModel(calibrationData)`
3. 删除 `useRobotPoseAPI` 依赖（不再需要 subscribe 场景 FK）

**验证标准**：`npm run build` 无 TypeScript 错误，无 broken import

---

## Phase 4: 单元测试

**目标**：首次为运动学模型建立测试覆盖

**新建文件**：`src/lib/scene-kinematic-model.test.ts`

**测试用例**（vitest）：
1. **零位 FK**：所有角度为 0 时，FK 输出 = 零位法兰位姿
2. **Golden accuracy**：对固定标定数据，20 个姿态下 PoE FK 与场景采样偏差 < 1mm
3. **Jacobian 维度**：spatialJacobian 始终为 6×6 满秩矩阵
4. **IK 闭环**：5 个测试用例全部收敛，位置误差 < 1mm
5. **J6 不退化**：J6 列的姿态行（rows 3-5）在任何姿态下不趋零

**验证标准**：`npx vitest run` 全部通过

---

## Phase 5: 清理

**涉及文件**：
- `src/lib/glb-robot-model.ts` — 删除
- `src/hooks/useRobotPoseAPI.ts` — 删除（如果不再被其他模块引用）

---

## 风险 & 回退

| 风险 | 缓解 |
|------|------|
| GLB 模型 hierarchy 有非纯旋转节点 | Phase 1 提取时就验证 pivot 轴方向是否与物理一致 |
| 场景零位与 PoE 零位初始值偏移 | Golden Test 覆盖，偏差 >1mm 就停止 |
| 坐标系常识混淆（mm vs m, world vs local） | 所有 PoE 计算统一用 mm 和世界坐标系，与现有 RobotModel 接口一致 |

**回退方案**：Phase 3 中 `glb-robot-model.ts` 不立即删除，用 feature flag 切回旧模型只需 1 行改动
