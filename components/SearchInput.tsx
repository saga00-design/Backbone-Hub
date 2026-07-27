import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** 'full' rounds all four corners (default). 'left' rounds only the left corners, for use
   * when another control (e.g. a barcode scan button) is attached flush to the right. */
  rounded?: 'full' | 'left';
}

// Shared search bar used on Stock Orders, Inventory, Menu Recipes, and Stock Count so all four
// look and behave identically: a search icon, the input, and a clear (x) button that only
// appears once text has been typed.
export const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, placeholder = 'Search...', className = '', rounded = 'full' }) => {
  return (
    <div className={`relative group ${className}`}>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted/50 group-focus-within:text-accent transition-colors pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`bg-main-bg border-border-grey text-text-navy block w-full pl-11 pr-9 py-2.5 text-sm border focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder-text-muted/30 ${rounded === 'left' ? 'rounded-l-xl' : 'rounded-xl'}`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted/50 hover:text-text-navy transition-colors"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
