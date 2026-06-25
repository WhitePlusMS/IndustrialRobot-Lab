// src/App.tsx
// 根组件：配置客户端路由，/ 渲染首页，/lab 渲染实验室
import { BrowserRouter, Routes, Route } from 'react-router';
import Home from '@/pages/Home';
import Lab from '@/pages/Lab';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lab" element={<Lab />} />
      </Routes>
    </BrowserRouter>
  );
}
