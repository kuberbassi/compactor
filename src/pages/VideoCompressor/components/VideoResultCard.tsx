import React from 'react';
import { CheckCircle2, RefreshCw, Share2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { ResultDownloadButton } from '../../../components/Common/ResultDownloadButton';
import { formatBytes } from '../../../utils/image';
import { shareResult } from '../../../utils/batch';

export interface VideoResultData { url: string; name: string; originalSize: number; newSize: number; blob: Blob; }
export interface VideoResultCardProps { file: File | null; result: VideoResultData; mode: string; createsGif: boolean; extractAudio: boolean; onReset: () => void; }

export const VideoResultCard: React.FC<VideoResultCardProps> = ({ file, result, mode, createsGif, extractAudio, onReset }) => {
  const extension = result.name.split('.').pop()?.toLowerCase() || '';
  const isAudio = extractAudio || ['mp3', 'aac', 'wav', 'flac', 'ogg', 'm4a'].includes(extension);
  const isGif = createsGif || extension === 'gif';
  const savings = result.originalSize > 0 ? Math.max(0, Math.round(((result.originalSize - result.newSize) / result.originalSize) * 100)) : 0;
  const downloadLabel = isAudio ? 'Download Audio' : isGif ? 'Download GIF' : mode === 'mute' ? 'Download Muted Video' : 'Download Video';

  return <div className="pdf-export-result-wrap video-export-result-wrap" role="region" aria-label="Video export result">
    <section className="pdf-export-result video-export-result w-full max-w-6xl p-5 sm:p-6" aria-label="Completed video export">
      <header className="video-export-result__header">
        <span className="pdf-export-result__success-icon"><CheckCircle2 aria-hidden="true" /></span>
        <p>Export complete</p>
        <h2>{isAudio ? 'Audio ready' : isGif ? 'GIF ready' : 'Video ready'}</h2>
        <span>{file?.name || 'Your media'} was exported successfully.</span>
      </header>
      <div className="video-export-result__preview">
        {isAudio ? <audio src={result.url} controls preload="metadata" /> : isGif ? <img src={result.url} alt="Exported GIF preview" /> : <video src={result.url} controls preload="metadata" playsInline />}
      </div>
      <dl className="video-export-result__metrics" aria-label="Export details">
        <div><dt>Original</dt><dd>{formatBytes(result.originalSize)}</dd></div>
        <div><dt>Export</dt><dd>{formatBytes(result.newSize)}</dd></div>
        <div><dt>Result</dt><dd>{savings > 0 ? `${savings}% smaller` : 'Ready'}</dd></div>
      </dl>
      <div className="video-export-result__file">
        <div><strong>{result.name}</strong><span>{formatBytes(result.newSize)} · {extension.toUpperCase()}</span></div>
        <ResultDownloadButton result={result} className="pdf-export-result__primary video-result-download">{downloadLabel}</ResultDownloadButton>
      </div>
      <footer className="video-export-result__actions">
        <Button variant="outline" onClick={onReset}><RefreshCw aria-hidden="true" />Another</Button>
        <Button variant="outline" onClick={() => shareResult(result).catch(console.error)}><Share2 aria-hidden="true" />Share</Button>
      </footer>
    </section>
  </div>;
};
