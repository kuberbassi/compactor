import { useMemo, useRef, useState } from 'react';
import { Download, FilePlus2, RotateCcw, X } from 'lucide-react';
import { CompactShell } from './components/CompactShell';
import type { CompactToolCapability } from './compactTools';
import { compactAudioAdapter, compactVideoAdapter, type CompactAudioSettings, type CompactVideoSettings } from './mediaCompressionAdapters';
import { summarizeCompactJobs } from './queue/compactQueue';
import { useCompactQueue, type CompactQueueAdapter } from './queue/useCompactQueue';
import { downloadResult, loadSetting, saveSetting } from '../utils/batch';
import { formatBytes } from '../utils/image';
import { CompactSelect } from './components/CompactSelect';
import { CompactResultScreen } from './components/CompactResultScreen';
import { CompactFilePreview } from './components/CompactFilePreview';

interface CompactMediaCompressorProps {
  tool: CompactToolCapability;
  onGoHome: () => void;
  onProcessed: (count: number) => void;
}

const AUDIO_SETTINGS_KEY = 'compactor:compact:audio-settings';
const VIDEO_SETTINGS_KEY = 'compactor:compact:video-settings';
type MediaSettings = CompactAudioSettings | CompactVideoSettings;

export function CompactMediaCompressor({ tool, onGoHome, onProcessed }: CompactMediaCompressorProps) {
  const isAudio = tool.id === 'audio-optimizer';
  const inputRef = useRef<HTMLInputElement>(null);
  const [audioSettings, setAudioSettings] = useState<CompactAudioSettings>(() => loadSetting(AUDIO_SETTINGS_KEY, { format: 'mp3', bitrate: '128k', removeMetadata: true, normalizeAudio: false, channels: 'original', removeSilence: false, noiseReduction: false, bassBoost: false }));
  const [videoSettings, setVideoSettings] = useState<CompactVideoSettings>(() => {
    const defaults: CompactVideoSettings = { format: 'mp4', quality: 'balanced', scale: '1280:720', removeAudio: false, removeMetadata: true, target: 'general', watermarkText: '', watermarkOpacity: .35 };
    return { ...defaults, ...loadSetting(VIDEO_SETTINGS_KEY, defaults) };
  });
  const adapter = useMemo<CompactQueueAdapter<MediaSettings>>(() => ({
    accepts: isAudio ? compactAudioAdapter.accepts : compactVideoAdapter.accepts,
    process: (file, settings, onProgress) => isAudio
      ? compactAudioAdapter.process(file, settings as CompactAudioSettings, onProgress)
      : compactVideoAdapter.process(file, settings as CompactVideoSettings, onProgress),
    cancelActive: isAudio ? compactAudioAdapter.cancelActive : compactVideoAdapter.cancelActive,
  }), [isAudio]);
  const settings: MediaSettings = isAudio ? audioSettings : videoSettings;
  const queue = useCompactQueue(adapter, settings, onProcessed);
  const completed = queue.jobs.filter(job => job.status === 'complete' && job.result).map(job => job.result!);
  const summary = useMemo(() => summarizeCompactJobs(queue.jobs), [queue.jobs]);
  const chooseFiles = () => inputRef.current?.click();
  const updateAudio = (next: CompactAudioSettings) => { setAudioSettings(next); saveSetting(AUDIO_SETTINGS_KEY, next); };
  const updateVideo = (next: CompactVideoSettings) => { setVideoSettings(next); saveSetting(VIDEO_SETTINGS_KEY, next); };

  if (completed.length > 0 && !queue.processing && queue.jobs.every(job => ['complete', 'failed', 'cancelled'].includes(job.status))) {
    return <CompactResultScreen title={tool.route.title} results={completed} originalSize={summary.originalSize} outputSize={summary.outputSize} failed={summary.failed} zipName={`compactor-${isAudio ? 'audio' : 'video'}.zip`} onNewBatch={queue.clear} onGoHome={onGoHome} />;
  }

  return (
    <CompactShell
      title={tool.route.title}
      onBack={onGoHome}
      action={queue.jobs.length > 0 ? queue.processing
        ? <button type="button" className="compact-primary-action compact-primary-action--danger" onClick={queue.cancel}>Cancel active job</button>
        : <button type="button" className="compact-primary-action" onClick={() => void queue.run()}>Compress {queue.jobs.filter(job => job.status !== 'complete').length} {queue.jobs.length === 1 ? 'file' : 'files'}</button>
        : undefined}
    >
      <input ref={inputRef} className="compact-file-input" type="file" multiple accept={isAudio ? 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac' : 'video/*,.mp4,.webm,.mov,.mkv,.avi,.m4v'} onChange={event => { queue.addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ''; }} />
      <section className="compact-compressor-hero">
        <p className="compact-kicker">Sequential local processing</p>
        <h1>{isAudio ? 'Compress audio without the editor layout.' : 'Make videos easier to share.'}</h1>
        <p>{isAudio ? 'Choose a simple output, queue several tracks, and keep each completed result.' : 'Videos run one at a time to reduce memory pressure on narrow devices.'}</p>
      </section>
      {queue.jobs.length === 0 ? <button type="button" className="compact-file-picker" onClick={chooseFiles}><span><FilePlus2 /></span><strong>Add {isAudio ? 'audio' : 'video'} files</strong><small>Keep this tab open and the screen awake while processing</small></button> : null}
      <aside className="compact-resource-note"><strong>Before you start</strong><span>Large media jobs depend on available device memory. Completed results remain available if a later item fails.</span></aside>
      {queue.notice ? <p className="compact-queue-notice" role="status">{queue.notice}</p> : null}
      {queue.jobs[0] ? <CompactFilePreview file={queue.jobs[0].file} kind={isAudio ? 'audio' : 'video'} title={`${isAudio ? 'Audio' : 'Video'} preview`} overlayText={isAudio ? '' : videoSettings.watermarkText} overlayOpacity={isAudio ? undefined : videoSettings.watermarkOpacity} /> : null}

      {queue.jobs.length > 0 ? <>
        <section className="compact-settings" aria-label="Compression options">
          <div className="compact-section-title"><div><span>Options</span><h2>Applied to this queue</h2></div></div>
          {isAudio ? <>
            <label><span>Output format</span><CompactSelect ariaLabel="Output format" value={audioSettings.format} onChange={format => updateAudio({ ...audioSettings, format })} options={[{ value: 'mp3', label: 'MP3' }, { value: 'm4a', label: 'M4A' }, { value: 'ogg', label: 'OGG' }, { value: 'wav', label: 'WAV' }]} /></label>
            <label><span>Bitrate</span><CompactSelect ariaLabel="Bitrate" value={audioSettings.bitrate} disabled={audioSettings.format === 'wav'} onChange={bitrate => updateAudio({ ...audioSettings, bitrate })} options={[{ value: '64k', label: '64 kbps' }, { value: '96k', label: '96 kbps' }, { value: '128k', label: '128 kbps' }, { value: '192k', label: '192 kbps' }]} /></label>
            <label><span>Channels</span><CompactSelect ariaLabel="Channels" value={audioSettings.channels} onChange={channels => updateAudio({ ...audioSettings, channels })} options={[{ value: 'original', label: 'Keep original' }, { value: 'mono', label: 'Mono' }, { value: 'stereo', label: 'Stereo' }]} /></label>
            <details className="compact-advanced"><summary>Advanced audio options</summary>
              <Toggle label="Normalize loudness" checked={audioSettings.normalizeAudio} onChange={checked => updateAudio({ ...audioSettings, normalizeAudio: checked })} />
              <Toggle label="Remove long silence" checked={audioSettings.removeSilence} onChange={checked => updateAudio({ ...audioSettings, removeSilence: checked })} />
              <Toggle label="Reduce background noise" checked={audioSettings.noiseReduction} onChange={checked => updateAudio({ ...audioSettings, noiseReduction: checked })} />
              <Toggle label="Bass boost" checked={audioSettings.bassBoost} onChange={checked => updateAudio({ ...audioSettings, bassBoost: checked })} />
              <Toggle label="Remove metadata" checked={audioSettings.removeMetadata} onChange={checked => updateAudio({ ...audioSettings, removeMetadata: checked })} />
            </details>
          </> : <>
            <label><span>Optimized for</span><CompactSelect ariaLabel="Video target" value={videoSettings.target} onChange={target => updateVideo({ ...videoSettings, target })} options={[{ value: 'general', label: 'General / custom' }, { value: 'whatsapp', label: 'WhatsApp (≤16 MB)' }, { value: 'discord', label: 'Discord Free (≤10 MB)' }, { value: 'instagram', label: 'Instagram Reels (≤95 MB)' }, { value: 'tiktok', label: 'TikTok (≤70 MB)' }]} /></label>
            <label><span>Output format</span><CompactSelect ariaLabel="Output format" value={videoSettings.format} onChange={format => updateVideo({ ...videoSettings, format })} options={[{ value: 'mp4', label: 'MP4' }, { value: 'webm', label: 'WebM' }]} /></label>
            <label><span>Compression</span><CompactSelect ariaLabel="Compression" value={videoSettings.quality} onChange={quality => updateVideo({ ...videoSettings, quality })} options={[{ value: 'smaller', label: 'Smaller file' }, { value: 'balanced', label: 'Balanced' }, { value: 'higher', label: 'Higher quality' }]} /></label>
            <label><span>Maximum resolution</span><CompactSelect ariaLabel="Maximum resolution" value={videoSettings.scale} onChange={scale => updateVideo({ ...videoSettings, scale })} options={[{ value: 'no-scale', label: 'Keep original' }, { value: '1280:720', label: '720p' }, { value: '854:480', label: '480p' }, { value: '640:360', label: '360p' }]} /></label>
            <details className="compact-advanced"><summary>Watermark</summary><label><span>Text</span><input className="compact-text-input" maxLength={48} value={videoSettings.watermarkText} placeholder="Optional watermark" onChange={event => updateVideo({ ...videoSettings, watermarkText: event.target.value })} /></label>{videoSettings.watermarkText ? <label><span>Opacity <b>{Math.round(videoSettings.watermarkOpacity * 100)}%</b></span><input type="range" min="10" max="80" value={videoSettings.watermarkOpacity * 100} onChange={event => updateVideo({ ...videoSettings, watermarkOpacity: Number(event.target.value) / 100 })} /></label> : null}</details>
            <details className="compact-advanced"><summary>Advanced video options</summary><Toggle label="Remove audio" checked={videoSettings.removeAudio} onChange={checked => updateVideo({ ...videoSettings, removeAudio: checked })} /><Toggle label="Remove metadata" checked={videoSettings.removeMetadata} onChange={checked => updateVideo({ ...videoSettings, removeMetadata: checked })} /></details>
          </>}
        </section>

        <section className="compact-queue" aria-label="Processing queue"><div className="compact-section-title"><div><span>Queue</span><h2>{queue.jobs.length} {queue.jobs.length === 1 ? 'file' : 'files'}</h2></div><div className="compact-section-title__actions"><button type="button" onClick={chooseFiles} disabled={queue.processing}><FilePlus2 /> Add files</button><button type="button" onClick={queue.clear} disabled={queue.processing}>Clear</button></div></div><div className="compact-queue__list">
          {queue.jobs.map(job => <article key={job.id} className={`compact-queue-item is-${job.status}`}><div className="compact-queue-item__copy"><strong>{job.file.name}</strong><small>{formatBytes(job.file.size)} · {job.status}{job.status === 'processing' ? ` · ${Math.round(job.progress)}%` : ''}</small>{job.error ? <em role="alert">{job.error}</em> : null}</div><div className="compact-queue-item__actions">{job.status === 'complete' && job.result ? <button type="button" onClick={() => downloadResult(job.result!)} aria-label={`Download ${job.result.name}`}><Download /></button> : null}{job.status === 'failed' || job.status === 'cancelled' ? <button type="button" onClick={() => void queue.retry(job.id)} aria-label={`Retry ${job.file.name}`}><RotateCcw /></button> : null}{!queue.processing ? <button type="button" onClick={() => queue.removeJob(job.id)} aria-label={`Remove ${job.file.name}`}><X /></button> : null}</div>{job.status === 'processing' ? <span className="compact-queue-item__progress" style={{ width: `${job.progress}%` }} /> : null}</article>)}
        </div></section>
      </> : null}

    </CompactShell>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="compact-toggle"><span><strong>{label}</strong></span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /></label>;
}
