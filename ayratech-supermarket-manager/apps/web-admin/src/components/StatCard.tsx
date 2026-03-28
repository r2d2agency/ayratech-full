import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: string;
  sub?: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, trend, sub, color }) => (
  <div className="bg-[color:var(--surface-container-low)] rounded-xl border border-[color:var(--color-border)] p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-4 group">
    <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center transition-transform group-hover:scale-105`}>
      {React.isValidElement(icon) && React.cloneElement(icon as React.ReactElement<any>, { size: 18, strokeWidth: 1.5 })}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-[color:var(--color-text)] truncate">{label}</p>
      {(sub || trend) && (
        <div className="flex items-center gap-2 mt-0.5">
          {sub && <p className="text-[11px] text-[color:var(--color-muted)] truncate">{sub}</p>}
          {trend && <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{trend}</span>}
        </div>
      )}
    </div>
    <div className="text-lg font-semibold text-[color:var(--color-text)] tracking-tight">
      {value}
    </div>
  </div>
);

export default StatCard;
