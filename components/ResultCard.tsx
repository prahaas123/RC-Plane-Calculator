import React from 'react';

interface ResultCardProps {
  label: string;
  value: string | number;
  unit?: string;
  highlight?: boolean;
  subtext?: string;
}

export const ResultCard: React.FC<ResultCardProps> = ({ label, value, unit, highlight = false, subtext }) => {
  return (
    <div className={`p-4 rounded-xl border ${highlight ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800 border-slate-700'}`}>
      <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</h3>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${highlight ? 'text-indigo-400' : 'text-slate-100'}`}>
          {value}
        </span>
        {unit && <span className="text-sm text-slate-500 font-medium">{unit}</span>}
      </div>
      {subtext && <p className="text-xs text-slate-500 mt-2">{subtext}</p>}
    </div>
  );
};
