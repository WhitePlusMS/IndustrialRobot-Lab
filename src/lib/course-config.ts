// src/lib/course-config.ts
// 教学课程内容配置 - 静态 JSON，后续可迁移到数据库/CMS

export type ModuleId = 'robot' | 'camera' | 'grasp';
export type ValidationType = 'joint-value' | 'camera-value' | 'manual';
export type LearningSubTab = 'steps' | 'explain' | 'knowledge';
export type LearningMode = 'guided' | 'free';

export interface CourseStep {
  id: string;
  title: string;
  subtitle: string;
  explanation: string;
  goal: string;
  warning: string;
  hint?: string;
  validation?: {
    type: ValidationType;
    params?: Record<string, unknown>;
  };
}

export interface TheoryItem {
  title: string;
  description: string;
}

export interface CourseModule {
  id: ModuleId;
  title: string;
  progressTitle: string;
  theory: TheoryItem[];
  steps: CourseStep[];
}

export const courseModules: CourseModule[] = [
  {
    id: 'robot',
    title: '机械臂',
    progressTitle: '机械臂学习进度',
    theory: [
      {
        title: '关节空间',
        description: '用 6 个关节角度（J1~J6）来描述机械臂的姿态。每个关节角度对应一个自由度。',
      },
      {
        title: '工作空间',
        description: '机械臂末端能够到达的所有位置集合。工作空间大小与机械臂结构和关节范围有关。',
      },
      {
        title: '正运动学',
        description: '已知各关节角度，通过 DH 参数和变换矩阵计算末端执行器的位置和姿态。',
      },
      {
        title: 'DH 参数',
        description: '描述相邻连杆之间关系的 4 个参数：连杆长度 a、连杆扭角 α、连杆偏距 d、关节角度 θ。',
      },
      {
        title: '奇异点',
        description: '某些关节组合下机械臂失去一个或多个自由度，导致运动控制精度下降或不可控。',
      },
    ],
    steps: [
      {
        id: 'robot-structure',
        title: '认识机械臂结构',
        subtitle: '了解 6 个关节的名称和作用',
        explanation:
          '6F 机械臂由 6 个旋转关节组成，从底座到末端依次编号为 J1 ~ J6。每个关节只负责一个自由度的运动，多个关节组合起来就能让末端到达空间中的任意位姿。',
        goal: '能够指出每个关节的位置，并说出 J1~J6 各自的主要运动方向。',
        warning: '不要混淆相邻关节的运动方向，比如 J1 是水平旋转，J2 是垂直俯仰。',
        hint: '点击右侧的关节卡片，观察 3D 模型中对应关节的位置。',
      },
      {
        id: 'robot-coordinate',
        title: '理解坐标系',
        subtitle: '基坐标系 vs 工具坐标系',
        explanation:
          '描述机械臂运动需要明确参考对象。基坐标系固定在底座中心，是全局不变的；工具坐标系固定在末端，会随机械臂运动而改变。',
        goal: '能够在 3D 视口中同时显示两种坐标系，并理解同一位置在不同坐标系下的数值差异。',
        warning: '切换坐标系时，底部状态栏的位置数值含义会随之改变。',
        hint: '在右侧选择不同的坐标系显示方式，观察 3D 视口中的变化。',
      },
      {
        id: 'robot-single-joint',
        title: '练习单关节运动',
        subtitle: '控制 J1 关节旋转 30°',
        explanation:
          'J1 关节是机械臂的底座旋转关节，控制机械臂在水平面上的转动。当 J1 角度增加时，机械臂会向右旋转；角度减少时则向左旋转。',
        goal: '通过调整 J1 关节，观察末端执行器位置的变化，理解关节角度与末端位置的关系。',
        warning: '旋转角度不要超过 ±180°，否则机械臂可能会进入奇异状态。',
        hint: '拖动右侧 J1 滑块，或将 J1 设为 30°。',
        validation: {
          type: 'joint-value',
          params: { jointIndex: 0, target: 30, tolerance: 0.5 },
        },
      },
      {
        id: 'robot-multi-joint',
        title: '多关节联动',
        subtitle: '协调控制多个关节',
        explanation:
          '实际任务中往往需要多个关节同时运动。本步骤练习同时调整 J2 和 J3，让机械臂末端到达指定高度和距离。',
        goal: '理解多个关节如何协同工作，初步感受逆运动学的概念。',
        warning: '注意关节之间的耦合关系，J2 和 J3 都会影响末端高度。',
        hint: '同时调整 J2 和 J3，使末端到达目标位置。',
      },
      {
        id: 'robot-cartesian',
        title: '末端位置控制',
        subtitle: '用笛卡尔坐标移动末端',
        explanation:
          '在工程应用中，通常直接指定末端要到达的 X、Y、Z 坐标，由机器人自动计算各关节角度。这就是逆运动学的实际应用。',
        goal: '给定目标坐标，让机械臂末端到达指定位置。',
        warning: '如果目标点在工作空间之外，机械臂会提示"目标不可达"。',
        hint: '在右侧输入目标 X/Y/Z 坐标，点击"移动到目标点"。',
      },
    ],
  },
  {
    id: 'camera',
    title: '相机系统',
    progressTitle: '相机系统学习进度',
    theory: [
      {
        title: '针孔相机模型',
        description: '光线通过一个小孔投影到成像平面上形成倒立像，是最简单的相机成像模型。',
      },
      {
        title: '内参矩阵',
        description: '描述相机内部几何特性，包括焦距 fx/fy 和主点 cx/cy。',
      },
      {
        title: '外参矩阵',
        description: '描述相机在世界坐标系中的位置和朝向，由旋转矩阵和平移向量组成。',
      },
      {
        title: '透视投影',
        description: '3D 空间中的点按照透视关系投影到 2D 图像平面上。',
      },
      {
        title: '相机标定',
        description: '通过拍摄已知图案（如棋盘格）来确定相机内外参的过程。',
      },
    ],
    steps: [
      {
        id: 'camera-model',
        title: '认识相机模型',
        subtitle: '了解针孔相机成像原理',
        explanation:
          '相机是机械臂的"眼睛"。针孔相机模型是最简单的成像模型：物体发出的光线通过一个小孔，在成像平面上形成倒立的像。',
        goal: '理解针孔相机模型的基本构成：光心、成像平面和焦距。',
        warning: '实际相机镜头会有畸变，针孔模型是理想化近似。',
        hint: '观察 3D 视口中的相机模型和成像平面示意。',
      },
      {
        id: 'camera-params',
        title: '理解内外参',
        subtitle: '内参矩阵与外参矩阵的含义',
        explanation:
          '内参描述相机自身的特性，如焦距和主点；外参描述相机在世界坐标系中的位姿。两者共同决定了 3D 点如何投影到 2D 图像。',
        goal: '能够区分内参和外参，并理解它们在成像过程中的作用。',
        warning: '同一台相机的内参通常固定，外参会随安装位置变化。',
        hint: '在右侧切换内外参标注的显示。',
      },
      {
        id: 'camera-pose',
        title: '调整相机位姿',
        subtitle: '控制相机位置和朝向',
        explanation:
          '通过改变相机的 X、Y、Z 坐标和姿态角，可以从不同视角观察机械臂和物体。合适的相机位姿是视觉抓取成功的前提。',
        goal: '掌握相机位姿参数的调整方法，能够切换到前视、侧视、顶视等常用视角。',
        warning: '相机距离物体太近可能无法完整成像，太远则细节不足。',
        hint: '拖动右侧滑块调整相机位置，或点击视角按钮。',
      },
      {
        id: 'camera-fov',
        title: '视场角与分辨率',
        subtitle: 'FOV 和分辨率对成像的影响',
        explanation:
          '视场角（FOV）决定了相机能看到的范围，分辨率决定了图像的清晰度。两者需要权衡：大 FOV 看到更多但细节少，高分辨率细节多但处理慢。',
        goal: '理解 FOV 和分辨率对成像效果的影响，能够根据任务需求调整。',
        warning: 'FOV 过大容易产生透视畸变，影响后续图像处理精度。',
        hint: '调整 FOV 滑块，观察视野锥的变化。',
      },
      {
        id: 'camera-calibration',
        title: '拍摄与标定',
        subtitle: '拍摄图像并进行标定',
        explanation:
          '相机标定是通过拍摄已知图案来确定相机内外参的过程。标定后的相机才能准确地将图像像素坐标转换为世界坐标。',
        goal: '能够拍摄图像并理解标定的基本流程。',
        warning: '标定板需要清晰完整地出现在图像中，避免过曝或过暗。',
        hint: '点击拍摄按钮，查看捕获的图像。',
      },
    ],
  },
  {
    id: 'grasp',
    title: '抓取实训',
    progressTitle: '抓取实训进度',
    theory: [
      {
        title: '真空吸附原理',
        description: '利用负压使吸盘与物体表面产生吸附力，大气压将物体压在吸盘上。',
      },
      {
        title: '末端执行器类型',
        description: '安装在机械臂末端的工具，常见有真空吸盘、气动夹爪、焊枪、电批等。',
      },
      {
        title: '动作规划',
        description: '将抓取任务分解为多个有序动作：接近、吸取、搬运、释放。',
      },
      {
        title: '抓取约束',
        description: '物体表面平整度、重量、姿态都会影响抓取成功率。',
      },
      {
        title: '安全操作',
        description: '控制移动速度，避免碰撞；吸取前确保吸盘与物体充分接触。',
      },
    ],
    steps: [
      {
        id: 'grasp-sucker',
        title: '认识吸盘工具',
        subtitle: '了解真空吸盘的工作原理',
        explanation:
          '真空吸盘是工业机械臂常用的末端执行器。当吸盘接触到物体表面并抽走空气后，吸盘内部形成负压，大气压会将物体压在吸盘上，从而实现抓取。',
        goal: '理解真空吸盘的工作原理，知道吸盘适合抓取表面平整的物体。',
        warning: '多孔、柔软或表面不平整的物体不适合用吸盘抓取。',
        hint: '观察 3D 视口中末端吸盘的位置。',
      },
      {
        id: 'grasp-spawn',
        title: '生成物体',
        subtitle: '在场景中生成待抓取物体',
        explanation:
          '在仿真环境中，我们可以随时生成待抓取物体。通过调整物体的位置和大小，可以模拟不同的抓取场景。',
        goal: '能够在场景中生成一个箱子，并观察它出现在 3D 视口中的位置。',
        warning: '物体不要生成在机械臂无法到达的位置。',
        hint: '点击右侧"生成物体"按钮。',
      },
      {
        id: 'grasp-approach',
        title: '接近物体',
        subtitle: '控制机械臂末端接近物体',
        explanation:
          '抓取前需要将吸盘移动到物体正上方，并保持合适的距离。这一步练习用关节控制或坐标控制让机械臂接近目标物体。',
        goal: '控制机械臂末端移动到物体上方约 5cm 处，准备吸取。',
        warning: '移动速度不要太快，避免碰撞物体。',
        hint: '使用位姿控制或目标坐标让末端靠近物体。',
      },
      {
        id: 'grasp-attach',
        title: '吸取与释放',
        subtitle: '开启/关闭吸盘完成抓取',
        explanation:
          '当吸盘贴近物体表面后，开启吸盘产生负压即可吸取物体；移动到目标位置后，关闭吸盘释放物体。',
        goal: '掌握吸盘的开启和关闭时机，完成一次吸取-搬运-释放。',
        warning: '吸取前要确保吸盘与物体表面充分接触，否则容易脱落。',
        hint: '点击"开启吸盘"吸取物体，移动到目标位置后点击"关闭吸盘"。',
      },
      {
        id: 'grasp-sequence',
        title: '动作序列',
        subtitle: '将多个动作组合成完整流程',
        explanation:
          '完整的抓取任务可以拆分为多个步骤：接近 → 吸取 → 搬运 → 释放。通过动作序列，可以让这些步骤自动按顺序执行。',
        goal: '创建一个包含 4 个步骤的动作序列，并运行完整抓取流程。',
        warning: '序列中的每个步骤都需要设置合适的参数和等待时间。',
        hint: '在序列编辑器中添加步骤并运行。',
      },
    ],
  },
];

export function getModuleById(id: ModuleId): CourseModule | undefined {
  return courseModules.find((m) => m.id === id);
}

export function getStepById(moduleId: ModuleId, stepId: string): CourseStep | undefined {
  const module = getModuleById(moduleId);
  return module?.steps.find((s) => s.id === stepId);
}
