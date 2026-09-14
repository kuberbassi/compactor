import React from 'react';
import {
  CheckCircle,
  FileText,
  Lock as LockIcon,
  Unlock as UnlockIcon,
  ShieldCheck as ShieldIcon,
  Eye as EyeIcon,
  EyeOff as EyeSlashIcon,
} from 'lucide-react';
import { Input } from '../../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import type { PageItem } from './PageOrganizer';

export interface PdfInspectorPanelProps {
  activeTool: string;
  onSelectTool?: (tool: string) => void;
  pagesList: PageItem[];
  stampPreset: string;
  setStampPreset: (preset: any) => void;
  stampPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'center';
  setStampPosition: (pos: 'bottom-right' | 'bottom-left' | 'top-right' | 'center') => void;
  stampTargetPages: 'last-page' | 'first-page' | 'all-pages';
  setStampTargetPages: (target: 'last-page' | 'first-page' | 'all-pages') => void;
  pageNumberPosition: 'top' | 'bottom';
  setPageNumberPosition: (pos: 'top' | 'bottom') => void;
  cropMarginsPct: number;
  setCropMarginsPct: (pct: number) => void;
  signatureText: string;
  setSignatureText: (text: string) => void;
  signaturePos: 'bottom-right' | 'bottom-left' | 'top-right' | 'center';
  setSignaturePos: (pos: 'bottom-right' | 'bottom-left' | 'top-right' | 'center') => void;
  signatureColor: 'blue' | 'black' | 'red';
  setSignatureColor: (color: 'blue' | 'black' | 'red') => void;
  signatureTargetPages: 'last-page' | 'first-page' | 'all-pages';
  setSignatureTargetPages: (target: 'last-page' | 'first-page' | 'all-pages') => void;
  pdfExportMode: 'png' | 'jpg' | 'markdown';
  pdfTextLayerStatus: 'checking' | 'available' | 'unavailable';
  setPdfExportMode: (mode: 'png' | 'jpg' | 'markdown') => void;
  flattenMode: 'complete' | 'forms';
  setFlattenMode: (mode: 'complete' | 'forms') => void;
  flattenQuality: 'standard' | 'high' | 'print';
  setFlattenQuality: (q: 'standard' | 'high' | 'print') => void;
  redactMode: 'redact' | 'text' | 'image';
  setRedactMode: (mode: 'redact' | 'text' | 'image') => void;
  redactTextContent: string;
  setRedactTextContent: (text: string) => void;
  pageRangeText: string;
  setPageRangeText: (range: string) => void;
  selectedPagesInSplit: number[];
  togglePageInSplitRange: (pNum: number) => void;
  setSplitPreset: (preset: 'all' | 'none' | 'odd' | 'even') => void;
  setPeekPageIndex: (idx: number) => void;
  watermarkText: string;
  setWatermarkText: (text: string) => void;
  watermarkPos: 'diagonal' | 'header' | 'footer' | 'pattern';
  setWatermarkPos: (pos: 'diagonal' | 'header' | 'footer' | 'pattern') => void;
  watermarkColor: 'red' | 'blue' | 'black' | 'gray';
  setWatermarkColor: (color: 'red' | 'blue' | 'black' | 'gray') => void;
  watermarkOpacity: number;
  setWatermarkOpacity: (opacity: number) => void;
  securityPassword: string;
  setSecurityPassword: (pwd: string) => void;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  pdfIsEncrypted?: boolean;
  rotateDegrees?: 90 | 180 | 270;
  setRotateDegrees?: (d: 90 | 180 | 270) => void;
}

export const PdfInspectorPanel: React.FC<PdfInspectorPanelProps> = ({
  activeTool,
  onSelectTool,
  rotateDegrees = 90,
  setRotateDegrees,
  pagesList,
  stampPreset,
  setStampPreset,
  stampPosition,
  setStampPosition,
  stampTargetPages,
  setStampTargetPages,
  pageNumberPosition,
  setPageNumberPosition,
  cropMarginsPct,
  setCropMarginsPct,
  signatureText,
  setSignatureText,
  signaturePos,
  setSignaturePos,
  signatureColor,
  setSignatureColor,
  signatureTargetPages,
  setSignatureTargetPages,
  pdfExportMode,
  pdfTextLayerStatus,
  setPdfExportMode,
  flattenMode: _flattenMode,
  setFlattenMode: _setFlattenMode,
  flattenQuality,
  setFlattenQuality,
  redactMode,
  setRedactMode,
  redactTextContent,
  setRedactTextContent,
  pageRangeText,
  setPageRangeText,
  selectedPagesInSplit,
  togglePageInSplitRange,
  setSplitPreset,
  setPeekPageIndex,
  watermarkText,
  setWatermarkText,
  watermarkPos,
  setWatermarkPos,
  watermarkColor,
  setWatermarkColor,
  watermarkOpacity,
  setWatermarkOpacity,
  securityPassword,
  setSecurityPassword,
  showPassword,
  setShowPassword,
  pdfIsEncrypted = false,
}) => {
  return (
    <div className="pdf-inspector space-y-4">
      {['pdf-protect', 'pdf-unlock', 'pdf-flatten', 'pdf-flatten-forms', 'pdf-flatten-entire', 'pdf-ocr'].includes(activeTool) && (
        <div className="pdf-security-actions" role="navigation" aria-label="PDF security actions">
          <button
            type="button"
            className={activeTool === 'pdf-protect' ? 'is-active' : ''}
            onClick={() => onSelectTool?.('pdf-protect')}
          >
            <LockIcon aria-hidden="true" />
            <span>Lock</span>
          </button>
          <button
            type="button"
            className={activeTool === 'pdf-unlock' ? 'is-active' : ''}
            onClick={() => onSelectTool?.('pdf-unlock')}
            disabled={!pdfIsEncrypted}
            title={pdfIsEncrypted ? 'Remove password protection' : 'This PDF is already unlocked'}
          >
            <UnlockIcon aria-hidden="true" />
            <span>Unlock</span>
          </button>
          <button
            type="button"
            className={activeTool === 'pdf-flatten' || activeTool === 'pdf-flatten-entire' || activeTool === 'pdf-flatten-forms' ? 'is-active' : ''}
            onClick={() => onSelectTool?.('pdf-flatten-entire')}
          >
            <ShieldIcon aria-hidden="true" />
            <span>Flatten</span>
          </button>
          <button
            type="button"
            className={activeTool === 'pdf-ocr' ? 'is-active' : ''}
            onClick={() => onSelectTool?.('pdf-ocr')}
          >
            <FileText aria-hidden="true" />
            <span>OCR</span>
          </button>
        </div>
      )}
      {activeTool === 'pdf-stamps' && (
        <div className="space-y-4 pt-1">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Select Stamp Preset</label>
            <div className="grid grid-cols-3 gap-2">
              {['APPROVED', 'CONFIDENTIAL', 'FINAL DRAFT', 'EXPIRED', 'PAID', 'CANCELLED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStampPreset(st as any)}
                  aria-pressed={stampPreset === st}
                  className={`py-2.5 px-2 rounded-xl text-xs font-mono font-black border transition-all cursor-pointer ${
                    stampPreset === st
                      ? 'is-active border-white bg-zinc-800 text-white shadow-sm'
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
              aria-pressed={pageNumberPosition === 'bottom'}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                pageNumberPosition === 'bottom'
                  ? 'is-active border-white bg-zinc-800 text-white shadow-sm'
                  : 'border-zinc-800 bg-zinc-950/40 text-zinc-400'
              }`}
            >
              Bottom Footer
            </button>
            <button
              onClick={() => setPageNumberPosition('top')}
              aria-pressed={pageNumberPosition === 'top'}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                pageNumberPosition === 'top'
                  ? 'is-active border-white bg-zinc-800 text-white shadow-sm'
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
          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Export format</label>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => setPdfExportMode('png')}
              aria-pressed={pdfExportMode === 'png'}
              className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                pdfExportMode === 'png'
                  ? 'is-active border-white bg-zinc-800 text-white shadow-sm'
                  : 'border-zinc-800 bg-zinc-950/40 text-zinc-400'
              }`}
            >
              PNG (Lossless 300 DPI)
            </button>
            <button
              onClick={() => setPdfExportMode('jpg')}
              aria-pressed={pdfExportMode === 'jpg'}
              className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                pdfExportMode === 'jpg'
                  ? 'is-active border-white bg-zinc-800 text-white shadow-sm'
                  : 'border-zinc-800 bg-zinc-950/40 text-zinc-400'
              }`}
            >
              JPG (Compressed 300 DPI)
            </button>
            <button
              type="button"
              disabled={pdfTextLayerStatus !== 'available'}
              onClick={() => setPdfExportMode('markdown')}
              aria-pressed={pdfExportMode === 'markdown'}
              title={pdfTextLayerStatus === 'checking' ? 'Checking for selectable text…' : pdfTextLayerStatus === 'unavailable' ? 'This PDF has no selectable text. Use OCR first.' : 'Export selectable text as Markdown'}
              className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                pdfExportMode === 'markdown'
                  ? 'is-active border-white bg-zinc-800 text-white shadow-sm'
                  : 'border-zinc-800 bg-zinc-950/40 text-zinc-400'
              }`}
            >
              {pdfTextLayerStatus === 'checking' ? 'Markdown (Checking text…)' : 'Markdown (Structured Text)'}
            </button>
          </div>
        </div>
      )}

      {(activeTool === 'pdf-flatten' || activeTool === 'pdf-flatten-forms' || activeTool === 'pdf-flatten-entire') && (
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Flatten Quality</label>
            <Select value={flattenQuality} onValueChange={(value) => setFlattenQuality(value as typeof flattenQuality)}>
              <SelectTrigger className="w-full h-9 text-xs bg-[#16171b] border-white/10 font-semibold text-white">
                <SelectValue>
                  {flattenQuality === 'standard' ? 'Standard · 150 DPI (smaller file)' : flattenQuality === 'print' ? 'Print · 600 DPI (highest detail)' : 'High · 300 DPI (recommended)'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-[#1c1e24] border-white/10 text-zinc-200">
                <SelectItem value="standard">Standard · 150 DPI (smaller file)</SelectItem>
                <SelectItem value="high">High · 300 DPI (recommended)</SelectItem>
                <SelectItem value="print">Print · 600 DPI (highest detail)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="pdf-inspector-note">Forms and annotations become permanent page content.</p>
        </div>
      )}

      {activeTool === 'pdf-ocr' && (
        <div className="pdf-inspector-summary">
          <FileText aria-hidden="true" />
          <div>
            <strong>Make text searchable</strong>
            <p>Adds selectable English text while keeping each page visually unchanged.</p>
          </div>
        </div>
      )}

      {activeTool === 'pdf-remove-blank-pages' && (
        <div className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-900/60 p-3.5 text-left">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
              <CheckCircle className="h-4 w-4 text-sky-400" /> Automatic Blank Page Removal
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
              Scans all pages for both text layers and graphical content. Completely empty or pure white pages are automatically stripped from your document.
            </p>
          </div>
          <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-[11px] text-sky-300">
            ⚡ Ideal for scanned contracts, double-sided document scans, and book exports with blank separator pages.
          </div>
        </div>
      )}

      {activeTool === 'pdf-rotate' && (
        <div className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-900/60 p-3.5 text-left">
          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Rotation Angle</label>
          <div className="grid grid-cols-3 gap-1.5">
            {([90, 180, 270] as const).map((deg) => (
              <button
                key={deg}
                type="button"
                onClick={() => setRotateDegrees?.(deg)}
                aria-pressed={rotateDegrees === deg}
                className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  rotateDegrees === deg ? 'is-active border-white bg-zinc-800 text-white' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {deg === 90 ? '90° CW' : deg === 180 ? '180°' : '90° CCW'}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-zinc-400">
            Rotates all pages simultaneously and preserves text layers and vector annotations.
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
                aria-pressed={redactMode === 'redact'}
                className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                  redactMode === 'redact' ? 'is-active border-white bg-zinc-800 text-white' : 'border-zinc-800 text-zinc-400'
                }`}
              >
                Blackout Redaction
              </button>
              <button
                onClick={() => setRedactMode('text')}
                aria-pressed={redactMode === 'text'}
                className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                  redactMode === 'text' ? 'is-active border-white bg-zinc-800 text-white' : 'border-zinc-800 text-zinc-400'
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
        <div className="pdf-split-controls">
          <div className="space-y-2">
            <div className="pdf-split-controls__heading">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Pages to split</label>
              <div className="pdf-split-presets">
                <button type="button" onClick={() => setSplitPreset('all')}>All</button>
                <button type="button" onClick={() => setSplitPreset('none')}>None</button>
                <button type="button" onClick={() => setSplitPreset('odd')}>Odd</button>
                <button type="button" onClick={() => setSplitPreset('even')}>Even</button>
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

          <div className="space-y-2 pt-3 border-t border-[var(--border-color)]">
            <p className="pdf-split-controls__help">Choose the pages that should become the new PDF.</p>
            <div className="pdf-split-page-grid workbench-scroll-region">
              {pagesList.map((item, idx) => {
                const pNum = idx + 1;
                const isSelected = selectedPagesInSplit.includes(pNum);
                return (
                  <article
                    key={item.id}
                    className={`pdf-split-page ${
                      isSelected
                        ? 'is-active'
                        : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="pdf-split-page__select"
                      onClick={() => togglePageInSplitRange(pNum)}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? 'Remove' : 'Add'} page ${pNum} ${isSelected ? 'from' : 'to'} the split PDF`}
                    >
                      <span>Page {pNum}</span><span aria-hidden="true">{isSelected ? '✓' : ''}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPeekPageIndex(idx)}
                      title={`Preview page ${pNum}`}
                      aria-label={`Preview page ${pNum}`}
                      className="pdf-split-page__preview"
                      style={{ aspectRatio: item.width && item.height ? (Math.abs(item.rotation) % 180 === 90 ? item.height / item.width : item.width / item.height) : 0.72 }}
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
                    </button>
                  </article>
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
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Set Password</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={securityPassword}
                onChange={e => setSecurityPassword(e.target.value)}
                className="h-9 text-xs bg-[#16171b] border-white/10 text-white pr-10 font-mono font-bold focus-visible:ring-1 focus-visible:ring-white/30"
                placeholder="Enter password to encrypt"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors cursor-pointer p-1 rounded"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeSlashIcon className="w-4 h-4 text-white" /> : <EyeIcon className="w-4 h-4 text-zinc-400" />}
              </button>
            </div>
          </div>
          <p className="pdf-inspector-note">The password will be required to open this PDF.</p>
        </div>
      )}

      {activeTool === 'pdf-unlock' && (
        pdfIsEncrypted ? <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Current Password</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={securityPassword}
                onChange={e => setSecurityPassword(e.target.value)}
                className="h-9 text-xs bg-[#16171b] border-white/10 text-white pr-10 font-mono font-bold focus-visible:ring-1 focus-visible:ring-white/30"
                placeholder="Enter document password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors cursor-pointer p-1 rounded"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeSlashIcon className="w-4 h-4 text-white" /> : <EyeIcon className="w-4 h-4 text-zinc-400" />}
              </button>
            </div>
          </div>
          <p className="pdf-inspector-note">Exports an unlocked copy after verifying the password.</p>
        </div> : <p className="pdf-inspector-note">This PDF is already unlocked, so there is nothing to remove.</p>
      )}
    </div>
  );
};
