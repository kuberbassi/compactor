import React from 'react';
import { Button } from '../ui/button';
import { ArrowLeft } from 'lucide-react';

interface ToolHeaderProps {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  onGoHome: () => void;
  badge?: string;
  actions?: React.ReactNode;
}

export const ToolHeader: React.FC<ToolHeaderProps> = ({
  title,
  description,
  icon: Icon,
  onGoHome,
  badge,
  actions
}) => {
  return (
    <div className="tool-layout__header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[var(--border-color)] mb-3">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {Icon && (
          <div className="p-2 rounded-xl bg-[var(--surface-color)] border border-[var(--border-color)] text-[var(--text-primary)] shrink-0 shadow-sm mt-0.5 flex items-center justify-center">
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--text-primary)]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-[var(--text-primary)] leading-tight">{title}</h1>
            {badge && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 uppercase tracking-wider shrink-0">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed line-clamp-2 sm:line-clamp-none">
            {description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
        {actions}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onGoHome} 
          className="h-8 sm:h-9 px-2.5 sm:px-3 text-xs font-semibold rounded-lg border-[var(--border-color)] bg-[var(--surface-color)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
        >
          <ArrowLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span className="hidden xs:inline">All tools</span>
          <span className="xs:hidden">Back</span>
        </Button>
      </div>
    </div>
  );
};
