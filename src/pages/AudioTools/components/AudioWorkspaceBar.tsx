import React from 'react';
import { Music } from 'lucide-react';
import { Button } from '../../../components/ui/button';

interface AudioWorkspaceBarProps {
  title: string;
  meta: string;
  onRemove?: () => void;
  removeLabel?: string;
  action?: React.ReactNode;
}

export const AudioWorkspaceBar: React.FC<AudioWorkspaceBarProps> = ({ title, meta, onRemove, removeLabel = 'Change file', action }) => (
  <div className="image-filebar audio-editor-panel__filebar h-11 border-b border-white/10 bg-[#18191e] flex items-center px-4 gap-3 text-xs text-zinc-400 shrink-0 justify-between">
    <div className="flex items-center gap-3 min-w-0">
      <Music className="w-4 h-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <strong className="block font-bold text-white truncate" title={title}>{title}</strong>
        <small className="block text-zinc-400 font-mono text-[11px]">{meta}</small>
      </div>
    </div>
    <div className="flex flex-none items-center gap-2">
      {onRemove && <Button type="button" variant="outline" size="sm" onClick={onRemove}>{removeLabel}</Button>}
      {action}
    </div>
  </div>
);
