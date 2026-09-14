import React, { useEffect, useRef, useState } from 'react';
import { FileUploader } from '../../components/Common/FileUploader';
import { ToolHeader } from '../../components/Common/ToolHeader';
import { ToolModeSwitcher } from '../../components/Common/ToolModeSwitcher';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { WorkspaceToolNav, WorkspaceZoomControls } from '../../components/Workspace/WorkspaceControls';
import type { WorkspaceToolItem } from '../../components/Workspace/WorkspaceControls';
import {
  Printer as PrinterIcon,
  LayoutGrid,
  Palette,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';
import { PAGE_SIZES, HALFTONE_CELL_SIZE, generatePosterPdfBlob } from '../../utils/posterEngine';
import { PosterSettingsPanel, type PosterTabId } from './components/PosterSettingsPanel';
import { PosterPreviewStage } from './components/PosterPreviewStage';
import { PosterResultCard } from './components/PosterResultCard';
import { formatBytes } from '../../utils/image';

interface RasterbatorProps {
  onGoHome: () => void;
  onSelectTool: (toolId: string) => void;
  onUploadSuccess: () => void;
}

const POSTER_TABS: WorkspaceToolItem<PosterTabId>[] = [
  { id: 'grid', label: 'Page Setup', Icon: LayoutGrid },
  { id: 'style', label: 'Style & Rotate', Icon: Palette },
];

export const Rasterbator: React.FC<RasterbatorProps> = ({ onGoHome, onSelectTool, onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<{ width: number; height: number } | null>(null);

  // Workbench layout states
  const [activeTab, setActiveTab] = useState<PosterTabId>('grid');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Page & Print settings
  const [pageSize, setPageSize] = useState<keyof typeof PAGE_SIZES>('A4');
  const [orientation, setOrientation] = useState<'Portrait' | 'Landscape'>('Portrait');
  const [columns, setColumns] = useState<number>(5);
  const [rows, setRows] = useState<number>(3);
  const [styleMode, setStyleMode] = useState<'color' | 'bw' | 'halftone'>('color');
  const [lockAspect, setLockAspect] = useState<boolean>(true);
  const [showCropMarks, setShowCropMarks] = useState<boolean>(true);
  const [showSheetNumbers, setShowSheetNumbers] = useState<boolean>(true);

  // Transforms & Halftone settings
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [dotSize, setDotSize] = useState<number>(HALFTONE_CELL_SIZE);
  const [invertHalftone, setInvertHalftone] = useState<boolean>(false);

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [posterZoom, setPosterZoom] = useState(100);
  const posterViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [previewUrl, resultUrl]);

  useEffect(() => {
    const viewport = posterViewportRef.current;
    if (!viewport) return;
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setPosterZoom(value => Math.max(40, Math.min(200, value + (event.deltaY < 0 ? 10 : -10))));
    };
    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [file]);

  const getEffectiveImageDims = () => {
    if (!imageDims) return null;
    const isPerp = rotation === 90 || rotation === 270;
    return {
      width: isPerp ? imageDims.height : imageDims.width,
      height: isPerp ? imageDims.width : imageDims.height,
    };
  };

  const handleFileSelected = (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;
    const f = selectedFiles[0];
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setFile(f);
    setResultUrl(null);
    setErrorMessage(null);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);

    const img = new Image();
    img.onload = () => {
      setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
      if (lockAspect) {
        recalcRows(columns, img.naturalWidth, img.naturalHeight, pageSize, orientation);
      }
    };
    img.src = url;
  };

  const recalcRows = (cols: number, imgW: number, imgH: number, sizeKey: keyof typeof PAGE_SIZES, orient: 'Portrait' | 'Landscape') => {
    const p = PAGE_SIZES[sizeKey];
    const pW = orient === 'Portrait' ? p.mmW : p.mmH;
    const pH = orient === 'Portrait' ? p.mmH : p.mmW;
    const imgAspect = imgW / imgH;
    const calculated = Math.max(1, Math.min(20, Math.round((cols * pW) / (imgAspect * pH))));
    setRows(calculated);
  };

  const handleColumnsChange = (newCols: number) => {
    const cols = Math.max(1, Math.min(20, newCols));
    setColumns(cols);
    const eff = getEffectiveImageDims();
    if (lockAspect && eff) {
      recalcRows(cols, eff.width, eff.height, pageSize, orientation);
    }
  };

  const handlePageSizeChange = (newSize: keyof typeof PAGE_SIZES) => {
    setPageSize(newSize);
    const eff = getEffectiveImageDims();
    if (lockAspect && eff) {
      recalcRows(columns, eff.width, eff.height, newSize, orientation);
    }
  };

  const handleOrientationChange = (newOrient: 'Portrait' | 'Landscape') => {
    setOrientation(newOrient);
    const eff = getEffectiveImageDims();
    if (lockAspect && eff) {
      recalcRows(columns, eff.width, eff.height, pageSize, newOrient);
    }
  };

  const handleSwapGrid = () => {
    const nextCols = rows;
    const nextRows = columns;
    setColumns(nextCols);
    setRows(nextRows);
  };

  const handleApplyPhysicalWidthPreset = (targetWidthM: number) => {
    const p = PAGE_SIZES[pageSize];
    const pageW = orientation === 'Portrait' ? p.mmW : p.mmH;
    const targetCols = Math.max(1, Math.min(20, Math.round((targetWidthM * 1000) / pageW)));
    setColumns(targetCols);
    const eff = getEffectiveImageDims();
    if (lockAspect && eff) {
      recalcRows(targetCols, eff.width, eff.height, pageSize, orientation);
    }
  };

  const handleRotateCW = () => {
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    if (lockAspect && imageDims) {
      const isPerp = nextRot === 90 || nextRot === 270;
      const w = isPerp ? imageDims.height : imageDims.width;
      const h = isPerp ? imageDims.width : imageDims.height;
      recalcRows(columns, w, h, pageSize, orientation);
    }
  };

  const handleRotateCCW = () => {
    const nextRot = (rotation + 270) % 360;
    setRotation(nextRot);
    if (lockAspect && imageDims) {
      const isPerp = nextRot === 90 || nextRot === 270;
      const w = isPerp ? imageDims.height : imageDims.width;
      const h = isPerp ? imageDims.width : imageDims.height;
      recalcRows(columns, w, h, pageSize, orientation);
    }
  };

  const handleRotate180 = () => {
    setRotation(r => (r + 180) % 360);
  };

  const handleToggleFlipH = () => setFlipH(f => !f);
  const handleToggleFlipV = () => setFlipV(f => !f);

  const handleResetTransforms = () => {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    if (lockAspect && imageDims) {
      recalcRows(columns, imageDims.width, imageDims.height, pageSize, orientation);
    }
  };

  const reset = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setPreviewUrl(null);
    setImageDims(null);
    setResultUrl(null);
    setResultName('');
    setErrorMessage(null);
    setProgress(0);
    setProcessing(false);
    setPageSize('A4');
    setOrientation('Portrait');
    setColumns(5);
    setRows(3);
    setStyleMode('color');
    setLockAspect(true);
    setShowCropMarks(true);
    setShowSheetNumbers(true);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setDotSize(HALFTONE_CELL_SIZE);
    setInvertHalftone(false);
    setPosterZoom(100);
    setActiveTab('grid');
  };

  // Physical Poster Total Dimensions
  const p = PAGE_SIZES[pageSize];
  const pageMMW = orientation === 'Portrait' ? p.mmW : p.mmH;
  const pageMMH = orientation === 'Portrait' ? p.mmH : p.mmW;
  const totalMMW = columns * pageMMW;
  const totalMMH = rows * pageMMH;
  const posterMeterW = (totalMMW / 1000).toFixed(2);
  const posterMeterH = (totalMMH / 1000).toFixed(2);
  const posterInchW = (totalMMW / 25.4).toFixed(1);
  const posterInchH = (totalMMH / 25.4).toFixed(1);

  const generatePoster = async () => {
    if (!file || !previewUrl) return;
    const totalPages = columns * rows;
    if (totalPages > 100) {
      setErrorMessage('Total poster sheets exceed the safety limit of 100 pages. Please reduce the number of columns or rows.');
      return;
    }

    setErrorMessage(null);
    setProcessing(true);
    setProgress(5);
    setStatusText('Initializing high-precision poster engine...');

    try {
      const img = new Image();
      img.src = previewUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const pdfBlob = await generatePosterPdfBlob(
        img,
        {
          imageWidth: img.naturalWidth,
          imageHeight: img.naturalHeight,
          pageSize,
          orientation,
          columns,
          rows,
          styleMode,
          showCropMarks,
          showSheetNumbers,
          rotation,
          flipH,
          flipV,
          dotSize,
          invertHalftone,
          maxSheetsCap: 100,
        },
        (prog, status) => {
          setProgress(prog);
          setStatusText(status);
        }
      );

      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResultUrl(URL.createObjectURL(pdfBlob));
      setResultName(`${file.name.replace(/\.[^/.]+$/, '')}_tiled_poster_${columns}x${rows}_${pageSize}.pdf`);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || 'Tiled poster printing failed.');
    } finally {
      setProgress(100);
      setProcessing(false);
    }
  };

  const effDims = getEffectiveImageDims();

  return (
    <div className={`tool-layout rasterbator-tool-layout ${file || resultUrl || processing ? 'has-active-session' : 'is-empty-session'}`}>
      <ToolHeader
        title="Poster Printer"
        description="Turn any image into a multi-page printable wall poster with precision cut guides."
        icon={PrinterIcon}
        fileName={file?.name}
        fileMeta={file ? `${effDims ? `${effDims.width} × ${effDims.height}px` : 'Loading image'} · ${columns * rows} sheets` : undefined}
        onGoHome={() => {
          if (file || resultUrl || processing) {
            reset();
          } else {
            onGoHome();
          }
        }}
        actions={!resultUrl && !processing ? (
          <ToolModeSwitcher
            label="Image tools"
            activeId="rasterbator"
            options={[
              { id: 'image-optimizer', label: 'Edit' },
              { id: 'rasterbator', label: 'Poster' },
            ]}
            onSelect={onSelectTool}
          />
        ) : undefined}
      />

      {errorMessage && (
        <div className="max-w-2xl mx-auto my-4 p-4 border border-rose-500/30 bg-rose-500/10 text-rose-300 rounded-xl text-xs flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-200 font-bold ml-3 cursor-pointer">✕</button>
        </div>
      )}

      {!file && !processing && !resultUrl && (
        <div className="tool-upload-frame max-w-2xl mx-auto py-10">
          <FileUploader
            accept="image/jpeg,image/png,image/webp,image/gif"
            label="Select your image for poster printing"
            subLabel="Drag & drop high-resolution JPEG, PNG, or WebP images"
            onFilesSelected={handleFileSelected}
            maxSizeMB={500}
          />
        </div>
      )}

      {/* Processing State - Full Center Screen */}
      {processing && (
        <div className="tool-processing-stage">
          <div className="tool-processing-stage__content">
            <ProgressBar
              progress={progress}
              statusText={statusText}
              subText="Generating ultra high-resolution tiled vector PDF sheets"
            />
          </div>
        </div>
      )}

      {/* Active Workspace State */}
      {file && !resultUrl && !processing && (
        <div className={`image-workbench ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''} flex-1 flex h-full overflow-hidden`}>
          {/* ═══ LEFT SIDEBAR ═══════════════════════════════════════════════════ */}
          <aside className={`image-workbench__sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
              {sidebarCollapsed ? (
                /* Collapsed Icon Rail */
                <div className="h-full flex flex-col items-center py-3 bg-[#18191e] justify-between w-full select-none">
                  <div className="flex flex-col items-center gap-1.5 w-full px-2">
                    {/* Expand button */}
                    <button
                      type="button"
                      onClick={() => setSidebarCollapsed(false)}
                      className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer mb-1"
                      title="Expand sidebar"
                    >
                      <PanelLeft className="w-4 h-4" />
                    </button>

                    <div className="w-6 h-[1px] bg-white/10 mb-1" />

                    {/* Tool icons with tooltip */}
                    <div className="flex flex-col items-center gap-1 w-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                      {POSTER_TABS.map((tab) => {
                        const Icon = tab.Icon;
                        const isActive = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              setActiveTab(tab.id);
                              setSidebarCollapsed(false);
                            }}
                            title={`${tab.label} Settings`}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer relative group ${
                              isActive
                                ? 'bg-white text-zinc-950 font-bold shadow-md'
                                : 'text-zinc-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            {/* Hover Tooltip */}
                            <div className="absolute left-full ml-3 px-2.5 py-1 bg-zinc-900 border border-zinc-700/80 text-zinc-100 text-xs font-semibold rounded-md shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                              {tab.label}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Collapsed CTA button */}
                  <div className="pt-2 border-t border-white/10 w-full flex justify-center px-2">
                    <button
                      type="button"
                      onClick={generatePoster}
                      disabled={processing}
                      title="Generate Poster PDF"
                      className="w-9 h-9 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 flex items-center justify-center shadow-md cursor-pointer transition-all hover:scale-105 active:scale-95 group relative font-bold disabled:opacity-50"
                    >
                      <span className="text-sm leading-none font-black">→</span>
                      <div className="absolute left-full ml-3 px-2.5 py-1 bg-zinc-900 border border-zinc-700/80 text-zinc-100 text-xs font-semibold rounded-md shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                        Generate PDF
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                /* Expanded Compact Sidebar */
                <div className="h-full flex flex-col min-h-0 bg-[#18191e]">
                  {/* Compact Header with Collapse button */}
                  <div className="h-10 px-3.5 border-b border-white/10 flex items-center justify-between bg-transparent shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Poster Setup</span>
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-semibold text-zinc-400">
                        {columns * rows} sheets
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSidebarCollapsed(true)}
                      className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                      title="Collapse to icon rail"
                    >
                      <PanelLeftClose className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Tool navigation tabs */}
                  <WorkspaceToolNav items={POSTER_TABS} activeId={activeTab} onChange={setActiveTab} label="Poster settings" />

                  {/* Scrollable settings content */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                    <PosterSettingsPanel
                      activeTab={activeTab}
                      pageSize={pageSize}
                      orientation={orientation}
                      columns={columns}
                      rows={rows}
                      styleMode={styleMode}
                      lockAspect={lockAspect}
                      showCropMarks={showCropMarks}
                      showSheetNumbers={showSheetNumbers}
                      rotation={rotation}
                      flipH={flipH}
                      flipV={flipV}
                      dotSize={dotSize}
                      invertHalftone={invertHalftone}
                      onPageSizeChange={handlePageSizeChange}
                      onOrientationChange={handleOrientationChange}
                      onColumnsChange={handleColumnsChange}
                      onRowsChange={(r) => setRows(r)}
                      onSwapGrid={handleSwapGrid}
                      onApplyPhysicalWidthPreset={handleApplyPhysicalWidthPreset}
                      setStyleMode={setStyleMode}
                      setLockAspect={(val) => {
                        setLockAspect(val);
                        const eff = getEffectiveImageDims();
                        if (val && eff) recalcRows(columns, eff.width, eff.height, pageSize, orientation);
                      }}
                      setShowCropMarks={setShowCropMarks}
                      setShowSheetNumbers={setShowSheetNumbers}
                      onRotateCW={handleRotateCW}
                      onRotateCCW={handleRotateCCW}
                      onRotate180={handleRotate180}
                      onToggleFlipH={handleToggleFlipH}
                      onToggleFlipV={handleToggleFlipV}
                      onResetTransforms={handleResetTransforms}
                      setDotSize={setDotSize}
                      setInvertHalftone={setInvertHalftone}
                    />
                  </div>

                  {/* Sticky Footer CTA */}
                  <div className="p-3 border-t border-white/10 bg-[#18191e] shrink-0">
                    <button
                      type="button"
                      onClick={generatePoster}
                      disabled={processing}
                      className="workspace-primary-action w-full h-10 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                    >
                      <span>{processing ? 'Generating…' : `Generate Poster (${columns * rows} Pages)`}</span>
                      <span className="text-sm">→</span>
                    </button>
                  </div>
                </div>
              )}
            </aside>

            {/* ═══ MAIN AREA ══════════════════════════════════════════════════════ */}
            <div className="image-workbench__main">
              {/* File info bar & Zoom controls */}
              <div className="image-filebar h-10 border-b border-[var(--border-color)] bg-[var(--surface-color)] flex items-center px-4 gap-3 text-xs text-[var(--text-secondary)] shrink-0 justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-semibold text-[var(--text-primary)] truncate max-w-[200px]">{file.name}</span>
                      <span className="text-zinc-500">{formatBytes(file.size)}</span>
                      {effDims && (
                        <span className="text-zinc-500 hidden sm:inline">{effDims.width} × {effDims.height}px</span>
                      )}
                      {rotation !== 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-semibold text-zinc-300">
                          {rotation}°
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <WorkspaceZoomControls value={posterZoom} onChange={setPosterZoom} min={40} max={200} />
                    </div>
                  </div>

                  {/* Main Preview Stage */}
                  <PosterPreviewStage
                    file={file}
                    previewUrl={previewUrl!}
                    imageDims={imageDims}
                    columns={columns}
                    rows={rows}
                    pageSize={pageSize}
                    orientation={orientation}
                    pageMMW={pageMMW}
                    pageMMH={pageMMH}
                    posterMeterW={posterMeterW}
                    posterMeterH={posterMeterH}
                    posterInchW={posterInchW}
                    posterInchH={posterInchH}
                    styleMode={styleMode}
                    posterZoom={posterZoom}
                    rotation={rotation}
                    flipH={flipH}
                    flipV={flipV}
                    dotSize={dotSize}
                    invertHalftone={invertHalftone}
                    posterViewportRef={posterViewportRef}
                  />
            </div>
          </div>
      )}

      {/* Results State */}
      {resultUrl && !processing && (
        <div className="flex-1 flex items-center justify-center p-6">
          <PosterResultCard
            resultUrl={resultUrl}
            resultName={resultName}
            columns={columns}
            rows={rows}
            pageSize={pageSize}
            posterMeterW={posterMeterW}
            posterMeterH={posterMeterH}
            onReset={reset}
          />
        </div>
      )}
    </div>
  );
};
