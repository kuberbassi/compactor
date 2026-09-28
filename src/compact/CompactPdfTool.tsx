import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, FilePlus2, X } from 'lucide-react';
import { CompactShell } from './components/CompactShell';
import type { CompactToolCapability } from './compactTools';
import type { DownloadableResult } from '../utils/batch';
import { formatBytes } from '../utils/image';
import type { PdfImageFormat } from './pdf/compactPdfJobs';
import { CompactSelect } from './components/CompactSelect';
import { CompactResultScreen } from './components/CompactResultScreen';
import { assertExportLooksValid } from '../utils/exportValidation';

interface Props { tool: CompactToolCapability; onGoHome: () => void; onProcessed: (count: number) => void }

const errorMessage = (error: unknown, toolId: string) => {
  const message = error instanceof Error ? error.message : String(error);
  if (/password|decrypt|encrypted/i.test(message)) return toolId === 'pdf-unlock' ? 'The password is incorrect or this PDF uses unsupported encryption.' : 'This PDF is encrypted. Unlock it before using this tool.';
  return message || 'The PDF could not be processed.';
};

export function CompactPdfTool({ tool, onGoHome, onProcessed }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [format, setFormat] = useState<PdfImageFormat>('png');
  const [range, setRange] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<DownloadableResult[]>([]);
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [watermarkPosition, setWatermarkPosition] = useState<'diagonal' | 'header' | 'footer' | 'pattern'>('diagonal');
  const [watermarkOpacity, setWatermarkOpacity] = useState(.35);
  const [flattenMode, setFlattenMode] = useState<'forms' | 'complete'>('forms');
  const [flattenQuality, setFlattenQuality] = useState<'standard' | 'high' | 'print'>('high');
  const [securityStatus, setSecurityStatus] = useState<'idle' | 'checking' | 'encrypted' | 'unlocked'>('idle');
  const isMerge = tool.id === 'pdf-merge';
  const isProtect = tool.id === 'pdf-protect';
  const isUnlock = tool.id === 'pdf-unlock';
  const isImages = tool.id === 'pdf-to-image';
  const isWatermark = tool.id === 'pdf-watermark';
  const isFlatten = tool.id === 'pdf-flatten';

  const addFiles = async (incoming: File[]) => {
    const pdfs = incoming.filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    const selected = isMerge ? [...files, ...pdfs] : pdfs.slice(0, 1);
    setFiles(selected);
    setPassword('');
    setConfirmation('');
    setResults([]);
    setSecurityStatus(selected[0] && !isMerge ? 'checking' : 'idle');
    setError(pdfs.length === incoming.length ? '' : 'Only PDF files were added.');
    if (selected[0] && !isMerge) {
      try {
        const { getCompactPdfSecurityStatus } = await import('./pdf/compactPdfJobs');
        const status = await getCompactPdfSecurityStatus(selected[0]);
        setSecurityStatus(status.isEncrypted ? 'encrypted' : 'unlocked');
        if (isUnlock && !status.isEncrypted) setError('This PDF is already unlocked. There is no password protection to remove.');
        else if (isProtect && status.isEncrypted) setError('This PDF is already password protected. Unlock it before setting a new password.');
        else if (!isUnlock && !isProtect && status.isEncrypted) setError('This PDF is password protected. Unlock it before using this tool.');
      } catch (reason) {
        setSecurityStatus('idle');
        setError(errorMessage(reason, tool.id));
      }
    }
    if (isImages && selected[0]) {
      try {
        const { getCompactPdfPageCount } = await import('./pdf/compactPdfJobs');
        setPageCount(await getCompactPdfPageCount(selected[0]));
      } catch (reason) { setPageCount(0); setError(errorMessage(reason, tool.id)); }
    }
  };
  const move = (from: number, to: number) => setFiles(current => { const next = [...current]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; });
  const hasCompatibleSecurity = isMerge || (isUnlock ? securityStatus === 'encrypted' : securityStatus === 'unlocked');
  const ready = (isMerge ? files.length >= 2 : files.length === 1) && hasCompatibleSecurity;

  const run = async () => {
    setError('');
    if (!ready) return;
    if (isProtect && (!password || password !== confirmation)) { setError(!password ? 'Enter a password.' : 'The password confirmation does not match.'); return; }
    if (isUnlock && !password) { setError('Enter the current PDF password.'); return; }
    setBusy(true); setProgress(8); setResults([]);
    try {
      const jobs = await import('./pdf/compactPdfJobs');
      let nextResults: DownloadableResult[];
      if (isMerge) {
        const blob = await jobs.compactPdfJobs.merge(files);
        nextResults = [{ blob, url: '', name: 'merged-document.pdf' }];
      } else if (isProtect || isUnlock) {
        const blob = isProtect ? await jobs.compactPdfJobs.protect(files[0], password) : await jobs.compactPdfJobs.unlock(files[0], password);
        const suffix = isProtect ? 'protected' : 'unlocked';
        nextResults = [{ blob, url: '', name: `${files[0].name.replace(/\.pdf$/i, '')}-${suffix}.pdf` }];
      } else if (isWatermark) {
        const { watermarkPdfAdvanced } = await import('../utils/pdf');
        const blob = await watermarkPdfAdvanced(files[0], { text: watermarkText.trim() || 'WATERMARK', position: watermarkPosition, opacity: watermarkOpacity });
        nextResults = [{ blob, url: '', name: `${files[0].name.replace(/\.pdf$/i, '')}-watermarked.pdf` }];
      } else if (isFlatten) {
        const { flattenPdfForm, flattenPdfCompletely } = await import('../utils/pdf');
        const blob = flattenMode === 'forms' ? await flattenPdfForm(files[0]) : await flattenPdfCompletely(files[0], flattenQuality);
        nextResults = [{ blob, url: '', name: `${files[0].name.replace(/\.pdf$/i, '')}-flattened.pdf` }];
      } else {
        const pages = jobs.parsePageRange(range, pageCount);
        const rendered = await jobs.renderCompactPdfPages(files[0], pages, format, setProgress);
        nextResults = rendered.map(item => ({ ...item, url: '' }));
      }
      await Promise.all(nextResults.map(result => assertExportLooksValid(result.blob!, result.name)));
      setResults(nextResults);
      setProgress(100); onProcessed(1);
    } catch (reason) { setError(errorMessage(reason, tool.id)); }
    finally { setPassword(''); setConfirmation(''); setBusy(false); }
  };

  const actionLabel = isMerge ? 'Merge PDFs' : isProtect ? 'Protect PDF' : isUnlock ? 'Unlock PDF' : isWatermark ? 'Add watermark' : isFlatten ? 'Flatten PDF' : 'Export pages';
  if (results.length) {
    return <CompactResultScreen title={tool.route.title} results={results} zipName="compactor-pdf-pages.zip" onNewBatch={() => { setFiles([]); setResults([]); setError(''); setRange(''); setPageCount(0); }} onGoHome={onGoHome} />;
  }
  return <CompactShell title={tool.route.title} onBack={onGoHome} action={files.length && !results.length ? <button type="button" className="compact-primary-action" disabled={!ready || busy || securityStatus === 'checking'} onClick={() => void run()}>{securityStatus === 'checking' ? 'Checking PDF…' : busy ? `Processing ${progress}%` : actionLabel}</button> : undefined}>
    <input ref={inputRef} className="compact-file-input" type="file" accept="application/pdf,.pdf" multiple={isMerge} onChange={event => { void addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ''; }} />
    <section className="compact-compressor-hero"><p className="compact-kicker">PDF quick tool</p><h1>{tool.route.title}</h1><p>{tool.shortDescription} Files and passwords stay in this browser session.</p></section>
    {files.length === 0 ? <button type="button" className="compact-file-picker" onClick={() => inputRef.current?.click()}><span><FilePlus2 /></span><strong>Choose PDF files</strong><small>{isMerge ? 'Select two or more documents' : 'Select one document'}</small></button> : null}
    {error ? <p className="compact-queue-notice compact-queue-notice--error" role="alert">{error}</p> : null}
    {files.length ? <section className="compact-queue"><div className="compact-section-title"><div><span>Files</span><h2>{files.length} selected</h2></div><div className="compact-section-title__actions"><button type="button" disabled={busy} onClick={() => inputRef.current?.click()}><FilePlus2 /> {isMerge ? 'Add PDFs' : 'Change PDF'}</button><button type="button" disabled={busy} onClick={() => { setFiles([]); setResults([]); setPassword(''); setConfirmation(''); }}>Clear</button></div></div><div className="compact-queue__list">{files.map((file, index) => <article className="compact-queue-item" key={`${file.name}-${file.size}-${index}`}><div className="compact-queue-item__copy"><strong>{file.name}</strong><small>{formatBytes(file.size)}{isMerge ? ` · position ${index + 1}` : ''}</small></div><div className="compact-queue-item__actions">{isMerge && index > 0 ? <button type="button" aria-label={`Move ${file.name} earlier`} onClick={() => move(index, index - 1)}><ArrowUp /></button> : null}{isMerge && index < files.length - 1 ? <button type="button" aria-label={`Move ${file.name} later`} onClick={() => move(index, index + 1)}><ArrowDown /></button> : null}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))}><X /></button></div></article>)}</div></section> : null}
    {(isProtect || isUnlock) && files.length && ((isUnlock && securityStatus === 'encrypted') || (isProtect && securityStatus === 'unlocked')) ? <section className="compact-settings" aria-label="Password settings"><div className="compact-section-title"><div><span>Security</span><h2>{isProtect ? 'Set document password' : 'Enter current password'}</h2></div></div><label><span>Password</span><div className="compact-password-field"><input aria-label="Password" type={showPassword ? 'text' : 'password'} autoComplete="off" value={password} onChange={event => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>{isProtect ? <label><span>Confirm password</span><input aria-label="Confirm password" className="compact-text-input" type={showPassword ? 'text' : 'password'} autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label> : null}<p className="compact-settings__note">Passwords are held only in component memory and cleared after each attempt.</p></section> : null}
    {isImages && files.length ? <section className="compact-settings"><div className="compact-section-title"><div><span>Pages</span><h2>{pageCount ? `${pageCount} pages detected` : 'Reading document'}</h2></div></div><label><span>Page range</span><input className="compact-text-input" value={range} placeholder={pageCount ? `All pages (1-${pageCount})` : 'All pages'} onChange={event => setRange(event.target.value)} /></label><label><span>Image format</span><CompactSelect ariaLabel="Image format" value={format} onChange={setFormat} options={[{ value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPG' }]} /></label><p className="compact-settings__note">Use commas and ranges, for example 1, 3-5. Pages are rendered one at a time to limit memory use.</p></section> : null}
    {isWatermark && files.length ? <section className="compact-settings"><div className="compact-section-title"><div><span>Watermark</span><h2>Simple text overlay</h2></div></div><label><span>Text</span><input className="compact-text-input" maxLength={48} value={watermarkText} onChange={event => setWatermarkText(event.target.value)} /></label><label><span>Position</span><CompactSelect ariaLabel="Watermark position" value={watermarkPosition} onChange={setWatermarkPosition} options={[{ value: 'diagonal', label: 'Centered diagonal' }, { value: 'pattern', label: 'Repeated pattern' }, { value: 'header', label: 'Header' }, { value: 'footer', label: 'Footer' }]} /></label><label><span>Opacity <b>{Math.round(watermarkOpacity * 100)}%</b></span><input type="range" min="10" max="70" value={watermarkOpacity * 100} onChange={event => setWatermarkOpacity(Number(event.target.value) / 100)} /></label></section> : null}
    {isFlatten && files.length ? <section className="compact-settings"><div className="compact-section-title"><div><span>Flatten</span><h2>Choose what becomes permanent</h2></div></div><label><span>Mode</span><CompactSelect ariaLabel="Flatten mode" value={flattenMode} onChange={setFlattenMode} options={[{ value: 'forms', label: 'Lock form fields' }, { value: 'complete', label: 'Flatten entire PDF' }]} /></label>{flattenMode === 'complete' ? <label><span>Render quality</span><CompactSelect ariaLabel="Flatten quality" value={flattenQuality} onChange={setFlattenQuality} options={[{ value: 'standard', label: 'Standard' }, { value: 'high', label: 'High' }, { value: 'print', label: 'Print' }]} /></label> : null}<p className="compact-settings__note">Entire PDF mode converts each page to an image, removing selectable text and interactive elements.</p></section> : null}
  </CompactShell>;
}
