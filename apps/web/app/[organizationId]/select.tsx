'use client';

import { useEffect, useRef, useState } from 'react';

interface Option {
  value: string;
  label: string;
}

/**
 * Themed replacement for a native <select>. Uncontrolled by default (hidden
 * input carries the value under `name` for FormData); pass value/onChange for
 * controlled use.
 */
export function Select({
  name,
  options,
  defaultValue,
  value: controlledValue,
  onChange,
  placeholder = 'Select…',
}: {
  name?: string;
  options: Option[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? options[0]?.value ?? '');
  const value = controlledValue ?? internalValue;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const selected = options.find((option) => option.value === value);

  return (
    <div ref={ref} className="relative">
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-[10px] border border-line bg-white px-3.5 py-2 text-left text-sm transition-colors hover:bg-primary-tint/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
      >
        <span className={`truncate ${selected ? 'text-ink' : 'text-muted/70'}`}>
          {selected?.label ?? placeholder}
        </span>
        <span aria-hidden className="text-xs text-muted">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-2 max-h-56 overflow-y-auto rounded-card border border-line bg-white p-2 shadow-lg"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setInternalValue(option.value);
                  onChange?.(option.value);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 text-left text-sm font-semibold transition-colors ${
                  active ? 'bg-primary-tint text-primary-deep' : 'text-ink hover:bg-primary-tint/60'
                }`}
              >
                <span className="truncate">{option.label}</span>
                {active && (
                  <span aria-hidden className="text-xs font-bold text-primary-deep">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
