import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUploader } from '../../components/Common/FileUploader';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { ToolHeader } from '../../components/Common/ToolHeader';
import { ToolModeSwitcher } from '../../components/Common/ToolModeSwitcher';
import { formatBytes } from '../../utils/image';
import {
  getCommonSupportedTargets,
  getFileExtension,
  isSupportedSourceFormat,
  SUPPORTED_SOURCE_FORMATS,
} from '../../utils/conversionCapabilities';
import { appendUniqueFiles, downloadAll, downloadAsZip, fileIdentity, makeUniqueNames } from '../../utils/batch';
import { convertUniversalFile } from '../../utils/universalConversion';
import type { PdfDocxMode } from '../../utils/documentConverters';
import {
  AlertCircle,
  Archive,
  ArrowDown,
  ArrowUp,
  Ban as ProhibitIcon,
  CheckCircle,
  Download,
  File as FileIcon,
  Lightbulb as BulbIcon,
  LoaderCircle,
  RefreshCw,
  X,
  Zap as ZapIcon,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardDescription, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

const FORMAT_CATEGORIES = {
  video: [
    'mp4', 'webm', 'mov', 'mkv', 'avi', 'flv',
    'mpeg', 'mpg', 'ts', 'm2ts', 'wmv', 'asf', 'ogv',
    '3gp', '3g2', 'm4v', 'f4v', 'vob', 'gif',
  ],
  audio: [
    'mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg',
    'opus', 'weba', 'wma', 'aiff', 'aif', 'alac',
    'mka', 'ac3', 'dts', 'amr',
  ],
  image: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp', 'ico', 'svg', 'tiff', 'tif', 'tga'],
  document: ['pdf', 'docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls', 'txt', 'md', 'html', 'rtf'],
  data: ['csv', 'tsv', 'json', 'xml', 'yaml', 'yml'],
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
  onSelectTool?: (toolId: string) => void;
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

export const UniversalConverter: React.FC<UniversalConverterProps> = ({ onGoHome, onSelectTool = () => undefined, onUploadSuccess }) => {
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
    <div className={`tool-layout converter-tool-layout ${items.length > 0 || processing || hasRun ? 'has-active-session' : 'is-empty-session'}`}>
      <ToolHeader
        title="Convert Files"
        description="Convert files privately in your browser with zero server uploads."
        icon={RefreshCw}
        fileName={items.length === 1 ? items[0].file.name : items.length > 1 ? `${items.length} files in queue` : undefined}
        fileMeta={items.length ? formatBytes(items.reduce((sum, item) => sum + item.file.size, 0)) : undefined}
        onGoHome={() => items.length > 0 || processing ? reset() : onGoHome()}
        actions={!processing && !hasRun ? <ToolModeSwitcher
          label="File tools"
          activeId="universal-converter"
          options={[
            { id: 'universal-converter', label: 'Convert' },
            { id: 'metadata-editor', label: 'Details' },
          ]}
          onSelect={onSelectTool}
        /> : undefined}
      />

      {processing && (
        <div className="converter-processing-workbench" aria-live="polite">
          <ProgressBar progress={overallProgress} statusText={statusText} subText="Sequential client-side conversion queue" />
          <Card className="converter-processing-queue border-[var(--border-color)] bg-[var(--surface-color)] p-4 sm:p-5">
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

      {!processing && !hasRun && items.length === 0 && (
        <div className="tool-upload-frame mx-auto w-full max-w-5xl">
          <div className="space-y-6">
            {errorMessage && (
              <Card role="alert" className="border-amber-500/40 bg-amber-950/20 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <p className="min-w-0 text-xs leading-relaxed text-amber-100">{errorMessage}</p>
                </div>
              </Card>
            )}

            <FileUploader
              accept={SUPPORTED_SOURCE_FORMATS.map(extension => `.${extension}`).join(',')}
              multiple
              label="Select files to convert"
              subLabel="Choose compatible files that share at least one output format"
              onFilesSelected={handleFilesSelected}
              maxSizeMB={500}
            />
          </div>
        </div>
      )}

      {!processing && !hasRun && items.length > 0 && (
        <div className="image-workbench flex-1 flex h-full overflow-hidden bg-[#111216]">
          {/* Left Sidebar Rail */}
          <aside className="image-workbench__sidebar w-[18.5rem] bg-[#18191e] border-r border-white/10 flex flex-col shrink-0 h-full overflow-hidden">
            <div className="h-11 border-b border-white/10 px-4 flex items-center justify-between shrink-0 bg-transparent">
              <div className="flex items-center gap-2 min-w-0">
                <FileIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Queue</span>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono truncate">
                {items.length} {items.length === 1 ? 'file' : 'files'} · {formatBytes(files.reduce((sum, file) => sum + file.size, 0))}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2" aria-label="Files waiting for conversion">
              {items.map((item, index) => (
                <div key={item.id} className="converter-queue-item bg-zinc-900/70 hover:bg-zinc-800/80 border border-white/10 hover:border-white/25 rounded-2xl p-3 flex items-center gap-3 transition-all shadow-sm">
                  <span className="text-center text-[11px] font-bold text-zinc-500 w-4">{index + 1}</span>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-zinc-950 text-[10px] font-mono font-bold uppercase text-white shadow-inner">
                    {item.extension}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white" title={item.file.name}>{item.file.name}</p>
                    <p className="whitespace-nowrap text-[11px] text-zinc-400">{formatBytes(item.file.size)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" disabled={index === 0} onClick={() => moveItem(index, -1)} aria-label={`Move ${item.file.name} up`} className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-20 cursor-pointer">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" disabled={index === items.length - 1} onClick={() => moveItem(index, 1)} aria-label={`Move ${item.file.name} down`} className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-20 cursor-pointer">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.file.name}`} className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-400 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3.5 border-t border-white/10 bg-[#18191e] mt-auto shrink-0">
              <button
                type="button"
                onClick={() => startConversion()}
                disabled={!supportedTargets.has(targetFormat)}
                className="w-full h-11 bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
              >
                <span>Convert to {targetFormat ? targetFormat.toUpperCase() : 'FORMAT'}</span>
                <span className="text-sm font-black">→</span>
              </button>
            </div>
          </aside>

          {/* Right Main Stage */}
          <main className="image-workbench__main flex-1 bg-[#111216] flex flex-col h-full overflow-y-auto p-6">
            <div className="max-w-2xl w-full mx-auto space-y-4">
              {errorMessage && (
                <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <p className="min-w-0 text-xs leading-relaxed text-amber-100">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Clean Add Files Strip */}
              <label className="flex items-center justify-between p-4 rounded-2xl border border-dashed border-white/20 bg-zinc-950/40 hover:border-white/40 cursor-pointer transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white shrink-0">
                    <FileIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Add more files to queue</span>
                    <span className="text-[11px] text-zinc-400">Compatible media, documents & images</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-zinc-950 bg-white hover:bg-zinc-200 px-3.5 py-1.5 rounded-xl transition-all shadow-sm shrink-0">
                  Browse files
                </span>
                <input
                  type="file"
                  multiple
                  accept={SUPPORTED_SOURCE_FORMATS.map(ext => `.${ext}`).join(',')}
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFilesSelected(Array.from(e.target.files));
                      e.target.value = '';
                    }
                  }}
                />
              </label>

              <div className="flex items-center gap-3 text-xs text-zinc-400 bg-[#18191e] border border-white/10 rounded-2xl p-4">
                <BulbIcon className="h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-[11px] leading-relaxed"><strong className="text-zinc-100">Shared compatibility:</strong> {supportedTargets.size} verified targets work for every queued {distinctExtensions.map(extension => `.${extension}`).join(', ')} file.</p>
              </div>

              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center bg-[#18191e] border border-white/10 rounded-2xl p-4">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">Output format</span>
                  <span className="mt-1 flex items-center gap-2 text-base font-black uppercase tracking-wide text-white"><ZapIcon className="h-4 w-4 text-white" /> {targetFormat}</span>
                </div>
                <Input placeholder="Search formats..." value={searchQuery} onChange={event => setSearchQuery(event.target.value)} className="h-9 w-full bg-zinc-950/50 border-white/10 text-xs rounded-xl sm:w-48" />
              </div>

              <div className="space-y-2.5 bg-[#18191e] border border-white/10 rounded-2xl p-4">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">Category</span>
                <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-zinc-950/60 p-1.5 sm:grid-cols-5">
                  {Object.keys(FORMAT_CATEGORIES).map(category => {
                    const categoryFormats = FORMAT_CATEGORIES[category as keyof typeof FORMAT_CATEGORIES];
                    const hasSupported = categoryFormats.some(format => supportedTargets.has(format));
                    const isSelected = targetCategory === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        disabled={!hasSupported}
                        onClick={() => {
                          setTargetCategory(category);
                          const first = categoryFormats.find(format => supportedTargets.has(format));
                          if (first) setTargetFormat(first);
                        }}
                        className={`min-h-10 rounded-lg border px-2 text-xs font-bold uppercase transition-all ${
                          isSelected
                            ? 'border-white bg-white text-zinc-950 font-black shadow-sm'
                            : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/10'
                        } disabled:cursor-not-allowed disabled:opacity-25 cursor-pointer`}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5 bg-[#18191e] border border-white/10 rounded-2xl p-4">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">Available formats</span>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-1">
                  {filteredFormats.map(format => {
                    const enabled = supportedTargets.has(format);
                    const isSelected = targetFormat === format;
                    return (
                      <button
                        key={format}
                        type="button"
                        disabled={!enabled}
                        onClick={() => setTargetFormat(format)}
                        className={`min-h-10 rounded-xl border px-2 text-xs font-black uppercase transition-all ${
                          isSelected
                            ? 'border-white bg-white text-zinc-950 shadow-md'
                            : enabled
                            ? 'border-white/10 bg-zinc-900/60 text-zinc-200 hover:border-white/30 hover:bg-zinc-800 hover:text-white cursor-pointer'
                            : 'border-white/5 bg-zinc-950/20 text-zinc-600 opacity-25 line-through'
                        }`}
                      >
                        {enabled ? format : <span className="inline-flex items-center gap-1"><ProhibitIcon className="h-2.5 w-2.5" />{format}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {distinctExtensions.length === 1 && distinctExtensions[0] === 'pdf' && targetFormat === 'docx' && (
                <div className="space-y-2 bg-[#18191e] border border-white/10 rounded-xl p-4">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">Word conversion style</span>
                  <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2" role="radiogroup" aria-label="Word conversion style">
                    {([
                      ['preserve-layout', 'Preserve layout', 'Recommended. Keeps each PDF page visually faithful inside Word.'],
                      ['editable', 'Editable text', 'Extracts or OCRs text; complex positioning and pictures may change.'],
                    ] as const).map(([mode, label, description]) => (
                      <button key={mode} type="button" role="radio" aria-checked={pdfDocxMode === mode} onClick={() => setPdfDocxMode(mode)} className={`min-h-20 rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${pdfDocxMode === mode ? 'border-white bg-white/10 text-white' : 'border-white/10 bg-zinc-950/50 text-zinc-400 hover:border-white/20'}`}>
                        <strong className="block text-xs font-bold text-white">{label}</strong>
                        <span className="mt-1 block text-[11px] leading-relaxed text-zinc-400">{description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {targetFormat === 'pdf' && distinctExtensions.some(extension => ['pptx', 'xlsx', 'html'].includes(extension)) && (
                <p className="rounded-xl border border-white/10 p-4 text-xs text-zinc-300">
                  {distinctExtensions.includes('pptx') && 'PPTX exports slide text into readable pages; artwork, charts, and original slide layouts are not reproduced. '}
                  {distinctExtensions.includes('xlsx') && 'XLSX exports cell values as paginated tables; charts and workbook styling are not reproduced. '}
                  {distinctExtensions.includes('html') && 'HTML exports its source text, including tags.'}
                </p>
              )}
              {distinctExtensions.length === 1 && distinctExtensions[0] === 'docx' && targetFormat === 'pdf' && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-[11px] leading-relaxed text-amber-100">
                  <strong className="block text-xs text-amber-50">Private browser conversion</strong>
                  Compactor renders the Word layout locally without uploading your file.
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      {!processing && hasRun && (
        <div className="converter-result-workbench">
          <Card className="converter-result-panel border-[var(--border-color)] bg-[var(--surface-color)] p-4 sm:p-6">
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
              {completedItems.length > 1 && (
                <Button
                  variant="outline"
                  onClick={() => downloadAsZip(
                    completedItems.map(item => ({ url: item.result!.url, name: item.result!.name, blob: item.result!.blob })),
                    'compactor-converted-files.zip'
                  ).catch(console.error)}
                  className="min-h-11 rounded-full px-6 text-xs font-bold border-zinc-700 hover:border-zinc-500"
                >
                  <Archive className="mr-2 h-4 w-4" /> Download as ZIP
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
