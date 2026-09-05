import { ArrowLeft, ZoomIn, ZoomOut } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface WorkspaceZoomControlsProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function WorkspaceZoomControls({
  value,
  onChange,
  min = 25,
  max = 300,
  step = 10,
  className = '',
}: WorkspaceZoomControlsProps) {
  return (
    <div className={`workspace-zoom-controls ${className}`} role="group" aria-label="Zoom controls">
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} aria-label="Zoom out">
        <ZoomOut aria-hidden="true" />
      </button>
      <button type="button" onClick={() => onChange(100)} className="workspace-zoom-controls__value" title="Reset zoom to 100%">
        {value}%
      </button>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} aria-label="Zoom in">
        <ZoomIn aria-hidden="true" />
      </button>
    </div>
  );
}

interface WorkspaceSidebarHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export function WorkspaceSidebarHeader({ title, subtitle, onBack }: WorkspaceSidebarHeaderProps) {
  return (
    <header className="workspace-sidebar-header">
      {onBack ? (
        <button type="button" onClick={onBack} className="workspace-sidebar-header__back" aria-label="Go back">
          <ArrowLeft aria-hidden="true" />
        </button>
      ) : null}
      <span className="workspace-sidebar-header__copy">
        <strong>{title}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
    </header>
  );
}

export interface WorkspaceToolItem<T extends string> {
  id: T;
  label: string;
  Icon: LucideIcon;
}

interface WorkspaceToolNavProps<T extends string> {
  items: readonly WorkspaceToolItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  label?: string;
  disabledIds?: readonly T[];
}

export function WorkspaceToolNav<T extends string>({ items, activeId, onChange, label = 'Workspace tools', disabledIds = [] }: WorkspaceToolNavProps<T>) {
  return (
    <nav className="workspace-tool-nav" aria-label={label}>
      {items.map(({ id, label: itemLabel, Icon }) => {
        const disabled = disabledIds.includes(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={activeId === id ? 'page' : undefined}
            disabled={disabled}
            title={disabled ? `${itemLabel} is unavailable for audio-only export` : undefined}
          >
            <Icon aria-hidden="true" />
            <span>{itemLabel}</span>
          </button>
        );
      })}
    </nav>
  );
}
