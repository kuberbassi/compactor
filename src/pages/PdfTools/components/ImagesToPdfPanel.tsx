import React from 'react';
import {
  Trash2 as TrashIcon,
  ZoomIn as ZoomIcon,
  Palette as FilterIcon
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { FileUploader } from '../../../components/Common/FileUploader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import type { PdfFileInfo } from './LivePdfPreview';

export interface ImagesToPdfPanelProps {
  multipleFiles: PdfFileInfo[];
  imgFilter: string;
  setImgFilter: (filter: any) => void;
  imgOrientation: 'portrait' | 'landscape' | 'auto';
  setImgOrientation: (orientation: 'portrait' | 'landscape' | 'auto') => void;
  imgPageSize: 'fit' | 'a4' | 'letter';
  setImgPageSize: (size: 'fit' | 'a4' | 'letter') => void;
  imgMargin: 'none' | 'small' | 'big';
  setImgMargin: (margin: 'none' | 'small' | 'big') => void;
  onMoveItem: (from: number, to: number) => void;
  onRemoveItem: (index: number) => void;
  onPeekImage: (index: number) => void;
  onAddFiles: (files: File[]) => void;
  onClearAll: () => void;
  onRunConvert: () => void;
}

export const ImagesToPdfPanel: React.FC<ImagesToPdfPanelProps> = ({
  multipleFiles,
  imgFilter,
  setImgFilter,
  imgOrientation,
  setImgOrientation,
  imgPageSize,
  setImgPageSize,
  imgMargin,
  setImgMargin,
  onMoveItem,
  onRemoveItem,
  onPeekImage,
  onAddFiles,
  onClearAll,
  onRunConvert,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <Card className="lg:col-span-8 border-[var(--border-color)] bg-[var(--surface-color)] p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
          <div>
            <span className="text-xs font-bold text-[var(--text-primary)] block">Uploaded Images ({multipleFiles.length} files)</span>
            <span className="text-[10px] text-zinc-500 font-medium">Reorder image sequence or click cards to view full resolution</span>
          </div>
          <Button variant="ghost" onClick={onClearAll} className="text-rose-500 hover:text-rose-600 text-xs h-7 px-2 cursor-pointer">
            Clear All
          </Button>
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
                    onClick={() => onRemoveItem(idx)}
                    className="text-rose-400 hover:text-rose-300 p-0.5 rounded hover:bg-rose-950/30 transition-colors cursor-pointer"
                    title="Remove image"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div 
                  onClick={() => onPeekImage(idx)}
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
                    onClick={() => onMoveItem(idx, idx - 1)}
                    disabled={idx === 0}
                    className="py-1 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed rounded border border-zinc-800 flex items-center justify-center cursor-pointer"
                  >
                    &larr; Prev
                  </button>
                  <button
                    onClick={() => onMoveItem(idx, idx + 1)}
                    disabled={idx === multipleFiles.length - 1}
                    className="py-1 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed rounded border border-zinc-800 flex items-center justify-center cursor-pointer"
                  >
                    Next &rarr;
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
          onFilesSelected={onAddFiles}
        />
      </Card>

      <Card className="lg:col-span-4 border-[var(--border-color)] bg-[var(--surface-color)] p-6 space-y-5">
        <div className="border-b border-[var(--border-color)] pb-3">
          <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider block">Image to PDF Options</span>
          <span className="text-[10px] text-zinc-500 font-medium">Customize layout, orientation & document scan filters</span>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block flex items-center gap-1.5">
            <FilterIcon className="w-3.5 h-3.5 text-white" /> Document Filter
          </label>
          <Select value={imgFilter === 'camscanner' ? 'smart-scan' : imgFilter} onValueChange={(val: any) => setImgFilter(val)}>
            <SelectTrigger className="w-full h-9 text-xs bg-zinc-950 border border-[var(--border-color)] font-semibold truncate">
              <SelectValue>
                {imgFilter === 'smart-scan' || imgFilter === 'camscanner' ? 'High Contrast (Boost Text & Clean)' :
                 imgFilter === 'whiteboard' ? 'Whiteboard Clean (High Contrast B&W)' :
                 imgFilter === 'bw' ? 'B&W Binary Document Scan' :
                 imgFilter === 'vibrant' ? 'Vibrant Diagram Scan' : 'Original Photo (No Filter)'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="smart-scan">High Contrast (Boost Text & Clean)</SelectItem>
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
          onClick={onRunConvert} 
          className="w-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold rounded-full h-11 text-xs cursor-pointer shadow-sm mt-2"
        >
          Convert to PDF Document &rarr;
        </Button>
      </Card>
    </div>
  );
};
