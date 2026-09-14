import React, { useState } from 'react';
import { Download, Eye, Archive, Share2, Check, ArrowRight, X } from 'lucide-react';
import { formatBytes } from '../../../utils/image';
import type { ImageProcessResult } from '../../../utils/image';
import { downloadAll, shareResult, downloadAsZip } from '../../../utils/batch';
import { ResultDownloadButton } from '../../../components/Common/ResultDownloadButton';

export interface ImageBatchResultsProps {
  results: ImageProcessResult[];
  files: File[];
  previewUrls: string[];
  failedFileIndexes: number[];
  onRetryFailed: (indexes: number[]) => void;
}

export const ImageBatchResults: React.FC<ImageBatchResultsProps> = ({
  results,
  files,
  previewUrls,
  failedFileIndexes,
  onRetryFailed,
}) => {
  const [selectedForCompare, setSelectedForCompare] = useState<ImageProcessResult | null>(null);

  const getSavings = (orig: number, res: number) => {
    if (!orig || orig === 0) return 0;
    return Math.max(0, Math.round(((orig - res) / orig) * 100));
  };

  const totalOrig = results.reduce((acc, r) => acc + r.originalSize, 0);
  const totalNew = results.reduce((acc, r) => acc + r.newSize, 0);
  const savedSize = Math.max(0, totalOrig - totalNew);
  const savedPercent = totalOrig > 0 ? Math.round((savedSize / totalOrig) * 100) : 0;

  return (
    <div className="image-batch-results flex-1 overflow-y-auto px-6 pb-6 pt-3 space-y-6 max-w-5xl mx-auto w-full">
      {/* Top Banner Stats Card */}
      <div className="rounded-2xl border border-white/10 bg-[#18191e] p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <Check className="w-3.5 h-3.5" />
              Optimization Complete
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Saved {formatBytes(savedSize)} ({savedPercent}% reduction)
            </h2>
            <p className="text-xs text-zinc-400">
              {results.length} {results.length === 1 ? 'file' : 'files'} compressed from {formatBytes(totalOrig)} to {formatBytes(totalNew)}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => downloadAll(results)}
              className="inline-flex items-center gap-2 bg-white hover:bg-zinc-200 text-zinc-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md cursor-pointer"
            >
              <Download className="w-4 h-4" /> Download All
            </button>
            {results.length > 1 && (
              <button
                type="button"
                onClick={() => downloadAsZip(results, 'optimized-images.zip').catch(console.error)}
                className="inline-flex items-center gap-2 border border-white/15 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 font-semibold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
              >
                <Archive className="w-4 h-4" /> Download ZIP
              </button>
            )}
            {results.length === 1 && (
              <button
                type="button"
                onClick={() => shareResult(results[0]).catch(console.error)}
                className="inline-flex items-center gap-2 border border-white/15 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 font-semibold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Individual Result Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Optimized Results ({results.length})
          </span>
          {failedFileIndexes.length > 0 && (
            <button
              type="button"
              onClick={() => onRetryFailed(failedFileIndexes)}
              className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
            >
              Retry {failedFileIndexes.length} failed
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {results.map((res, idx) => {
            const savings = getSavings(res.originalSize, res.newSize);
            return (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-white/10 bg-[#18191e] hover:border-white/20 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-lg bg-zinc-950 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                    <img
                      src={res.url}
                      alt={res.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white truncate max-w-[280px]" title={res.name}>
                        {res.name}
                      </p>
                      {savings > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                          -{savings}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                      <span className="text-zinc-500 line-through">{formatBytes(res.originalSize)}</span>
                      <ArrowRight className="w-3 h-3 text-zinc-600" />
                      <span className="font-semibold text-zinc-200">{formatBytes(res.newSize)}</span>
                      {res.width > 0 && (
                        <>
                          <span className="text-zinc-600">·</span>
                          <span className="text-zinc-500 font-mono text-[10px]">{res.width} × {res.height}px</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedForCompare(res)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                    title="Compare before and after"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Compare</span>
                  </button>
                  <ResultDownloadButton
                    result={res}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-bold transition-all cursor-pointer shadow-sm"
                    title="Download file"
                  >
                    <span>Download</span>
                  </ResultDownloadButton>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comparison Modal Dialog */}
      {selectedForCompare && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-3xl w-full rounded-2xl border border-white/15 bg-[#18191e] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">{selectedForCompare.name}</h3>
                <span className="text-xs text-zinc-400">Before vs After comparison</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedForCompare(null)}
                className="w-8 h-8 rounded-lg border border-white/10 bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(() => {
                const fileIndex = files.findIndex(f =>
                  selectedForCompare.name.includes(f.name.substring(0, f.name.lastIndexOf('.')))
                );
                const originalUrl = fileIndex !== -1 && previewUrls[fileIndex] ? previewUrls[fileIndex] : '';

                return (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                        <span>Original</span>
                        <span className="font-mono">{formatBytes(selectedForCompare.originalSize)}</span>
                      </div>
                      <div className="aspect-video w-full rounded-xl bg-zinc-950 border border-white/10 overflow-hidden flex items-center justify-center">
                        {originalUrl ? (
                          <img src={originalUrl} alt="Original" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-xs text-zinc-600">Original preview not available</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                        <span>Optimized (-{getSavings(selectedForCompare.originalSize, selectedForCompare.newSize)}%)</span>
                        <span className="font-mono text-white">{formatBytes(selectedForCompare.newSize)}</span>
                      </div>
                      <div className="aspect-video w-full rounded-xl bg-zinc-950 border border-white/10 overflow-hidden flex items-center justify-center">
                        <img src={selectedForCompare.url} alt="Optimized" className="w-full h-full object-contain" />
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="p-4 border-t border-white/10 bg-zinc-950/60 flex items-center justify-end gap-2">
              <ResultDownloadButton
                result={selectedForCompare}
                className="inline-flex items-center gap-2 bg-white hover:bg-zinc-200 text-zinc-950 font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md"
              >
                Download Result
              </ResultDownloadButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
