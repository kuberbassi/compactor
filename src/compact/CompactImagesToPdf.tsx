import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, FilePlus2, RotateCw, X } from 'lucide-react';
import { CompactShell } from './components/CompactShell';
import type { DownloadableResult } from '../utils/batch';
import { formatBytes } from '../utils/image';
import { CompactSelect } from './components/CompactSelect';
import { CompactResultScreen } from './components/CompactResultScreen';
import { assertExportLooksValid } from '../utils/exportValidation';

type Filter = 'original' | 'smart-scan' | 'whiteboard' | 'bw' | 'vibrant';
type PageSize = 'fit' | 'a4' | 'letter';

function ImageThumbnail({ file, rotation }: { file: File; rotation: number }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next); }, [file]);
  return url ? <img className="compact-image-thumb" src={url} alt="" style={{ transform: `rotate(${rotation}deg)` }} /> : null;
}

interface Props { onGoHome: () => void; onProcessed: (count: number) => void }

export function CompactImagesToPdf({ onGoHome, onProcessed }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Array<{ file: File; rotation: number }>>([]);
  const [filter, setFilter] = useState<Filter>('original');
  const [pageSize, setPageSize] = useState<PageSize>('fit');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<DownloadableResult | null>(null);
  const add = (files: File[]) => {
    const images = files.filter(file => /image\/(png|jpeg|webp)/.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name));
    setItems(current => [...current, ...images.map(file => ({ file, rotation: 0 }))]);
    setResult(null);
    setError(images.length === files.length ? '' : 'Only PNG, JPEG, and WebP images were added.');
  };
  const move = (from: number, to: number) => setItems(current => { const next = [...current]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; });
  const rotate = (index: number) => setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, rotation: (item.rotation + 90) % 360 } : item));
  const run = async () => {
    if (!items.length) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const { compactPdfJobs } = await import('./pdf/compactPdfJobs');
      const blob = await compactPdfJobs.imagesToPdf(items.map(item => item.file), { pageSize, filter, rotations: items.map(item => item.rotation), orientation: 'auto', margin: pageSize === 'fit' ? 'none' : 'small' });
      await assertExportLooksValid(blob, 'compactor-images.pdf');
      setResult({ blob, url: '', name: 'compactor-images.pdf' });
      onProcessed(1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The images could not be converted.'); }
    finally { setBusy(false); }
  };
  if (result) return <CompactResultScreen title="Images to PDF" results={[result]} zipName="compactor-images-pdf.zip" onNewBatch={() => { setItems([]); setResult(null); setError(''); }} onGoHome={onGoHome} />;
  return <CompactShell title="Images to PDF" onBack={onGoHome} action={items.length && !result ? <button type="button" className="compact-primary-action" disabled={busy} onClick={() => void run()}>{busy ? 'Building PDF…' : `Create PDF from ${items.length} ${items.length === 1 ? 'image' : 'images'}`}</button> : undefined}>
    <input ref={inputRef} className="compact-file-input" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={event => { add(Array.from(event.target.files ?? [])); event.currentTarget.value = ''; }} />
    <section className="compact-compressor-hero"><p className="compact-kicker">PDF quick tool</p><h1>Images to PDF</h1><p>Arrange, rotate, clean up, and combine images into one simple PDF.</p></section>
    {items.length === 0 ? <button type="button" className="compact-file-picker" onClick={() => inputRef.current?.click()}><span><FilePlus2 /></span><strong>Add images</strong><small>PNG, JPG, or WebP · multiple selection supported</small></button> : null}
    {error ? <p className="compact-queue-notice compact-queue-notice--error" role="alert">{error}</p> : null}
    {items.length ? <><section className="compact-settings"><div className="compact-section-title"><div><span>PDF setup</span><h2>Simple page options</h2></div></div><label><span>Document filter</span><CompactSelect ariaLabel="Document filter" value={filter} onChange={setFilter} options={[{ value: 'original', label: 'Original' }, { value: 'smart-scan', label: 'High contrast' }, { value: 'whiteboard', label: 'Whiteboard clean' }, { value: 'bw', label: 'Black & white' }, { value: 'vibrant', label: 'Vibrant' }]} /></label><label><span>Page size</span><CompactSelect ariaLabel="Page size" value={pageSize} onChange={setPageSize} options={[{ value: 'fit', label: 'Fit each image' }, { value: 'a4', label: 'A4' }, { value: 'letter', label: 'US Letter' }]} /></label></section>
      <section className="compact-queue"><div className="compact-section-title"><div><span>Page order</span><h2>{items.length} {items.length === 1 ? 'image' : 'images'}</h2></div><div className="compact-section-title__actions"><button type="button" disabled={busy} onClick={() => inputRef.current?.click()}><FilePlus2 /> Add images</button><button type="button" disabled={busy} onClick={() => { setItems([]); setResult(null); }}>Clear</button></div></div><div className="compact-queue__list">{items.map((item, index) => <article className="compact-queue-item compact-image-item" key={`${item.file.name}-${item.file.size}-${index}`}><ImageThumbnail file={item.file} rotation={item.rotation} /><div className="compact-queue-item__copy"><strong>{item.file.name}</strong><small>{formatBytes(item.file.size)} · {item.rotation}°</small></div><div className="compact-queue-item__actions">{index > 0 ? <button type="button" aria-label={`Move ${item.file.name} earlier`} onClick={() => move(index, index - 1)}><ArrowUp /></button> : null}{index < items.length - 1 ? <button type="button" aria-label={`Move ${item.file.name} later`} onClick={() => move(index, index + 1)}><ArrowDown /></button> : null}<button type="button" aria-label={`Rotate ${item.file.name} clockwise`} onClick={() => rotate(index)}><RotateCw /></button><button type="button" aria-label={`Remove ${item.file.name}`} onClick={() => setItems(current => current.filter((_, itemIndex) => itemIndex !== index))}><X /></button></div></article>)}</div></section></> : null}
  </CompactShell>;
}
