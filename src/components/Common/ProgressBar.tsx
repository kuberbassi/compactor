import React from 'react';

interface ProgressBarProps {
  progress: number; // 0 to 100
  statusText?: string;
  subText?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  statusText = "Processing...", 
  subText = "Your file is being prepared."
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-10 border border-zinc-900 bg-[#0a0b0d] backdrop-blur-md rounded-3xl max-w-lg mx-auto w-full shadow-lg">
      {/* Spinner */}
      <div className="w-8 h-8 border-[3px] border-[var(--text-primary)] border-t-transparent rounded-full animate-spin mb-6"></div>
      
      <div className="text-lg font-bold tracking-tight text-[var(--text-primary)] text-center mb-6">{statusText}</div>
      
      {/* Progress bar - bigger and more visible */}
      <div className="w-full bg-[var(--bg-color)] h-4 rounded-full relative mb-3 border border-[var(--border-color)] overflow-hidden">
        <div 
          className="h-full bg-[var(--text-primary)] rounded-full transition-all duration-300 ease-out relative"
          style={{ 
            width: `${progress}%`
          }}
        >
          {/* Animated shimmer on bar */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite]" />
        </div>
      </div>
      
      <div className="text-2xl font-black text-[var(--text-primary)] mb-2">
        {Math.round(progress)}%
      </div>
      
      {subText && (
        <div className="text-sm text-[var(--text-secondary)] max-w-xs text-center leading-relaxed mt-2 font-medium">
          {subText}
        </div>
      )}
    </div>
  );
};
