// src/pages/Lab.tsx
// 实验室页面：承载原有 AppProviders 与 LabContent，保持所有 Context 与行为不变
import { AppProviders } from '@/contexts/AppProviders';
import LabContent from '@/components/layout/LabContent';

export default function Lab() {
  return (
    <AppProviders>
      <LabContent />
    </AppProviders>
  );
}
