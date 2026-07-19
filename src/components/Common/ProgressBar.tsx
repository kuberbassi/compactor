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
    <div className="flex flex-col items-center justify-center p-10 border border-zinc-800 bg-[#070a0f]/70 backdrop-blur-md rounded-3xl shadow-[0_0_40px_rgba(0,255,136,0.1)] max-w-lg mx-auto w-full">
      {/* Spinner */}
      <div className="w-8 h-8 border-[3px] border-[#00FF88] border-t-transparent rounded-full animate-spin mb-6 shadow-[0_0_12px_rgba(0,255,136,0.6)]"></div>
      
      <div className="text-lg font-bold tracking-tight text-white text-center mb-6">{statusText}</div>
      
      {/* Progress bar - bigger and more visible */}
      <div className="w-full bg-zinc-900 h-4 rounded-full relative mb-3 border border-zinc-800 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-[#00FF88] to-[#00E5FF] rounded-full transition-all duration-300 ease-out relative"
          style={{ 
            width: `${progress}%`,
            boxShadow: '0 0 16px #00FF88, 0 0 6px #00E5FF'
          }}
        >
          {/* Animated shimmer on bar */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.5s_infinite]" />
        </div>
      </div>
      
      <div className="text-2xl font-black text-[#00FF88] mb-2" style={{ textShadow: '0 0 20px rgba(0,255,136,0.5)' }}>
        {Math.round(progress)}%
      </div>
      
      {subText && (
        <div className="text-sm text-zinc-400 max-w-xs text-center leading-relaxed mt-2 font-medium">
          {subText}
        </div>
      )}
    </div>
  );
};
