import React from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';

export interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  onDismiss,
  onRetry,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`flex items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-200 text-xs shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 ${className}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
        <div className="space-y-0.5 min-w-0">
          <p className="font-bold text-rose-100 text-xs tracking-tight">Operation Notice</p>
          <p className="text-[11px] text-rose-200/90 break-words leading-relaxed">{message}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="h-7 px-2.5 bg-rose-900/60 border-rose-700/80 hover:bg-rose-850 text-rose-100 text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </Button>
        )}

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded-lg text-rose-300 hover:text-white hover:bg-rose-900/60 cursor-pointer transition-colors"
            title="Dismiss notice"
            aria-label="Dismiss error notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

