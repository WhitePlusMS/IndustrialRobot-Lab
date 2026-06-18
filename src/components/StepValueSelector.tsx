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
          type="button"
          key={v}
          aria-pressed={current === v}
          onClick={() => onChange(v)}
          className={`px-2 py-0.5 text-xs font-medium border rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
            current === v
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          {v}
        </button>
      ))}
      <span className="text-xs text-slate-500 ml-0.5">{unit}</span>
    </div>
  );
}
