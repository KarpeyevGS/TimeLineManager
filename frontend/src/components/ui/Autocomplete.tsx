import React, { useState, useRef, useEffect } from 'react';

interface AutocompleteProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const Autocomplete: React.FC<AutocompleteProps> = ({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  className = '',
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes (e.g. when field is reset)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const filtered = inputValue.trim()
    ? options.filter(o => o.toLowerCase().includes(inputValue.toLowerCase()))
    : options;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    onChange(v);
    setIsOpen(true);
  };

  const handleSelect = (opt: string) => {
    setInputValue(opt);
    onChange(opt);
    setIsOpen(false);
  };

  const handleFocus = () => {
    if (!disabled) setIsOpen(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Delay to allow click on option to fire first
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`} onBlur={handleBlur}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full h-7 px-2 text-xs rounded border border-app-border bg-white text-app-text-head placeholder:text-gray-300 outline-none focus:border-app-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      />
      {isOpen && filtered.length > 0 && (
        <ul className="absolute z-[500] top-full mt-0.5 left-0 right-0 bg-white border border-app-border rounded shadow-md max-h-40 overflow-y-auto">
          {filtered.map(opt => (
            <li
              key={opt}
              onMouseDown={() => handleSelect(opt)}
              className={`px-2 py-1 text-xs cursor-pointer hover:bg-app-primary/10 hover:text-app-primary transition-colors ${
                opt === value ? 'bg-app-primary/10 text-app-primary font-semibold' : 'text-app-text-main'
              }`}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
