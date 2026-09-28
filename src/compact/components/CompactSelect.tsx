import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface CompactSelectOption<T extends string | number> {
  value: T;
  label: string;
}

interface CompactSelectProps<T extends string | number> {
  value: T;
  options: CompactSelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel: string;
}

export function CompactSelect<T extends string | number>({ value, options, onChange, disabled = false, ariaLabel }: CompactSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find(option => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  return <div className={`compact-select ${open ? 'is-open' : ''}`} ref={rootRef}>
    <button type="button" className="compact-select__trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen(current => !current)}>
      <span>{selected?.label}</span><ChevronDown aria-hidden="true" />
    </button>
    {open ? <div className="compact-select__menu" role="listbox" aria-label={ariaLabel}>
      {options.map(option => <button type="button" role="option" aria-selected={option.value === value} key={String(option.value)} onClick={() => { onChange(option.value); setOpen(false); }}><span>{option.label}</span>{option.value === value ? <Check aria-hidden="true" /> : null}</button>)}
    </div> : null}
  </div>;
}
