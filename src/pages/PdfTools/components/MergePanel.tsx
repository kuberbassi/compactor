import React from 'react';
import {
  List as ListIcon,
  Trash2 as TrashIcon
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { FileUploader } from '../../../components/Common/FileUploader';
import { formatBytes } from '../../../utils/image';
import type { PdfFileInfo } from './LivePdfPreview';

export interface MergePanelProps {
  multipleFiles: PdfFileInfo[];
  draggedQueueIndex: number | null;
  onMoveQueueItem: (from: number, to: number) => void;
  onRemoveQueueItem: (index: number) => void;
  onSetDraggedQueueIndex: (index: number | null) => void;
  onAddFiles: (files: File[]) => void;
  onClearQueue: () => void;
  onRunMerge: () => void;
}

export const MergePanel: React.FC<MergePanelProps> = ({
  multipleFiles,
  draggedQueueIndex,
  onMoveQueueItem,
  onRemoveQueueItem,
  onSetDraggedQueueIndex,
  onAddFiles,
  onClearQueue,
  onRunMerge,
}) => {
  const totalPages = multipleFiles.reduce((sum, item) => sum + (item.pageCount || 1), 0);
  const totalBytes = multipleFiles.reduce((sum, item) => sum + item.file.size, 0);
  const canMerge = multipleFiles.length > 1;

  return (
    <div className="pdf-merge-workspace pdf-mobile-stack grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="md:col-span-2 border-[var(--border-color)] bg-[var(--surface-color)] p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
          <div>
            <span className="text-xs font-bold text-[var(--text-primary)] block">Files Queue ({multipleFiles.length} files)</span>
            <span className="text-[10px] text-zinc-500 font-medium">Drag rows or use ↑ ↓ buttons to reorder merge priority</span>
          </div>
          <Button variant="ghost" onClick={onClearQueue} className="text-rose-500 hover:text-rose-600 text-xs h-7 px-2 cursor-pointer">
            Clear Queue
          </Button>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {multipleFiles.map((info, idx) => (
            <div 
              key={`${info.file.name}:${info.file.size}:${info.file.lastModified}:${idx}`}
              draggable={true}
              onDragStart={(e) => {
                onSetDraggedQueueIndex(idx);
                e.dataTransfer.setData('text/plain', String(idx));
              }}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                if (!isNaN(fromIdx)) {
                  onMoveQueueItem(fromIdx, idx);
                }
                onSetDraggedQueueIndex(null);
              }}
              onDragEnd={() => onSetDraggedQueueIndex(null)}
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
                  onClick={() => onMoveQueueItem(idx, idx - 1)}
                  disabled={idx === 0}
                  title="Move File Up"
                  className="w-7 h-7 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 rounded border border-zinc-800 flex items-center justify-center text-xs transition-colors cursor-pointer"
                >
                  ↑
                </button>
                <button 
                  onClick={() => onMoveQueueItem(idx, idx + 1)}
                  disabled={idx === multipleFiles.length - 1}
                  title="Move File Down"
                  className="w-7 h-7 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 rounded border border-zinc-800 flex items-center justify-center text-xs transition-colors cursor-pointer"
                >
                  ↓
                </button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => onRemoveQueueItem(idx)} 
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 w-7 h-7 rounded-lg ml-1 cursor-pointer"
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
          onFilesSelected={onAddFiles}
          compact
        />
      </Card>

      <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-6 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <h3 className="font-bold text-xs text-[var(--text-primary)] uppercase tracking-wider">Compilation Target</h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Combines all queued file pages sequentially in the exact order listed (#1 &rarr; #{multipleFiles.length}) into a single unified PDF document.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-3">
            <div className="pdf-workflow-stat"><strong>{multipleFiles.length}</strong><span>PDFs</span></div>
            <div className="pdf-workflow-stat"><strong>{totalPages}</strong><span>Pages</span></div>
          </div>
          <p className="text-[10px] text-zinc-500">Combined input: {formatBytes(totalBytes)}</p>
          {!canMerge && <p className="text-xs text-amber-300">Add one more PDF to enable merging.</p>}
        </div>
        <Button 
          onClick={onRunMerge} 
          disabled={!canMerge}
          className="w-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold rounded-full h-11 text-xs cursor-pointer shadow-sm"
        >
          {canMerge ? 'Compile PDF Document' : 'Waiting for 2 PDFs'}
        </Button>
      </Card>
    </div>
  );
};
