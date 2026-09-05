export interface ToolModeOption {
  id: string;
  label: string;
}

interface ToolModeSwitcherProps {
  label: string;
  activeId: string;
  options: readonly ToolModeOption[];
  onSelect: (id: string) => void;
}

export function ToolModeSwitcher({ label, activeId, options, onSelect }: ToolModeSwitcherProps) {
  return (
    <nav className="tool-mode-switcher" aria-label={label}>
      {options.map(option => (
        <button
          key={option.id}
          type="button"
          aria-pressed={activeId === option.id}
          onClick={() => onSelect(option.id)}
        >
          {option.label}
        </button>
      ))}
    </nav>
  );
}
