import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUploader } from '../../components/Common/FileUploader';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { ToolHeader } from '../../components/Common/ToolHeader';
import { formatBytes } from '../../utils/image';
import {
  getCommonSupportedTargets,
  getFileExtension,
  isSupportedSourceFormat,
  SUPPORTED_SOURCE_FORMATS,
} from '../../utils/conversionCapabilities';
import { appendUniqueFiles, downloadAll, fileIdentity, makeUniqueNames } from '../../utils/batch';
import { convertUniversalFile } from '../../utils/universalConversion';
import type { PdfDocxMode } from '../../utils/documentConverters';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Ban as ProhibitIcon,
  Check as CheckIcon,
  CheckCircle,
  Download,
  File as FileIcon,
  Lightbulb as BulbIcon,
  LoaderCircle,
  RefreshCw,
  ShieldCheck as ShieldIcon,
  Sparkles as MagicIcon,
  Trash2,
  X,
  Zap as ZapIcon,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardDescription, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

const FORMAT_CATEGORIES = {
  document: ['pdf', 'docx', 'txt', 'md', 'html'],
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'ico', 'svg'],
  video: ['mp4', 'webm', 'mov', 'mkv', 'avi', 'flv'],
  audio: ['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg', 'opus', 'weba'],
  data: ['csv', 'json'],
};

type QueueStatus = 'pending' | 'processing' | 'completed' | 'error';

interface QueueResult {
  blob: Blob;
  url: string;
  name: string;
}

interface QueueItem {
  id: string;
  file: File;
  extension: string;
  status: QueueStatus;
  progress: number;
  statusText: string;
  error?: string;
  result?: QueueResult;
}

interface UniversalConverterProps {
  onGoHome: () => void;
  onUploadSuccess: () => void;
}

const categoryForFormat = (format: string): string =>
  Object.entries(FORMAT_CATEGORIES).find(([, formats]) => formats.includes(format))?.[0] || 'document';

const preferredTarget = (files: File[], targets: Set<string>): string => {
  if (files.length === 1) {
    const extension = getFileExtension(files[0]);
    const preferred: Record<string, string> = {
      pdf: 'docx',
      png: 'webp',
      jpg: 'png',
      jpeg: 'png',
      mp4: 'mp3',
      mov: 'mp3',
      webm: 'mp3',
      csv: 'json',
      json: 'csv',
    };
    if (preferred[extension] && targets.has(preferred[extension])) return preferred[extension];
  }
  return Array.from(targets)[0] || '';
};

export const UniversalConverter: React.FC<UniversalConverterProps> = ({ onGoHome, onUploadSuccess }) => {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [targetCategory, setTargetCategory] = useState('image');
  const [targetFormat, setTargetFormat] = useState('png');
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pdfDocxMode, setPdfDocxMode] = useState<PdfDocxMode>('preserve-layout');
  const [hasRun, setHasRun] = useState(false);
  const stopRequestedRef = useRef(false);
  const resultUrlsRef = useRef(new Set<string>());

  const files = useMemo(() => items.map(item => item.file), [items]);
  const supportedTargets = useMemo(() => getCommonSupportedTargets(files), [files]);
  const completedItems = items.filter(item => item.status === 'completed' && item.result);
  const failedItems = items.filter(item => item.status === 'error');

  useEffect(() => () => {
    resultUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    resultUrlsRef.current.clear();
  }, []);

  const updateItem = (id: string, patch: Partial<QueueItem>) => {
    setItems(current => current.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const handleFilesSelected = (incoming: File[]) => {
    const uniqueFiles = appendUniqueFiles(files, incoming);
    const duplicateCount = files.length + incoming.length - uniqueFiles.length;
    const accepted = [...files];
    const rejected: string[] = [];

    uniqueFiles.slice(files.length).forEach(file => {
      const extension = getFileExtension(file);
      if (!isSupportedSourceFormat(extension)) {
        rejected.push(file.name);
        return;
      }
      const candidate = [...accepted, file];
      if (accepted.length > 0 && getCommonSupportedTargets(candidate).size === 0) {
        rejected.push(file.name);
        return;
      }
      accepted.push(file);
    });

    const acceptedNewFiles = accepted.slice(files.length);
    if (acceptedNewFiles.length > 0) {
      const newItems = acceptedNewFiles.map(file => ({
        id: fileIdentity(file),
        file,
        extension: getFileExtension(file),
        status: 'pending' as const,
        progress: 0,
        statusText: 'Waiting',
      }));
      setItems(current => [...current, ...newItems]);

      const nextTargets = getCommonSupportedTargets(accepted);
      const nextTarget = nextTargets.has(targetFormat) ? targetFormat : preferredTarget(accepted, nextTargets);
      setTargetFormat(nextTarget);
      setTargetCategory(categoryForFormat(nextTarget));
      setHasRun(false);
    }

    const notices: string[] = [];
    if (duplicateCount > 0) notices.push(`${duplicateCount} duplicate ${duplicateCount === 1 ? 'file was' : 'files were'} skipped.`);
    if (rejected.length > 0) notices.push(`${rejected.length} ${rejected.length === 1 ? 'file does' : 'files do'} not share a conversion target with this queue: ${rejected.join(', ')}`);
    setErrorMessage(notices.join(' '));
  };

  const removeItem = (id: string) => {
    setItems(current => {
      const removed = current.find(item => item.id === id);
      if (removed?.result) {
        URL.revokeObjectURL(removed.result.url);
        resultUrlsRef.current.delete(removed.result.url);
      }
      const next = current.filter(item => item.id !== id);
      const targets = getCommonSupportedTargets(next.map(item => item.file));
      if (next.length > 0 && !targets.has(targetFormat)) {
        const nextTarget = preferredTarget(next.map(item => item.file), targets);
        setTargetFormat(nextTarget);
        setTargetCategory(categoryForFormat(nextTarget));
      }
      return next;
    });
    setErrorMessage('');
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    setItems(current => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  };

  const reset = () => {
    resultUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    resultUrlsRef.current.clear();
    setItems([]);
    setTargetFormat('png');
    setTargetCategory('image');
    setSearchQuery('');
    setOverallProgress(0);
    setProcessing(false);
    setHasRun(false);
    setErrorMessage('');
    stopRequestedRef.current = false;
  };

  const startConversion = async (onlyIds?: string[]) => {
    const selected = items.filter(item =>
      onlyIds ? onlyIds.includes(item.id) : item.status === 'pending' || item.status === 'error',
    );
    if (selected.length === 0 || !supportedTargets.has(targetFormat)) return;

    setProcessing(true);
    setHasRun(false);
    setErrorMessage('');
    setOverallProgress(0);
    stopRequestedRef.current = false;
    const usedNames = items.flatMap(item => item.result ? [item.result.name] : []);

    for (let index = 0; index < selected.length; index += 1) {
      if (stopRequestedRef.current) break;
      const item = selected[index];
      if (item.result) {
        URL.revokeObjectURL(item.result.url);
        resultUrlsRef.current.delete(item.result.url);
      }
      updateItem(item.id, { status: 'processing', progress: 0, statusText: 'Starting...', error: undefined, result: undefined });
      setStatusText(`Converting ${index + 1} of ${selected.length}: ${item.file.name}`);

      try {
        const converted = await convertUniversalFile(item.file, targetFormat, pdfDocxMode, (percent, status) => {
          updateItem(item.id, { progress: percent, statusText: status });
          setOverallProgress(Math.round(((index + percent / 100) / selected.length) * 100));
        });
        const name = makeUniqueNames([...usedNames, converted.name]).at(-1) || converted.name;
        usedNames.push(name);
        const url = URL.createObjectURL(converted.blob);
        resultUrlsRef.current.add(url);
        updateItem(item.id, {
          status: 'completed',
          progress: 100,
          statusText: 'Completed',
          result: { blob: converted.blob, url, name },
        });
        onUploadSuccess();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        updateItem(item.id, { status: 'error', progress: 100, statusText: 'Failed', error: message });
      }
      setOverallProgress(Math.round(((index + 1) / selected.length) * 100));
    }

    if (stopRequestedRef.current) {
      setStatusText('Queue stopped. Unprocessed files are still waiting.');
    } else {
      setStatusText('Batch conversion complete.');
    }
    setProcessing(false);
    setHasRun(true);
  };

  const filteredFormats = (FORMAT_CATEGORIES[targetCategory as keyof typeof FORMAT_CATEGORIES] || [])
    .filter(format => !searchQuery || format.includes(searchQuery.toLowerCase()));

  const distinctExtensions = Array.from(new Set(items.map(item => item.extension)));

  return (
    <div className="tool-layout">
      <ToolHeader
        title="Verified File Converter"
        description="Convert one file or a compatible batch privately. Files run one at a time to protect browser memory."
        icon={MagicIcon}
        onGoHome={() => items.length > 0 || processing ? reset() : onGoHome()}
      />

      {processing && (
        <div className="mx-auto max-w-3xl space-y-5 py-8 sm:py-12" aria-live="polite">
          <ProgressBar progress={overallProgress} statusText={statusText} subText="Sequential client-side conversion queue" />
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-4 sm:p-5">
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {items.map(item => (
                <div key={item.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border-color)] bg-zinc-950/30 p-3">
                  {item.status === 'processing' ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
                    : item.status === 'completed' ? <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                    : item.status === 'error' ? <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                    : <FileIcon className="h-4 w-4 shrink-0 text-zinc-500" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[var(--text-primary)]">{item.file.name}</p>
                    <p className="truncate text-[10px] text-[var(--text-secondary)]">{item.statusText}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold text-[var(--text-secondary)]">{item.progress}%</span>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={() => { stopRequestedRef.current = true; }} className="mt-4 min-h-11 w-full rounded-full text-xs">
              Stop after current file
            </Button>
          </Card>
        </div>
      )}

      {!processing && !hasRun && (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            {errorMessage && (
              <Card role="alert" className="border-amber-500/40 bg-amber-950/20 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <p className="min-w-0 text-xs leading-relaxed text-amber-100">{errorMessage}</p>
                </div>
              </Card>
            )}

            {items.length === 0 ? (
              <FileUploader
                accept={SUPPORTED_SOURCE_FORMATS.map(extension => `.${extension}`).join(',')}
                multiple
                label="Select files to convert"
                subLabel="Choose compatible files that share at least one verified output format"
                onFilesSelected={handleFilesSelected}
                maxSizeMB={500}
              />
            ) : (
              <>
                <Card className="space-y-4 border-[var(--border-color)] bg-[var(--surface-color)] p-4 shadow-sm sm:p-6">
                  <div className="flex flex-col gap-3 border-b border-[var(--border-color)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileIcon className="h-4 w-4 shrink-0 text-zinc-400" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-primary)]">Conversion queue</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">{items.length} {items.length === 1 ? 'file' : 'files'} · {formatBytes(files.reduce((sum, file) => sum + file.size, 0))}</p>
                      </div>
                    </div>
                    <Button variant="ghost" onClick={reset} className="min-h-10 self-start px-3 text-xs text-rose-500 sm:self-auto">
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear all
                    </Button>
                  </div>

                  <div className="max-h-80 space-y-2 overflow-y-auto pr-1" aria-label="Files waiting for conversion">
                    {items.map((item, index) => (
                      <div key={item.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-zinc-950/30 p-3 sm:gap-3">
                        <span className="w-5 shrink-0 text-center text-[10px] font-bold text-zinc-500">{index + 1}</span>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-[9px] font-bold uppercase text-zinc-200">
                          {item.extension}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-[var(--text-primary)]" title={item.file.name}>{item.file.name}</p>
                          <p className="text-[10px] text-[var(--text-secondary)]">{formatBytes(item.file.size)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button type="button" disabled={index === 0} onClick={() => moveItem(index, -1)} aria-label={`Move ${item.file.name} up`} className="flex h-10 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 disabled:opacity-25">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" disabled={index === items.length - 1} onClick={() => moveItem(index, 1)} aria-label={`Move ${item.file.name} down`} className="flex h-10 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 disabled:opacity-25">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.file.name}`} className="flex h-10 w-9 items-center justify-center rounded-lg text-rose-400 hover:bg-rose-950/40">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <FileUploader
                  accept={SUPPORTED_SOURCE_FORMATS.map(extension => `.${extension}`).join(',')}
                  multiple
                  compact
                  label="Add more compatible files"
                  subLabel="Duplicates and files without a shared target are skipped"
                  onFilesSelected={handleFilesSelected}
                  maxSizeMB={500}
                />

                <Card className="space-y-5 border-[var(--border-color)] bg-[var(--surface-color)] p-4 shadow-sm sm:p-6">
                  <div className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-xs text-zinc-300">
                    <BulbIcon className="h-4 w-4 shrink-0 text-amber-400" />
                    <p className="text-[11px] leading-relaxed"><strong className="text-zinc-100">Shared compatibility:</strong> {supportedTargets.size} verified targets work for every queued {distinctExtensions.map(extension => `.${extension}`).join(', ')} file.</p>
                  </div>

                  <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-[var(--border-color)] bg-zinc-950/60 p-4 sm:flex-row sm:items-center">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Output format for all files</span>
                      <span className="mt-1 flex items-center gap-2 text-base font-black uppercase tracking-wide text-[var(--text-primary)]"><ZapIcon className="h-4 w-4" /> {targetFormat}</span>
                    </div>
                    <Input placeholder="Search formats..." value={searchQuery} onChange={event => setSearchQuery(event.target.value)} className="h-10 w-full bg-transparent text-xs sm:w-48" />
                  </div>

                  <div className="space-y-2">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Format category</span>
                    <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-[var(--border-color)] bg-zinc-950/60 p-1.5 sm:grid-cols-5">
                      {Object.keys(FORMAT_CATEGORIES).map(category => {
                        const categoryFormats = FORMAT_CATEGORIES[category as keyof typeof FORMAT_CATEGORIES];
                        const hasSupported = categoryFormats.some(format => supportedTargets.has(format));
                        return (
                          <button key={category} type="button" disabled={!hasSupported} onClick={() => {
                            setTargetCategory(category);
                            const first = categoryFormats.find(format => supportedTargets.has(format));
                            if (first) setTargetFormat(first);
                          }} className={`min-h-10 rounded-lg border px-1 text-[10px] font-bold uppercase transition-colors ${targetCategory === category ? 'border-zinc-700 bg-zinc-800 text-white' : 'border-transparent text-zinc-300 hover:bg-zinc-900'} disabled:cursor-not-allowed disabled:opacity-25`}>
                            {category}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Available shared formats</span>
                    <div className="grid max-h-44 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 md:grid-cols-8">
                      {filteredFormats.map(format => {
                        const enabled = supportedTargets.has(format);
                        return (
                          <button key={format} type="button" disabled={!enabled} onClick={() => setTargetFormat(format)} className={`min-h-10 rounded-lg border px-2 text-[10px] font-black uppercase ${targetFormat === format ? 'border-white bg-zinc-100 text-zinc-950' : enabled ? 'border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:border-zinc-600' : 'border-zinc-900/40 text-zinc-600 opacity-25 line-through'}`}>
                            {enabled ? format : <span className="inline-flex items-center gap-1"><ProhibitIcon className="h-2.5 w-2.5" />{format}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {distinctExtensions.length === 1 && distinctExtensions[0] === 'pdf' && targetFormat === 'docx' && (
                    <div className="space-y-2">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Word conversion style</span>
                      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2" role="radiogroup" aria-label="Word conversion style">
                        {([
                          ['preserve-layout', 'Preserve layout', 'Recommended. Keeps each PDF page visually faithful inside Word.'],
                          ['editable', 'Editable text', 'Extracts or OCRs text; complex positioning and pictures may change.'],
                        ] as const).map(([mode, label, description]) => (
                          <button key={mode} type="button" role="radio" aria-checked={pdfDocxMode === mode} onClick={() => setPdfDocxMode(mode)} className={`min-h-24 rounded-xl border p-4 text-left ${pdfDocxMode === mode ? 'border-white bg-zinc-800 text-white' : 'border-zinc-800 bg-zinc-950/40 text-zinc-300'}`}>
                            <span className="block text-sm font-bold">{label}</span>
                            <span className="mt-2 block text-[11px] leading-relaxed text-zinc-400">{description}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button onClick={() => startConversion()} disabled={!supportedTargets.has(targetFormat)} className="min-h-12 w-full rounded-full bg-zinc-950 text-xs font-bold text-white dark:bg-zinc-50 dark:text-zinc-950">
                    Convert {items.length} {items.length === 1 ? 'file' : 'files'} to {targetFormat.toUpperCase()}
                  </Button>
                </Card>
              </>
            )}
          </div>

          <div className="space-y-4 lg:col-span-4">
            <Card className="space-y-3 border-[var(--border-color)] bg-[var(--surface-color)] p-5">
              <div className="flex items-center gap-2"><ShieldIcon className="h-4 w-4" /><CardTitle className="text-xs font-bold">100% Client-Side Privacy</CardTitle></div>
              <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">The queue stays in your browser. Files are processed sequentially and are never uploaded.</p>
            </Card>
            {items.length > 0 && (
              <Card className="space-y-3 border-[var(--border-color)] bg-[var(--surface-color)] p-5">
                <div className="flex items-center gap-2"><CheckIcon className="h-4 w-4" /><CardTitle className="text-xs font-bold">Shared targets</CardTitle></div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(supportedTargets).map(target => (
                    <button key={target} type="button" onClick={() => { setTargetFormat(target); setTargetCategory(categoryForFormat(target)); }} className={`min-h-8 rounded px-2 text-[9px] font-bold uppercase ${targetFormat === target ? 'bg-white text-zinc-950' : 'border border-zinc-800 bg-zinc-900 text-zinc-300'}`}>{target}</button>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {!processing && hasRun && (
        <div className="mx-auto max-w-4xl space-y-6">
          <Card className="space-y-4 border-[var(--border-color)] bg-[var(--surface-color)] p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-xl font-black">Batch conversion complete</CardTitle>
                <CardDescription className="mt-1 text-xs">{completedItems.length} completed · {failedItems.length} failed · {items.filter(item => item.status === 'pending').length} waiting</CardDescription>
              </div>
              <Button variant="outline" onClick={reset} className="min-h-11 rounded-full px-5 text-xs"><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> New batch</Button>
            </div>

            <div className="space-y-2" aria-live="polite">
              {items.map(item => (
                <div key={item.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-[var(--border-color)] bg-zinc-950/30 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {item.status === 'completed' ? <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
                      : item.status === 'error' ? <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
                      : <FileIcon className="h-5 w-5 shrink-0 text-zinc-500" />}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[var(--text-primary)]">{item.result?.name || item.file.name}</p>
                      <p className={`mt-0.5 text-[10px] ${item.error ? 'text-rose-300' : 'text-[var(--text-secondary)]'}`}>{item.error || (item.result ? `${formatBytes(item.file.size)} → ${formatBytes(item.result.blob.size)}` : item.statusText)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {item.result && <a href={item.result.url} download={item.result.name} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 px-3 text-xs font-bold text-zinc-200 hover:bg-zinc-800 sm:flex-none"><Download className="h-3.5 w-3.5" /> Download</a>}
                    {item.status === 'error' && <Button variant="outline" onClick={() => startConversion([item.id])} className="min-h-10 flex-1 text-xs sm:flex-none"><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry</Button>}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:justify-center">
              {completedItems.length > 0 && (
                <Button onClick={() => downloadAll(completedItems.map(item => ({ url: item.result!.url, name: item.result!.name, blob: item.result!.blob })))} className="min-h-11 rounded-full px-6 text-xs font-bold">
                  <Download className="mr-2 h-4 w-4" /> Download all ({completedItems.length})
                </Button>
              )}
              {failedItems.length > 0 && (
                <Button variant="outline" onClick={() => startConversion(failedItems.map(item => item.id))} className="min-h-11 rounded-full px-6 text-xs font-bold text-rose-300">
                  <RefreshCw className="mr-2 h-4 w-4" /> Retry failed ({failedItems.length})
                </Button>
              )}
              {items.some(item => item.status === 'pending') && (
                <Button variant="outline" onClick={() => startConversion(items.filter(item => item.status === 'pending').map(item => item.id))} className="min-h-11 rounded-full px-6 text-xs font-bold">
                  Continue queue
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
