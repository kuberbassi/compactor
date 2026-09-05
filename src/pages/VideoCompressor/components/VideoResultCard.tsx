import React from 'react';
import { Video as FileVideo, Download, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { formatBytes } from '../../../utils/image';
import { shareResult } from '../../../utils/batch';

export interface VideoResultData {
  url: string;
  name: string;
  originalSize: number;
  newSize: number;
}

export interface VideoResultCardProps {
  file: File | null;
  result: VideoResultData;
  mode: string;
  createsGif: boolean;
  extractAudio: boolean;
  onReset: () => void;
}

export const VideoResultCard: React.FC<VideoResultCardProps> = ({
  file,
  result,
  mode,
  createsGif,
  extractAudio,
  onReset,
}) => {
  const savings = result.originalSize > 0
    ? Math.max(0, Math.round(((result.originalSize - result.newSize) / result.originalSize) * 100))
    : 0;

  return (
    <div className="video-result-workbench">
      <section className="video-result-stage" aria-label="Completed video export">
        {/* Card Top Bar with File Tag & Reset */}
        <div className="video-result-filebar">
          <div className="flex items-center gap-2 truncate bg-[var(--bg-color)]/50 px-3 py-1.5 rounded-full border border-[var(--border-color)]">
            <FileVideo className="w-4 h-4 text-sky-500 shrink-0" />
            <span className="text-xs font-bold text-[var(--text-primary)] truncate max-w-xs">{file?.name || result.name}</span>
          </div>
          <Button 
            variant="ghost" 
            onClick={onReset} 
            className="text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 text-xs h-7 px-2 rounded-full cursor-pointer transition-colors"
            title="Start over with another file"
          >
            ✕
          </Button>
        </div>

        {/* Original vs Compressed Metrics */}
        <div className="video-result-metrics">
          <div className="p-4 bg-[var(--bg-color)]/30 border border-[var(--border-color)] rounded-xl text-center">
            <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Original Size</span>
            <span className="block text-2xl font-black text-[var(--text-primary)] mt-1">{formatBytes(result.originalSize)}</span>
          </div>
          <div className="p-4 bg-[var(--bg-color)]/30 border border-[var(--border-color)] rounded-xl text-center">
            <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Compressed Size</span>
            <span className="block text-2xl font-black text-white mt-1">{formatBytes(result.newSize)}</span>
          </div>
        </div>

        {/* Media Player Preview Section */}
        <div className="video-result-preview">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              {extractAudio ? 'Audio Track Preview' : createsGif ? 'GIF Animation Preview' : 'Video Preview'}
            </span>
            <span className="text-[11px] font-bold text-zinc-200 bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700">
              {result.name.split('.').pop()?.toUpperCase()} Format
            </span>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-black border border-[var(--border-color)] shadow-inner">
            {extractAudio || ['mp3', 'aac', 'wav', 'flac', 'ogg', 'm4a'].includes(result.name.split('.').pop()?.toLowerCase() || '') ? (
              <div className="video-result-audio-player">
                <div className="video-result-audio-player__icon">
                  <FileVideo className="w-6 h-6" />
                </div>
                <div className="video-result-audio-player__copy">
                  <span>Extracted audio track</span>
                  <strong>{result.name}</strong>
                </div>
                <audio src={result.url} controls preload="metadata" />
              </div>
            ) : createsGif || /\.gif$/i.test(result.name) ? (
              <img src={result.url} alt="Result GIF" className="w-full max-h-[280px] sm:max-h-[360px] object-contain mx-auto" />
            ) : (
              <video 
                src={result.url} 
                controls 
                preload="metadata"
                playsInline
                className="w-full max-h-[280px] sm:max-h-[360px] object-contain mx-auto" 
              />
            )}
          </div>
        </div>

        {/* Bottom Bar: Savings Tag & Download Action */}
        <div className="video-result-actions-dock">
          <div className="flex items-center gap-2">
            <div className="status-dot-glow shrink-0" />
            <span className="text-xs font-bold text-zinc-200">
              {savings > 0 
                ? `Saved ${savings}% of original size` 
                : `Optimal Size (${formatBytes(result.newSize)})`}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={onReset} 
              className="h-11 text-xs rounded-xl border-[var(--border-color)] px-4 font-bold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Another
            </Button>
            <a 
              href={result.url} 
              download={result.name}
              className="video-result-download workspace-primary-action"
            >
              <Download className="w-4 h-4" /> 
              {extractAudio ? 'Download Audio Track' : createsGif ? 'Download GIF' : mode === 'mute' ? 'Download Muted Video' : 'Download Compressed Video'}
            </a>
            <Button
              variant="outline" 
              onClick={() => shareResult(result).catch(console.error)}
              className="batch-action batch-action--secondary h-11 cursor-pointer"
            >
              Share
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
