import React from 'react';
import { LoaderCircle, ShieldCheck } from 'lucide-react';

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
    <div className="process-card" role="status" aria-live="polite" aria-label={`${statusText} ${safeProgress}% complete`}>
      <div className="process-card__icon"><LoaderCircle aria-hidden="true" /></div>
      <div className="process-card__copy">
        <span className="process-card__eyebrow"><ShieldCheck aria-hidden="true" /> Local processing</span>
        <strong>{statusText}</strong>
        {subText ? <p>{subText}</p> : null}
      </div>
      <strong className="process-card__value">{safeProgress}%</strong>
      <div className="process-card__track" aria-hidden="true"><i style={{ width: `${safeProgress}%` }} /></div>
      <div className="process-card__meta"><span>Processing on this device</span><span>{safeProgress === 100 ? 'Ready' : 'Please keep this tab open'}</span></div>
    </div>
  );
};
