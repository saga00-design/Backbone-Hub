
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label?: string; description?: string }[];
  placeholder?: string;
  label?: string;
  required?: boolean;
  id?: string;
  className?: string;
}

export const Combobox: React.FC<ComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select or type...",
  label,
  required,
  id,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.value.toLowerCase().includes(inputValue.toLowerCase()) || 
    (opt.label && opt.label.toLowerCase().includes(inputValue.toLowerCase()))
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val);
    setIsOpen(true);
  };

  const handleSelect = (val: string) => {
    setInputValue(val);
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label htmlFor={id} className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1 mb-1.5 block">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          id={id}
          required={required}
          className="block w-full bg-secondary-surface border-border-grey rounded-xl shadow-sm py-3 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-text-navy sm:text-sm transition-all placeholder-text-muted/50"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-navy"
          onClick={() => setIsOpen(!isOpen)}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-[100] mt-1 w-full bg-card-bg border border-border-grey rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
          {filteredOptions.length > 0 ? (
            <div className="py-1">
              {filteredOptions.map((opt, idx) => (
                <button
                  key={`${opt.value}-${idx}`}
                  type="button"
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-secondary-surface transition-colors flex flex-col ${value === opt.value ? 'bg-accent/5' : ''}`}
                  onClick={() => handleSelect(opt.value)}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${value === opt.value ? 'text-accent' : 'text-text-navy'}`}>
                      {opt.label || opt.value}
                    </span>
                    {value === opt.value && <Check className="h-4 w-4 text-accent" />}
                  </div>
                  {opt.description && (
                    <span className="text-[10px] text-text-muted mt-0.5">{opt.description}</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-text-muted italic">
              No matches found. Press enter to use "{inputValue}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};
