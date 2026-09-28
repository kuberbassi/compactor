import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Download, FilePlus2, RotateCcw, X } from 'lucide-react';
import type { CompactToolCapability } from './compactTools';
import { CompactShell } from './components/CompactShell';
import { compactImageAdapter, compactPdfAdapter, type CompactImageSettings, type CompactPdfSettings } from './compressionAdapters';
import { summarizeCompactJobs } from './queue/compactQueue';
import { useCompactQueue, type CompactQueueAdapter } from './queue/useCompactQueue';
import { downloadResult, loadSetting, saveSetting } from '../utils/batch';
import { formatBytes } from '../utils/image';
import { CompactSelect } from './components/CompactSelect';
import { CompactResultScreen } from './components/CompactResultScreen';
import { CompactFilePreview } from './components/CompactFilePreview';

interface CompactCompressorProps {
  tool: CompactToolCapability;
  onGoHome: () => void;
  onProcessed: (count: number) => void;
}

const IMAGE_SETTINGS_KEY = 'compactor:compact:image-settings';
const PDF_SETTINGS_KEY = 'compactor:compact:pdf-settings';
type CompactCompressorSettings = CompactImageSettings | CompactPdfSettings;

export function CompactCompressor({ tool, onGoHome, onProcessed }: CompactCompressorProps) {
  const isImage = tool.id === 'image-optimizer';
  const [imageSettings, setImageSettings] = useState<CompactImageSettings>(() => {
    const defaults: CompactImageSettings = { quality: 78, format: 'preserve', method: 'auto', targetSizeKB: 500, targetUnit: 'KB', resize: false, width: 1920, height: 1080, fixedRatio: true, watermarkText: '', watermarkOpacity: .32 };
    return { ...defaults, ...loadSetting(IMAGE_SETTINGS_KEY, defaults) };
  });
  const [pdfSettings, setPdfSettings] = useState<CompactPdfSettings>(() => loadSetting(PDF_SETTINGS_KEY, { preset: 'balanced', removeMetadata: true }));
  const inputRef = useRef<HTMLInputElement>(null);
  const adapter = useMemo<CompactQueueAdapter<CompactCompressorSettings>>(() => ({
    accepts: isImage ? compactImageAdapter.accepts : compactPdfAdapter.accepts,
    process: (file, currentSettings, onProgress) => isImage
      ? compactImageAdapter.process(file, currentSettings as CompactImageSettings, onProgress)
      : compactPdfAdapter.process(file, currentSettings as CompactPdfSettings, onProgress),
  }), [isImage]);
  const settings: CompactCompressorSettings = isImage ? imageSettings : pdfSettings;
  const queue = useCompactQueue(adapter, settings, onProcessed);
  const summary = useMemo(() => summarizeCompactJobs(queue.jobs), [queue.jobs]);
  const completed = queue.jobs.filter(job => job.status === 'complete' && job.result).map(job => job.result!);

  const updateImageSettings = (next: CompactImageSettings) => { setImageSettings(next); saveSetting(IMAGE_SETTINGS_KEY, next); };
  const updatePdfSettings = (next: CompactPdfSettings) => { setPdfSettings(next); saveSetting(PDF_SETTINGS_KEY, next); };
  const chooseFiles = () => inputRef.current?.click();

  if (completed.length > 0 && !queue.processing && queue.jobs.every(job => ['complete', 'failed', 'cancelled'].includes(job.status))) {
    return <CompactResultScreen title={tool.route.title} results={completed} originalSize={summary.originalSize} outputSize={summary.outputSize} failed={summary.failed} zipName={isImage ? 'compactor-images.zip' : 'compactor-pdfs.zip'} onNewBatch={queue.clear} onGoHome={onGoHome} />;
  }

  return (
    <CompactShell
      title={tool.route.title}
      onBack={onGoHome}
      action={queue.jobs.length > 0 ? (
        queue.processing
          ? <button type="button" className="compact-primary-action compact-primary-action--danger" onClick={queue.cancel}>Cancel remaining</button>
          : <button type="button" className="compact-primary-action" onClick={() => void queue.run()}>Compress {queue.jobs.filter(job => job.status !== 'complete').length} {queue.jobs.length === 1 ? 'file' : 'files'}</button>
      ) : undefined}
    >
      <input ref={inputRef} className="compact-file-input" type="file" multiple accept={isImage ? 'image/*' : 'application/pdf,.pdf'} onChange={event => { queue.addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ''; }} />

      <section className="compact-compressor-hero">
        <p className="compact-kicker">Private, on-device compression</p>
        <h1>{isImage ? 'Smaller images, together.' : 'Compress PDFs in a simple queue.'}</h1>
        <p>{isImage ? 'Add JPG, PNG, or WebP files. Adjust one set of options and export everything together.' : 'Add several PDFs, choose a strength, and keep completed files even if another fails.'}</p>
      </section>

      {queue.jobs.length === 0 ? <button type="button" className="compact-file-picker" onClick={chooseFiles}>
        <span><FilePlus2 aria-hidden="true" /></span>
        <strong>Add {isImage ? 'images' : 'PDF files'}</strong>
        <small>Multiple selection supported · files never leave this device</small>
      </button> : null}
      {queue.notice ? <p className="compact-queue-notice" role="status">{queue.notice}</p> : null}
      {isImage && queue.jobs[0] ? <CompactFilePreview file={queue.jobs[0].file} kind="image" title="First image preview" overlayText={imageSettings.watermarkText} overlayOpacity={imageSettings.watermarkOpacity} /> : null}

      {queue.jobs.length > 0 ? (
        <>
          <section className="compact-settings" aria-labelledby="compact-settings-title">
            <div className="compact-section-title"><div><span>Options</span><h2 id="compact-settings-title">Applied to this queue</h2></div></div>
            {isImage ? (
              <>
                <label><span>Method</span><CompactSelect ariaLabel="Compression method" value={imageSettings.method} onChange={method => updateImageSettings({ ...imageSettings, method })} options={[{ value: 'auto', label: 'Auto quality' }, { value: 'target', label: 'Target size' }]} /></label>
                {imageSettings.method === 'auto' ? <label><span>Quality <b>{imageSettings.quality}%</b></span><input type="range" min="25" max="95" value={imageSettings.quality} onChange={event => updateImageSettings({ ...imageSettings, quality: Number(event.target.value) })} /></label> : null}
                {imageSettings.method === 'target' ? <div className="compact-target-size"><label><span>Target size</span><input className="compact-text-input" type="number" min={imageSettings.targetUnit === 'MB' ? .1 : 10} step={imageSettings.targetUnit === 'MB' ? .1 : 10} value={imageSettings.targetSizeKB} onChange={event => updateImageSettings({ ...imageSettings, targetSizeKB: Math.max(imageSettings.targetUnit === 'MB' ? .1 : 10, Number(event.target.value)) })} /></label><label><span>Unit</span><CompactSelect ariaLabel="Target size unit" value={imageSettings.targetUnit} onChange={targetUnit => { if (targetUnit === imageSettings.targetUnit) return; updateImageSettings({ ...imageSettings, targetUnit, targetSizeKB: targetUnit === 'MB' ? Math.max(.1, Number((imageSettings.targetSizeKB / 1024).toFixed(2))) : Math.max(10, Math.round(imageSettings.targetSizeKB * 1024)) }); }} options={[{ value: 'KB', label: 'KB' }, { value: 'MB', label: 'MB' }]} /></label><p>Maximum output size. Smaller source files remain unchanged unless another edit is applied.</p></div> : null}
                <label><span>Output format</span><CompactSelect ariaLabel="Output format" value={imageSettings.format} onChange={format => updateImageSettings({ ...imageSettings, format })} options={[{ value: 'preserve', label: 'Keep original format' }, { value: 'image/jpeg', label: 'JPG' }, { value: 'image/webp', label: 'WebP' }, { value: 'image/png', label: 'PNG' }]} /></label>
                <details className="compact-advanced"><summary>Resize</summary>
                  <Toggle label="Resize output" checked={imageSettings.resize} onChange={resize => updateImageSettings({ ...imageSettings, resize })} />
                  {imageSettings.resize ? <><Toggle label="Fixed ratio" checked={imageSettings.fixedRatio} onChange={fixedRatio => updateImageSettings({ ...imageSettings, fixedRatio })} /><div className="compact-field-row"><label><span>Width (px)</span><input className="compact-text-input" type="number" min="1" value={imageSettings.width} onChange={event => { const width = Math.max(1, Number(event.target.value)); updateImageSettings({ ...imageSettings, width, height: imageSettings.fixedRatio ? Math.max(1, Math.round(width * imageSettings.height / imageSettings.width)) : imageSettings.height }); }} /></label><label><span>Height (px)</span><input className="compact-text-input" type="number" min="1" value={imageSettings.height} onChange={event => { const height = Math.max(1, Number(event.target.value)); updateImageSettings({ ...imageSettings, height, width: imageSettings.fixedRatio ? Math.max(1, Math.round(height * imageSettings.width / imageSettings.height)) : imageSettings.width }); }} /></label></div></> : null}
                </details>
                <details className="compact-advanced"><summary>Watermark</summary><label><span>Text</span><input className="compact-text-input" maxLength={48} value={imageSettings.watermarkText} placeholder="Optional watermark" onChange={event => updateImageSettings({ ...imageSettings, watermarkText: event.target.value })} /></label>{imageSettings.watermarkText ? <label><span>Opacity <b>{Math.round(imageSettings.watermarkOpacity * 100)}%</b></span><input type="range" min="10" max="80" value={imageSettings.watermarkOpacity * 100} onChange={event => updateImageSettings({ ...imageSettings, watermarkOpacity: Number(event.target.value) / 100 })} /></label> : null}</details>
              </>
            ) : (
              <>
                <label><span>Compression strength</span><CompactSelect ariaLabel="Compression strength" value={pdfSettings.preset} onChange={preset => updatePdfSettings({ ...pdfSettings, preset })} options={[{ value: 'light', label: 'Light' }, { value: 'balanced', label: 'Balanced' }, { value: 'maximum', label: 'Maximum' }]} /></label>
                <label className="compact-toggle"><span><strong>Remove metadata</strong><small>Clears document title, author, subject, and keywords.</small></span><input type="checkbox" checked={pdfSettings.removeMetadata} onChange={event => updatePdfSettings({ ...pdfSettings, removeMetadata: event.target.checked })} /></label>
              </>
            )}
          </section>

          <section className="compact-queue" aria-labelledby="compact-queue-title">
            <div className="compact-section-title"><div><span>Queue</span><h2 id="compact-queue-title">{queue.jobs.length} {queue.jobs.length === 1 ? 'file' : 'files'}</h2></div><div className="compact-section-title__actions"><button type="button" onClick={chooseFiles} disabled={queue.processing}><FilePlus2 /> Add files</button><button type="button" onClick={queue.clear} disabled={queue.processing}>Clear</button></div></div>
            <div className="compact-queue__list">
              {queue.jobs.map((job, index) => (
                <article key={job.id} className={`compact-queue-item is-${job.status}`}>
                  <div className="compact-queue-item__copy"><strong>{job.file.name}</strong><small>{formatBytes(job.file.size)} · {job.status}</small>{job.error ? <em role="alert">{job.error}</em> : null}</div>
                  <div className="compact-queue-item__actions">
                    {job.status === 'complete' && job.result ? <button type="button" onClick={() => downloadResult(job.result!)} aria-label={`Download ${job.result.name}`}><Download /></button> : null}
                    {job.status === 'failed' ? <button type="button" onClick={() => void queue.retry(job.id)} aria-label={`Retry ${job.file.name}`}><RotateCcw /></button> : null}
                    {job.status === 'pending' && index > 0 ? <button type="button" onClick={() => queue.moveJob(index, index - 1)} aria-label={`Move ${job.file.name} up`}><ArrowUp /></button> : null}
                    {job.status === 'pending' && index < queue.jobs.length - 1 ? <button type="button" onClick={() => queue.moveJob(index, index + 1)} aria-label={`Move ${job.file.name} down`}><ArrowDown /></button> : null}
                    {!queue.processing ? <button type="button" onClick={() => queue.removeJob(job.id)} aria-label={`Remove ${job.file.name}`}><X /></button> : null}
                  </div>
                  {job.status === 'processing' ? <span className="compact-queue-item__progress" style={{ width: `${job.progress}%` }} /> : null}
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}

    </CompactShell>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="compact-toggle"><span><strong>{label}</strong></span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /></label>;
}
