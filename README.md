[English](README.md) | [中文](README.zh.md)

# IndustrialRobot-Lab · 机臂实验室

> An interactive learning workbench for industrial robotics. It decomposes a six-axis robotic arm into observable, operable, step-by-step experiments — covering forward and inverse kinematics, camera vision, grasping simulation, palletizing, and more — making abstract kinematics math直观可见.

🌐 **Live Demo:** [https://whiteplusms.github.io/IndustrialRobot-Lab/](https://whiteplusms.github.io/IndustrialRobot-Lab/)

*© 2026 WhitePlusMS*

## Overview

A browser-based, pure front-end industrial robot simulation platform built around a realistic KUKA six-axis GLB model. It blends interactive 3D visualization with structured teaching modules (~180 min of curriculum) and a free-practice sandbox for experimentation.

### Core Capabilities

| Module | Features |
|--------|----------|
| **Forward Kinematics** | Modified DH parameter chain, 4×4 homogeneous transform matrices, end-effector pose (position + ZYX Euler angles) |
| **Inverse Kinematics** | Jacobian-based Levenberg-Marquardt damped least squares, dual-strategy degradation (6-DOF → 3-DOF fallback), singularity detection |
| **Joint & Pose Control** | Six-axis joint sliders with 4 step sizes; Cartesian position/orientation controls in World & Tool frames; long-press continuous triggering |
| **Waypoint System** | Save & recall joint configurations, set home positions, localStorage persistence |
| **Virtual Camera** | Industrial camera model with adjustable intrinsics/extrinsics, lens & frustum visualization, photo capture (color / segmentation / depth map) |
| **Gripper & Grasping** | Vacuum sucker end-effector with physics simulation (attach, lift, free-fall, ground collision), spawn area fence |
| **Palletizing** | Coming soon — multi-box pick-and-place, pattern generation, cycle optimization |
| **Action Sequence Programming** | Drag-and-drop visual sequence editor, 10 step types, full-run & single-step debugging with execution logs |
| **Teaching Curriculum** | 3 modules, 15+ guided steps — Robot Basics / Camera System / Grasping Practice — with task descriptions, check items, key terms, and scene-linked highlights |

## Tech Stack

| Layer | Technology |
|------|-----------|
| Framework | React 19 + Vite 7 |
| Language | TypeScript 5 |
| 3D Rendering | Three.js + @react-three/fiber + @react-three/drei |
| Styling | Tailwind CSS 3 + shadcn/ui (New York) |
| Linear Algebra | ml-matrix (SVD, matrix inversion) |
| State | React Context API + custom hooks |
| Persistence | browser localStorage |
| Testing | Vitest |

## Architecture Highlights

- **Pure frontend, no backend** — All kinematics, IK solving, and physics run in the browser; zero server dependencies.
- **GLB model as ground truth** — The Jacobian matrix is estimated by numerically perturbing joints in the actual 3D scene, so kinematics match the visual representation exactly.
- **Dual-degradation IK** — If 6-DOF (position + orientation) IK fails, automatically falls back to 3-DOF position-only IK; never silently fails.
- **RAF animation engine** — Type-based non-restart optimization: repeated calls to the same animation type only update targets without restarting the RAF loop, eliminating frame-gap stuttering.
- **Frame-level interpolation** — Joint sliders and camera controls use ref + `useFrame` interpolation, bypassing React re-renders for 60fps smooth interaction.
- **Structured pedagogy** — Each guided step includes task description, operation steps, self-check items, observation points, key terms, and theory links.

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:18081` in your browser. Switch between **Guided Teaching** (left panel) and **Free Practice** (right panel) modes.

## Project Structure

```
src/
  lib/                    # Core algorithms
    kinematics.ts             # Forward kinematics (DH transform chain)
    ik-solver.ts              # Inverse kinematics (LM-DLS)
    matrix4x4.ts              # 4×4 homogeneous transform matrix
    robot-config.ts           # KUKA-like DH parameters
    glb-robot-model.ts        # GLB-based model (Jacobian from 3D scene)
    motion-smoothing.ts       # Easing functions & joint interpolation
    motion-planner.ts         # Cartesian space step-wise motion planning
    capture-engine.ts         # Color / segmentation / depth capture
    waypoint-storage.ts       # localStorage waypoint persistence
    course-config.ts          # Complete teaching curriculum
    camera-config.ts          # Shared camera resolution constants
  components/             # React components
    GLBRobotArm.tsx           # GLB model loader & joint manipulator
    RobotScene.tsx            # 3D scene composition
    JointAngleCard.tsx        # Joint control panel
    PoseControlCard.tsx       # Cartesian pose control
    DirectionButton.tsx       # Long-press capable step buttons
    WaypointPanel.tsx         # Waypoint management UI
    DataOverlay.tsx           # Real-time pose display
    StatusBar.tsx             # Bottom status bar
    camera/                   # Virtual camera components
    operation/                # Operation panels (Robot, Camera, Grasp, Free)
    learning/                 # Learning panel (steps, explanations, theory)
    sequence/                 # Sequence editor
  hooks/                  # React hooks
    useRobot.ts               # Core robot control
    useMotion.ts              # RAF animation engine
    useVirtualCamera.ts       # Camera state management
    useSuckerControl.ts       # Sucker physics & attachment
    useActionSequence.ts      # Sequence execution engine
    useWaypoints.ts           # Waypoint storage wrapper
  contexts/               # React Context providers
```

## License

All Rights Reserved. This project is a proprietary educational product — see [LICENSE](LICENSE) for details.
