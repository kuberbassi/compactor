import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Crop, Download, FileMinus2, FileText, Hash, LoaderCircle, PanelLeft, PanelLeftClose, RotateCcw, RotateCw, Trash2, ZoomIn } from 'lucide-react';
import { formatBytes } from '../../../utils/image';
import { EditorCommandBar, EditorSidebar, EditorSidebarHeader } from '../../../components/Workspace/EditorChrome';
import { WorkspaceZoomControls } from '../../../components/Workspace/WorkspaceControls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import type { PdfFileInfo } from './LivePdfPreview';
import { getDefaultPageZoom, getPageAspectRatio } from '../pdfPageDisplay';

export interface PageItem {
  id: string;
  originalIndex: number;
  rotation: number;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}

const isPageQuarterTurn = (page: PageItem): boolean => Math.abs(page.rotation) % 180 === 90;

export interface PageOrganizerProps {
  singleFile: PdfFileInfo;
  pagesList: PageItem[];
  onRotatePage: (index: number, deg: number) => void;
  onRotateAll: (deg: number) => void;
  onMovePage: (from: number, to: number) => void;
  onDeletePage: (index: number) => void;
  onPeekPage: (index: number) => void;
  onReset: () => void;
  onRunOrganize: () => void;
  onRemoveBlankPages: () => void;
  blankPageStatus: 'idle' | 'scanning' | 'ready' | 'none' | 'error';
  blankPageCount: number;
  addPageNumbers: boolean;
  onAddPageNumbersChange: (enabled: boolean) => void;
  pageNumberPosition: 'top' | 'bottom';
  onPageNumberPositionChange: (position: 'top' | 'bottom') => void;
  cropEnabled: boolean;
  onCropEnabledChange: (enabled: boolean) => void;
  cropMarginsPct: number;
  onCropMarginsChange: (value: number) => void;
  toolSelector?: React.ReactNode;
}

export const PageOrganizer: React.FC<PageOrganizerProps> = ({
  singleFile, pagesList, onRotatePage, onRotateAll, onMovePage,
  onDeletePage, onPeekPage, onReset, onRunOrganize, onRemoveBlankPages, blankPageStatus, blankPageCount,
  addPageNumbers, onAddPageNumbersChange, pageNumberPosition, onPageNumberPositionChange,
  cropEnabled, onCropEnabledChange, cropMarginsPct, onCropMarginsChange, toolSelector,
}) => {
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [isPagePanelCollapsed, setIsPagePanelCollapsed] = useState(false);
  const [draggedPageIndex, setDraggedPageIndex] = useState<number | null>(null);
  const [dragOverPageIndex, setDragOverPageIndex] = useState<number | null>(null);
  const draggedPageIndexRef = useRef<number | null>(null);
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
    setSelectedPageIndex(previous => Math.max(0, Math.min(previous, pagesList.length - 1)));
  }, [pagesList.length]);

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

  const selectedPage = pagesList[selectedPageIndex];
  const visibleBlankStatus = blankPageStatus === 'ready' && blankPageCount === 0 ? 'none' : blankPageStatus;

  return (
    <section className={`pdf-organizer ${isPagePanelCollapsed ? 'is-page-panel-collapsed' : ''}`} aria-label="Organize PDF pages">
      <EditorCommandBar className="pdf-organizer__commandbar">
        <div className="pdf-organizer__file">
          <FileText aria-hidden="true" />
          <div>
            <strong>{singleFile.file.name}</strong>
            <span>{pagesList.length} {pagesList.length === 1 ? 'page' : 'pages'} · {formatBytes(singleFile.file.size)}</span>
          </div>
        </div>
        <div className="pdf-organizer__header-actions">
          {toolSelector}
          <div className="pdf-organizer__commands" aria-label="Page commands">
            <button type="button" onClick={() => onRotateAll(-90)} title="Rotate every page left"><RotateCcw aria-hidden="true" /><span>All</span></button>
            <button type="button" onClick={() => onRotateAll(90)} title="Rotate every page right"><RotateCw aria-hidden="true" /><span>All</span></button>
            <span className="pdf-organizer__separator" />
            <button
              type="button"
              className={`pdf-organizer__blank-status is-${visibleBlankStatus}`}
              onClick={onRemoveBlankPages}
              disabled={visibleBlankStatus !== 'ready' || blankPageCount === 0}
              title={visibleBlankStatus === 'scanning' ? 'Checking pages while previews load' : visibleBlankStatus === 'ready' ? `Remove ${blankPageCount} detected blank ${blankPageCount === 1 ? 'page' : 'pages'}` : visibleBlankStatus === 'error' ? 'Blank-page check could not be completed' : 'No blank pages detected'}
            >
              {visibleBlankStatus === 'scanning' ? <LoaderCircle aria-hidden="true" /> : visibleBlankStatus === 'none' ? <Check aria-hidden="true" /> : <FileMinus2 aria-hidden="true" />}
              <span>{visibleBlankStatus === 'scanning' ? 'Checking…' : visibleBlankStatus === 'ready' ? `Blank pages (${blankPageCount})` : visibleBlankStatus === 'error' ? 'Check unavailable' : 'No blank pages'}</span>
            </button>
            <div className="pdf-organizer__option-group" aria-label="Export options">
              <button type="button" className={cropEnabled ? 'is-active' : ''} aria-pressed={cropEnabled} onClick={() => onCropEnabledChange(!cropEnabled)} title="Crop margins when exporting">{cropEnabled ? <Check aria-hidden="true" /> : <Crop aria-hidden="true" />}<span>Crop</span></button>
              {cropEnabled && <label className="pdf-organizer__inline-option"><input type="number" min="0" max="20" value={cropMarginsPct} onChange={event => onCropMarginsChange(Math.min(20, Math.max(0, Number(event.target.value) || 0)))} aria-label="Crop margin percent" /><span>%</span></label>}
              <span className="pdf-organizer__option-divider" />
              <button type="button" className={addPageNumbers ? 'is-active' : ''} aria-pressed={addPageNumbers} onClick={() => onAddPageNumbersChange(!addPageNumbers)} title="Add page numbers when exporting">{addPageNumbers ? <Check aria-hidden="true" /> : <Hash aria-hidden="true" />}<span>Numbers</span></button>
              {addPageNumbers && (
                <Select value={pageNumberPosition} onValueChange={value => onPageNumberPositionChange(value as 'top' | 'bottom')}>
                  <SelectTrigger size="sm" className="pdf-organizer__inline-select" aria-label="Page number position">
                    <SelectValue>{pageNumberPosition === 'top' ? 'Top' : 'Bottom'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent align="end" className="pdf-organizer__inline-select-menu">
                    <SelectItem value="bottom">Bottom</SelectItem>
                    <SelectItem value="top">Top</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <span className="pdf-organizer__separator" />
            <button type="button" className="pdf-organizer__change" onClick={onReset}>Change file</button>
            <button type="button" className="pdf-organizer__export" onClick={onRunOrganize} disabled={pagesList.length === 0} title="Export PDF"><Download aria-hidden="true" /><span>Export PDF</span></button>
          </div>
        </div>
      </EditorCommandBar>

      <div className="pdf-organizer__workspace">
        <EditorSidebar className="pdf-organizer__pages" aria-label="Document pages">
          <EditorSidebarHeader className="pdf-organizer__pages-heading">
            <div className="pdf-sidebar-heading-row"><strong>Pages</strong><small className="pdf-sidebar-page-badge">Page {selectedPageIndex + 1} of {pagesList.length}</small></div>
            <button type="button" onClick={() => setIsPagePanelCollapsed(previous => !previous)} title={isPagePanelCollapsed ? 'Expand page panel' : 'Collapse page panel'}>
              {isPagePanelCollapsed ? <PanelLeft aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
            </button>
          </EditorSidebarHeader>
          <div className="pdf-organizer__page-list" role="list">
            {pagesList.map((item, index) => {
              const isSelected = index === selectedPageIndex;
              const isDragging = draggedPageIndex === index;
              const isDragOver = dragOverPageIndex === index && draggedPageIndex !== index;

              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  draggable
                  className={`pdf-organizer__thumbnail ${isSelected ? 'is-selected' : ''} ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'is-drag-over' : ''}`}
                  aria-current={isSelected ? 'page' : undefined}
                  aria-label={`Page ${index + 1}. Drag to reorder; double-click to preview.`}
                  onClick={() => setSelectedPageIndex(index)}
                  onDoubleClick={() => onPeekPage(index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedPageIndex(index);
                    }
                  }}
                  onDragStart={(event) => {
                    setDraggedPageIndex(index);
                    draggedPageIndexRef.current = index;
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(index));
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    if (dragOverPageIndex !== index) {
                      setDragOverPageIndex(index);
                    }
                  }}
                  onDragLeave={(event) => {
                    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                    if (dragOverPageIndex === index) {
                      setDragOverPageIndex(null);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const sourceIndex = draggedPageIndexRef.current ?? Number(event.dataTransfer.getData('text/plain'));
                    if (typeof sourceIndex === 'number' && Number.isInteger(sourceIndex) && sourceIndex !== index) {
                      onMovePage(sourceIndex, index);
                      setSelectedPageIndex(index);
                    }
                    setDraggedPageIndex(null);
                    setDragOverPageIndex(null);
                    draggedPageIndexRef.current = null;
                  }}
                  onDragEnd={() => {
                    setDraggedPageIndex(null);
                    setDragOverPageIndex(null);
                    draggedPageIndexRef.current = null;
                  }}
                >
                  <div className="pdf-organizer__thumbnail-header flex items-center justify-between w-full select-none">
                    <span className="pdf-organizer__thumbnail-number">{index + 1}</span>
                    <nav
                      className="pdf-organizer__thumbnail-arrows flex items-center gap-0.5"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Move page ${index + 1}`}
                    >
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => {
                          onMovePage(index, index - 1);
                          setSelectedPageIndex(index - 1);
                        }}
                        title="Move page earlier"
                        className="w-4 h-4 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                        draggable={false}
                      >
                        <ArrowLeft className="w-2.5 h-2.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={index === pagesList.length - 1}
                        onClick={() => {
                          onMovePage(index, index + 1);
                          setSelectedPageIndex(index + 1);
                        }}
                        title="Move page later"
                        className="w-4 h-4 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                        draggable={false}
                      >
                        <ArrowRight className="w-2.5 h-2.5" aria-hidden="true" />
                      </button>
                    </nav>
                  </div>
                  <span className="pdf-organizer__thumbnail-paper pointer-events-none select-none" aria-hidden={isPagePanelCollapsed} style={{ aspectRatio: getPageAspectRatio(item) }}>
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={`Source page ${item.originalIndex + 1}`}
                        draggable={false}
                        className="pointer-events-none select-none"
                        style={{
                          width: isPageQuarterTurn(item) ? 'auto' : '100%',
                          height: '100%',
                          maxWidth: isPageQuarterTurn(item) ? 'none' : '100%',
                          transform: `rotate(${item.rotation}deg)`,
                        }}
                      />
                    ) : <FileText aria-label={`Rendering page ${index + 1}`} />}
                  </span>
                  {item.rotation !== 0 && <small className="pointer-events-none select-none">{item.rotation}°</small>}
                </div>
              );
            })}
          </div>
        </EditorSidebar>

        <main className="pdf-organizer__stage">
          {selectedPage ? (
            <>
              <div className="pdf-organizer__page-toolbar">
                <span>Page {selectedPageIndex + 1}</span>
                <button type="button" onClick={() => onMovePage(selectedPageIndex, selectedPageIndex - 1)} disabled={selectedPageIndex === 0} title="Move page left"><ArrowLeft aria-hidden="true" /></button>
                <button type="button" onClick={() => onMovePage(selectedPageIndex, selectedPageIndex + 1)} disabled={selectedPageIndex === pagesList.length - 1} title="Move page right"><ArrowRight aria-hidden="true" /></button>
                <span className="pdf-organizer__separator" />
                <button type="button" onClick={() => onRotatePage(selectedPageIndex, -90)} title="Rotate page left"><RotateCcw aria-hidden="true" /></button>
                <button type="button" onClick={() => onRotatePage(selectedPageIndex, 90)} title="Rotate page right"><RotateCw aria-hidden="true" /></button>
                <button type="button" onClick={() => onPeekPage(selectedPageIndex)} title="Open large preview"><ZoomIn aria-hidden="true" /></button>
                <span className="pdf-organizer__separator" />
                <button type="button" className="pdf-organizer__delete" onClick={() => onDeletePage(selectedPageIndex)} title="Remove page"><Trash2 aria-hidden="true" /></button>
              </div>
              <div ref={stageRef} className="pdf-organizer__stage-scroll">
                <button
                  type="button"
                  className="pdf-organizer__preview"
                  style={{ width: `${zoom * 0.72}%`, maxWidth: `${zoom * 0.46}rem` }}
                  onClick={() => onPeekPage(selectedPageIndex)}
                  title="Open large preview"
                >
                  {selectedPage.thumbnailUrl ? (
                    <span className="pdf-organizer__preview-paper" style={{ transform: `rotate(${selectedPage.rotation}deg)` }}>
                      <img src={selectedPage.thumbnailUrl} alt={`Page ${selectedPageIndex + 1}`} draggable={false} />
                      {cropEnabled && cropMarginsPct > 0 && <i className="pdf-organizer__crop-preview" style={{ inset: `${cropMarginsPct}%` }} aria-hidden="true" />}
                      {addPageNumbers && <b className={`pdf-organizer__number-preview is-${pageNumberPosition}`}>Page {selectedPageIndex + 1} of {pagesList.length}</b>}
                    </span>
                  ) : <span><FileText aria-hidden="true" />Rendering page {selectedPageIndex + 1}…</span>}
                </button>
              </div>
            </>
          ) : <div ref={stageRef} className="pdf-organizer__stage-scroll"><div className="pdf-organizer__empty">No pages remain in this document.</div></div>}
          <WorkspaceZoomControls value={zoom} onChange={setZoom} min={40} max={200} step={10} className="pdf-organizer__zoom" />
        </main>
      </div>

    </section>
  );
};
