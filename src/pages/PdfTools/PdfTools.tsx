import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileUploader } from '../../components/Common/FileUploader';
import { CompressionPresetSelector } from '../../components/Common/CompressionPresetSelector';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { ToolHeader } from '../../components/Common/ToolHeader';
import { PdfEditor } from './PdfEditor';
import { MarkdownEditor } from './MarkdownEditor';
import { 
  mergePdfs, 
  extractPdfPages, 
  imagesToPdf, 
  getPdfPageCount, 
  compressPdf, 
  watermarkPdfAdvanced, 
  addPageNumbersToPdf, 
  cropPdfMargins, 
  signPdfDocumentAdvanced, 
  protectPdfWithPassword, 
  unlockPdfWithPassword,
  checkPdfEncryptionStatus, 
  extractPdfMarkdown,
  reorganizePdfPages,
  flattenPdfForm,
  addVectorStampToPdf,
  annotateOrRedactPdf
} from '../../utils/pdf';
import { renderPdfThumbnails, renderPdfPagesToImages } from '../../utils/pdfRenderer';
import type { PageOrganizeSpec } from '../../utils/pdf';
import { formatBytes } from '../../utils/image';
import { downloadAll, isEditableShortcutTarget, loadSetting, saveSetting, shareResult } from '../../utils/batch';
import type { CompressionPreset } from '../../utils/batch';
import { 
  FileText, Download, RefreshCw, 
  CheckCircle, Trash2 as TrashIcon, 
  Split as SplitIcon, Layers as LayersIcon, Image as ImageIcon,
  Lock as LockIcon, Signature as SignatureIcon, Settings as SettingsIcon,
  Type as TextIcon, ArrowLeft,
  ArrowRight, Crop as CropIcon,
  ShieldCheck as ShieldIcon, Pencil as EditIcon,
  ZoomIn as ZoomIcon, X as CloseIcon,
  List as ListIcon, Eye as EyeIcon, EyeOff as EyeSlashIcon,
  Sparkles as MagicIcon, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardTitle, CardDescription } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

interface PdfToolsProps {
  toolId: string;
  onGoHome: () => void;
  onUploadSuccess: (amount?: number) => void;
}

interface PdfFileInfo {
  file: File;
  pageCount: number;
}

interface PageItem {
  id: string;
  originalIndex: number;
  rotation: number; // 0, 90, 180, 270
  thumbnailUrl?: string;
}

interface CompressionResult {
  sourceName: string;
  sourceSize: number;
  outputName: string;
  outputSize: number;
  url?: string;
  error?: string;
}

const TOOL_GROUPS = [
  {
    title: 'Organize & Edit',
    items: [
      { id: 'pdf-edit', label: 'Edit PDF', icon: EditIcon, desc: 'Add shapes, text, annotations & manage layers' },
      { id: 'pdf-organize', label: 'Page Organizer', icon: LayersIcon, desc: 'Reorder, rotate & delete pages visually' },
      { id: 'pdf-merge', label: 'Merge PDF', icon: LayersIcon, desc: 'Combine multiple PDFs into one' },
      { id: 'pdf-split', label: 'Split PDF', icon: SplitIcon, desc: 'Extract specific page ranges' },
      { id: 'pdf-crop-tool', label: 'Crop Margins', icon: CropIcon, desc: 'Trim white margins off pages' },
      { id: 'pdf-compress', label: 'Compress PDF', icon: SettingsIcon, desc: 'Reduce file size efficiently' }
    ]
  },
  {
    title: 'Protect & Sign',
    items: [
      { id: 'pdf-stamps', label: 'Document Stamps', icon: CheckCircle, desc: 'APPROVED, CONFIDENTIAL, CANCELLED stamps' },
      { id: 'pdf-redact', label: 'Redact & Annotate', icon: CropIcon, desc: 'Blackout sensitive text & add stamps' },
      { id: 'pdf-flatten', label: 'Flatten Forms', icon: EditIcon, desc: 'Lock form fields into uneditable vector graphics' },
      { id: 'pdf-sign', label: 'Sign Document', icon: SignatureIcon, desc: 'Add digital signature & stamp' },
      { id: 'pdf-watermark', label: 'Add Watermark', icon: TextIcon, desc: 'Custom diagonal/header watermarks' },
      { id: 'pdf-protect', label: 'Protect Password', icon: LockIcon, desc: 'Encrypt document with password' },
      { id: 'pdf-unlock', label: 'Unlock PDF', icon: ShieldIcon, desc: 'Remove password & decrypt PDF' },
      { id: 'pdf-page-numbers', label: 'Page Numbers', icon: FileText, desc: 'Insert top/bottom page numbers' }
    ]
  },
  {
    title: 'Convert & Export',
    items: [
      { id: 'pdf-to-image', label: 'PDF to Images', icon: ImageIcon, desc: 'Export pages to 300 DPI PNG/JPG' },
      { id: 'pdf-jpg-to-pdf', label: 'Images to PDF', icon: ImageIcon, desc: 'Document scan filters & layout' },
      { id: 'pdf-word-to-pdf', label: 'Markdown Editor & PDF', icon: TextIcon, desc: 'Rich Markdown editor & PDF compiler' },
      { id: 'pdf-to-word', label: 'PDF to Markdown', icon: FileText, desc: 'Extract 100% real text layer (.md)' }
    ]
  }
];

/**
 * Real-Time Visual Preview Engine
 */
const LivePdfPreview: React.FC<{
  activeTool: string;
  singleFile: PdfFileInfo;
  firstPageThumbnail?: string;
  pageRangeText: string;
  setPageRangeText: (s: string) => void;
  watermarkText: string;
  watermarkPos: 'diagonal' | 'header' | 'footer' | 'pattern';
  watermarkColor: 'red' | 'blue' | 'black' | 'gray';
  watermarkOpacity: number;
  pageNumberPosition: 'top' | 'bottom';
  cropMarginsPct: number;
  signatureText: string;
  signaturePos: 'bottom-right' | 'bottom-left' | 'top-right' | 'center';
  signatureColor: 'blue' | 'black' | 'red';
  signatureTargetPages: 'last-page' | 'first-page' | 'all-pages';
  pdfIsEncrypted?: boolean;
  stampPreset?: string;
  stampPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'center';
  stampTargetPages?: 'last-page' | 'first-page' | 'all-pages';
  redactMode?: 'redact' | 'text' | 'image';
  redactTextContent?: string;
}> = ({
  activeTool,
  singleFile,
  firstPageThumbnail,
  pageRangeText,
  setPageRangeText,
  watermarkText,
  watermarkPos,
  watermarkColor,
  watermarkOpacity,
  pageNumberPosition,
  cropMarginsPct,
  signatureText,
  signaturePos,
  signatureColor,
  signatureTargetPages,
  pdfIsEncrypted,
  stampPreset,
  stampPosition,
  stampTargetPages,
  redactMode,
  redactTextContent
}) => {
  const parsePageRanges = (rangeStr: string, maxPages: number): number[] => {
    const pages = new Set<number>();
    const tokens = rangeStr.split(',');
    for (const token of tokens) {
      const t = token.trim();
      if (t.includes('-')) {
        const parts = t.split('-');
        const start = parseInt(parts[0], 10);
        const end = parseInt(parts[1], 10);
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.min(start, end);
          const max = Math.max(start, end);
          for (let p = min; p <= max; p++) {
            if (p >= 1 && p <= maxPages) pages.add(p);
          }
        }
      } else {
        const p = parseInt(t, 10);
        if (!isNaN(p) && p >= 1 && p <= maxPages) pages.add(p);
      }
    }
    return Array.from(pages).sort((a, b) => a - b);
  };

  const selectedPages = parsePageRanges(pageRangeText, singleFile.pageCount);

  const togglePageInRange = (pNum: number) => {
    let current = new Set(selectedPages);
    if (current.has(pNum)) {
      current.delete(pNum);
    } else {
      current.add(pNum);
    }
    const arr = Array.from(current).sort((a, b) => a - b);
    if (arr.length === 0) {
      setPageRangeText('1');
      return;
    }
    
    let str = '';
    let start = arr[0];
    let prev = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] === prev + 1) {
        prev = arr[i];
      } else {
        if (start === prev) str += `${start}, `;
        else str += `${start}-${prev}, `;
        start = arr[0];
        prev = arr[i];
      }
    }
    if (start === prev) str += `${start}`;
    else str += `${start}-${prev}`;

    setPageRangeText(str);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block truncate">
          Real-Time Visual Preview
        </span>
        <span className="text-[9px] bg-zinc-900 border border-zinc-700 text-zinc-300 font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
          Live Preview
        </span>
      </div>

      {/* STAMP PRESET PREVIEW */}
      {activeTool === 'pdf-stamps' && (
        <div className="bg-zinc-950/60 p-4 rounded-xl border border-[var(--border-color)] flex flex-col items-center">
          <div className="w-44 h-60 bg-white border border-zinc-700 rounded-lg shadow-2xl relative overflow-hidden flex flex-col justify-between p-2 select-none group">
            {firstPageThumbnail ? (
              <img 
                src={firstPageThumbnail} 
                alt="PDF Content Page" 
                className="absolute inset-0 w-full h-full object-contain pointer-events-none bg-white opacity-95"
              />
            ) : (
              <div className="space-y-1.5 opacity-30 p-2">
                <div className="w-3/4 h-1.5 bg-zinc-400 rounded" />
                <div className="w-full h-1 bg-zinc-500 rounded" />
              </div>
            )}

            {/* Overlaid Vector Stamp Badge with LIVE Position */}
            <div className={`absolute z-10 transition-all duration-300 ${
              stampPosition === 'bottom-left' ? 'bottom-3 left-3' :
              stampPosition === 'top-right' ? 'top-3 right-3' :
              stampPosition === 'center' ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : 'bottom-3 right-3'
            }`}>
              <div className={`px-2.5 py-1 rounded border-2 font-mono font-black text-[11px] tracking-wider bg-white/90 shadow-xl transition-all duration-200 ${
                stampPreset === 'APPROVED' ? 'border-zinc-800 text-zinc-900 bg-white' :
                stampPreset === 'CONFIDENTIAL' ? 'border-rose-600 text-rose-600 bg-white' :
                stampPreset === 'CANCELLED' ? 'border-rose-700 text-rose-700 bg-white' :
                stampPreset === 'EXPIRED' ? 'border-amber-600 text-amber-600 bg-white' :
                stampPreset === 'PAID' ? 'border-zinc-700 text-zinc-800 bg-white' : 'border-zinc-900 text-zinc-900 bg-white'
              }`}>
                {stampPreset || 'APPROVED'}
              </div>
            </div>
          </div>
          <span className="text-[10px] text-zinc-400 mt-2 font-medium">
            Vector Stamp ({stampTargetPages === 'first-page' ? 'First Page' : stampTargetPages === 'all-pages' ? 'All Pages' : 'Last Page'})
          </span>
        </div>
      )}

      {/* PAGE NUMBERS PREVIEW */}
      {activeTool === 'pdf-page-numbers' && (
        <div className="bg-zinc-950/60 p-4 rounded-xl border border-[var(--border-color)] flex flex-col items-center">
          <div className="w-44 h-60 bg-white border border-zinc-700 rounded-lg shadow-2xl relative overflow-hidden flex flex-col justify-between p-2 select-none group">
            {firstPageThumbnail ? (
              <img 
                src={firstPageThumbnail} 
                alt="PDF Content Page" 
                className="absolute inset-0 w-full h-full object-contain pointer-events-none bg-white opacity-95"
              />
            ) : (
              <div className="space-y-1.5 opacity-30 p-2">
                <div className="w-3/4 h-1.5 bg-zinc-400 rounded" />
                <div className="w-full h-1 bg-zinc-500 rounded" />
              </div>
            )}

            <div className={`absolute inset-x-0 p-1.5 flex justify-center pointer-events-none z-10 ${
              pageNumberPosition === 'top' ? 'top-1' : 'bottom-1'
            }`}>
              <span className="bg-zinc-950/90 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-zinc-700 shadow-md">
                Page 1 of {singleFile.pageCount}
              </span>
            </div>
          </div>
          <span className="text-[10px] text-zinc-400 mt-2 font-medium">Page Numbering Preview</span>
        </div>
      )}

      {/* CROP MARGINS PREVIEW */}
      {activeTool === 'pdf-crop-tool' && (
        <div className="bg-zinc-950/60 p-4 rounded-xl border border-[var(--border-color)] flex flex-col items-center">
          <div className="w-44 h-60 bg-white border border-zinc-700 rounded-lg shadow-2xl relative overflow-hidden p-2 select-none group">
            {firstPageThumbnail ? (
              <img 
                src={firstPageThumbnail} 
                alt="PDF Content Page" 
                className="w-full h-full object-contain pointer-events-none bg-white opacity-95"
              />
            ) : (
              <div className="w-full h-full space-y-1.5 opacity-30 p-2">
                <div className="w-3/4 h-1.5 bg-zinc-400 rounded" />
              </div>
            )}

            <div 
              className="absolute border-2 border-dashed border-rose-500 bg-rose-500/10 pointer-events-none transition-all duration-200"
              style={{
                top: `${cropMarginsPct}%`,
                bottom: `${cropMarginsPct}%`,
                left: `${cropMarginsPct}%`,
                right: `${cropMarginsPct}%`
              }}
            />
          </div>
          <span className="text-[10px] text-zinc-400 mt-2 font-medium">Margin Crop Box ({cropMarginsPct}%)</span>
        </div>
      )}

      {/* REDACTION / OVERLAY LIVE PREVIEW */}
      {activeTool === 'pdf-redact' && (
        <div className="bg-zinc-950/60 p-4 rounded-xl border border-[var(--border-color)] flex flex-col items-center">
          <div className="w-44 h-60 bg-white border border-zinc-700 rounded-lg shadow-2xl relative overflow-hidden flex flex-col justify-between p-2 select-none group">
            {firstPageThumbnail && (
              <img 
                src={firstPageThumbnail} 
                alt="PDF Content Page" 
                className="absolute inset-0 w-full h-full object-contain pointer-events-none bg-white opacity-95"
              />
            )}

            {redactMode === 'redact' ? (
              <div className="absolute inset-x-4 top-1/3 h-10 bg-black text-white font-mono text-[9px] font-bold flex items-center justify-center border border-zinc-800 shadow-2xl z-10">
                [REDACTED CENSORSHIP]
              </div>
            ) : (
              <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 p-2 bg-white/90 border border-zinc-400 rounded text-zinc-900 font-mono text-[9px] font-bold text-center z-10 shadow-lg">
                {redactTextContent || 'Sample Overlay'}
              </div>
            )}
          </div>
          <span className="text-[10px] text-zinc-400 mt-2 font-medium">
            {redactMode === 'redact' ? 'Blackout Censorship Box Overlay' : 'Text Overlay Preview'}
          </span>
        </div>
      )}

      {/* SPLIT PAGE PREVIEW */}
      {activeTool === 'pdf-split' && (
        <div className="space-y-3 bg-zinc-950/60 p-3.5 rounded-xl border border-[var(--border-color)]">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[11px] font-bold text-zinc-300">Page Selection Chips</span>
            <span className="text-[10px] font-bold text-white whitespace-nowrap shrink-0">{selectedPages.length} of {singleFile.pageCount} Pages</span>
          </div>

          <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto pr-1">
            {Array.from({ length: Math.min(singleFile.pageCount, 60) }, (_, i) => i + 1).map(pNum => {
              const isSelected = selectedPages.includes(pNum);
              return (
                <button
                  key={pNum}
                  onClick={() => togglePageInRange(pNum)}
                  className={`text-[9px] font-mono font-bold w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-white text-zinc-950 shadow-sm scale-105 font-black' 
                      : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800'
                  }`}
                  title={isSelected ? `Remove Page ${pNum}` : `Select Page ${pNum}`}
                >
                  {pNum}
                </button>
              );
            })}
          </div>
          <span className="text-[10px] text-zinc-500 block font-medium">Click page chips above to toggle page ranges.</span>
        </div>
      )}

      {/* REAL DOCUMENT CANVAS SHEET FOR WATERMARKS */}
      {activeTool === 'pdf-watermark' && (
        <div className="bg-zinc-950/60 p-4 rounded-xl border border-[var(--border-color)] flex flex-col items-center">
          <div className="w-44 h-60 bg-white border border-zinc-700 rounded-lg shadow-2xl relative overflow-hidden flex flex-col justify-between p-2 select-none group">
            {firstPageThumbnail ? (
              <img 
                src={firstPageThumbnail} 
                alt="PDF Content Page" 
                className="absolute inset-0 w-full h-full object-contain pointer-events-none bg-white opacity-95"
              />
            ) : (
              <div className="space-y-1.5 opacity-30 p-2">
                <div className="w-3/4 h-1.5 bg-zinc-400 rounded" />
                <div className="w-full h-1 bg-zinc-500 rounded" />
              </div>
            )}

            {watermarkPos === 'pattern' ? (
              <div className="absolute inset-0 grid grid-cols-2 gap-3 p-2 pointer-events-none items-center justify-center overflow-hidden">
                {Array.from({ length: 6 }).map((_, i) => (
                  <span 
                    key={i}
                    className="font-black tracking-widest text-center truncate max-w-[90%] drop-shadow-sm select-none"
                    style={{ 
                      transform: 'rotate(-30deg)',
                      opacity: watermarkOpacity * 0.7,
                      fontSize: '8px',
                      color: watermarkColor === 'red' ? '#ef4444' : watermarkColor === 'blue' ? '#3b82f6' : watermarkColor === 'black' ? '#000000' : '#4b5563'
                    }}
                  >
                    {watermarkText || 'WATERMARK'}
                  </span>
                ))}
              </div>
            ) : (
              <div className={`absolute inset-0 flex items-center justify-center pointer-events-none p-3 ${
                watermarkPos === 'header' ? '!items-start pt-4' : watermarkPos === 'footer' ? '!items-end pb-4' : ''
              }`}>
                <span 
                  className="font-black tracking-widest text-center truncate max-w-[95%] drop-shadow-md transition-all duration-200"
                  style={{ 
                    transform: watermarkPos === 'diagonal' ? 'rotate(-30deg)' : 'none',
                    opacity: watermarkOpacity,
                    fontSize: watermarkPos === 'diagonal' ? '15px' : '11px',
                    color: watermarkColor === 'red' ? '#ef4444' : watermarkColor === 'blue' ? '#3b82f6' : watermarkColor === 'black' ? '#000000' : '#4b5563'
                  }}
                >
                  {watermarkText || 'WATERMARK'}
                </span>
              </div>
            )}
          </div>
          <span className="text-[10px] text-zinc-400 mt-2 font-medium">Real Page Watermark Overlay</span>
        </div>
      )}

      {/* DIGITAL SIGNATURE STAMP */}
      {activeTool === 'pdf-sign' && (
        <div className="bg-zinc-950/60 p-4 rounded-xl border border-[var(--border-color)] flex flex-col items-center">
          <div className="w-44 h-60 bg-white border border-zinc-700 rounded-lg shadow-2xl relative overflow-hidden flex flex-col justify-between p-2 select-none group">
            {firstPageThumbnail ? (
              <img 
                src={firstPageThumbnail} 
                alt="PDF Content Page" 
                className="absolute inset-0 w-full h-full object-contain pointer-events-none bg-white opacity-95"
              />
            ) : (
              <div className="space-y-1.5 opacity-30 p-2">
                <div className="w-3/4 h-1.5 bg-zinc-400 rounded" />
                <div className="w-full h-1 bg-zinc-500 rounded" />
              </div>
            )}

            <div className={`absolute p-2.5 flex flex-col pointer-events-none transition-all duration-200 z-10 ${
              signaturePos === 'bottom-right' ? 'bottom-2 right-2 items-end' :
              signaturePos === 'bottom-left' ? 'bottom-2 left-2 items-start' :
              signaturePos === 'top-right' ? 'top-2 right-2 items-end' : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 items-center'
            }`}>
              <div className="bg-white/80 backdrop-blur-sm border border-zinc-300 p-1.5 rounded shadow-lg flex flex-col items-center">
                <span 
                  className="font-serif italic font-bold text-xs tracking-wide"
                  style={{ color: signatureColor === 'blue' ? '#1e3a8a' : signatureColor === 'red' ? '#991b1b' : '#000000' }}
                >
                  {signatureText || 'Signature'}
                </span>
                <span className="text-[7px] text-zinc-600 font-mono mt-0.5">Verified: {new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <span className="text-[10px] text-zinc-400 mt-2 font-medium">
            Signature Stamp ({signatureTargetPages === 'first-page' ? 'First Page' : signatureTargetPages === 'all-pages' ? 'All Pages' : 'Last Page'})
          </span>
        </div>
      )}

      {/* FLATTEN FORMS CARD */}
      {activeTool === 'pdf-flatten' && (
        <div className="bg-zinc-950/60 p-4 rounded-xl border border-[var(--border-color)] space-y-2">
          <div className="flex items-center gap-2 text-zinc-200 font-bold text-xs">
            <CheckCircle className="w-4 h-4 text-white" /> Vector Form Flattening
          </div>
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            All fillable text inputs and checkboxes will be permanently converted into static, uneditable vector elements.
          </p>
        </div>
      )}

      {/* PASSWORD / UNLOCK CARDS */}
      {activeTool === 'pdf-unlock' && (
        <div className="bg-zinc-950/60 p-4 rounded-xl border border-[var(--border-color)] space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs">
            {pdfIsEncrypted ? (
              <span className="text-amber-400 flex items-center gap-1.5">
                <LockIcon className="w-4 h-4 text-amber-400" /> Password Security Detected
              </span>
            ) : (
              <span className="text-zinc-200 flex items-center gap-1.5">
                <ShieldIcon className="w-4 h-4 text-white" /> No Security Locks
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            {pdfIsEncrypted
              ? 'Password protection detected. Compactor will strip encryption streams and export an unlocked copy.'
              : 'This document has open permissions. Exporting will strip residual security headers to produce a clean PDF.'}
          </p>
        </div>
      )}
    </div>
  );
};

export const PdfTools: React.FC<PdfToolsProps> = ({ toolId, onGoHome, onUploadSuccess }) => {
  const [activeTool, setActiveTool] = useState<string>(toolId || 'pdf-organize');

  // Global execution states
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState('');
  const [resultSize, setResultSize] = useState<number>(0);
  const [compressionResults, setCompressionResults] = useState<CompressionResult[]>([]);
  const [compressionPreset, setCompressionPreset] = useState<CompressionPreset>(() =>
    loadSetting('compactor_pdf_compression_preset', 'balanced')
  );
  const [removeCompressionMetadata, setRemoveCompressionMetadata] = useState(() =>
    loadSetting('compactor_pdf_remove_metadata', true)
  );

  // File states
  const [multipleFiles, setMultipleFiles] = useState<PdfFileInfo[]>([]);
  const [singleFile, setSingleFile] = useState<PdfFileInfo | null>(null);
  const [draggedQueueIndex, setDraggedQueueIndex] = useState<number | null>(null);

  useEffect(() => {
    saveSetting('compactor_pdf_compression_preset', compressionPreset);
    saveSetting('compactor_pdf_remove_metadata', removeCompressionMetadata);
  }, [compressionPreset, removeCompressionMetadata]);

  // Page Organizer state
  const [pagesList, setPagesList] = useState<PageItem[]>([]);
  const [peekPageIndex, setPeekPageIndex] = useState<number | null>(null);

  // Sidebar Auto-collapse State (to maximize viewport width when file is active)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  useEffect(() => {
    if (singleFile || multipleFiles.length > 0) {
      setIsSidebarCollapsed(true);
    }
  }, [singleFile, multipleFiles]);

  // Tool specific configuration states
  const [pageRangeText, setPageRangeText] = useState('1-2');
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [watermarkPos, setWatermarkPos] = useState<'diagonal' | 'header' | 'footer' | 'pattern'>('diagonal');
  const [watermarkColor, setWatermarkColor] = useState<'red' | 'blue' | 'black' | 'gray'>('red');
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.35);

  const [pageNumberPosition, setPageNumberPosition] = useState<'top' | 'bottom'>('bottom');
  const [cropMarginsPct, setCropMarginsPct] = useState<number>(10);
  
  const [signatureText, setSignatureText] = useState('Authorized Signatory');
  const [signaturePos, setSignaturePos] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'center'>('bottom-right');
  const [signatureColor, setSignatureColor] = useState<'blue' | 'black' | 'red'>('blue');
  const [signatureTargetPages, setSignatureTargetPages] = useState<'last-page' | 'first-page' | 'all-pages'>('last-page');

  // Stamp Presets
  const [stampPreset, setStampPreset] = useState<'APPROVED' | 'CONFIDENTIAL' | 'FINAL DRAFT' | 'EXPIRED' | 'PAID' | 'CANCELLED'>('APPROVED');
  const [stampTargetPages, setStampTargetPages] = useState<'last-page' | 'first-page' | 'all-pages'>('last-page');
  const [stampPosition, setStampPosition] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'center'>('bottom-right');

  // Redaction / Annotator
  const [redactMode, setRedactMode] = useState<'redact' | 'text' | 'image'>('redact');
  const [redactTextContent, setRedactTextContent] = useState('CONFIDENTIAL REDACTION');

  const [securityPassword, setSecurityPassword] = useState('');
  const [pdfIsEncrypted, setPdfIsEncrypted] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState(false);

  // Image to PDF Pro Option States
  const [imgOrientation, setImgOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [imgPageSize, setImgPageSize] = useState<'fit' | 'a4' | 'letter'>('fit');
  const [imgMargin, setImgMargin] = useState<'none' | 'small' | 'big'>('none');
  const [imgFilter, setImgFilter] = useState<'original' | 'smart-scan' | 'camscanner' | 'whiteboard' | 'bw' | 'vibrant'>('smart-scan');

  // PDF to Images Extracted Output List
  const [pdfExportImgFormat, setPdfExportImgFormat] = useState<'png' | 'jpg'>('png');
  const [extractedImages, setExtractedImages] = useState<{ pageNumber: number; blob: Blob; url: string }[]>([]);

  // PowerToys Peek Keyboard Navigation Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (peekPageIndex === null) return;
      if (e.key === 'Escape') {
        setPeekPageIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setPeekPageIndex(prev => (prev !== null && prev > 0 ? prev - 1 : pagesList.length - 1));
      } else if (e.key === 'ArrowRight') {
        setPeekPageIndex(prev => (prev !== null && prev < pagesList.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [peekPageIndex, pagesList.length]);

  // Lock background body scroll when PowerToys Peek modal is active
  useEffect(() => {
    if (peekPageIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [peekPageIndex]);

  const reset = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    compressionResults.forEach(result => {
      if (result.url) URL.revokeObjectURL(result.url);
    });
    setResultUrl(null);
    setResultName('');
    setResultSize(0);
    setExtractedImages([]);
    setMultipleFiles([]);
    setSingleFile(null);
    setPagesList([]);
    setPeekPageIndex(null);
    setDraggedQueueIndex(null);
    setShowPassword(false);
    setPdfIsEncrypted(false);
    setSecurityPassword('');
    setProgress(0);
    setProcessing(false);
    setCompressionResults([]);
  };

  useEffect(() => {
    if (toolId) setActiveTool(toolId);
    reset();
    // Reset intentionally runs only when navigation selects another PDF tool.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolId]);

  const handleMultipleFilesSelected = async (selectedFiles: File[]) => {
    setProcessing(true);
    setStatusText('Analyzing document structures...');
    const loaded: PdfFileInfo[] = [];
    for (const f of selectedFiles) {
      const count = f.type.includes('pdf') ? await getPdfPageCount(f) : 1;
      loaded.push({ file: f, pageCount: count });
    }
    setMultipleFiles((prev) => [...prev, ...loaded]);
    setProcessing(false);
  };

  const handleCompressionFilesSelected = async (selectedFiles: File[]) => {
    setProcessing(true);
    setStatusText('Validating PDF documents...');
    const existing = new Set(
      multipleFiles.map(({ file }) => `${file.name}:${file.size}:${file.lastModified}`)
    );
    const loaded: PdfFileInfo[] = [];

    for (const file of selectedFiles) {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (existing.has(key)) continue;
      try {
        const pageCount = await getPdfPageCount(file);
        loaded.push({ file, pageCount });
        existing.add(key);
      } catch (error) {
        console.error(`Could not read ${file.name}`, error);
      }
    }

    setMultipleFiles(prev => [...prev, ...loaded]);
    setProcessing(false);
    setProgress(0);
  };

  const handleSingleFileSelected = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;
    setProcessing(true);
    setStatusText('Analyzing PDF security & page structure...');
    const f = selectedFiles[0];

    const secStatus = await checkPdfEncryptionStatus(f);
    setPdfIsEncrypted(secStatus.isEncrypted);
    setSecurityPassword('');

    const count = secStatus.pageCount;
    setSingleFile({ file: f, pageCount: count });
    setPageRangeText(`1-${Math.min(count, 3)}`);

    const items: PageItem[] = [];
    for (let i = 0; i < count; i++) {
      items.push({ id: `page-${i}-${Date.now()}`, originalIndex: i, rotation: 0 });
    }
    setPagesList(items);
    setProcessing(false);

    renderPdfThumbnails(f, Math.min(count, 100), 1.5).then(thumbs => {
      if (thumbs && thumbs.length > 0) {
        setPagesList(prev => prev.map((item, idx) => ({
          ...item,
          thumbnailUrl: thumbs[idx] || undefined
        })));
      }
    });
  };

  const moveQueueItem = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= multipleFiles.length) return;
    setMultipleFiles(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
  };

  const parsePageRanges = (rangeStr: string, maxPages: number): number[] => {
    const pages = new Set<number>();
    const tokens = rangeStr.split(',');
    for (const token of tokens) {
      const t = token.trim();
      if (t.includes('-')) {
        const parts = t.split('-');
        const start = parseInt(parts[0], 10);
        const end = parseInt(parts[1], 10);
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.min(start, end);
          const max = Math.max(start, end);
          for (let p = min; p <= max; p++) {
            if (p >= 1 && p <= maxPages) pages.add(p);
          }
        }
      } else {
        const p = parseInt(t, 10);
        if (!isNaN(p) && p >= 1 && p <= maxPages) pages.add(p);
      }
    }
    return Array.from(pages).sort((a, b) => a - b);
  };

  const selectedPagesInSplit = singleFile ? parsePageRanges(pageRangeText, singleFile.pageCount) : [];

  const togglePageInSplitRange = (pNum: number) => {
    let current = new Set(selectedPagesInSplit);
    if (current.has(pNum)) {
      current.delete(pNum);
    } else {
      current.add(pNum);
    }
    const arr = Array.from(current).sort((a, b) => a - b);
    if (arr.length === 0) {
      setPageRangeText('1');
      return;
    }
    
    let str = '';
    let start = arr[0];
    let prev = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] === prev + 1) {
        prev = arr[i];
      } else {
        if (start === prev) str += `${start}, `;
        else str += `${start}-${prev}, `;
        start = arr[0];
        prev = arr[i];
      }
    }
    if (start === prev) str += `${start}`;
    else str += `${start}-${prev}`;

    setPageRangeText(str);
  };

  const setSplitPreset = (preset: 'all' | 'none' | 'odd' | 'even') => {
    if (!singleFile) return;
    const total = singleFile.pageCount;
    if (preset === 'all') {
      setPageRangeText(`1-${total}`);
    } else if (preset === 'none') {
      setPageRangeText('1');
    } else if (preset === 'odd') {
      const odds: number[] = [];
      for (let i = 1; i <= total; i += 2) odds.push(i);
      setPageRangeText(odds.join(', '));
    } else if (preset === 'even') {
      const evens: number[] = [];
      for (let i = 2; i <= total; i += 2) evens.push(i);
      setPageRangeText(evens.join(', '));
    }
  };

  // --- PAGE ORGANIZER ACTIONS ---
  const rotatePage = (idx: number, degreesDelta: number) => {
    setPagesList(prev => prev.map((item, i) => {
      if (i === idx) {
        const nextRot = (item.rotation + degreesDelta + 360) % 360;
        return { ...item, rotation: nextRot };
      }
      return item;
    }));
  };

  const movePage = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= pagesList.length) return;
    setPagesList(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
  };

  const deletePage = (idx: number) => {
    setPagesList(prev => prev.filter((_, i) => i !== idx));
  };

  const rotateAllPages = (degreesDelta: number) => {
    setPagesList(prev => prev.map(item => ({
      ...item,
      rotation: (item.rotation + degreesDelta + 360) % 360
    })));
  };

  // --- RUN ACTIONS ---
  const runOrganize = async () => {
    if (!singleFile || pagesList.length === 0) return;
    setProcessing(true); setProgress(30);
    setStatusText('Reorganizing & compiling PDF pages...');
    try {
      const specs: PageOrganizeSpec[] = pagesList.map(item => ({
        originalIndex: item.originalIndex,
        rotation: item.rotation
      }));
      const blob = await reorganizePdfPages(singleFile.file, specs);
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_organized.pdf`);
      onUploadSuccess();
    } catch (e) {
      console.error(e);
      alert('Page organization failed.');
    }
    setProgress(100); setProcessing(false);
  };

  const runMerge = async () => {
    if (multipleFiles.length < 2) return;
    setProcessing(true); setProgress(30);
    setStatusText('Merging PDF files into single document stream...');
    try {
      const files = multipleFiles.map(info => info.file);
      const blob = await mergePdfs(files);
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName('merged_document.pdf');
      onUploadSuccess();
    } catch (e) {
      console.error(e);
      alert('Merge failed.');
    }
    setProgress(100); setProcessing(false);
  };

  const runSplit = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(40);
    setStatusText('Extracting selected page range...');
    try {
      const indices = parsePageRanges(pageRangeText, singleFile.pageCount).map(p => p - 1);
      if (indices.length === 0) {
        alert('Invalid page selection.');
        setProcessing(false); return;
      }
      const blob = await extractPdfPages(singleFile.file, indices);
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_extracted.pdf`);
      onUploadSuccess();
    } catch (e) {
      console.error(e);
      alert('Extraction failed.');
    }
    setProgress(100); setProcessing(false);
  };

  const runCompress = async () => {
    if (multipleFiles.length === 0) return;
    compressionResults.forEach(result => {
      if (result.url) URL.revokeObjectURL(result.url);
    });
    setCompressionResults([]);
    setProcessing(true);

    const results: CompressionResult[] = [];
    for (let index = 0; index < multipleFiles.length; index++) {
      const { file } = multipleFiles[index];
      setProgress(Math.round((index / multipleFiles.length) * 100));
      setStatusText(`Optimizing ${index + 1} of ${multipleFiles.length}: ${file.name}`);
      const outputName = `${file.name.replace(/\.pdf$/i, '')}_compressed.pdf`;
      try {
        const blob = await compressPdf(file, {
          preset: compressionPreset,
          removeMetadata: removeCompressionMetadata,
        });
        results.push({
          sourceName: file.name,
          sourceSize: file.size,
          outputName,
          outputSize: blob.size,
          url: URL.createObjectURL(blob),
        });
      } catch (error) {
        console.error(`Compression failed for ${file.name}`, error);
        results.push({
          sourceName: file.name,
          sourceSize: file.size,
          outputName,
          outputSize: 0,
          error: error instanceof Error ? error.message : 'Unable to optimize this PDF',
        });
      }
    }
    setCompressionResults(results);
    setProgress(100);
    setProcessing(false);
    const successfulCount = results.filter(result => result.url).length;
    if (successfulCount > 0) onUploadSuccess(successfulCount);
  };

  const retryCompressionResult = async (resultIndex: number) => {
    const failed = compressionResults[resultIndex];
    const source = multipleFiles.find(item =>
      item.file.name === failed.sourceName && item.file.size === failed.sourceSize
    )?.file;
    if (!source) return;
    setProcessing(true);
    setProgress(35);
    setStatusText(`Retrying ${source.name}...`);
    try {
      const blob = await compressPdf(source, {
        preset: compressionPreset,
        removeMetadata: removeCompressionMetadata,
      });
      const replacement: CompressionResult = {
        ...failed,
        outputSize: blob.size,
        url: URL.createObjectURL(blob),
        error: undefined,
      };
      setCompressionResults(prev => prev.map((item, index) => index === resultIndex ? replacement : item));
      setProgress(100);
      onUploadSuccess();
    } catch (error) {
      setCompressionResults(prev => prev.map((item, index) => index === resultIndex ? {
        ...item,
        error: error instanceof Error ? error.message : 'Unable to optimize this PDF',
      } : item));
    } finally {
      setProcessing(false);
    }
  };

  const runImagesToPdf = async () => {
    if (multipleFiles.length === 0) return;
    setProcessing(true); setProgress(40);
    setStatusText('Compiling raster images into vector PDF pages...');
    try {
      const files = multipleFiles.map(info => info.file);
      const blob = await imagesToPdf(files, {
        orientation: imgOrientation,
        pageSize: imgPageSize,
        margin: imgMargin,
        filter: imgFilter
      });
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName('images_compiled.pdf');
      onUploadSuccess();
    } catch (e) {
      console.error(e);
      alert('Conversion failed.');
    }
    setProgress(100); setProcessing(false);
  };

  const runStamps = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(45);
    setStatusText(`Stamping ${stampPreset} preset badge onto pages...`);
    try {
      const blob = await addVectorStampToPdf(singleFile.file, {
        preset: stampPreset,
        targetPages: stampTargetPages,
        position: stampPosition
      });
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_stamped.pdf`);
      onUploadSuccess();
    } catch (e) {
      console.error(e);
      alert('Stamping document failed.');
    }
    setProgress(100); setProcessing(false);
  };

  const runFlatten = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(45);
    setStatusText('Flattening form fields into uneditable vector streams...');
    try {
      const blob = await flattenPdfForm(singleFile.file);
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_flattened.pdf`);
      onUploadSuccess();
    } catch (e) {
      console.error(e);
      alert('Form flattening failed.');
    }
    setProgress(100); setProcessing(false);
  };

  const runRedact = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(45);
    setStatusText('Applying redaction blackout & overlays...');
    try {
      const blob = await annotateOrRedactPdf(singleFile.file, {
        mode: redactMode,
        textOverlay: redactMode === 'text' ? { content: redactTextContent, xPct: 10, yPct: 50 } : undefined,
        redactBox: redactMode === 'redact' ? { xPct: 20, yPct: 20, widthPct: 60, heightPct: 20 } : undefined
      });
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_redacted.pdf`);
      onUploadSuccess();
    } catch (e) {
      console.error(e);
      alert('Redaction failed.');
    }
    setProgress(100); setProcessing(false);
  };

  const runPdfToImages = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(40);
    setStatusText(`Rendering ${singleFile.pageCount} pages at 300 DPI high-resolution...`);
    try {
      const images = await renderPdfPagesToImages(singleFile.file, pdfExportImgFormat, 2.5);
      setProgress(95);
      setExtractedImages(images);
      onUploadSuccess();
    } catch (e) {
      console.error(e);
      alert('PDF to Image rendering failed.');
    }
    setProgress(100); setProcessing(false);
  };

  const runWatermark = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(45);
    setStatusText('Applying watermark overlay onto document pages...');
    try {
      const blob = await watermarkPdfAdvanced(singleFile.file, {
        text: watermarkText,
        color: watermarkColor,
        position: watermarkPos,
        opacity: watermarkOpacity
      });
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_watermarked.pdf`);
      onUploadSuccess();
    } catch (e) {
      console.error(e);
      alert('Watermark addition failed.');
    }
    setProgress(100); setProcessing(false);
  };

  const runPageNumbers = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(45);
    setStatusText('Injecting page numbers into document footer/header...');
    try {
      const blob = await addPageNumbersToPdf(singleFile.file, pageNumberPosition);
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_numbered.pdf`);
      onUploadSuccess();
    } catch (e) {
      console.error(e);
      alert('Page numbering failed.');
    }
    setProgress(100); setProcessing(false);
  };

  const runCrop = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(45);
    setStatusText('Cropping page margins...');
    try {
      const blob = await cropPdfMargins(singleFile.file, cropMarginsPct);
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_cropped.pdf`);
      onUploadSuccess();
    } catch (e) {
      console.error(e);
      alert('Cropping margins failed.');
    }
    setProgress(100); setProcessing(false);
  };

  const runSign = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(45);
    setStatusText('Applying digital signature stamp...');
    try {
      const blob = await signPdfDocumentAdvanced(
        singleFile.file, 
        signatureText, 
        signaturePos, 
        signatureColor,
        signatureTargetPages
      );
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_signed.pdf`);
      onUploadSuccess();
    } catch (e) {
      console.error(e);
      alert('Sign document failed.');
    }
    setProgress(100); setProcessing(false);
  };

  const runProtect = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(45);
    setStatusText('Encrypting PDF stream dictionary...');
    try {
      const blob = await protectPdfWithPassword(singleFile.file, securityPassword);
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_protected.pdf`);
      onUploadSuccess();
    } catch (e) {
      console.error(e);
      alert('Protection failed.');
    }
    setProgress(100); setProcessing(false);
  };

  const runUnlock = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(45);
    setStatusText('Decrypting PDF stream & removing password...');
    try {
      const blob = await unlockPdfWithPassword(singleFile.file, securityPassword);
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_unlocked.pdf`);
      onUploadSuccess();
    } catch (e) {
      console.error(e);
      alert('Unlock PDF failed. Please verify the current password.');
    }
    setProgress(100); setProcessing(false);
  };

  const runPdfToMd = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(40);
    setStatusText('Extracting PDF text layer & formatting Markdown structure...');
    try {
      const mdText = await extractPdfMarkdown(singleFile.file);
      setProgress(90);
      const mdBlob = new Blob([mdText], { type: 'text/markdown;charset=utf-8' });
      setResultSize(mdBlob.size);
      setResultUrl(URL.createObjectURL(mdBlob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_extracted.md`);
      onUploadSuccess();
    } catch (e) {
      console.error(e);
      alert('PDF to Markdown conversion failed.');
    }
    setProgress(100); setProcessing(false);
  };

  const getToolTitle = () => {
    for (const group of TOOL_GROUPS) {
      const match = group.items.find(i => i.id === activeTool);
      if (match) return match.label;
    }
    return 'Adobe-Level PDF Editor Pro';
  };

  const getToolDesc = () => {
    for (const group of TOOL_GROUPS) {
      const match = group.items.find(i => i.id === activeTool);
      if (match) return match.desc;
    }
    return 'Comprehensive PDF toolkit for page organization, digital signatures, watermarks, encryption, and conversions.';
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && activeTool === 'pdf-compress' && multipleFiles.length > 0 && !processing) {
        event.preventDefault();
        runCompress();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && compressionResults.some(result => result.url)) {
        event.preventDefault();
        downloadAll(compressionResults.flatMap(result => result.url ? [{ url: result.url, name: result.outputName }] : []));
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  });

  return (
    <div className="tool-layout pdf-tool-layout">
      <ToolHeader 
        title={getToolTitle()} 
        description={getToolDesc()} 
        icon={FileText} 
        onGoHome={() => {
          if (singleFile || multipleFiles.length > 0 || resultUrl || compressionResults.length > 0 || extractedImages.length > 0 || processing) {
            reset();
          } else {
            onGoHome();
          }
        }} 
      />

      {processing && (
        <div className="max-w-2xl mx-auto py-12">
          <ProgressBar progress={progress} statusText={statusText} subText="High-precision client-side PDF document engine" />
        </div>
      )}

      {/* Sidebar Viewport Toggle Bar */}
      {!processing && !resultUrl && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarCollapsed(prev => !prev)}
              className="hidden lg:flex items-center gap-2 text-xs font-extrabold px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 cursor-pointer shadow-md transition-all"
              title={isSidebarCollapsed ? "Show Tools Menu Sidebar" : "Collapse Tools Menu Sidebar to Maximize Canvas Viewport"}
            >
              {isSidebarCollapsed ? (
                <>
                  <PanelLeftOpen className="w-4 h-4 text-white shrink-0 stroke-[2.5]" />
                  <span className="text-white font-extrabold">Show Tools Menu</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4 text-white shrink-0 stroke-[2.5]" />
                  <span className="text-white font-extrabold">Maximize Viewport</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {!processing && !resultUrl && compressionResults.length === 0 && extractedImages.length === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Adobe Acrobat Style Category Sidebar (Desktop Only - Auto-hidden when file uploaded or toggled) */}
          {!isSidebarCollapsed && (
            <div className="tool-menu hidden lg:block lg:col-span-3 space-y-4">
              {TOOL_GROUPS.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1.5">
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block px-1">
                    {group.title}
                  </span>
                  <div className="space-y-1 bg-zinc-950/60 p-1.5 rounded-xl border border-[var(--border-color)]">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => { setActiveTool(item.id); reset(); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                          activeTool === item.id 
                            ? 'bg-white text-zinc-950 shadow-sm border border-white font-bold' 
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                        }`}
                      >
                        <item.icon className="w-4 h-4 shrink-0 text-zinc-400" />
                        <div className="truncate">
                          <span className="block text-xs truncate">{item.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={`space-y-6 ${!isSidebarCollapsed ? 'col-span-1 lg:col-span-9' : 'col-span-1 lg:col-span-12'}`}>

            {/* Mobile Exclusive Condensed Tool Selector (Upload Box First) */}
            <div className="block lg:hidden w-full space-y-1.5 bg-zinc-900/80 p-3 rounded-2xl border border-zinc-800">
              <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
                Active PDF Tool
              </label>
              <Select value={activeTool} onValueChange={(val) => { if (val) { setActiveTool(val); reset(); } }}>
                <SelectTrigger className="w-full h-10 text-xs bg-zinc-950 border border-zinc-800 text-white font-bold rounded-xl">
                  <SelectValue placeholder="Select PDF Tool">
                    {getToolTitle()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TOOL_GROUPS.map((group) => (
                    <div key={group.title} className="py-1">
                      <div className="px-2 py-1 text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider bg-zinc-900/50">
                        {group.title}
                      </div>
                      {group.items.map((item) => (
                        <SelectItem key={item.id} value={item.id} className="text-xs font-semibold py-2">
                          <span className="flex items-center gap-2">
                            <item.icon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span>{item.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 0. EDIT PDF & REDACT WORKSPACE */}
            {(activeTool === 'pdf-edit' || activeTool === 'pdf-redact') && (
              <div className="space-y-6">
                {!singleFile ? (
                  <FileUploader 
                    accept=".pdf"
                    label={activeTool === 'pdf-redact' ? "Select PDF file to redact sensitive content" : "Select PDF file to edit"}
                    subLabel={activeTool === 'pdf-redact' ? "Draw visual blackout boxes, text censorship overlays & redact sensitive areas with 100% precision" : "Add shapes, annotations, text, lines, border & fill colors, opacity, rotation & side element layers"}
                    onFilesSelected={handleSingleFileSelected}
                    maxSizeMB={200}
                  />
                ) : (
                  <PdfEditor 
                    file={singleFile.file} 
                    mode={activeTool === 'pdf-redact' ? 'redact' : 'edit'}
                    onSaveSuccess={() => onUploadSuccess(1)} 
                  />
                )}
              </div>
            )}

            {/* MARKDOWN EDITOR WORKSPACE */}
            {activeTool === 'pdf-word-to-pdf' && (
              <MarkdownEditor 
                onExportSuccess={() => onUploadSuccess(1)} 
              />
            )}

            {/* 1. VISUAL PAGE ORGANIZER WORKSPACE */}
            {activeTool === 'pdf-organize' && (
              <div className="space-y-6">
                {!singleFile ? (
                  <FileUploader 
                    accept=".pdf"
                    label="Select PDF file to organize pages"
                    subLabel="Visual thumbnail organizer for page reordering, rotation & deletion"
                    onFilesSelected={handleSingleFileSelected}
                    maxSizeMB={200}
                  />
                ) : (
                  <Card className="border-[var(--border-color)] bg-[var(--surface-color)] shadow-sm p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--border-color)] pb-4">
                      <div>
                        <span className="text-xs font-bold text-[var(--text-primary)] block">{singleFile.file.name}</span>
                        <span className="text-[10px] text-[var(--text-secondary)] font-medium">
                          {pagesList.length} Pages remaining &bull; Size: {formatBytes(singleFile.file.size)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => rotateAllPages(-90)} 
                          className="h-8 text-[11px] border-[var(--border-color)] text-zinc-300"
                        >
                          Rotate All ↺
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => rotateAllPages(90)} 
                          className="h-8 text-[11px] border-[var(--border-color)] text-zinc-300"
                        >
                          Rotate All ↻
                        </Button>
                        <Button 
                          variant="ghost" 
                          onClick={reset} 
                          className="text-rose-500 hover:text-rose-600 text-xs h-8 px-2"
                        >
                          Change File
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                          Visual Page Grid (Click thumbnail image to Peek / Zoom)
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[440px] overflow-y-auto pr-1">
                        {pagesList.map((item, idx) => (
                          <div 
                            key={item.id} 
                            className="bg-zinc-950/60 border border-[var(--border-color)] rounded-xl p-2.5 flex flex-col items-center justify-between gap-2 relative group hover:border-zinc-500 transition-all shadow-sm"
                          >
                            <div className="flex items-center justify-between w-full text-[10px] font-bold text-zinc-400">
                              <span>Page {idx + 1}</span>
                              <span className="text-zinc-500">Org #{item.originalIndex + 1}</span>
                            </div>

                            <div 
                              onClick={() => setPeekPageIndex(idx)}
                              title="Click for PowerToys Peek Zoom View"
                              className="w-full aspect-[1/1.3] bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center p-1 relative overflow-hidden cursor-pointer group/thumb hover:border-zinc-400 transition-colors shadow-inner"
                            >
                              <div 
                                className="w-full h-full rounded flex items-center justify-center transition-transform duration-300 bg-white overflow-hidden shadow-sm"
                                style={{ transform: `rotate(${item.rotation}deg)` }}
                              >
                                {item.thumbnailUrl ? (
                                  <img 
                                    src={item.thumbnailUrl} 
                                    alt={`Page ${item.originalIndex + 1}`} 
                                    className="w-full h-full object-contain pointer-events-none" 
                                  />
                                ) : (
                                  <div className="flex flex-col items-center justify-center p-2 text-zinc-400">
                                    <FileText className="w-6 h-6 text-zinc-400 mb-1 animate-pulse" />
                                    <span className="text-[9px] font-mono text-zinc-600 font-bold">Rendering P. {item.originalIndex + 1}...</span>
                                  </div>
                                )}
                              </div>

                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                                <span className="text-[9px] font-bold text-white bg-zinc-950/95 border border-zinc-700 px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-1.5">
                                  <ZoomIcon className="w-3.5 h-3.5 text-white" /> Peek Zoom
                                </span>
                              </div>

                              {item.rotation !== 0 && (
                                <span className="absolute top-1 right-1 bg-zinc-950/90 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-zinc-700 shadow-md">
                                  {item.rotation}°
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-4 gap-1 w-full pt-1 border-t border-zinc-900">
                              <button 
                                onClick={() => rotatePage(idx, -90)}
                                title="Rotate Left 90°"
                                className="py-1 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-800 flex items-center justify-center cursor-pointer"
                              >
                                ↺
                              </button>
                              <button 
                                onClick={() => rotatePage(idx, 90)}
                                title="Rotate Right 90°"
                                className="py-1 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-800 flex items-center justify-center cursor-pointer"
                              >
                                ↻
                              </button>
                              <button 
                                onClick={() => movePage(idx, idx - 1)}
                                disabled={idx === 0}
                                title="Move Previous"
                                className="py-1 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed rounded border border-zinc-800 flex items-center justify-center cursor-pointer"
                              >
                                <ArrowLeft className="w-2.5 h-2.5" />
                              </button>
                              <button 
                                onClick={() => movePage(idx, idx + 1)}
                                disabled={idx === pagesList.length - 1}
                                title="Move Next"
                                className="py-1 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed rounded border border-zinc-800 flex items-center justify-center cursor-pointer"
                              >
                                <ArrowRight className="w-2.5 h-2.5" />
                              </button>
                            </div>

                            <button
                              onClick={() => deletePage(idx)}
                              title="Delete Page"
                              className="w-full py-1 bg-rose-950/20 hover:bg-rose-900/40 text-rose-400 hover:text-rose-300 text-[10px] font-bold rounded border border-rose-900/40 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              <TrashIcon className="w-3 h-3" /> Remove Page
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button 
                      onClick={runOrganize}
                      disabled={pagesList.length === 0}
                      className="w-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold rounded-full h-11 text-xs shadow-sm cursor-pointer"
                    >
                      Save & Export Organized PDF ({pagesList.length} Pages)
                    </Button>
                  </Card>
                )}
              </div>
            )}

            {/* 2. MERGE PDF WORKSPACE */}
            {activeTool === 'pdf-merge' && (
              <div className="space-y-6">
                {multipleFiles.length === 0 ? (
                  <FileUploader 
                    accept=".pdf"
                    multiple={true}
                    label="Upload PDF files to merge"
                    subLabel="Choose multiple PDF documents to compile sequentially in order"
                    onFilesSelected={handleMultipleFilesSelected}
                    maxSizeMB={150}
                  />
                ) : (
                  <div className="pdf-mobile-stack grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="md:col-span-2 border-[var(--border-color)] bg-[var(--surface-color)] p-6 space-y-4">
                      <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
                        <div>
                          <span className="text-xs font-bold text-[var(--text-primary)] block">Files Queue ({multipleFiles.length} files)</span>
                          <span className="text-[10px] text-zinc-500 font-medium">Drag rows or use ↑ ↓ buttons to reorder merge priority</span>
                        </div>
                        <Button variant="ghost" onClick={reset} className="text-rose-500 hover:text-rose-600 text-xs h-7 px-2">Clear Queue</Button>
                      </div>

                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {multipleFiles.map((info, idx) => (
                          <div 
                            key={idx} 
                            draggable={true}
                            onDragStart={(e) => {
                              setDraggedQueueIndex(idx);
                              e.dataTransfer.setData('text/plain', String(idx));
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                              if (!isNaN(fromIdx)) {
                                moveQueueItem(fromIdx, idx);
                              }
                              setDraggedQueueIndex(null);
                            }}
                            onDragEnd={() => setDraggedQueueIndex(null)}
                            className={`flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-[var(--border-color)] text-xs group hover:border-zinc-500 transition-all ${
                              draggedQueueIndex === idx ? 'opacity-40 border-dashed border-white bg-zinc-900 scale-[0.99]' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                              <div className="cursor-grab active:cursor-grabbing p-1 text-zinc-500 hover:text-white transition-colors shrink-0" title="Drag to reorder merge priority">
                                <ListIcon className="w-4 h-4" />
                              </div>

                              <span className="w-6 h-6 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono font-bold text-zinc-300 flex items-center justify-center shrink-0">
                                #{idx + 1}
                              </span>

                              <div className="truncate min-w-0">
                                <span className="block font-bold text-[var(--text-primary)] truncate text-xs">{info.file.name}</span>
                                <span className="text-[10px] text-[var(--text-secondary)] font-medium">
                                  Pages: {info.pageCount || 1} &bull; Size: {formatBytes(info.file.size)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button 
                                onClick={() => moveQueueItem(idx, idx - 1)}
                                disabled={idx === 0}
                                title="Move File Up"
                                className="w-7 h-7 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 rounded border border-zinc-800 flex items-center justify-center text-xs transition-colors cursor-pointer"
                              >
                                ↑
                              </button>
                              <button 
                                onClick={() => moveQueueItem(idx, idx + 1)}
                                disabled={idx === multipleFiles.length - 1}
                                title="Move File Down"
                                className="w-7 h-7 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 rounded border border-zinc-800 flex items-center justify-center text-xs transition-colors cursor-pointer"
                              >
                                ↓
                              </button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setMultipleFiles(prev => prev.filter((_, i) => i !== idx))} 
                                className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 w-7 h-7 rounded-lg ml-1"
                                title="Remove File from Queue"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <FileUploader 
                        accept=".pdf"
                        multiple={true}
                        label="Append more files to queue"
                        onFilesSelected={handleMultipleFilesSelected}
                      />
                    </Card>

                    <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-6 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <h3 className="font-bold text-xs text-[var(--text-primary)] uppercase tracking-wider">Compilation Target</h3>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                          Combines all queued file pages sequentially in the exact order listed (#1 &rarr; #{multipleFiles.length}) into a single unified PDF document.
                        </p>
                      </div>
                      <Button 
                        onClick={runMerge} 
                        className="w-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold rounded-full h-11 text-xs cursor-pointer shadow-sm"
                      >
                        Compile PDF Document
                      </Button>
                    </Card>
                  </div>
                )}
              </div>
            )}

            {/* 3. IMAGES TO PDF WORKSPACE */}
            {activeTool === 'pdf-jpg-to-pdf' && (
              <div className="space-y-6">
                {multipleFiles.length === 0 ? (
                  <FileUploader 
                    accept="image/png,image/jpeg,image/webp"
                    multiple={true}
                    label="Upload PNG, JPG, or WebP images to convert"
                    subLabel="Compile high-resolution image cards into a unified multi-page PDF with CamScanner Mobile Scan filters"
                    onFilesSelected={handleMultipleFilesSelected}
                    maxSizeMB={150}
                  />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    <Card className="lg:col-span-8 border-[var(--border-color)] bg-[var(--surface-color)] p-6 space-y-4">
                      <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
                        <div>
                          <span className="text-xs font-bold text-[var(--text-primary)] block">Uploaded Images ({multipleFiles.length} files)</span>
                          <span className="text-[10px] text-zinc-500 font-medium">Reorder image sequence or click cards to view full resolution</span>
                        </div>
                        <Button variant="ghost" onClick={reset} className="text-rose-500 hover:text-rose-600 text-xs h-7 px-2">Clear All</Button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 max-h-[460px] overflow-y-auto pr-1">
                        {multipleFiles.map((info, idx) => {
                          const imgUrl = URL.createObjectURL(info.file);
                          return (
                            <div 
                              key={idx}
                              className="bg-zinc-950/60 border border-[var(--border-color)] rounded-xl p-2.5 flex flex-col justify-between items-center relative group hover:border-zinc-500 transition-all shadow-sm select-none"
                            >
                              <div className="flex items-center justify-between w-full text-[10px] font-bold text-zinc-400 mb-1">
                                <span className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-mono">
                                  #{idx + 1}
                                </span>
                                <button
                                  onClick={() => setMultipleFiles(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-rose-400 hover:text-rose-300 p-0.5 rounded hover:bg-rose-950/30 transition-colors"
                                  title="Remove image"
                                >
                                  <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div 
                                onClick={() => {
                                  const peekList = multipleFiles.map((f, i) => ({
                                    id: `img-${i}`,
                                    originalIndex: i,
                                    rotation: 0,
                                    thumbnailUrl: URL.createObjectURL(f.file)
                                  }));
                                  setPagesList(peekList);
                                  setPeekPageIndex(idx);
                                }}
                                className="w-full aspect-[1/1.2] bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden relative cursor-pointer group/imgCard shadow-inner flex items-center justify-center"
                                title="Click for PowerToys Peek Zoom View"
                              >
                                <img 
                                  src={imgUrl} 
                                  alt={info.file.name} 
                                  className="w-full h-full object-cover group-hover/imgCard:scale-105 transition-transform duration-300"
                                />

                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/imgCard:opacity-100 flex items-center justify-center transition-opacity">
                                  <span className="text-[9px] font-bold text-white bg-zinc-950/95 border border-zinc-700 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-lg">
                                    <ZoomIcon className="w-3 h-3 text-white" /> View Image
                                  </span>
                                </div>
                              </div>

                              <span className="text-[10px] font-medium text-zinc-400 truncate w-full mt-1.5 text-center">
                                {info.file.name}
                              </span>

                              <div className="grid grid-cols-2 gap-1 w-full mt-1.5 pt-1.5 border-t border-zinc-900">
                                <button
                                  onClick={() => moveQueueItem(idx, idx - 1)}
                                  disabled={idx === 0}
                                  className="py-0.5 text-[9px] bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 text-zinc-300 rounded border border-zinc-800 flex items-center justify-center"
                                  title="Move Left"
                                >
                                  ←
                                </button>
                                <button
                                  onClick={() => moveQueueItem(idx, idx + 1)}
                                  disabled={idx === multipleFiles.length - 1}
                                  className="py-0.5 text-[9px] bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 text-zinc-300 rounded border border-zinc-800 flex items-center justify-center"
                                  title="Move Right"
                                >
                                  →
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <FileUploader 
                        accept="image/png,image/jpeg,image/webp"
                        multiple={true}
                        label="Append more images"
                        onFilesSelected={handleMultipleFilesSelected}
                      />
                    </Card>

                    <Card className="lg:col-span-4 border-[var(--border-color)] bg-[var(--surface-color)] p-6 space-y-5">
                      <div className="border-b border-[var(--border-color)] pb-3">
                        <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider block">Image to PDF Options</span>
                        <span className="text-[10px] text-zinc-500 font-medium">Customize layout, orientation & document scan filters</span>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block flex items-center gap-1.5">
                          <MagicIcon className="w-3.5 h-3.5 text-white" /> Document Scan Filter
                        </label>
                        <Select value={imgFilter === 'camscanner' ? 'smart-scan' : imgFilter} onValueChange={(val: any) => setImgFilter(val)}>
                          <SelectTrigger className="w-full h-9 text-xs bg-zinc-950 border border-[var(--border-color)] font-semibold truncate">
                            <SelectValue>
                              {imgFilter === 'smart-scan' || imgFilter === 'camscanner' ? 'Magic Color (Boost Contrast & Whiten)' :
                               imgFilter === 'whiteboard' ? 'Whiteboard Clean (High Contrast B&W)' :
                               imgFilter === 'bw' ? 'B&W Binary Document Scan' :
                               imgFilter === 'vibrant' ? 'Vibrant Diagram Scan' : 'Original Photo (No Filter)'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="smart-scan">Magic Color (Boost Contrast & Whiten)</SelectItem>
                            <SelectItem value="whiteboard">Whiteboard Clean (High Contrast B&W)</SelectItem>
                            <SelectItem value="bw">B&W Binary Document Scan</SelectItem>
                            <SelectItem value="vibrant">Vibrant Diagram Scan</SelectItem>
                            <SelectItem value="original">Original Photo (No Filter)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Page Orientation</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setImgOrientation('auto')}
                            className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                              imgOrientation === 'auto'
                                ? 'border-white bg-zinc-800 text-white shadow-sm font-bold'
                                : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            <span className="text-[10px] font-bold font-mono text-zinc-200">AUTO</span>
                            <span className="text-[10px]">Same as Image</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setImgOrientation('portrait')}
                            className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                              imgOrientation === 'portrait'
                                ? 'border-white bg-zinc-800 text-white shadow-sm font-bold'
                                : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            <div className="w-3.5 h-5 border-2 border-current rounded-sm" />
                            <span className="text-[10px]">Portrait</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setImgOrientation('landscape')}
                            className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                              imgOrientation === 'landscape'
                                ? 'border-white bg-zinc-800 text-white shadow-sm font-bold'
                                : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            <div className="w-5 h-3.5 border-2 border-current rounded-sm" />
                            <span className="text-[10px]">Landscape</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Page Size</label>
                          <Select value={imgPageSize} onValueChange={(val: any) => setImgPageSize(val)}>
                            <SelectTrigger className="w-full h-9 text-xs bg-zinc-950 border border-[var(--border-color)] font-semibold">
                              <SelectValue>
                                {imgPageSize === 'fit' ? 'Fit Image' : imgPageSize === 'a4' ? 'A4 Page' : 'US Letter'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fit">Fit Image</SelectItem>
                              <SelectItem value="a4">A4 Page</SelectItem>
                              <SelectItem value="letter">US Letter</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Page Margin</label>
                          <Select value={imgMargin} onValueChange={(val: any) => setImgMargin(val)}>
                            <SelectTrigger className="w-full h-9 text-xs bg-zinc-950 border border-[var(--border-color)] font-semibold">
                              <SelectValue>
                                {imgMargin === 'none' ? 'No Margin' : imgMargin === 'small' ? 'Small' : 'Big Margin'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Margin</SelectItem>
                              <SelectItem value="small">Small</SelectItem>
                              <SelectItem value="big">Big Margin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Button 
                        onClick={runImagesToPdf} 
                        className="w-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold rounded-full h-11 text-xs cursor-pointer shadow-sm mt-2"
                      >
                        Convert to PDF Document &rarr;
                      </Button>
                    </Card>
                  </div>
                )}
              </div>
            )}

            {/* BULK PDF COMPRESSION WORKSPACE */}
            {activeTool === 'pdf-compress' && (
              <div className="space-y-5">
                <FileUploader
                  accept=".pdf,application/pdf"
                  multiple
                  label={multipleFiles.length === 0 ? 'Bulk import PDF documents' : 'Add more PDF documents'}
                  subLabel="Select or drop multiple PDFs. Files are optimized one at a time to keep memory usage stable."
                  onFilesSelected={handleCompressionFilesSelected}
                  maxSizeMB={200}
                  compact={multipleFiles.length > 0}
                />

                {multipleFiles.length > 0 && (
                  <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-6 space-y-4">
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
                      <div>
                        <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider block">
                          Compression queue ({multipleFiles.length})
                        </span>
                        <span className="text-[10px] text-[var(--text-secondary)]">
                          {formatBytes(multipleFiles.reduce((total, item) => total + item.file.size, 0))} total
                        </span>
                      </div>
                      <Button variant="ghost" onClick={reset} className="text-rose-500 hover:text-rose-600 text-xs h-8 px-2">
                        Clear all
                      </Button>
                    </div>

                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                      {multipleFiles.map((item, index) => (
                        <div
                          key={`${item.file.name}:${item.file.size}:${item.file.lastModified}`}
                          draggable
                          onDragStart={() => setDraggedQueueIndex(index)}
                          onDragOver={event => event.preventDefault()}
                          onDrop={() => {
                            if (draggedQueueIndex !== null && draggedQueueIndex !== index) {
                              moveQueueItem(draggedQueueIndex, index);
                            }
                            setDraggedQueueIndex(null);
                          }}
                          onDragEnd={() => setDraggedQueueIndex(null)}
                          className="flex items-center gap-3 p-3 bg-zinc-950/40 border border-[var(--border-color)] rounded-xl cursor-grab active:cursor-grabbing"
                        >
                          <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200 font-bold text-[10px] shrink-0">
                            PDF
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="block text-xs font-bold truncate text-[var(--text-primary)]">{item.file.name}</span>
                            <span className="text-[10px] text-[var(--text-secondary)]">
                              {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'} &bull; {formatBytes(item.file.size)}
                            </span>
                          </div>
                          <button
                            type="button"
                            aria-label={`Remove ${item.file.name}`}
                            onClick={() => setMultipleFiles(prev => prev.filter((_, itemIndex) => itemIndex !== index))}
                            className="p-2 rounded-lg text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <CompressionPresetSelector value={compressionPreset} onChange={setCompressionPreset} />

                    <label className="compression-privacy-toggle">
                      <span>
                        <span className="block text-xs font-bold text-[var(--text-primary)]">Remove private metadata</span>
                        <span className="block text-[10px] text-[var(--text-secondary)] mt-0.5">Clears author, title, subject, keywords, creator, and producer details.</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={removeCompressionMetadata}
                        onChange={event => setRemoveCompressionMetadata(event.target.checked)}
                        className="w-4 h-4 accent-white shrink-0"
                      />
                    </label>

                    <Button
                      onClick={runCompress}
                      className="w-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold rounded-full h-11 text-xs cursor-pointer shadow-sm"
                    >
                      <MagicIcon className="w-4 h-4 mr-1.5" />
                      Optimize {multipleFiles.length} {multipleFiles.length === 1 ? 'PDF' : 'PDFs'}
                    </Button>
                  </Card>
                )}
              </div>
            )}

            {/* 4. SINGLE FILE TOOL CONFIGURATOR WORKSPACE WITH REAL-TIME PREVIEW */}
            {['pdf-split', 'pdf-watermark', 'pdf-page-numbers', 'pdf-protect', 'pdf-unlock', 'pdf-sign', 'pdf-to-word', 'pdf-crop-tool', 'pdf-stamps', 'pdf-flatten', 'pdf-to-image'].includes(activeTool) && (
              <div className="space-y-6">
                {!singleFile ? (
                  <FileUploader 
                    accept=".pdf"
                    label="Upload PDF document to configure"
                    subLabel="Supports stamps, form flattening, redaction & 300 DPI exports"
                    onFilesSelected={handleSingleFileSelected}
                    maxSizeMB={200}
                  />
                ) : (
                  <div className="pdf-mobile-stack grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="md:col-span-2 border-[var(--border-color)] bg-[var(--surface-color)] p-6 space-y-5">
                      <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
                        <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Source Document</span>
                        <Button variant="ghost" onClick={reset} className="text-rose-500 hover:text-rose-600 text-xs h-7 px-2">Change File</Button>
                      </div>

                      <div className="flex items-center gap-3.5 p-4 bg-zinc-950/40 border border-[var(--border-color)] rounded-xl">
                        <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200 font-bold text-xs uppercase flex-shrink-0">
                          PDF
                        </div>
                        <div className="truncate flex-1 min-w-0">
                          <span className="block text-xs font-bold truncate text-[var(--text-primary)]">{singleFile.file.name}</span>
                          <span className="text-[10px] text-[var(--text-secondary)] mt-0.5 block font-medium">
                            Pages: <span className="text-zinc-200 font-bold">{singleFile.pageCount}</span> &bull; Size: <span className="text-zinc-200 font-bold">{formatBytes(singleFile.file.size)}</span>
                          </span>
                        </div>
                      </div>

                      {/* Tool Config Controls */}
                      {activeTool === 'pdf-stamps' && (
                        <div className="space-y-4 pt-1">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Select Stamp Preset</label>
                            <div className="grid grid-cols-3 gap-2">
                              {['APPROVED', 'CONFIDENTIAL', 'FINAL DRAFT', 'EXPIRED', 'PAID', 'CANCELLED'].map((st) => (
                                <button
                                  key={st}
                                  onClick={() => setStampPreset(st as any)}
                                  className={`py-2.5 px-2 rounded-xl text-xs font-mono font-black border transition-all cursor-pointer ${
                                    stampPreset === st
                                      ? 'border-white bg-zinc-800 text-white shadow-sm scale-105'
                                      : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200'
                                  }`}
                                >
                                  {st}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Placement</label>
                              <Select value={stampPosition} onValueChange={(val: any) => setStampPosition(val)}>
                                <SelectTrigger className="w-full h-9 text-xs bg-zinc-950 border border-[var(--border-color)] font-semibold">
                                  <SelectValue>
                                    {stampPosition === 'bottom-right' ? 'Bottom Right' :
                                     stampPosition === 'bottom-left' ? 'Bottom Left' :
                                     stampPosition === 'top-right' ? 'Top Right' : 'Center'}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                                  <SelectItem value="top-right">Top Right</SelectItem>
                                  <SelectItem value="center">Center</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Target Pages</label>
                              <Select value={stampTargetPages} onValueChange={(val: any) => setStampTargetPages(val)}>
                                <SelectTrigger className="w-full h-9 text-xs bg-zinc-950 border border-[var(--border-color)] font-semibold">
                                  <SelectValue>
                                    {stampTargetPages === 'last-page' ? 'Last Page Only' :
                                     stampTargetPages === 'first-page' ? 'First Page Only' : 'All Pages'}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="last-page">Last Page Only</SelectItem>
                                  <SelectItem value="first-page">First Page Only</SelectItem>
                                  <SelectItem value="all-pages">All Pages</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTool === 'pdf-page-numbers' && (
                        <div className="space-y-3 pt-1">
                          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Page Number Placement</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setPageNumberPosition('bottom')}
                              className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                pageNumberPosition === 'bottom'
                                  ? 'border-white bg-zinc-800 text-white shadow-sm'
                                  : 'border-zinc-800 bg-zinc-950/40 text-zinc-400'
                              }`}
                            >
                              Bottom Footer
                            </button>
                            <button
                              onClick={() => setPageNumberPosition('top')}
                              className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                pageNumberPosition === 'top'
                                  ? 'border-white bg-zinc-800 text-white shadow-sm'
                                  : 'border-zinc-800 bg-zinc-950/40 text-zinc-400'
                              }`}
                            >
                              Top Header
                            </button>
                          </div>
                        </div>
                      )}

                      {activeTool === 'pdf-crop-tool' && (
                        <div className="space-y-3 pt-1">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Trim Margin Percentage</label>
                            <span className="text-xs font-mono font-bold text-white bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">{cropMarginsPct}%</span>
                          </div>
                          <input 
                            type="range"
                            min={5}
                            max={30}
                            value={cropMarginsPct}
                            onChange={e => setCropMarginsPct(parseInt(e.target.value, 10))}
                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
                          />
                        </div>
                      )}

                      {activeTool === 'pdf-sign' && (
                        <div className="space-y-4 pt-1">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Signature Name / Title</label>
                            <Input 
                              type="text"
                              value={signatureText}
                              onChange={e => setSignatureText(e.target.value)}
                              className="h-9 text-xs bg-transparent border-[var(--border-color)] text-[var(--text-primary)] font-bold"
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Position</label>
                              <Select value={signaturePos} onValueChange={(val: any) => setSignaturePos(val)}>
                                <SelectTrigger className="w-full h-9 text-xs bg-zinc-950 border border-[var(--border-color)] font-semibold">
                                  <SelectValue>
                                    {signaturePos === 'bottom-right' ? 'Bottom Right' :
                                     signaturePos === 'bottom-left' ? 'Bottom Left' :
                                     signaturePos === 'top-right' ? 'Top Right' : 'Center'}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                                  <SelectItem value="top-right">Top Right</SelectItem>
                                  <SelectItem value="center">Center</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Color</label>
                              <Select value={signatureColor} onValueChange={(val: any) => setSignatureColor(val)}>
                                <SelectTrigger className="w-full h-9 text-xs bg-zinc-950 border border-[var(--border-color)] font-semibold">
                                  <SelectValue>
                                    {signatureColor === 'blue' ? 'Ink Blue' : signatureColor === 'black' ? 'Deep Black' : 'Red'}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="blue">Ink Blue</SelectItem>
                                  <SelectItem value="black">Deep Black</SelectItem>
                                  <SelectItem value="red">Red</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Target Pages</label>
                              <Select value={signatureTargetPages} onValueChange={(val: any) => setSignatureTargetPages(val)}>
                                <SelectTrigger className="w-full h-9 text-xs bg-zinc-950 border border-[var(--border-color)] font-semibold">
                                  <SelectValue>
                                    {signatureTargetPages === 'last-page' ? 'Last Page' :
                                     signatureTargetPages === 'first-page' ? 'First Page' : 'All Pages'}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="last-page">Last Page</SelectItem>
                                  <SelectItem value="first-page">First Page</SelectItem>
                                  <SelectItem value="all-pages">All Pages</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTool === 'pdf-to-image' && (
                        <div className="space-y-3 pt-1">
                          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Image Export Quality & Format</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setPdfExportImgFormat('png')}
                              className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                pdfExportImgFormat === 'png'
                                  ? 'border-white bg-zinc-800 text-white shadow-sm'
                                  : 'border-zinc-800 bg-zinc-950/40 text-zinc-400'
                              }`}
                            >
                              PNG (Lossless 300 DPI)
                            </button>
                            <button
                              onClick={() => setPdfExportImgFormat('jpg')}
                              className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                pdfExportImgFormat === 'jpg'
                                  ? 'border-white bg-zinc-800 text-white shadow-sm'
                                  : 'border-zinc-800 bg-zinc-950/40 text-zinc-400'
                              }`}
                            >
                              JPG (Compressed 300 DPI)
                            </button>
                          </div>
                        </div>
                      )}

                      {activeTool === 'pdf-flatten' && (
                        <div className="p-3.5 bg-zinc-900/60 border border-zinc-700 rounded-xl space-y-1.5">
                          <div className="flex items-center gap-2 text-zinc-200 font-bold text-xs">
                            <CheckCircle className="w-4 h-4 text-white" /> Vector Form Flattening
                          </div>
                          <p className="text-[11px] text-zinc-300 leading-relaxed">
                            Converts interactive textboxes and checkboxes into static, uneditable PDF page content.
                          </p>
                        </div>
                      )}

                      {activeTool === 'pdf-redact' && (
                        <div className="space-y-4 pt-1">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Mode</label>
                            <div className="grid grid-cols-3 gap-1.5">
                              <button
                                onClick={() => setRedactMode('redact')}
                                className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                                  redactMode === 'redact' ? 'border-white bg-zinc-800 text-white' : 'border-zinc-800 text-zinc-400'
                                }`}
                              >
                                Blackout Redaction
                              </button>
                              <button
                                onClick={() => setRedactMode('text')}
                                className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                                  redactMode === 'text' ? 'border-white bg-zinc-800 text-white' : 'border-zinc-800 text-zinc-400'
                                }`}
                              >
                                Text Overlay
                              </button>
                            </div>
                          </div>

                          {redactMode === 'text' && (
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Text Overlay Content</label>
                              <Input 
                                type="text"
                                value={redactTextContent}
                                onChange={e => setRedactTextContent(e.target.value)}
                                className="h-9 text-xs bg-transparent border-[var(--border-color)] text-[var(--text-primary)] font-bold"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {activeTool === 'pdf-split' && (
                        <div className="space-y-4 pt-1">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Page Range Selection</label>
                              <div className="flex items-center gap-1">
                                <button onClick={() => setSplitPreset('all')} className="text-[9px] font-bold px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer">All</button>
                                <button onClick={() => setSplitPreset('none')} className="text-[9px] font-bold px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer">None</button>
                                <button onClick={() => setSplitPreset('odd')} className="text-[9px] font-bold px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer">Odd</button>
                                <button onClick={() => setSplitPreset('even')} className="text-[9px] font-bold px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer">Even</button>
                              </div>
                            </div>

                            <Input 
                              type="text" 
                              value={pageRangeText} 
                              onChange={e => setPageRangeText(e.target.value)} 
                              placeholder="e.g. 1-2, 5, 8-10" 
                              className="h-9 text-xs bg-transparent border-[var(--border-color)] text-[var(--text-primary)] font-semibold"
                            />
                          </div>

                          <div className="space-y-2 pt-2 border-t border-[var(--border-color)]">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                              {pagesList.map((item, idx) => {
                                const pNum = idx + 1;
                                const isSelected = selectedPagesInSplit.includes(pNum);
                                return (
                                  <div
                                    key={item.id}
                                    onClick={() => togglePageInSplitRange(pNum)}
                                    className={`p-2 rounded-xl border flex flex-col items-center justify-between gap-1.5 transition-all cursor-pointer select-none ${
                                      isSelected 
                                        ? 'bg-zinc-900 border-white ring-1 ring-white/50 shadow-md' 
                                        : 'bg-zinc-950/40 border-zinc-800 text-zinc-500 opacity-60 hover:opacity-100 hover:border-zinc-700'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between w-full text-[9px] font-bold">
                                      <span className={isSelected ? 'text-white' : 'text-zinc-500'}>Page {pNum}</span>
                                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                        isSelected ? 'bg-white text-zinc-950 font-black' : 'bg-zinc-900 border border-zinc-800 text-zinc-600'
                                      }`}>
                                        {isSelected ? '✓' : ''}
                                      </span>
                                    </div>

                                    <div 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPeekPageIndex(idx);
                                      }}
                                      title="Click to PowerToys Peek Zoom"
                                      className="w-full aspect-[1/1.3] bg-zinc-900 border border-zinc-800 rounded flex items-center justify-center p-0.5 overflow-hidden relative group/splitThumb shadow-inner"
                                    >
                                      <div 
                                        className="w-full h-full rounded flex items-center justify-center transition-transform duration-300 bg-white overflow-hidden"
                                        style={{ transform: `rotate(${item.rotation}deg)` }}
                                      >
                                        {item.thumbnailUrl ? (
                                          <img 
                                            src={item.thumbnailUrl} 
                                            alt={`Page ${pNum}`} 
                                            className="w-full h-full object-contain pointer-events-none" 
                                          />
                                        ) : (
                                          <div className="flex flex-col items-center justify-center p-1 text-zinc-400">
                                            <FileText className="w-4 h-4 text-zinc-400 animate-pulse" />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTool === 'pdf-watermark' && (
                        <div className="space-y-4 pt-1">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Watermark Text</label>
                            <Input 
                              type="text" 
                              value={watermarkText} 
                              onChange={e => setWatermarkText(e.target.value)} 
                              className="h-9 text-xs bg-transparent border-[var(--border-color)] text-[var(--text-primary)] font-bold"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Position / Mode</label>
                              <Select value={watermarkPos} onValueChange={(val: any) => setWatermarkPos(val)}>
                                <SelectTrigger className="w-full h-9 text-xs bg-zinc-950 border border-[var(--border-color)] font-semibold">
                                  <SelectValue>
                                    {watermarkPos === 'diagonal' ? 'Diagonal 45° Center' :
                                     watermarkPos === 'pattern' ? 'Tiled Grid Pattern' :
                                     watermarkPos === 'header' ? 'Top Header' : 'Bottom Footer'}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="diagonal">Diagonal 45° Center</SelectItem>
                                  <SelectItem value="pattern">Tiled Grid Pattern (Full Page)</SelectItem>
                                  <SelectItem value="header">Top Header</SelectItem>
                                  <SelectItem value="footer">Bottom Footer</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Color</label>
                              <Select value={watermarkColor} onValueChange={(val: any) => setWatermarkColor(val)}>
                                <SelectTrigger className="w-full h-9 text-xs bg-zinc-950 border border-[var(--border-color)] font-semibold">
                                  <SelectValue>
                                    {watermarkColor === 'red' ? 'Crimson Red' :
                                     watermarkColor === 'blue' ? 'Royal Blue' :
                                     watermarkColor === 'black' ? 'Deep Charcoal' : 'Neutral Gray'}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="red">Crimson Red</SelectItem>
                                  <SelectItem value="blue">Royal Blue</SelectItem>
                                  <SelectItem value="black">Deep Charcoal</SelectItem>
                                  <SelectItem value="gray">Neutral Gray</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="space-y-1 pt-1">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Watermark Opacity</label>
                              <span className="text-xs font-mono font-bold text-white bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">{Math.round(watermarkOpacity * 100)}%</span>
                            </div>
                            <input 
                              type="range"
                              min={10}
                              max={90}
                              step={5}
                              value={Math.round(watermarkOpacity * 100)}
                              onChange={e => setWatermarkOpacity(parseFloat(e.target.value) / 100)}
                              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
                            />
                          </div>
                        </div>
                      )}

                      {activeTool === 'pdf-protect' && (
                        <div className="space-y-2 pt-1">
                          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Encryption Key / Password</label>
                          <div className="relative">
                            <Input 
                              type={showPassword ? 'text' : 'password'} 
                              value={securityPassword} 
                              onChange={e => setSecurityPassword(e.target.value)} 
                              className="h-9 text-xs bg-transparent border-[var(--border-color)] text-[var(--text-primary)] pr-10 font-mono font-bold"
                              placeholder="Enter document password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors cursor-pointer p-1 rounded"
                            >
                              {showPassword ? <EyeSlashIcon className="w-4 h-4 text-white" /> : <EyeIcon className="w-4 h-4 text-zinc-400" />}
                            </button>
                          </div>
                        </div>
                      )}

                      {activeTool === 'pdf-unlock' && (
                        <div className="space-y-4 pt-1">
                          {!pdfIsEncrypted ? (
                            <div className="p-3.5 bg-zinc-900/60 border border-zinc-700 rounded-xl space-y-1.5">
                              <div className="flex items-center gap-2 text-zinc-200 font-bold text-xs">
                                <ShieldIcon className="w-4 h-4 text-white" /> No Security Locks Detected
                              </div>
                              <p className="text-[11px] text-zinc-300 leading-relaxed">
                                This PDF document is already unencrypted and has standard open access permissions.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl space-y-1">
                                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                                  <LockIcon className="w-4 h-4 text-amber-400" /> Password Security Detected
                                </div>
                                <p className="text-[11px] text-zinc-300 leading-relaxed">
                                  Please enter the current password below to decrypt and unlock this PDF.
                                </p>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Current PDF Password</label>
                                <div className="relative">
                                  <Input 
                                    type={showPassword ? 'text' : 'password'} 
                                    value={securityPassword} 
                                    onChange={e => setSecurityPassword(e.target.value)} 
                                    className="h-9 text-xs bg-transparent border-[var(--border-color)] text-[var(--text-primary)] pr-10 font-mono font-bold"
                                    placeholder="Enter document password"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>

                    {/* REAL-TIME PREVIEW PANEL */}
                    <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-6 flex flex-col justify-between space-y-4">
                      <LivePdfPreview 
                        activeTool={activeTool}
                        singleFile={singleFile}
                        firstPageThumbnail={pagesList[0]?.thumbnailUrl}
                        pageRangeText={pageRangeText}
                        setPageRangeText={setPageRangeText}
                        watermarkText={watermarkText}
                        watermarkPos={watermarkPos}
                        watermarkColor={watermarkColor}
                        watermarkOpacity={watermarkOpacity}
                        pageNumberPosition={pageNumberPosition}
                        cropMarginsPct={cropMarginsPct}
                        signatureText={signatureText}
                        signaturePos={signaturePos}
                        signatureColor={signatureColor}
                        signatureTargetPages={signatureTargetPages}
                        pdfIsEncrypted={pdfIsEncrypted}
                        stampPreset={stampPreset}
                        stampPosition={stampPosition}
                        stampTargetPages={stampTargetPages}
                        redactMode={redactMode}
                        redactTextContent={redactTextContent}
                      />

                      <Button 
                        onClick={() => {
                          if (activeTool === 'pdf-split') runSplit();
                          else if (activeTool === 'pdf-watermark') runWatermark();
                          else if (activeTool === 'pdf-page-numbers') runPageNumbers();
                          else if (activeTool === 'pdf-protect') runProtect();
                          else if (activeTool === 'pdf-unlock') runUnlock();
                          else if (activeTool === 'pdf-sign') runSign();
                          else if (activeTool === 'pdf-to-word') runPdfToMd();
                          else if (activeTool === 'pdf-crop-tool') runCrop();
                          else if (activeTool === 'pdf-stamps') runStamps();
                          else if (activeTool === 'pdf-flatten') runFlatten();
                          else if (activeTool === 'pdf-redact') runRedact();
                          else if (activeTool === 'pdf-to-image') runPdfToImages();
                        }}
                        className="w-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold rounded-full h-11 text-xs cursor-pointer shadow-sm mt-2"
                      >
                        Apply & Export Document
                      </Button>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BULK COMPRESSION RESULTS */}
      {compressionResults.length > 0 && !processing && (
        <Card className="max-w-3xl mx-auto border-[var(--border-color)] bg-[var(--surface-color)] p-6 space-y-5">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
            <div>
              <CardTitle className="text-lg font-black text-[var(--text-primary)]">PDF optimization complete</CardTitle>
              <CardDescription className="text-xs text-[var(--text-secondary)] mt-1">
                {compressionResults.filter(result => result.url).length} of {compressionResults.length} documents ready
              </CardDescription>
              {compressionResults.some(result => result.url) && (
                <span className="text-[10px] text-[var(--text-secondary)] mt-1 block">
                  {formatBytes(compressionResults.reduce((total, result) => total + result.sourceSize, 0))} original
                  {' → '}
                  {formatBytes(compressionResults.reduce((total, result) => total + (result.url ? result.outputSize : result.sourceSize), 0))} after optimization
                  {' · saved '}
                  {formatBytes(compressionResults.reduce((total, result) => total + (result.url ? Math.max(0, result.sourceSize - result.outputSize) : 0), 0))}
                </span>
              )}
            </div>
            <Button variant="outline" onClick={reset} className="rounded-full h-9 text-xs border-[var(--border-color)]">
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> New batch
            </Button>
          </div>

          <div className="space-y-2">
            {compressionResults.map((result, index) => {
              const savedBytes = result.sourceSize - result.outputSize;
              const savedPercent = result.sourceSize > 0
                ? Math.max(0, Math.round((savedBytes / result.sourceSize) * 100))
                : 0;
              return (
                <div key={`${result.sourceName}:${result.sourceSize}:${index}`} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-zinc-950/40 border border-[var(--border-color)] rounded-xl">
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block text-xs font-bold truncate text-[var(--text-primary)]">{result.outputName}</span>
                    {result.url ? (
                      <span className="text-[10px] text-[var(--text-secondary)] mt-0.5 block">
                        {formatBytes(result.sourceSize)} &rarr; {formatBytes(result.outputSize)}
                        {savedPercent > 0 ? ` • ${savedPercent}% smaller` : ' • already fully optimized'}
                      </span>
                    ) : (
                      <>
                        <span className="text-[10px] text-rose-400 mt-0.5 block truncate" title={result.error}>
                          Failed: {result.error}
                        </span>
                        <button type="button" onClick={() => retryCompressionResult(index)} className="text-[10px] text-white underline mt-1">
                          Retry this file
                        </button>
                      </>
                    )}
                  </div>
                  {result.url && (
                    <div className="batch-result-actions">
                      <button
                        type="button"
                        onClick={() => {
                          const source = multipleFiles.find(item => item.file.name === result.sourceName)?.file;
                          if (!source || !result.url) return;
                          fetch(result.url).then(response => response.blob()).then(blob =>
                            shareResult({ url: result.url!, name: result.outputName, blob })
                          ).catch(console.error);
                        }}
                        className="batch-action batch-action--secondary"
                      >
                        Share
                      </button>
                      <a
                        href={result.url}
                        download={result.outputName}
                        className="batch-action batch-action--primary"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {compressionResults.some(result => result.url) && (
            <Button
              onClick={() => downloadAll(compressionResults.flatMap(result =>
                result.url ? [{ url: result.url, name: result.outputName }] : []
              ))}
              className="w-full rounded-full h-11 text-xs font-bold"
            >
              <Download className="w-4 h-4 mr-2" /> Download all completed PDFs
            </Button>
          )}
        </Card>
      )}

      {/* EXTRACTED IMAGES GRID RESULT */}
      {extractedImages.length > 0 && !processing && (
        <Card className="max-w-4xl mx-auto border-[var(--border-color)] bg-[var(--surface-color)] p-6 space-y-5">
          <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
            <div>
              <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider block">Extracted PDF Page Images ({extractedImages.length} Pages)</span>
              <span className="text-[10px] text-zinc-500 font-medium">300 DPI high-resolution page rendering</span>
            </div>
            <Button variant="ghost" onClick={reset} className="text-xs h-7 px-2 text-zinc-400">Clear</Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[460px] overflow-y-auto pr-1">
            {extractedImages.map((img) => (
              <div key={img.pageNumber} className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-2.5 flex flex-col justify-between items-center gap-2">
                <span className="text-[10px] font-bold text-zinc-400">Page {img.pageNumber}</span>
                <img src={img.url} alt={`Page ${img.pageNumber}`} className="w-full aspect-[1/1.3] object-contain bg-white rounded border border-zinc-800" />
                <a 
                  href={img.url} 
                  download={`page_${img.pageNumber}.${pdfExportImgFormat}`}
                  className="w-full py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-bold rounded flex items-center justify-center gap-1 border border-zinc-700"
                >
                  <Download className="w-3 h-3" /> Save P.{img.pageNumber}
                </a>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* RESULT PAGE FOR SINGLE FILE BLOB */}
      {resultUrl && extractedImages.length === 0 && !processing && (
        <div className="max-w-xl mx-auto space-y-6">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] shadow-sm text-center p-6 space-y-5">
            <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 rounded-full flex items-center justify-center mx-auto shadow-inner border border-[var(--border-color)]">
              <CheckCircle className="w-7 h-7" />
            </div>

            <div>
              <CardTitle className="text-xl font-black text-[var(--text-primary)]">Document Export Ready!</CardTitle>
              <CardDescription className="text-xs text-[var(--text-secondary)] mt-1">Your compiled file has been generated and saved.</CardDescription>
            </div>

            <div className="flex items-center gap-3 p-4 bg-zinc-950/40 border border-[var(--border-color)] rounded-xl text-left">
              <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200 font-bold text-xs uppercase flex-shrink-0">
                {resultName.endsWith('.md') ? 'MD' : 'PDF'}
              </div>
              <div className="truncate flex-1 min-w-0">
                <span className="block text-xs font-bold truncate text-[var(--text-primary)]">{resultName}</span>
                <span className="text-[10px] text-[var(--text-secondary)] uppercase mt-0.5 block font-semibold">
                  Output Size: {formatBytes(resultSize)}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
              <a 
                href={resultUrl} 
                download={resultName}
                className="inline-flex items-center justify-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold px-6 py-3 rounded-full text-xs shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download Export File
              </a>
              <Button 
                variant="outline" 
                onClick={reset}
                className="rounded-full h-10 text-xs border-[var(--border-color)]"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Process Another Document
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* POWERTOYS PEEK MODAL */}
      {peekPageIndex !== null && pagesList[peekPageIndex] && createPortal(
        <div 
          className="pdf-peek fixed inset-0 z-[99999] bg-black/60 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 overflow-hidden select-none animate-in fade-in duration-200"
          onClick={() => setPeekPageIndex(null)}
        >
          <div 
            className="pdf-peek__header w-full max-w-5xl mx-auto flex items-center justify-between bg-zinc-950/80 backdrop-blur-md border border-zinc-800/80 p-3 rounded-2xl shadow-2xl shrink-0 z-20"
            onClick={e => e.stopPropagation()}
          >
            <div className="pdf-peek__file flex items-center gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 font-bold text-xs">
                P.{peekPageIndex + 1}
              </div>
              <div className="min-w-0 flex-1">
                <span className="pdf-peek__title block text-xs font-bold text-white truncate max-w-xs sm:max-w-md">
                  Page {peekPageIndex + 1} of {pagesList.length} &bull; {singleFile?.file.name || multipleFiles[peekPageIndex]?.file.name}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPeekPageIndex(null)}
                className="pdf-peek__close h-8 text-xs text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg px-3 flex items-center gap-1 whitespace-nowrap"
              >
                <CloseIcon className="w-4 h-4" /> Close (Esc)
              </Button>
            </div>
          </div>

          <div 
            className="pdf-peek__stage flex-1 w-full max-w-5xl mx-auto flex items-center justify-center relative overflow-hidden my-3"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setPeekPageIndex(peekPageIndex > 0 ? peekPageIndex - 1 : pagesList.length - 1)}
              className="pdf-peek__previous absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-zinc-900/90 border border-zinc-700 text-white flex items-center justify-center shadow-2xl hover:bg-zinc-800 hover:scale-110 active:scale-95 transition-all cursor-pointer"
              aria-label="Previous page"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>

            <div className="pdf-peek__document w-full h-full flex items-center justify-center p-2">
              <div 
                className="pdf-peek__paper bg-white rounded-xl shadow-2xl border border-zinc-700 overflow-hidden flex items-center justify-center transition-transform duration-300 max-h-[78vh] max-w-[85vw]"
                style={{ transform: `rotate(${pagesList[peekPageIndex].rotation}deg)` }}
              >
                {pagesList[peekPageIndex].thumbnailUrl ? (
                  <img 
                    src={pagesList[peekPageIndex].thumbnailUrl} 
                    alt={`Page ${peekPageIndex + 1}`} 
                    className="pdf-peek__image max-h-[76vh] w-auto h-auto object-contain block rounded shadow-inner"
                  />
                ) : (
                  <div className="w-96 h-[60vh] flex flex-col items-center justify-center text-zinc-600">
                    <FileText className="w-12 h-12 mb-2 animate-pulse" />
                    <span className="text-xs font-bold font-mono">Rendering High-Res Page...</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setPeekPageIndex(peekPageIndex < pagesList.length - 1 ? peekPageIndex + 1 : 0)}
              className="pdf-peek__next absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-zinc-900/90 border border-zinc-700 text-white flex items-center justify-center shadow-2xl hover:bg-zinc-800 hover:scale-110 active:scale-95 transition-all cursor-pointer"
              aria-label="Next page"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
