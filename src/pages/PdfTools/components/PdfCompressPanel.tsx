import React from 'react';
import {
  Trash2 as TrashIcon,
  Sliders
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { FileUploader } from '../../../components/Common/FileUploader';
import { CompressionPresetSelector } from '../../../components/Common/CompressionPresetSelector';
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
}

export const PdfCompressPanel: React.FC<PdfCompressPanelProps> = ({
  multipleFiles,
  compressionPreset,
  setCompressionPreset,
  removeCompressionMetadata,
  setRemoveCompressionMetadata,
  draggedQueueIndex,
  setDraggedQueueIndex,
  onMoveQueueItem,
  onRemoveQueueItem,
  onFilesSelected,
  onClearAll,
  onRunCompress,
}) => {
  return (
    <div className="pdf-compress-workspace flex-1 flex flex-col min-h-0">
      {/* Upload area */}
      <div className="p-3 border-b border-[var(--border-color)]">
        <FileUploader
          accept=".pdf,application/pdf"
          multiple={true}
          label="Add more PDFs"
          subLabel="PDF documents up to 500MB each"
          onFilesSelected={onFilesSelected}
          maxSizeMB={500}
          compact
        />
      </div>

      {/* Selected files list */}
      <div className="p-3 border-b border-[var(--border-color)] flex items-center justify-between">
        <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
          PDF Queue ({multipleFiles.length})
        </span>
        {multipleFiles.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-6 text-[10px] text-zinc-400 hover:text-rose-400 font-semibold px-1.5"
          >
            Clear all
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
        {multipleFiles.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-xs">
            No PDFs uploaded yet. Upload documents above to start compressing.
          </div>
        ) : (
          multipleFiles.map((item, index) => (
            <Card
              key={`${item.file.name}-${index}`}
              draggable
              onDragStart={() => setDraggedQueueIndex(index)}
              onDragOver={event => {
                event.preventDefault();
                if (draggedQueueIndex !== null && draggedQueueIndex !== index) {
                  onMoveQueueItem(draggedQueueIndex, index);
                  setDraggedQueueIndex(index);
                }
              }}
              onDragEnd={() => setDraggedQueueIndex(null)}
              className="p-2 flex items-center gap-2 border-[var(--border-color)] bg-[var(--surface-color)] group hover:border-zinc-700 transition-colors cursor-move"
            >
              <span className="text-xs text-zinc-500 font-mono w-4 text-center">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate" title={item.file.name}>
                  {item.file.name}
                </p>
                <p className="text-[10px] text-zinc-500 font-mono">
                  {formatBytes(item.file.size)} · {item.pageCount || 1} pages
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveQueueItem(index)}
                className="h-7 w-7 p-0 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20"
                aria-label={`Remove ${item.file.name}`}
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </Button>
            </Card>
          ))
        )}
      </div>

      {/* Action Footer */}
      {multipleFiles.length > 0 && (
        <Card className="p-3.5 border-t border-[var(--border-color)] rounded-none bg-[var(--surface-color)] space-y-3 shrink-0">
          <CompressionPresetSelector
            value={compressionPreset}
            onChange={setCompressionPreset}
          />

          <label className="flex items-center justify-between text-xs text-[var(--text-secondary)] cursor-pointer py-1 select-none">
            <span>Strip document metadata</span>
            <input
              type="checkbox"
              checked={removeCompressionMetadata}
              onChange={event => setRemoveCompressionMetadata(event.target.checked)}
              className="w-4 h-4 accent-white shrink-0"
            />
          </label>

          <Button
            onClick={onRunCompress}
            className="w-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold rounded-full h-11 text-xs cursor-pointer shadow-sm"
          >
            <Sliders className="w-4 h-4 mr-1.5" />
            Compress {multipleFiles.length} {multipleFiles.length === 1 ? 'PDF' : 'PDFs'}
          </Button>
        </Card>
      )}
    </div>
  );
};
