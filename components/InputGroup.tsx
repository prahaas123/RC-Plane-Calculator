import React from 'react';

interface InputGroupProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  helpText?: string;
}

export const InputGroup: React.FC<InputGroupProps> = ({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min = 0,
  max,
  helpText
}) => {
  return (
    <div className="flex flex-col gap-1 mb-4">
      <div className="flex justify-between items-center">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {label}
        </label>
        {helpText && <span className="text-xs text-slate-500 italic">{helpText}</span>}
      </div>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          step={step}
          min={min}
          max={max}
          className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent block w-full p-2.5 transition-all duration-200"
        />
        {unit && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <span className="text-slate-500 text-sm">{unit}</span>
          </div>
        )}
      </div>
    </div>
  );
};
