import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileText,
  Lock as LockIcon,
  PanelLeft,
  PanelLeftClose,
  ZoomIn,
} from 'lucide-react';
import { formatBytes } from '../../../utils/image';
import { EditorCommandBar, EditorSidebar, EditorSidebarHeader } from '../../../components/Workspace/EditorChrome';
import { WorkspaceZoomControls } from '../../../components/Workspace/WorkspaceControls';
import type { PageItem } from './PageOrganizer';
import { getDefaultPageZoom } from '../pdfPageDisplay';
import type { PdfFileInfo } from './LivePdfPreview';
import { PdfInspectorPanel } from './PdfInspectorPanel';

export interface PdfSingleConfiguratorProps {
  singleFile: PdfFileInfo;
  activeTool: string;
  onSelectTool: (tool: string) => void;
  pagesList: PageItem[];
  onPeekPage: (index: number) => void;
  onReset: () => void;
  onRunAction: () => void;
  actionLabel?: string;
  toolSelector?: React.ReactNode;

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
  watermarkText: string;
  setWatermarkText: (text: string) => void;
  watermarkPos: 'diagonal' | 'header' | 'footer' | 'pattern';
  setWatermarkPos: (pos: 'diagonal' | 'header' | 'footer' | 'pattern') => void;
  watermarkColor: 'red' | 'blue' | 'black' | 'gray';
  setWatermarkColor: (color: 'red' | 'blue' | 'black' | 'gray') => void;
  watermarkOpacity: number;
  setWatermarkOpacity: (opacity: number) => void;
  securityPassword: string;
  setSecurityPassword: (password: string) => void;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  pdfIsEncrypted: boolean;
}

export const PdfSingleConfigurator: React.FC<PdfSingleConfiguratorProps> = ({
  singleFile,
  activeTool,
  onSelectTool,
  pagesList,
  onPeekPage,
  onReset,
  onRunAction,
  actionLabel,
  toolSelector,
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
  flattenMode,
  setFlattenMode,
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
  pdfIsEncrypted,
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [zoom, setZoom] = useState(50);
  const stageRef = useRef<HTMLDivElement>(null);
  const autoZoomAppliedRef = useRef(false);

  useEffect(() => {
    autoZoomAppliedRef.current = false;
    setZoom(50);
  }, [singleFile.file]);

  useEffect(() => {
    const firstPage = pagesList[0];
    if (autoZoomAppliedRef.current || !firstPage?.width || !firstPage.height) return;
    setZoom(getDefaultPageZoom(firstPage));
    autoZoomAppliedRef.current = true;
  }, [pagesList]);

  useEffect(() => {
    setCurrentPageIndex(prev => Math.max(0, Math.min(prev, singleFile.pageCount - 1)));
  }, [singleFile.pageCount]);

  // Smooth wheel zoom with Ctrl/Cmd key matching PageOrganizer
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      const cursorX = event.clientX - rect.left + stage.scrollLeft;
      const cursorY = event.clientY - rect.top + stage.scrollTop;
      const direction = event.deltaY < 0 ? 1 : -1;
      setZoom(current => {
        const next = Math.max(40, Math.min(200, current + direction * 5));
        if (next === current) return current;
        const ratio = next / current;
        requestAnimationFrame(() => {
          stage.scrollLeft = cursorX * ratio - (event.clientX - rect.left);
          stage.scrollTop = cursorY * ratio - (event.clientY - rect.top);
        });
        return next;
      });
    };
    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => stage.removeEventListener('wheel', handleWheel);
  }, []);

  const currentPageThumbnail = pagesList[currentPageIndex]?.thumbnailUrl || pagesList[0]?.thumbnailUrl;
  const isUnlockUnavailable = activeTool === 'pdf-unlock' && !pdfIsEncrypted;
  const isProtectUnavailable = activeTool === 'pdf-protect' && !securityPassword.trim();

  const sidebarTitle = (() => {
    if (activeTool === 'pdf-split') return 'Pages';
    if (activeTool === 'pdf-protect') return 'Protect';
    if (activeTool === 'pdf-unlock') return 'Unlock';
    if (activeTool.startsWith('pdf-flatten')) return 'Flatten';
    if (activeTool === 'pdf-ocr') return 'OCR';
    if (activeTool === 'pdf-watermark') return 'Watermark';
    if (activeTool === 'pdf-stamps') return 'Stamp';
    if (activeTool === 'pdf-sign') return 'Signature';
    if (activeTool === 'pdf-page-numbers') return 'Page numbers';
    if (activeTool === 'pdf-crop-tool') return 'Crop';
    if (activeTool === 'pdf-rotate') return 'Rotate';
    if (activeTool === 'pdf-to-image') return 'Export';
    return 'Options';
  })();

  const getActionLabel = () => {
    if (actionLabel) return actionLabel;
    if (activeTool === 'pdf-protect') return 'Lock PDF';
    if (activeTool === 'pdf-unlock') return 'Unlock PDF';
    if (activeTool.startsWith('pdf-flatten')) return 'Flatten PDF';
    if (activeTool === 'pdf-ocr') return 'Make Searchable';
    if (activeTool === 'pdf-split') return 'Split PDF';
    if (activeTool === 'pdf-watermark') return 'Apply Watermark';
    if (activeTool === 'pdf-page-numbers') return 'Add Numbers';
    if (activeTool === 'pdf-crop-tool') return 'Crop PDF';
    if (activeTool === 'pdf-stamps') return 'Apply Stamp';
    if (activeTool === 'pdf-sign') return 'Sign PDF';
    if (activeTool === 'pdf-to-image') return 'Export Pages';
    return 'Export PDF';
  };

  return (
    <section
      className={`pdf-organizer ${isSidebarCollapsed ? 'is-page-panel-collapsed' : ''}`}
      aria-label="PDF tool configuration workspace"
    >
      {/* ── TOP COMMAND BAR ── */}
      <EditorCommandBar className="pdf-organizer__commandbar">
        <div className="pdf-organizer__file">
          <FileText aria-hidden="true" />
          <div>
            <strong>{singleFile.file.name}</strong>
            <span>
              {singleFile.pageCount} {singleFile.pageCount === 1 ? 'page' : 'pages'} · {formatBytes(singleFile.file.size)}
            </span>
          </div>
        </div>

        <div className="pdf-organizer__header-actions">
          {toolSelector}
          <div className="pdf-organizer__commands" aria-label="Tool commands">
            <span className="pdf-organizer__separator" />
            <button
              type="button"
              className="pdf-organizer__change"
              onClick={onReset}
            >
              Change file
            </button>
            <button
              type="button"
              className="pdf-organizer__export"
              onClick={onRunAction}
              disabled={isUnlockUnavailable || isProtectUnavailable || (pdfIsEncrypted && activeTool !== 'pdf-unlock')}
              title={isUnlockUnavailable ? 'This PDF is already unlocked' : isProtectUnavailable ? 'Enter a password first' : pdfIsEncrypted && activeTool !== 'pdf-unlock' ? 'Unlock this PDF before using other tools' : undefined}
            >
              <Download aria-hidden="true" />
              <span>{getActionLabel()}</span>
            </button>
          </div>
        </div>
      </EditorCommandBar>

      <div className="pdf-organizer__workspace">
        {/* ── LEFT SIDEBAR (OPTIONS) ── */}
        <EditorSidebar className="pdf-organizer__pages" aria-label="PDF Options">
          <EditorSidebarHeader className="pdf-organizer__pages-heading">
            <div className="pdf-sidebar-heading-row">
              <strong>{sidebarTitle}</strong>
              <small className="pdf-sidebar-page-badge">Page {currentPageIndex + 1} of {singleFile.pageCount}</small>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(prev => !prev)}
              title={isSidebarCollapsed ? 'Expand options panel' : 'Collapse options panel'}
            >
              {isSidebarCollapsed ? <PanelLeft aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
            </button>
          </EditorSidebarHeader>

          {!isSidebarCollapsed ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              <PdfInspectorPanel
                activeTool={activeTool}
                onSelectTool={onSelectTool}
                pagesList={pagesList}
                stampPreset={stampPreset}
                setStampPreset={setStampPreset}
                stampPosition={stampPosition}
                setStampPosition={setStampPosition}
                stampTargetPages={stampTargetPages}
                setStampTargetPages={setStampTargetPages}
                pageNumberPosition={pageNumberPosition}
                setPageNumberPosition={setPageNumberPosition}
                cropMarginsPct={cropMarginsPct}
                setCropMarginsPct={setCropMarginsPct}
                signatureText={signatureText}
                setSignatureText={setSignatureText}
                signaturePos={signaturePos}
                setSignaturePos={setSignaturePos}
                signatureColor={signatureColor}
                setSignatureColor={setSignatureColor}
                signatureTargetPages={signatureTargetPages}
                setSignatureTargetPages={setSignatureTargetPages}
                pdfExportMode={pdfExportMode}
                pdfTextLayerStatus={pdfTextLayerStatus}
                setPdfExportMode={setPdfExportMode}
                flattenMode={flattenMode}
                setFlattenMode={setFlattenMode}
                flattenQuality={flattenQuality}
                setFlattenQuality={setFlattenQuality}
                redactMode={redactMode}
                setRedactMode={setRedactMode}
                redactTextContent={redactTextContent}
                setRedactTextContent={setRedactTextContent}
                pageRangeText={pageRangeText}
                setPageRangeText={setPageRangeText}
                selectedPagesInSplit={selectedPagesInSplit}
                togglePageInSplitRange={togglePageInSplitRange}
                setSplitPreset={setSplitPreset}
                setPeekPageIndex={onPeekPage}
                watermarkText={watermarkText}
                setWatermarkText={setWatermarkText}
                watermarkPos={watermarkPos}
                setWatermarkPos={setWatermarkPos}
                watermarkColor={watermarkColor}
                setWatermarkColor={setWatermarkColor}
                watermarkOpacity={watermarkOpacity}
                setWatermarkOpacity={setWatermarkOpacity}
                securityPassword={securityPassword}
                setSecurityPassword={setSecurityPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                pdfIsEncrypted={pdfIsEncrypted}
              />
            </div>
          ) : (
            <div className="pdf-sidebar-rail">
              {singleFile.pageCount > 1 && (
                <>
                  <div className="flex flex-col items-center gap-1 w-full">
                    {Array.from({ length: Math.min(singleFile.pageCount, 8) }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCurrentPageIndex(i)}
                        title={`Go to page ${i + 1}`}
                        className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-mono font-bold transition-all cursor-pointer ${
                          currentPageIndex === i
                            ? 'border border-zinc-300 bg-zinc-200 text-zinc-950 shadow-sm'
                            : 'text-zinc-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    {singleFile.pageCount > 8 && (
                      <span className="text-[10px] text-zinc-500 font-mono">…</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </EditorSidebar>

        {/* ── RIGHT MAIN PREVIEW STAGE ── */}
        <main className="pdf-organizer__stage">
          {/* Top Page Toolbar Pill */}
          {!pdfIsEncrypted && <div className="pdf-organizer__page-toolbar">
            <span>
              Page {currentPageIndex + 1} of {singleFile.pageCount}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPageIndex(prev => Math.max(0, prev - 1))}
              disabled={currentPageIndex === 0}
              title="Previous page"
            >
              <ArrowLeft aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPageIndex(prev => Math.min(singleFile.pageCount - 1, prev + 1))}
              disabled={currentPageIndex === singleFile.pageCount - 1}
              title="Next page"
            >
              <ArrowRight aria-hidden="true" />
            </button>
            <span className="pdf-organizer__separator" />
            <button
              type="button"
              onClick={() => onPeekPage(currentPageIndex)}
              title="Open large preview"
            >
              <ZoomIn aria-hidden="true" />
            </button>
          </div>}

          {/* Stage Scroll Viewport with Canvas Background */}
          <div ref={stageRef} className="pdf-organizer__stage-scroll">
            {pdfIsEncrypted ? (
              <div className="pdf-locked-preview" role="status">
                <LockIcon aria-hidden="true" />
                <strong>Preview locked</strong>
                <p>Enter the document password in the sidebar to unlock this PDF.</p>
              </div>
            ) : <button
              type="button"
              className="pdf-organizer__preview"
              style={{ width: `${zoom * 0.72}%`, maxWidth: `${zoom * 0.46}rem` }}
              onClick={() => onPeekPage(currentPageIndex)}
              title="Open large preview"
            >
              {currentPageThumbnail ? (
                <span className="pdf-organizer__preview-paper">
                  <img src={currentPageThumbnail} alt={`Page ${currentPageIndex + 1}`} />

                  {/* 1. Crop Margins Preview */}
                  {activeTool === 'pdf-crop-tool' && cropMarginsPct > 0 && (
                    <i
                      className="pdf-organizer__crop-preview"
                      style={{ inset: `${cropMarginsPct}%` }}
                      aria-hidden="true"
                    />
                  )}

                  {/* 2. Page Number Overlay Preview */}
                  {activeTool === 'pdf-page-numbers' && (
                    <b className={`pdf-organizer__number-preview is-${pageNumberPosition}`}>
                      Page {currentPageIndex + 1} of {singleFile.pageCount}
                    </b>
                  )}

                  {/* 3. Watermark Overlay Preview */}
                  {activeTool === 'pdf-watermark' && watermarkPos === 'pattern' && (
                    <div className="absolute inset-0 grid grid-cols-2 gap-3 p-3 pointer-events-none items-center justify-center overflow-hidden">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <span
                          key={i}
                          className="font-black tracking-widest text-center truncate max-w-[90%] drop-shadow-sm select-none"
                          style={{
                            transform: 'rotate(-30deg)',
                            opacity: watermarkOpacity * 0.7,
                            fontSize: 'clamp(0.6rem, 1.5vw, 1.2rem)',
                            color: watermarkColor === 'red' ? '#ef4444' : watermarkColor === 'blue' ? '#3b82f6' : watermarkColor === 'black' ? '#000000' : '#4b5563',
                          }}
                        >
                          {watermarkText || 'WATERMARK'}
                        </span>
                      ))}
                    </div>
                  )}
                  {activeTool === 'pdf-watermark' && watermarkPos !== 'pattern' && (
                    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none p-4 ${
                      watermarkPos === 'header' ? '!items-start pt-6' : watermarkPos === 'footer' ? '!items-end pb-6' : ''
                    }`}>
                      <span
                        className="font-black tracking-widest text-center truncate max-w-[95%] drop-shadow-md transition-all duration-200"
                        style={{
                          transform: watermarkPos === 'diagonal' ? 'rotate(-30deg)' : 'none',
                          opacity: watermarkOpacity,
                          fontSize: watermarkPos === 'diagonal' ? 'clamp(1rem, 2.8vw, 2.5rem)' : 'clamp(0.75rem, 1.8vw, 1.5rem)',
                          color: watermarkColor === 'red' ? '#ef4444' : watermarkColor === 'blue' ? '#3b82f6' : watermarkColor === 'black' ? '#000000' : '#4b5563',
                        }}
                      >
                        {watermarkText || 'WATERMARK'}
                      </span>
                    </div>
                  )}

                  {/* 4. Vector Stamp Overlay Preview */}
                  {activeTool === 'pdf-stamps' && (
                    <div className={`absolute z-10 transition-all duration-300 pointer-events-none ${
                      stampPosition === 'bottom-left' ? 'bottom-4 left-4' :
                      stampPosition === 'top-right' ? 'top-4 right-4' :
                      stampPosition === 'center' ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : 'bottom-4 right-4'
                    }`}>
                      <div className={`px-3 py-1.5 rounded border-2 font-mono font-black text-xs tracking-wider bg-white/95 shadow-xl transition-all duration-200 ${
                        stampPreset === 'APPROVED' ? 'border-zinc-800 text-zinc-900' :
                        stampPreset === 'CONFIDENTIAL' ? 'border-rose-600 text-rose-600' :
                        stampPreset === 'CANCELLED' ? 'border-rose-700 text-rose-700' :
                        stampPreset === 'EXPIRED' ? 'border-amber-600 text-amber-600' :
                        stampPreset === 'PAID' ? 'border-zinc-700 text-zinc-800' : 'border-zinc-900 text-zinc-900'
                      }`}>
                        {stampPreset || 'APPROVED'}
                      </div>
                    </div>
                  )}

                  {/* 5. Signature Stamp Overlay Preview */}
                  {activeTool === 'pdf-sign' && (
                    <div className={`absolute p-3 flex flex-col pointer-events-none transition-all duration-200 z-10 ${
                      signaturePos === 'bottom-right' ? 'bottom-3 right-3 items-end' :
                      signaturePos === 'bottom-left' ? 'bottom-3 left-3 items-start' :
                      signaturePos === 'top-right' ? 'top-3 right-3 items-end' : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 items-center'
                    }`}>
                      <div className="bg-white/90 backdrop-blur-sm border border-zinc-300 px-3 py-2 rounded-lg shadow-lg flex flex-col items-center">
                        <span
                          className="font-serif italic font-bold text-sm tracking-wide"
                          style={{ color: signatureColor === 'blue' ? '#1e3a8a' : signatureColor === 'red' ? '#991b1b' : '#000000' }}
                        >
                          {signatureText || 'Authorized Signature'}
                        </span>
                        <span className="text-[8px] text-zinc-600 font-mono mt-0.5">Verified: {new Date().toLocaleDateString()}</span>
                      </div>
                    </div>
                  )}

                  {/* 6. Redaction / Censorship Box Overlay Preview */}
                  {activeTool === 'pdf-redact' && (
                    redactMode === 'redact' ? (
                      <div className="absolute inset-x-8 top-1/3 h-10 bg-black text-white font-mono text-xs font-bold flex items-center justify-center border border-zinc-800 shadow-2xl z-10 pointer-events-none">
                        [REDACTED]
                      </div>
                    ) : (
                      <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 p-2 bg-white/90 border border-zinc-400 rounded text-zinc-900 font-mono text-xs font-bold text-center z-10 shadow-lg pointer-events-none">
                        {redactTextContent || 'Sample Overlay'}
                      </div>
                    )
                  )}
                </span>
              ) : (
                <span>
                  <FileText aria-hidden="true" />
                  Rendering page {currentPageIndex + 1}…
                </span>
              )}
            </button>}
          </div>

          {/* Workspace Zoom Controls */}
          {!pdfIsEncrypted && <WorkspaceZoomControls
            value={zoom}
            onChange={setZoom}
            min={40}
            max={200}
            step={10}
            className="pdf-organizer__zoom"
          />}
        </main>
      </div>
    </section>
  );
};
