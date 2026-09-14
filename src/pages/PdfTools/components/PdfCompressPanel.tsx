import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  FileText,
  Layers,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Sliders,
  Trash2,
} from 'lucide-react';
import { FileUploader } from '../../../components/Common/FileUploader';
import { CompressionPresetSelector } from '../../../components/Common/CompressionPresetSelector';
import { EditorCommandBar, EditorSidebar, EditorSidebarHeader } from '../../../components/Workspace/EditorChrome';
import { formatBytes } from '../../../utils/image';
import type { CompressionPreset } from '../../../utils/batch';
import type { PdfFileInfo } from './LivePdfPreview';

export interface PdfCompressPanelProps {
  multipleFiles: PdfFileInfo[];
  compressionPreset: CompressionPreset;
  setCompressionPreset: (preset: CompressionPreset) => void;
  removeCompressionMetadata: boolean;
  setRemoveCompressionMetadata: (remove: boolean) => void;
  draggedQueueIndex: number | null;
  setDraggedQueueIndex: (index: number | null) => void;
  onMoveQueueItem: (from: number, to: number) => void;
  onRemoveQueueItem: (index: number) => void;
  onFilesSelected: (files: File[]) => void;
  onClearAll: () => void;
  onRunCompress: () => void;
  toolSelector?: React.ReactNode;
}

export const PdfCompressPanel: React.FC<PdfCompressPanelProps> = ({
  multipleFiles,
  compressionPreset,
  setCompressionPreset,
  removeCompressionMetadata,
  setRemoveCompressionMetadata,
  draggedQueueIndex: _draggedQueueIndex,
  setDraggedQueueIndex: _setDraggedQueueIndex,
  onMoveQueueItem,
  onRemoveQueueItem,
  onFilesSelected,
  onClearAll,
  onRunCompress,
  toolSelector,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const totalBytes = multipleFiles.reduce((acc, f) => acc + f.file.size, 0);
  const totalPages = multipleFiles.reduce((acc, f) => acc + (f.pageCount || 1), 0);
  const firstFile = multipleFiles[0]?.file;

  const sequenceTitle = multipleFiles.length === 0
    ? 'Select documents to compress'
    : multipleFiles.length === 1
      ? '1 document ready to compress'
      : `${multipleFiles.length} documents ready to compress`;

  return (
    <section
      className={`pdf-organizer ${isSidebarCollapsed ? 'is-page-panel-collapsed' : ''}`}
      aria-label="Compress PDF documents"
    >
      {/* ── TOP COMMAND BAR (HEADER STRIP) ── */}
      <EditorCommandBar className="pdf-organizer__commandbar">
        <div className="pdf-organizer__file">
          <FileText aria-hidden="true" />
          <div>
            <strong title={firstFile ? firstFile.name : 'Compress PDF'}>
              {firstFile ? firstFile.name : 'Compress PDF'}
            </strong>
            <span>
              {multipleFiles.length} {multipleFiles.length === 1 ? 'file' : 'files'} · {totalPages} {totalPages === 1 ? 'page' : 'pages'} · {formatBytes(totalBytes)}
            </span>
          </div>
        </div>

        <div className="pdf-organizer__header-actions">
          {toolSelector}
          <div className="pdf-organizer__commands" aria-label="Compression commands">
            <span className="pdf-organizer__separator" />
            <button
              type="button"
              className="pdf-organizer__change"
              onClick={onClearAll}
            >
              Change file
            </button>
            <button
              type="button"
              disabled={multipleFiles.length === 0}
              className="pdf-organizer__export"
              onClick={onRunCompress}
            >
              <Sliders aria-hidden="true" />
              <span>Compress {multipleFiles.length > 1 ? `${multipleFiles.length} PDFs` : 'PDF'}</span>
            </button>
          </div>
        </div>
      </EditorCommandBar>

      {/* ── WORKSPACE (SIDEBAR + MAIN STAGE) ── */}
      <div className="pdf-organizer__workspace">
        {/* ── LEFT SIDEBAR (DOCUMENTS & SETTINGS) ── */}
        <EditorSidebar className="pdf-organizer__pages" aria-label="Compression controls">
          <EditorSidebarHeader className="pdf-organizer__pages-heading">
            <div>
              <strong>Compression</strong>
              <small>{multipleFiles.length} ready</small>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(prev => !prev)}
              title={isSidebarCollapsed ? 'Expand document panel' : 'Collapse document panel'}
            >
              {isSidebarCollapsed ? <PanelLeft aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
            </button>
          </EditorSidebarHeader>

          {!isSidebarCollapsed ? (
            <div className="pdf-join-controls flex-1 overflow-y-auto min-h-0 space-y-4">
              <div className="pdf-join-controls__list">
                {multipleFiles.map((item, index) => (
                  <article
                    key={`${item.file.name}:${item.file.size}:${index}`}
                  >
                    <span className="pdf-queue-index">
                      {index + 1}
                    </span>
                    <div>
                      <strong title={item.file.name}>
                        {item.file.name}
                      </strong>
                      <small className="truncate whitespace-nowrap">
                        {item.pageCount ? `${item.pageCount} ${item.pageCount === 1 ? 'page' : 'pages'} · ` : ''}
                        {formatBytes(item.file.size)}
                      </small>
                    </div>
                    <nav aria-label={`Reorder ${item.file.name}`}>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => onMoveQueueItem(index, index - 1)}
                        title="Move up"
                      >
                        <ArrowUp aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={index === multipleFiles.length - 1}
                        onClick={() => onMoveQueueItem(index, index + 1)}
                        title="Move down"
                      >
                        <ArrowDown aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveQueueItem(index)}
                        title="Remove document"
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </nav>
                  </article>
                ))}
              </div>

              <div>
                <label className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 hover:bg-zinc-900/40 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer select-none">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      if (e.target.files?.length) {
                        onFilesSelected(Array.from(e.target.files));
                        e.target.value = '';
                      }
                    }}
                  />
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add more PDFs</span>
                </label>
              </div>

              {/* Compression Configuration */}
              <div className="pt-3 border-t border-white/10 space-y-3">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Compression preset
                  </span>
                  <CompressionPresetSelector
                    value={compressionPreset}
                    onChange={setCompressionPreset}
                  />
                </div>

                <label className="flex items-center justify-between text-xs text-zinc-300 hover:text-white cursor-pointer select-none py-1">
                  <span>Strip metadata</span>
                  <input
                    type="checkbox"
                    checked={removeCompressionMetadata}
                    onChange={event => setRemoveCompressionMetadata(event.target.checked)}
                    className="w-4 h-4 accent-white rounded shrink-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="pdf-sidebar-rail">
              <div className="flex flex-col items-center gap-1.5 w-full">
                {multipleFiles.map((item, index) => (
                  <button
                    key={`${item.file.name}:${item.file.size}:${index}`}
                    type="button"
                    onClick={() => setIsSidebarCollapsed(false)}
                    title={`${index + 1}. ${item.file.name} (${item.pageCount ? `${item.pageCount} ${item.pageCount === 1 ? 'page' : 'pages'} · ` : ''}${formatBytes(item.file.size)})`}
                    className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[11px] font-bold text-zinc-300 hover:text-white hover:border-zinc-600 hover:bg-zinc-800 transition-all cursor-pointer"
                  >
                    {index + 1}
                  </button>
                ))}
                <div className="w-6 h-px bg-white/10 my-1" />
                <label
                  className="w-8 h-8 rounded-lg border border-dashed border-zinc-800 hover:border-zinc-600 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer"
                  title="Add more PDFs"
                >
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      if (e.target.files?.length) {
                        onFilesSelected(Array.from(e.target.files));
                        e.target.value = '';
                      }
                    }}
                  />
                  <Plus className="w-4 h-4" />
                </label>
              </div>
            </div>
          )}
        </EditorSidebar>

        {/* ── MAIN STAGE ── */}
        <main className="pdf-organizer__stage pdf-organizer__stage--clean">
          <section className="pdf-join-preview">
            {/* Header */}
            <div className="audio-preview-heading pdf-preview-heading">
              <div>
                <span>Optimization sequence</span>
                <h2>{sequenceTitle}</h2>
              </div>
              <Layers aria-hidden="true" />
            </div>

            {/* Stats cards */}
            <div className="audio-join-summary pdf-join-summary">
              <article>
                <span>Documents</span>
                <strong>{multipleFiles.length}</strong>
                <small>In compression queue</small>
              </article>
              <article>
                <span>Source size</span>
                <strong>{formatBytes(totalBytes)}</strong>
                <small>Before compression</small>
              </article>
            </div>

            {/* Compact Dropzone */}
            <FileUploader
              accept=".pdf,application/pdf"
              multiple
              compact
              label={multipleFiles.length ? 'Add another document' : 'Select PDF documents'}
              subLabel="Choose files or drop them here"
              onFilesSelected={onFilesSelected}
              maxSizeMB={500}
            />
          </section>
        </main>
      </div>
    </section>
  );
};
