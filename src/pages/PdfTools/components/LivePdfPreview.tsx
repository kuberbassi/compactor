import React from 'react';
import {
  CheckCircle,
  Lock as LockIcon,
  ShieldCheck as ShieldIcon,
} from 'lucide-react';

import { parsePageRanges } from '../pdfToolsConfig';

const DOCUMENT_PREVIEW_TOOLS = new Set([
  'pdf-split', 'pdf-protect', 'pdf-unlock', 'pdf-remove-metadata',
  'pdf-flatten', 'pdf-flatten-forms', 'pdf-flatten-entire', 'pdf-ocr',
  'pdf-to-image', 'pdf-to-word', 'pdf-extract-text',
]);

export interface PdfFileInfo {
  file: File;
  pageCount: number;
}

export interface LivePdfPreviewProps {
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
}

export const LivePdfPreview: React.FC<LivePdfPreviewProps> = ({
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
  const selectedPages = parsePageRanges(pageRangeText, singleFile.pageCount);

  const togglePageInRange = (pNum: number) => {
    const current = new Set(selectedPages);
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
        start = arr[i];
        prev = arr[i];
      }
    }
    if (start === prev) str += `${start}`;
    else str += `${start}-${prev}`;

    setPageRangeText(str);
  };

  return (
    <div className="pdf-live-preview space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block truncate">
          Real-Time Visual Preview
        </span>
        <span className="text-[9px] bg-zinc-900 border border-zinc-700 text-zinc-300 font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
          Live Preview
        </span>
      </div>

      {DOCUMENT_PREVIEW_TOOLS.has(activeTool) && (
        <div className="pdf-live-preview__document" aria-label="First page document preview">
          <div className="pdf-live-preview__paper">
            {firstPageThumbnail ? <img src={firstPageThumbnail} alt="First PDF page" /> : <div className="pdf-live-preview__loading">Rendering first page…</div>}
          </div>
          <span>Page 1 of {singleFile.pageCount}</span>
        </div>
      )}

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

      {/* FLATTEN FORMS / ENTIRE CARDS */}
      {(activeTool === 'pdf-flatten' || activeTool === 'pdf-flatten-forms') && (
        <div className="bg-zinc-950/60 p-4 rounded-xl border border-[var(--border-color)] space-y-2">
          <div className="flex items-center gap-2 text-zinc-200 font-bold text-xs">
            <CheckCircle className="w-4 h-4 text-white" /> Vector Form Flattening
          </div>
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            All fillable text inputs, checkboxes, and signatures will be permanently converted into static vector elements, keeping text fully searchable.
          </p>
        </div>
      )}

      {activeTool === 'pdf-flatten-entire' && (
        <div className="bg-zinc-950/60 p-4 rounded-xl border border-[var(--border-color)] space-y-2">
          <div className="flex items-center gap-2 text-zinc-200 font-bold text-xs">
            <CheckCircle className="w-4 h-4 text-white" /> Rasterized Page Flattening
          </div>
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            All pages will be converted into non-selectable high-resolution images, destroying scripts, annotations, and interactive controls.
          </p>
        </div>
      )}

      {/* OCR SEARCHABLE CARD */}
      {activeTool === 'pdf-ocr' && (
        <div className="bg-zinc-950/60 p-4 rounded-xl border border-[var(--border-color)] space-y-2">
          <div className="flex items-center gap-2 text-zinc-200 font-bold text-xs">
            <CheckCircle className="w-4 h-4 text-white" /> OCR Text Layer Synthesis
          </div>
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            Optical Character Recognition will process page images and overlay an invisible selectable text layer for search, copy, and screen readers.
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
