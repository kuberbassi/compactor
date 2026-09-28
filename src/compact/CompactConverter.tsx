import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Download, FilePlus2, RotateCcw, X } from 'lucide-react';
import { CompactShell } from './components/CompactShell';
import { useCompactQueue, type CompactQueueAdapter } from './queue/useCompactQueue';
import { summarizeCompactJobs } from './queue/compactQueue';
import { downloadResult } from '../utils/batch';
import { formatBytes } from '../utils/image';
import {
  getCommonSupportedTargets,
  getConversionLimitation,
  getFileExtension,
  getPreferredTarget,
  isSupportedSourceFormat,
} from '../utils/conversionCapabilities';
import { CompactSelect } from './components/CompactSelect';
import { CompactResultScreen } from './components/CompactResultScreen';

interface CompactConverterProps {
  onGoHome: () => void;
  onProcessed: (count: number) => void;
}

interface CompactConverterSettings {
  target: string;
}

export function CompactConverter({ onGoHome, onProcessed }: CompactConverterProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState('');
  const [compatibilityNotice, setCompatibilityNotice] = useState('');
  const adapter = useMemo<CompactQueueAdapter<CompactConverterSettings>>(() => ({
    accepts: file => isSupportedSourceFormat(getFileExtension(file)),
    process: async (file, settings, onProgress) => {
      const { convertUniversalFile } = await import('../utils/universalConversion');
      const converted = await convertUniversalFile(file, settings.target, (progress) => onProgress(progress));
      return { blob: converted.blob, name: converted.name, originalSize: file.size, newSize: converted.blob.size };
    },
    cancelActive: async () => {
      const { terminateFFmpeg } = await import('../utils/ffmpeg');
      await terminateFFmpeg();
    },
  }), []);
  const queue = useCompactQueue(adapter, { target }, onProcessed);
  const files = useMemo(() => queue.jobs.map(job => job.file), [queue.jobs]);
  const targets = useMemo(() => getCommonSupportedTargets(files), [files]);
  const completed = queue.jobs.filter(job => job.status === 'complete' && job.result).map(job => job.result!);
  const summary = useMemo(() => summarizeCompactJobs(queue.jobs), [queue.jobs]);

  useEffect(() => {
    if (files.length === 0) { setTarget(''); return; }
    if (!targets.has(target)) setTarget(getPreferredTarget(files, targets));
  }, [files, target, targets]);

  const addFiles = (incoming: File[]) => {
    const accepted: File[] = [];
    const rejected: string[] = [];
    const finishedBatch = queue.jobs.length > 0 && queue.jobs.every(job => ['complete', 'failed', 'cancelled'].includes(job.status));
    const existing = finishedBatch ? [] : queue.jobs.map(job => job.file);
    for (const file of incoming) {
      const candidate = [...existing, ...accepted, file];
      if (!isSupportedSourceFormat(getFileExtension(file)) || (candidate.length > 1 && getCommonSupportedTargets(candidate).size === 0)) rejected.push(file.name);
      else accepted.push(file);
    }
    queue.addFiles(accepted);
    setCompatibilityNotice(rejected.length ? `${rejected.length} ${rejected.length === 1 ? 'file does' : 'files do'} not share a conversion target with this queue: ${rejected.join(', ')}` : '');
  };
  const chooseFiles = () => inputRef.current?.click();
  const pendingCount = queue.jobs.filter(job => job.status !== 'complete').length;

  if (completed.length > 0 && !queue.processing && queue.jobs.every(job => ['complete', 'failed', 'cancelled'].includes(job.status))) {
    return <CompactResultScreen title="Convert Files" results={completed} originalSize={summary.originalSize} outputSize={summary.outputSize} failed={summary.failed} zipName="compactor-converted.zip" onNewBatch={() => { queue.clear(); setCompatibilityNotice(''); }} onGoHome={onGoHome} />;
  }

  return (
    <CompactShell
      title="Convert Files"
      onBack={onGoHome}
      action={queue.jobs.length ? queue.processing
        ? <button type="button" className="compact-primary-action compact-primary-action--danger" onClick={queue.cancel}>Stop conversion</button>
        : <button type="button" className="compact-primary-action" disabled={!target} onClick={() => void queue.run()}>Convert {pendingCount} to {target.toUpperCase()}</button>
        : undefined}
    >
      <input ref={inputRef} className="compact-file-input" type="file" multiple onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ''; }} />
      <section className="compact-compressor-hero"><p className="compact-kicker">Universal file converter</p><h1>Choose files, then one shared output.</h1><p>Compatible files can be converted together using the same verified engines as the desktop workspace.</p></section>
      {queue.jobs.length === 0 ? <button type="button" className="compact-file-picker" onClick={chooseFiles}><span><FilePlus2 /></span><strong>Add files to convert</strong><small>Documents, images, audio, video, text, and structured data</small></button> : null}
      {queue.notice || compatibilityNotice ? <p className="compact-queue-notice" role="status">{[queue.notice, compatibilityNotice].filter(Boolean).join(' ')}</p> : null}

      {queue.jobs.length ? <>
        <section className="compact-settings" aria-label="Conversion target">
          <div className="compact-section-title"><div><span>Output</span><h2>Shared compatible formats</h2></div></div>
          <label><span>Convert every file to</span><CompactSelect ariaLabel="Convert every file to" value={target} onChange={setTarget} options={Array.from(targets).map(format => ({ value: format, label: format.toUpperCase() }))} /></label>
          <p className="compact-settings__note">{getConversionLimitation(getFileExtension(files[0]))}</p>
        </section>

        <section className="compact-queue" aria-label="Conversion queue"><div className="compact-section-title"><div><span>Queue</span><h2>{queue.jobs.length} {queue.jobs.length === 1 ? 'file' : 'files'}</h2></div><div className="compact-section-title__actions"><button type="button" onClick={chooseFiles} disabled={queue.processing}><FilePlus2 /> Add files</button><button type="button" disabled={queue.processing} onClick={() => { queue.clear(); setCompatibilityNotice(''); }}>Clear</button></div></div><div className="compact-queue__list">
          {queue.jobs.map((job, index) => <article key={job.id} className={`compact-queue-item is-${job.status}`}><div className="compact-queue-item__copy"><strong>{job.file.name}</strong><small>{getFileExtension(job.file).toUpperCase()} · {formatBytes(job.file.size)} · {job.status}{job.status === 'processing' ? ` · ${Math.round(job.progress)}%` : ''}</small>{job.error ? <em role="alert">{job.error}</em> : null}</div><div className="compact-queue-item__actions">{job.status === 'complete' && job.result ? <button type="button" aria-label={`Download ${job.result.name}`} onClick={() => downloadResult(job.result!)}><Download /></button> : null}{job.status === 'failed' || job.status === 'cancelled' ? <button type="button" aria-label={`Retry ${job.file.name}`} onClick={() => void queue.retry(job.id)}><RotateCcw /></button> : null}{job.status === 'pending' && index > 0 ? <button type="button" aria-label={`Move ${job.file.name} up`} onClick={() => queue.moveJob(index, index - 1)}><ArrowUp /></button> : null}{job.status === 'pending' && index < queue.jobs.length - 1 ? <button type="button" aria-label={`Move ${job.file.name} down`} onClick={() => queue.moveJob(index, index + 1)}><ArrowDown /></button> : null}{!queue.processing ? <button type="button" aria-label={`Remove ${job.file.name}`} onClick={() => queue.removeJob(job.id)}><X /></button> : null}</div>{job.status === 'processing' ? <span className="compact-queue-item__progress" style={{ width: `${job.progress}%` }} /> : null}</article>)}
        </div></section>
      </> : null}

    </CompactShell>
  );
}
