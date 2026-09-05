import React from 'react';
import {
  FileText,
  Trash2 as TrashIcon,
  ZoomIn as ZoomIcon,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { formatBytes } from '../../../utils/image';
import type { PdfFileInfo } from './LivePdfPreview';

export interface PageItem {
  id: string;
  originalIndex: number;
  rotation: number;
  thumbnailUrl?: string;
}

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
}

export const PageOrganizer: React.FC<PageOrganizerProps> = ({
  singleFile,
  pagesList,
  onRotatePage,
  onRotateAll,
  onMovePage,
  onDeletePage,
  onPeekPage,
  onReset,
  onRunOrganize,
}) => {
  return (
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
            onClick={() => onRotateAll(-90)} 
            className="h-8 text-[11px] border-[var(--border-color)] text-zinc-300 cursor-pointer"
          >
            Rotate All ↺
          </Button>
          <Button 
            variant="outline" 
            onClick={() => onRotateAll(90)} 
            className="h-8 text-[11px] border-[var(--border-color)] text-zinc-300 cursor-pointer"
          >
            Rotate All ↻
          </Button>
          <Button 
            variant="ghost" 
            onClick={onReset} 
            className="text-rose-500 hover:text-rose-600 text-xs h-8 px-2 cursor-pointer"
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
                onClick={() => onPeekPage(idx)}
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
                  onClick={() => onRotatePage(idx, -90)}
                  title="Rotate Left 90°"
                  className="py-1 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-800 flex items-center justify-center cursor-pointer"
                >
                  ↺
                </button>
                <button 
                  onClick={() => onRotatePage(idx, 90)}
                  title="Rotate Right 90°"
                  className="py-1 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-800 flex items-center justify-center cursor-pointer"
                >
                  ↻
                </button>
                <button 
                  onClick={() => onMovePage(idx, idx - 1)}
                  disabled={idx === 0}
                  title="Move Previous"
                  className="py-1 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed rounded border border-zinc-800 flex items-center justify-center cursor-pointer"
                >
                  <ArrowLeft className="w-2.5 h-2.5" />
                </button>
                <button 
                  onClick={() => onMovePage(idx, idx + 1)}
                  disabled={idx === pagesList.length - 1}
                  title="Move Next"
                  className="py-1 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed rounded border border-zinc-800 flex items-center justify-center cursor-pointer"
                >
                  <ArrowRight className="w-2.5 h-2.5" />
                </button>
              </div>

              <button
                onClick={() => onDeletePage(idx)}
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
        onClick={onRunOrganize}
        disabled={pagesList.length === 0}
        className="w-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold rounded-full h-11 text-xs shadow-sm cursor-pointer"
      >
        Save & Export Organized PDF ({pagesList.length} Pages)
      </Button>
    </Card>
  );
};

