import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface SearchableMultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const SearchableMultiSelect: React.FC<SearchableMultiSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  label,
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = (event: Event) => {
      // Don't close if scrolling inside the dropdown
      if (dropdownRef.current && event.target instanceof Node && dropdownRef.current.contains(event.target)) {
        return;
      }
      if (isOpen) setIsOpen(false);
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen]);

  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
    setIsOpen(!isOpen);
  };

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const dropdownContent = (
    <div 
      ref={dropdownRef}
      className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
      style={{ 
        top: coords.top + 4, 
        left: coords.left, 
        width: coords.width,
        maxHeight: '300px'
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="p-2 border-b border-slate-100 bg-slate-50 sticky top-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>
      </div>
      
      <div className="overflow-y-auto flex-1">
        {filteredOptions.length === 0 ? (
          <div className="p-4 text-center text-sm text-[color:var(--color-muted)]">
            Nenhum resultado encontrado
          </div>
        ) : (
          filteredOptions.map(option => {
            const isSelected = value.includes(option.value);
            return (
              <div
                key={option.value}
                className={`px-4 py-3 text-sm cursor-pointer transition-colors flex items-center justify-between ${
                  isSelected
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-[color:var(--color-text)] hover:bg-slate-50'
                }`}
                onClick={() => toggleOption(option.value)}
              >
                <span>{option.label}</span>
                {isSelected && <Check size={16} />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-bold text-[color:var(--color-muted)] uppercase mb-2">
          {label}
        </label>
      )}
      
      <div
        className={`w-full px-4 py-3 rounded-xl border bg-white flex items-center justify-between cursor-pointer transition-all ${
          isOpen ? 'ring-4 ring-blue-50 border-blue-500' : 'border-slate-200 hover:border-blue-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
        onClick={toggleOpen}
      >
        <span className={`font-medium truncate ${value.length > 0 ? 'text-[color:var(--color-text)]' : 'text-slate-400'}`}>
          {value.length > 0 
            ? `${value.length} selecionado${value.length > 1 ? 's' : ''}`
            : placeholder}
        </span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={() => setIsOpen(false)}
          />
          {dropdownContent}
        </>,
        document.body
      )}
    </div>
  );
};
