// src/pages/Home.tsx
// 主界面（Landing Page）：基于 prototype/website/landing-series.html 设计稿
import { useNavigate } from 'react-router';
import { Github, ArrowRight, Check } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <HeroSection onStart={() => navigate('/lab')} />
      <main className="flex-1">
        <PreviewSection />
        <FeaturesSection />
        <StepsSection />
      </main>
      <Footer />
    </div>
  );
}

function HeroSection({ onStart }: { onStart: () => void }) {
  return (
    <section className="hero relative min-h-screen flex flex-col overflow-hidden text-white">
      <style>{`
        .hero {
          background: linear-gradient(135deg, #091120 0%, #102742 54%, #163a5d 100%);
        }
        .hero-grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px);
          background-size: 56px 56px;
        }
        .hero-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at top left, rgba(56, 189, 248, 0.16), transparent 38%),
            radial-gradient(circle at 85% 22%, rgba(59, 130, 246, 0.18), transparent 34%),
            radial-gradient(circle at 50% 100%, rgba(20, 184, 166, 0.12), transparent 28%);
        }
        .hero-fade {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 112px;
          background: linear-gradient(to bottom, transparent, rgba(2, 6, 23, 0.24));
          pointer-events: none;
        }
      `}</style>

      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-glow" aria-hidden="true" />
      <div className="hero-fade" aria-hidden="true" />

      {/* TopBar */}
      <div className="relative z-10 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold tracking-wide">工业机械臂实验室</span>
            <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">IndustrialRobot-Lab</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/WhitePlusMS/IndustrialRobot-Lab"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 bg-white/5 text-white/70 text-sm font-medium hover:bg-white/10 hover:text-white transition"
            >
              <Github size={15} />
              GitHub
            </a>
            <button
              onClick={onStart}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-slate-900 text-sm font-semibold hover:bg-sky-50 transition shadow-lg shadow-white/10"
            >
              开始学习
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Hero Content */}
      <div className="relative z-10 flex-1 flex flex-col justify-center max-w-6xl pl-52 pr-6 py-16">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight max-w-3xl">
          在 3D 场景中
          <br />
          <span className="bg-gradient-to-r from-sky-200 via-cyan-200 to-blue-300 bg-clip-text text-transparent">
            理解工业六轴机械臂
          </span>
        </h1>
        <p className="mt-4 text-xl sm:text-2xl font-medium text-white/80">交互式机械臂学习实验台</p>
        <p className="mt-5 max-w-xl text-base sm:text-lg text-white/60 leading-relaxed">
          一个基于 3D 可视化与实时操作的学习工具。通过观察、控制、验证三步，把机械臂结构、坐标系、关节运动和简单任务流程变成直观的学习体验。
        </p>
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
          <MetricCard value="3" label="学习模块" desc="从机械臂、相机系统到抓取实训，循序递进。" color="text-sky-200" />
          <MetricCard value="15" label="实践小节" desc="3 大模块共 15 个引导小节，边学边操作。" color="text-cyan-200" />
          <MetricCard value="0" label="安装步骤" desc="纯前端实现，浏览器打开即可开始学习。" color="text-green-200" />
        </div>
      </div>
    </section>
  );
}

function MetricCard({ value, label, desc, color }: { value: string; label: string; desc: string; color: string }) {
  return (
    <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-sm shadow-xl">
      <div className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${color}`}>{value}</div>
      <div className="mt-2 text-xs font-bold uppercase tracking-widest text-white/50">{label}</div>
      <div className="mt-2 text-sm text-white/60 leading-relaxed">{desc}</div>
    </div>
  );
}

function PreviewSection() {
  return (
    <section className="py-16 sm:py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">学习界面</div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">左侧 3D 场景，右侧操作面板</h2>
          <p className="mt-2 max-w-2xl text-slate-500 leading-relaxed">
            与传统卡片式课程不同，6F Robot 采用一体化操作界面：中间是实时 3D 机械臂，两侧是学习面板与操作控件，边学边做。
          </p>
        </div>

        <div data-screenshot="preview" className="rounded-2xl overflow-hidden border border-slate-200 shadow-2xl bg-slate-900">
          <img
            src="/images/hero-preview.png"
            alt="实验室界面预览"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="py-16 sm:py-20 px-6 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <div className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">三大学习模块</div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">从机械臂到视觉，再到完整抓取流程</h2>
        </div>

        <FeatureRow
          icon="🦾"
          imageSrc="/images/hero-robot.png"
          title="机械臂结构与运动控制"
          desc="在 3D 场景中认识 J1~J6 六个关节，理解每个关节的运动方向。通过拖动滑块实时控制机械臂姿态，建立关节角度与末端位置之间的直觉。"
          items={['六个关节独立调节', '实时数值反馈', 'Home / Zero 快速复位']}
        />
        <FeatureRow
          icon="📷"
          imageSrc="/images/hero-camera.png"
          title="工业相机与视觉感知"
          desc="认识针孔相机模型、内参矩阵与外参矩阵，理解 3D 点如何投影到 2D 图像。调整相机位姿、FOV 和分辨率，观察成像变化。"
          items={['针孔相机模型', '内外参矩阵', '彩色 / 分割 / 深度拍摄']}
          reverse
        />
        <FeatureRow
          icon="🤏"
          imageSrc="/images/hero-grasp.png"
          title="真空吸盘与抓取流程"
          desc="理解真空吸附原理，观察末端执行器与物体的交互。将接近、吸取、搬运、释放组合成完整动作序列，完成简单抓取任务。"
          items={['真空吸附原理', '末端执行器可视化', '动作序列编排']}
        />
      </div>
    </section>
  );
}

function FeatureRow({
  icon,
  imageSrc,
  title,
  desc,
  items,
  reverse = false,
}: {
  icon: string;
  imageSrc: string;
  title: string;
  desc: string;
  items: string[];
  reverse?: boolean;
}) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-10 items-center mt-12 ${reverse ? 'md:[direction:rtl]' : ''}`}>
      <div data-screenshot={icon} className={`aspect-[16/9] bg-white border border-slate-200 rounded-2xl overflow-hidden md:[direction:ltr] ${reverse ? 'md:order-2' : ''}`}>
        <img
          src={imageSrc}
          alt={title}
          className="w-full h-full object-cover"
        />
      </div>
      <div className={`md:[direction:ltr] ${reverse ? 'md:order-1' : ''}`}>
        <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-3">{title}</h3>
        <p className="text-slate-500 leading-relaxed mb-5">{desc}</p>
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm sm:text-base text-slate-800">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                <Check size={12} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StepsSection() {
  const steps = [
    { num: 1, title: '观察结构', desc: '在 3D 场景中认识 J1~J6 六个关节，理解每个关节的运动方向。' },
    { num: 2, title: '动手控制', desc: '拖动滑块控制关节，实时观察机械臂姿态和末端位置的变化。' },
    { num: 3, title: '理解原理', desc: '通过坐标系切换和数值反馈，理解参考系与运动学基本概念。' },
    { num: 4, title: '完成任务', desc: '组合多个动作，完成接近、吸取、搬运、释放的完整流程。' },
  ];

  return (
    <section className="py-16 sm:py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <div className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">学习流程</div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">四步进入工业机器人学习</h2>
        </div>
        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div
            className="hidden lg:block absolute top-5 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-amber-500 opacity-25"
            aria-hidden
          />
          {steps.map((s) => (
            <div key={s.num} className="relative text-center z-10">
              <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-200 text-blue-600 font-extrabold flex items-center justify-center mx-auto mb-4">
                {s.num}
              </div>
              <h4 className="text-base font-bold mb-1">{s.title}</h4>
              <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <a
          href="https://github.com/WhitePlusMS/IndustrialRobot-Lab"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-400 hover:text-slate-500 inline-flex items-center gap-1.5 transition"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          IndustrialRobot-Lab / 工业机械臂实验室
        </a>
        <span className="text-xs text-slate-300">&copy; 2026 WhitePlusMS</span>
      </div>
    </footer>
  );
}
