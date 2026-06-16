// src/components/StepValueSelector.tsx
interface StepValueSelectorProps {
  values: number[];
  unit: string;
  current: number;
  onChange: (value: number) => void;
}

export default function StepValueSelector({ values, unit, current, onChange }: StepValueSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      {values.map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-2 py-0.5 text-xs font-medium border rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none ${
            current === v
              ? 'bg-[#2563EB] text-white border-[#2563EB]'
              : 'bg-white text-[#1E293B] border-[#D1D5DB] hover:bg-[#F9FAFB]'
          }`}
        >
          {v}
        </button>
      ))}
      <span className="text-xs text-[#64748B] ml-0.5">{unit}</span>
    </div>
  );
}
