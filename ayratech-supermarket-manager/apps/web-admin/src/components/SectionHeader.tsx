
import React from 'react';

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, subtitle }) => {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        {icon && React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 18, strokeWidth: 2, className: 'text-[color:var(--color-primary)]' }) : icon}
        <h2 className="text-base font-semibold text-[color:var(--color-text)]">{title}</h2>
      </div>
      {subtitle && <p className="text-[color:var(--color-muted)] text-xs mt-1">{subtitle}</p>}
    </div>
  );
};

export default SectionHeader;
