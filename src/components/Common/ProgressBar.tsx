import React from 'react';

interface ProgressBarProps {
  progress: number; // 0 to 100
  statusText?: string;
  subText?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  statusText = "Processing Video...", 
  subText = "Compressing stream while preserving full video duration..."
}) => {
  // Strictly clamp progress between 0 and 100 to prevent 100000000% overflow glitches
  const safeProgress = Number.isFinite(progress)
    ? Math.max(0, Math.min(100, Math.round(progress)))
    : 0;

  return (
    <div className="flex flex-col items-center justify-center p-8 border border-[var(--border-color)] bg-[var(--surface-color)] rounded-2xl max-w-lg mx-auto w-full shadow-lg transition-all duration-300">
      {/* Outer Spinner */}
      <div className="relative w-16 h-16 flex items-center justify-center mb-6">
        <div className="w-14 h-14 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] rounded-full animate-spin" />
        <span className="absolute text-[12px] font-extrabold text-[var(--text-primary)] font-sans tabular-nums">
          {safeProgress}%
        </span>
      </div>
      
      {/* Status Title */}
      <div className="text-sm font-bold tracking-tight text-[var(--text-primary)] text-center mb-2">
        {statusText}
      </div>
      
      {/* Smooth Progress Bar Container */}
      <div className="w-full bg-[var(--bg-color)] h-2.5 rounded-full relative my-3 border border-[var(--border-color)] overflow-hidden p-0.5">
        <div 
          className="h-full bg-[var(--text-primary)] rounded-full transition-all duration-300 ease-out relative opacity-90"
          style={{ width: `${safeProgress}%` }}
        />
      </div>
      
      {/* Progress metrics */}
      <div className="flex justify-between w-full text-[11px] font-bold text-[var(--text-secondary)] px-1 mt-1">
        <span>Processing</span>
        <span className="text-[var(--text-primary)] font-sans font-bold tabular-nums">{safeProgress}% Complete</span>
      </div>
      
      {subText && (
        <div className="text-xs text-[var(--text-secondary)] max-w-xs text-center leading-relaxed mt-3 font-medium">
          {subText}
        </div>
      )}
    </div>
  );
};

