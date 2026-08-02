import { useState } from 'react';
import { FileUploader } from '../../components/Common/FileUploader';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { ToolHeader } from '../../components/Common/ToolHeader';
import { traceImageToSvg } from '../../utils/svgTracer';
import { imagesToPdf, textToPdf } from '../../utils/pdf';
import { getFFmpeg, transcodeFormatLossless } from '../../utils/ffmpeg';
import { formatBytes, loadImage } from '../../utils/image';
import {
  canvasToBmp, canvasToIco, audioFileToWav,
  csvToJson, jsonToCsv, csvToHtmlTable, textToHtml
} from '../../utils/universalConverters';
import { docxToHtml, docxToPdf, docxToText, pdfToDocx, pdfToText, textToDocx } from '../../utils/documentConverters';
import type { PdfDocxMode } from '../../utils/documentConverters';
import { getSupportedTargets, isSupportedSourceFormat, SUPPORTED_SOURCE_FORMATS } from '../../utils/conversionCapabilities';
import { 
  File as FileIcon, RefreshCw, 
  CheckCircle, Download,
  Sparkles as MagicIcon, ShieldCheck as ShieldIcon,
  Zap as ZapIcon, Check as CheckIcon,
  Ban as ProhibitIcon, Lightbulb as BulbIcon
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardTitle, CardDescription } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

// The catalog can show familiar formats, but only engine-backed pairs are enabled.
const FORMAT_CATEGORIES = {
  document: ['pdf', 'docx', 'txt', 'md', 'html'],
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'ico', 'svg'],
  video: ['mp4', 'webm', 'mov', 'mkv', 'avi', 'flv'],
  audio: ['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg', 'opus', 'weba'],
  data: ['csv', 'json'],
};

/**
 * Smart Compatibility Matrix Helper
 * Derives valid conversion target formats for any input extension
 */
interface UniversalConverterProps {
  onGoHome: () => void;
  onUploadSuccess: () => void;
}

export const UniversalConverter: React.FC<UniversalConverterProps> = ({ onGoHome, onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [inputExt, setInputExt] = useState<string>('');
  const [inputCategory, setInputCategory] = useState<string>('');
  
  const [targetCategory, setTargetCategory] = useState<string>('image');
  const [targetFormat, setTargetFormat] = useState<string>('png');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pdfDocxMode, setPdfDocxMode] = useState<PdfDocxMode>('preserve-layout');
  
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState('');
  const [resultSize, setResultSize] = useState<number>(0);

  // Compute supported target formats for current file
  const supportedTargets = file ? getSupportedTargets(inputExt) : new Set<string>();

  // Detect input file extension & categorize it automatically
  const handleFileSelected = (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;
    const f = selectedFiles[0];
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    if (!isSupportedSourceFormat(ext)) {
      setErrorMessage(`.${ext || 'unknown'} files are not shown because Compactor has no reliable conversion engine for them.`);
      return;
    }
    setFile(f);
    setErrorMessage('');
    setInputExt(ext);
    
    // Find category
    let foundCat = 'document';
    for (const [cat, list] of Object.entries(FORMAT_CATEGORIES)) {
      if (list.includes(ext)) {
        foundCat = cat;
        break;
      }
    }
    setInputCategory(foundCat);
    
    // Derive valid smart targets
    const validTargets = getSupportedTargets(ext);
    
    // Find category containing the best default target format
    let bestCat = foundCat;
    let bestFormat = Array.from(validTargets)[0] || 'pdf';

    // Special smart defaults:
    if (ext === 'pdf') { bestCat = 'document'; bestFormat = 'docx'; }
    else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) { bestCat = 'image'; bestFormat = ext === 'png' ? 'webp' : 'png'; }
    else if (['mp4', 'mov', 'webm'].includes(ext)) { bestCat = 'video'; bestFormat = 'mp3'; }
    else if (['csv', 'json'].includes(ext)) { bestCat = 'data'; bestFormat = ext === 'csv' ? 'json' : 'csv'; }

    setTargetCategory(bestCat);
    setTargetFormat(bestFormat);
  };

  const reset = () => {
    setFile(null);
    setInputExt('');
    setInputCategory('');
    setResultUrl(null);
    setResultName('');
    setResultSize(0);
    setProgress(0);
    setProcessing(false);
    setErrorMessage('');
  };

  const startConversion = async () => {
    if (!file) return;
    setProcessing(true);
    setErrorMessage('');
    setProgress(10);
    setStatusText('Analyzing file format headers...');
    
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const target = targetFormat.toLowerCase();

      // 1. IMAGE CONVERSIONS (Lossless & High Quality HTML5 Canvas)
      if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'ico'].includes(target) && ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg', 'avif'].includes(ext)) {
        setStatusText(`Loading raster image into loss-free conversion pipeline...`);
        setProgress(30);
        const img = await loadImage(file);
        
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not instantiate 2D context');

        // White background for JPEG / BMP if source has alpha
        if (['jpg', 'jpeg', 'bmp'].includes(target)) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);
        setProgress(70);

        let resultBlob: Blob;
        if (target === 'png') {
          setStatusText('Encoding lossless 32-bit PNG format...');
          resultBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(b => b ? resolve(b) : reject('PNG conversion failed'), 'image/png');
          });
        } else if (target === 'webp') {
          setStatusText('Encoding 100% max quality WebP format...');
          resultBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(b => b ? resolve(b) : reject('WebP conversion failed'), 'image/webp', 1.0);
          });
        } else if (target === 'jpg' || target === 'jpeg') {
          setStatusText('Encoding high-fidelity JPEG format...');
          resultBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(b => b ? resolve(b) : reject('JPEG conversion failed'), 'image/jpeg', 0.98);
          });
        } else if (target === 'bmp') {
          setStatusText('Encoding uncompressed 24-bit BMP binary bitmap...');
          resultBlob = canvasToBmp(canvas);
        } else if (target === 'ico') {
          setStatusText('Encoding 256x256 ICO icon asset...');
          resultBlob = canvasToIco(canvas, 256);
        } else {
          throw new Error('Unsupported image target');
        }

        setProgress(95);
        setResultSize(resultBlob.size);
        setResultUrl(URL.createObjectURL(resultBlob));
        setResultName(file.name.replace(/\.[^/.]+$/, "") + `.${target}`);
        onUploadSuccess();
      }
      // 2. IMAGE TO VECTOR SVG
      else if (target === 'svg' && ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'].includes(ext)) {
        setStatusText('Tracing image contour paths into SVG vector shapes...');
        setProgress(40);
        const svgContent = await traceImageToSvg(file);
        setProgress(90);
        
        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        setResultSize(blob.size);
        setResultUrl(URL.createObjectURL(blob));
        setResultName(file.name.replace(/\.[^/.]+$/, "") + '.svg');
        onUploadSuccess();
      }
      // 3. IMAGE TO PDF
      else if (target === 'pdf' && ['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext)) {
        setStatusText('Compiling image file to vector PDF document page...');
        const blob = await imagesToPdf([file]);
        setProgress(90);
        setResultSize(blob.size);
        setResultUrl(URL.createObjectURL(blob));
        setResultName(file.name.replace(/\.[^/.]+$/, "") + '.pdf');
        onUploadSuccess();
      }
      // 4. REAL DOCUMENT CONVERSIONS
      else if (ext === 'pdf' && target === 'docx') {
        setStatusText('Reading PDF text layout and building a valid editable Word document...');
        setProgress(25);
        const blob = await pdfToDocx(file, (percent, status) => {
          setProgress(20 + Math.round(percent * 0.7));
          setStatusText(status);
        }, pdfDocxMode);
        setProgress(95);
        setResultSize(blob.size);
        setResultUrl(URL.createObjectURL(blob));
        setResultName(file.name.replace(/\.[^/.]+$/, '') + '.docx');
        onUploadSuccess();
      }
      else if (ext === 'docx' && target === 'pdf') {
        setStatusText('Parsing the Word document and typesetting a valid PDF...');
        setProgress(30);
        const blob = await docxToPdf(file);
        setProgress(95);
        setResultSize(blob.size);
        setResultUrl(URL.createObjectURL(blob));
        setResultName(file.name.replace(/\.[^/.]+$/, '') + '.pdf');
        onUploadSuccess();
      }
      else if (ext === 'docx' && (target === 'txt' || target === 'html')) {
        setStatusText(`Parsing Word content into ${target.toUpperCase()}...`);
        const content = target === 'txt' ? await docxToText(file) : await docxToHtml(file);
        const blob = new Blob([content], { type: target === 'txt' ? 'text/plain;charset=utf-8' : 'text/html;charset=utf-8' });
        setProgress(95);
        setResultSize(blob.size);
        setResultUrl(URL.createObjectURL(blob));
        setResultName(file.name.replace(/\.[^/.]+$/, '') + `.${target}`);
        onUploadSuccess();
      }
      else if (target === 'docx' && ['txt', 'md'].includes(ext)) {
        setStatusText('Building a valid editable Word document package...');
        const blob = await textToDocx(await file.text(), file.name);
        setProgress(95);
        setResultSize(blob.size);
        setResultUrl(URL.createObjectURL(blob));
        setResultName(file.name.replace(/\.[^/.]+$/, '') + '.docx');
        onUploadSuccess();
      }
      else if (ext === 'pdf' && target === 'txt') {
        setStatusText('Extracting readable text from the PDF...');
        const text = await pdfToText(file, (percent, status) => {
          setProgress(20 + Math.round(percent * 0.7));
          setStatusText(status);
        });
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        setProgress(95);
        setResultSize(blob.size);
        setResultUrl(URL.createObjectURL(blob));
        setResultName(file.name.replace(/\.[^/.]+$/, '') + '.txt');
        onUploadSuccess();
      }
      // 5. TEXT / MD / HTML / CSV TO PDF
      else if (target === 'pdf' && ['txt', 'md', 'html', 'json', 'csv'].includes(ext)) {
        setStatusText('Compiling text document layout into PDF...');
        const text = await file.text();
        const blob = await textToPdf(text, file.name);
        setProgress(90);
        setResultSize(blob.size);
        setResultUrl(URL.createObjectURL(blob));
        setResultName(file.name.replace(/\.[^/.]+$/, "") + '.pdf');
        onUploadSuccess();
      }
      // 6. NATIVE AUDIO DECODER TO WAV
      else if (target === 'wav' && ['mp3', 'aac', 'm4a', 'flac', 'ogg', 'opus', 'weba', 'wav'].includes(ext)) {
        setStatusText('Decoding audio PCM samples into uncompressed WAV...');
        setProgress(40);
        const wavBlob = await audioFileToWav(file);
        setProgress(90);
        setResultSize(wavBlob.size);
        setResultUrl(URL.createObjectURL(wavBlob));
        setResultName(file.name.replace(/\.[^/.]+$/, "") + '.wav');
        onUploadSuccess();
      }
      // 7. CSV / JSON / HTML DATA TRANSFORMS
      else if (target === 'json' && (ext === 'csv' || ext === 'txt')) {
        setStatusText('Parsing CSV data rows into formatted JSON objects...');
        const text = await file.text();
        const jsonStr = csvToJson(text);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        setProgress(90);
        setResultSize(blob.size);
        setResultUrl(URL.createObjectURL(blob));
        setResultName(file.name.replace(/\.[^/.]+$/, "") + '.json');
        onUploadSuccess();
      }
      else if (target === 'csv' && (ext === 'json' || ext === 'txt')) {
        setStatusText('Structuring JSON data into comma-separated CSV rows...');
        const text = await file.text();
        const csvStr = jsonToCsv(text);
        const blob = new Blob([csvStr], { type: 'text/csv' });
        setProgress(90);
        setResultSize(blob.size);
        setResultUrl(URL.createObjectURL(blob));
        setResultName(file.name.replace(/\.[^/.]+$/, "") + '.csv');
        onUploadSuccess();
      }
      else if (target === 'html' && (ext === 'csv' || ext === 'txt' || ext === 'md')) {
        setStatusText('Formatting document text to styled semantic HTML page...');
        const text = await file.text();
        const htmlStr = ext === 'csv' ? csvToHtmlTable(text, file.name) : textToHtml(text, file.name);
        const blob = new Blob([htmlStr], { type: 'text/html' });
        setProgress(90);
        setResultSize(blob.size);
        setResultUrl(URL.createObjectURL(blob));
        setResultName(file.name.replace(/\.[^/.]+$/, "") + '.html');
        onUploadSuccess();
      }
      // 8. MEDIA TRANSCODING (FFmpeg WASM)
      else if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'gif'].includes(target) && ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'mp3', 'wav', 'aac', 'm4a', 'ogg', 'opus', 'weba', 'flac'].includes(ext)) {
        setStatusText('Initializing FFmpeg WebAssembly media engine...');
        await getFFmpeg(() => {}, setProgress);
        
        setStatusText(`Transcoding ${ext.toUpperCase()} to ${target.toUpperCase()}...`);
        const result = await transcodeFormatLossless(file, target, () => {}, setProgress);
        
        setResultSize(result.blob.size);
        setResultUrl(result.url);
        setResultName(result.name);
        onUploadSuccess();
      }
      // Never fabricate a target by changing a file extension.
      else {
        throw new Error(`${ext.toUpperCase()} to ${target.toUpperCase()} is not supported by an installed conversion engine.`);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || String(e));
    }
    
    setProgress(100);
    setProcessing(false);
  };

  // Filter formats based on search query
  const getFilteredFormats = () => {
    const list = FORMAT_CATEGORIES[targetCategory as keyof typeof FORMAT_CATEGORIES] || [];
    if (!searchQuery) return list;
    return list.filter(f => f.toLowerCase().includes(searchQuery.toLowerCase()));
  };

  return (
    <div className="tool-layout">
      <ToolHeader 
        title="Verified File Converter"
        description="Reliable, private conversions using real format engines. Unsupported pairs are disabled instead of producing corrupt files."
        icon={MagicIcon} 
        onGoHome={() => {
          if (file || resultUrl || processing) {
            reset();
          } else {
            onGoHome();
          }
        }} 
      />

      {processing && (
        <div className="max-w-2xl mx-auto py-12">
          <ProgressBar progress={progress} statusText={statusText} subText="High-precision client-side format conversion engine" />
        </div>
      )}

      {!processing && !resultUrl && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main workspace */}
          <div className="lg:col-span-8 space-y-6">
            {errorMessage && (
              <Card role="alert" className="border-red-500/40 bg-red-950/20 p-4">
                <div className="flex items-start gap-3">
                  <ProhibitIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-red-100">Conversion could not be completed</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-red-200/80">{errorMessage}</p>
                  </div>
                </div>
              </Card>
            )}
            {!file ? (
              <FileUploader 
                accept={SUPPORTED_SOURCE_FORMATS.map(ext => `.${ext}`).join(',')}
                label="Select a supported file to convert"
                subLabel="Supports verified image, media, PDF, DOCX, text, CSV and JSON conversion pairs"
                onFilesSelected={handleFileSelected}
                maxSizeMB={500}
              />
            ) : (
              <Card className="border-[var(--border-color)] bg-[var(--surface-color)] shadow-sm p-6 space-y-5">
                <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
                  <div className="flex items-center gap-2">
                    <FileIcon className="w-4 h-4 text-zinc-400" />
                    <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">Selected Source File</span>
                  </div>
                  <Button variant="ghost" onClick={reset} className="text-rose-500 hover:text-rose-600 text-xs h-7 px-2">Change File</Button>
                </div>
                
                <div className="flex items-center gap-3.5 p-4 bg-zinc-950/40 border border-[var(--border-color)] rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200 font-bold text-xs uppercase flex-shrink-0">
                    {inputExt || 'FILE'}
                  </div>
                  <div className="truncate flex-1 min-w-0">
                    <span className="block text-xs font-bold truncate text-[var(--text-primary)]">{file.name}</span>
                    <span className="text-[10px] text-[var(--text-secondary)] mt-0.5 block font-medium">
                      Category: <span className="text-zinc-200 font-semibold uppercase">{inputCategory}</span> &bull; Size: <span className="text-zinc-200 font-semibold">{formatBytes(file.size)}</span>
                    </span>
                  </div>
                </div>

                {/* Smart Conversion Helper Tip Bar */}
                <div className="flex items-center gap-2.5 bg-zinc-950/70 border border-zinc-800 p-3 rounded-xl text-xs text-zinc-300">
                  <BulbIcon className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <div className="text-[11px] leading-tight">
                    <strong className="text-zinc-100">Smart Compatibility Helper:</strong> Showing <span className="text-zinc-200 font-bold">{supportedTargets.size} compatible targets</span> for <span className="text-white font-bold uppercase">.{inputExt}</span>. Incompatible formats are automatically dimmed.
                  </div>
                </div>

                {/* Target Format Config Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-zinc-950/60 p-4 border border-[var(--border-color)] rounded-xl justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Target Output Format</span>
                    <span className="text-base font-black text-[var(--text-primary)] uppercase tracking-wide flex items-center gap-2">
                      <ZapIcon className="w-4 h-4 text-zinc-400" /> {targetFormat}
                    </span>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                    <Input 
                      placeholder="Search verified formats..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="h-9 text-xs w-full sm:w-48 bg-transparent border-[var(--border-color)] text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                {/* Categories Tab Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Format Category</label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 bg-zinc-950/60 p-1.5 rounded-xl border border-[var(--border-color)]">
                    {Object.keys(FORMAT_CATEGORIES).map(cat => {
                      const catList = FORMAT_CATEGORIES[cat as keyof typeof FORMAT_CATEGORIES] || [];
                      const hasSupported = catList.some(fmt => supportedTargets.has(fmt));

                      return (
                        <button
                          key={cat}
                          onClick={() => {
                            setTargetCategory(cat);
                            // Find first supported format in this category or default to first
                            const firstValid = catList.find(fmt => supportedTargets.has(fmt)) || catList[0] || 'pdf';
                            setTargetFormat(firstValid);
                          }}
                          className={`py-1.5 px-1 text-[10px] font-bold rounded-lg uppercase tracking-wide transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            targetCategory === cat
                              ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                              : hasSupported
                              ? 'text-zinc-300 hover:text-white hover:bg-zinc-900/50'
                              : 'text-zinc-600 opacity-40 hover:opacity-70'
                          }`}
                        >
                          {hasSupported && <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />}
                          <span>{cat}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Target Format Buttons Grid */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                    Available Formats ({getFilteredFormats().length})
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-1.5 max-h-44 overflow-y-auto pr-1">
                    {getFilteredFormats().map(fmt => {
                      const isSupported = supportedTargets.has(fmt);

                      return (
                        <button
                          key={fmt}
                          disabled={!isSupported}
                          onClick={() => isSupported && setTargetFormat(fmt)}
                          title={isSupported ? `Convert .${inputExt.toUpperCase()} to .${fmt.toUpperCase()}` : `.${fmt.toUpperCase()} is not compatible with .${inputExt.toUpperCase()} files`}
                          className={`py-2 px-1.5 rounded-lg text-[10px] font-black transition-all uppercase border flex items-center justify-center gap-1 ${
                            targetFormat === fmt
                              ? 'border-white bg-zinc-100 text-zinc-950 shadow-md scale-105 cursor-pointer z-10'
                              : isSupported
                              ? 'border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:text-white hover:border-zinc-600 hover:bg-zinc-900/80 cursor-pointer'
                              : 'border-zinc-900/40 bg-zinc-950/10 text-zinc-600 opacity-25 cursor-not-allowed line-through decoration-zinc-700/50'
                          }`}
                        >
                          {isSupported ? (
                            <span>{fmt}</span>
                          ) : (
                            <span className="flex items-center gap-0.5">
                              <ProhibitIcon className="w-2.5 h-2.5" /> {fmt}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {inputExt === 'pdf' && targetFormat === 'docx' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                      Word conversion style
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5" role="radiogroup" aria-label="Word conversion style">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={pdfDocxMode === 'preserve-layout'}
                        onClick={() => setPdfDocxMode('preserve-layout')}
                        className={`relative min-h-24 w-full rounded-xl border p-4 pr-11 text-left transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:min-h-28 ${pdfDocxMode === 'preserve-layout' ? 'border-white bg-zinc-800 text-white shadow-sm' : 'border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900/60'}`}
                      >
                        <span className="block text-sm font-bold leading-snug">Preserve layout</span>
                        <span className="mt-1 inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-200">Recommended</span>
                        <span className="mt-2 block text-[11px] leading-relaxed text-zinc-400">Keeps images, fonts, columns, tables, and page appearance as closely as Word allows.</span>
                        <span aria-hidden="true" className={`absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border ${pdfDocxMode === 'preserve-layout' ? 'border-white bg-white text-zinc-950' : 'border-zinc-600'}`}>
                          {pdfDocxMode === 'preserve-layout' && <span className="h-2 w-2 rounded-full bg-zinc-950" />}
                        </span>
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={pdfDocxMode === 'editable'}
                        onClick={() => setPdfDocxMode('editable')}
                        className={`relative min-h-24 w-full rounded-xl border p-4 pr-11 text-left transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:min-h-28 ${pdfDocxMode === 'editable' ? 'border-white bg-zinc-800 text-white shadow-sm' : 'border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900/60'}`}
                      >
                        <span className="block text-sm font-bold leading-snug">Editable text</span>
                        <span className="mt-2 block text-[11px] leading-relaxed text-zinc-400">Extracts or OCRs text for editing; complex positioning and pictures may not match exactly.</span>
                        <span aria-hidden="true" className={`absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border ${pdfDocxMode === 'editable' ? 'border-white bg-white text-zinc-950' : 'border-zinc-600'}`}>
                          {pdfDocxMode === 'editable' && <span className="h-2 w-2 rounded-full bg-zinc-950" />}
                        </span>
                      </button>
                    </div>
                    <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
                      Preserve layout creates sharp page images inside Word for visual accuracy. Editable text prioritizes content editing.
                    </p>
                  </div>
                )}

                <Button 
                  onClick={startConversion}
                  disabled={!supportedTargets.has(targetFormat)}
                  className="w-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold rounded-full h-11 text-xs shadow-sm cursor-pointer"
                >
                  {supportedTargets.has(targetFormat)
                    ? `Convert to ${targetFormat.toUpperCase()}`
                    : 'No reliable conversion available'}
                </Button>
              </Card>
            )}
          </div>

          <div className="lg:col-span-4 space-y-4">
            <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-5 space-y-3">
              <div className="flex items-center gap-2 text-zinc-200">
                <ShieldIcon className="w-4 h-4 text-zinc-300" />
                <CardTitle className="text-xs font-bold text-[var(--text-primary)]">100% Client-Side Privacy</CardTitle>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                All conversions process strictly inside your web browser. Your files never leave your device or get uploaded to any external server.
              </p>
            </Card>

            {file && (
              <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-5 space-y-3">
                <div className="flex items-center gap-2 text-zinc-200">
                  <CheckIcon className="w-4 h-4 text-white" />
                  <CardTitle className="text-xs font-bold text-[var(--text-primary)]">Supported Targets Summary</CardTitle>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(supportedTargets).map(t => (
                    <span
                      key={t}
                      onClick={() => {
                        setTargetFormat(t);
                        // Find category
                        for (const [cat, list] of Object.entries(FORMAT_CATEGORIES)) {
                          if (list.includes(t)) { setTargetCategory(cat); break; }
                        }
                      }}
                      className={`text-[9px] font-mono font-bold px-2 py-1 rounded cursor-pointer uppercase transition-all ${
                        targetFormat === t
                          ? 'bg-white text-zinc-950 font-black shadow-sm'
                          : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white border border-zinc-800'
                      }`}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* RESULT PAGE */}
      {resultUrl && !processing && (
        <div className="max-w-xl mx-auto space-y-6">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] shadow-sm text-center p-6 space-y-5">
            <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 rounded-full flex items-center justify-center mx-auto shadow-inner border border-[var(--border-color)]">
              <CheckCircle className="w-7 h-7" />
            </div>

            <div>
              <CardTitle className="text-xl font-black text-[var(--text-primary)]">Conversion Complete!</CardTitle>
              <CardDescription className="text-xs text-[var(--text-secondary)] mt-1">Your converted format asset is compiled and ready for download.</CardDescription>
            </div>

            <div className="flex items-center gap-3 p-4 bg-zinc-950/40 border border-[var(--border-color)] rounded-xl text-left">
              <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200 font-bold text-xs uppercase flex-shrink-0">
                {targetFormat}
              </div>
              <div className="truncate flex-1 min-w-0">
                <span className="block text-xs font-bold truncate text-[var(--text-primary)]">{resultName}</span>
                <span className="text-[10px] text-[var(--text-secondary)] uppercase mt-0.5 block font-semibold">
                  {inputExt.toUpperCase()} &rarr; {targetFormat.toUpperCase()} &bull; Output Size: {formatBytes(resultSize)}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
              <a 
                href={resultUrl} 
                download={resultName}
                className="inline-flex items-center justify-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold px-6 py-3 rounded-full text-xs shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download Converted File
              </a>
              <Button variant="outline" onClick={reset} className="rounded-full h-10 text-xs border-[var(--border-color)]">
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Convert Another File
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
