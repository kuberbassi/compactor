import React from 'react';
import { Card, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { CheckCircle, Download, RefreshCw, Archive } from 'lucide-react';
import { formatBytes } from '../../../utils/image';
import { downloadAll, downloadAsZip, shareResult } from '../../../utils/batch';
import type { CompressionResult } from '../pdfToolsConfig';
import type { PdfFileInfo } from './LivePdfPreview';

export interface PdfResultViewsProps {
  resultUrl: string | null;
  resultName: string;
  resultSize: number;
  extractedImages: { pageNumber: number; blob: Blob; url: string }[];
  pdfExportImgFormat: 'png' | 'jpg';
  compressionResults: CompressionResult[];
  multipleFiles: PdfFileInfo[];
  onRetryCompression: (index: number) => void;
  onReset: () => void;
}

export const PdfResultViews: React.FC<PdfResultViewsProps> = ({
  resultUrl,
  resultName,
  resultSize,
  extractedImages,
  pdfExportImgFormat,
  compressionResults,
  multipleFiles,
  onRetryCompression,
  onReset,
}) => {
  return (
    <>
      {/* BULK COMPRESSION RESULTS */}
      {compressionResults.length > 0 && (
        <Card className="max-w-3xl mx-auto border-[var(--border-color)] bg-[var(--surface-color)] p-6 space-y-5">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
            <div>
              <CardTitle className="text-lg font-black text-[var(--text-primary)]">PDF optimization complete</CardTitle>
              <CardDescription className="text-xs text-[var(--text-secondary)] mt-1">
                {compressionResults.filter(result => result.url).length} of {compressionResults.length} documents ready
              </CardDescription>
              {compressionResults.some(result => result.url) && (
                <span className="text-[10px] text-[var(--text-secondary)] mt-1 block">
                  {formatBytes(compressionResults.reduce((total, result) => total + result.sourceSize, 0))} original
                  {' → '}
                  {formatBytes(compressionResults.reduce((total, result) => total + (result.url ? result.outputSize : result.sourceSize), 0))} after optimization
                  {' · saved '}
                  {formatBytes(compressionResults.reduce((total, result) => total + (result.url ? Math.max(0, result.sourceSize - result.outputSize) : 0), 0))}
                </span>
              )}
            </div>
            <Button variant="outline" onClick={onReset} className="rounded-full h-9 text-xs border-[var(--border-color)] cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> New batch
            </Button>
          </div>

          <div className="space-y-2">
            {compressionResults.map((result, index) => {
              const savedBytes = result.sourceSize - result.outputSize;
              const savedPercent = result.sourceSize > 0
                ? Math.max(0, Math.round((savedBytes / result.sourceSize) * 100))
                : 0;
              return (
                <div key={`${result.sourceName}:${result.sourceSize}:${index}`} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-zinc-950/40 border border-[var(--border-color)] rounded-xl">
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block text-xs font-bold truncate text-[var(--text-primary)]">{result.outputName}</span>
                    {result.url ? (
                      <span className="text-[10px] text-[var(--text-secondary)] mt-0.5 block">
                        {formatBytes(result.sourceSize)} → {formatBytes(result.outputSize)}
                        {savedPercent > 0 ? ` • ${savedPercent}% smaller` : ' • already fully optimized'}
                      </span>
                    ) : (
                      <>
                        <span className="text-[10px] text-rose-400 mt-0.5 block truncate" title={result.error}>
                          Failed: {result.error}
                        </span>
                        <button type="button" onClick={() => onRetryCompression(index)} className="text-[10px] text-white underline mt-1 cursor-pointer">
                          Retry this file
                        </button>
                      </>
                    )}
                  </div>
                  {result.url && (
                    <div className="batch-result-actions">
                      <button
                        type="button"
                        onClick={() => {
                          const source = multipleFiles.find(item => item.file.name === result.sourceName)?.file;
                          if (!source || !result.url) return;
                          fetch(result.url).then(response => response.blob()).then(blob =>
                            shareResult({ url: result.url!, name: result.outputName, blob })
                          ).catch(console.error);
                        }}
                        className="batch-action batch-action--secondary cursor-pointer"
                      >
                        Share
                      </button>
                      <a
                        href={result.url}
                        download={result.outputName}
                        className="batch-action batch-action--primary cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {compressionResults.some(result => result.url) && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => downloadAll(compressionResults.flatMap(result =>
                  result.url ? [{ url: result.url, name: result.outputName }] : []
                ))}
                className="flex-1 rounded-full h-11 text-xs font-bold cursor-pointer"
              >
                <Download className="w-4 h-4 mr-2" /> Download all completed PDFs
              </Button>
              {compressionResults.filter(r => r.url).length > 1 && (
                <Button
                  variant="outline"
                  onClick={() => downloadAsZip(
                    compressionResults.flatMap(r => r.url ? [{ url: r.url, name: r.outputName }] : []),
                    'compactor-compressed-pdfs.zip'
                  ).catch(console.error)}
                  className="rounded-full h-11 text-xs font-bold border-zinc-700 hover:border-zinc-500 cursor-pointer"
                >
                  <Archive className="w-4 h-4 mr-2" /> Download as ZIP
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {/* EXTRACTED IMAGES GRID RESULT */}
      {extractedImages.length > 0 && (
        <Card className="max-w-4xl mx-auto border-[var(--border-color)] bg-[var(--surface-color)] p-6 space-y-5">
          <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
            <div>
              <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider block">Extracted PDF Page Images ({extractedImages.length} Pages)</span>
              <span className="text-[10px] text-zinc-500 font-medium">300 DPI high-resolution page rendering</span>
            </div>
            <Button variant="ghost" onClick={onReset} className="text-xs h-7 px-2 text-zinc-400 cursor-pointer">Clear</Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[460px] overflow-y-auto pr-1">
            {extractedImages.map((img) => (
              <div key={img.pageNumber} className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-2.5 flex flex-col justify-between items-center gap-2">
                <span className="text-[10px] font-bold text-zinc-400">Page {img.pageNumber}</span>
                <img src={img.url} alt={`Page ${img.pageNumber}`} className="w-full aspect-[1/1.3] object-contain bg-white rounded border border-zinc-800" />
                <a 
                  href={img.url} 
                  download={`page_${img.pageNumber}.${pdfExportImgFormat}`}
                  className="w-full py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-bold rounded flex items-center justify-center gap-1 border border-zinc-700 cursor-pointer"
                >
                  <Download className="w-3 h-3" /> Save P.{img.pageNumber}
                </a>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => downloadAll(extractedImages.map(image => ({
                url: image.url,
                name: `page_${image.pageNumber}.${pdfExportImgFormat}`,
              })))}
              className="flex-1 rounded-full h-11 text-xs font-bold cursor-pointer"
            >
              <Download className="w-4 h-4 mr-2" /> Download all {extractedImages.length} images
            </Button>
            {extractedImages.length > 1 && (
              <Button
                variant="outline"
                onClick={() => downloadAsZip(
                  extractedImages.map(image => ({
                    url: image.url,
                    name: `page_${image.pageNumber}.${pdfExportImgFormat}`,
                  })),
                  'pdf-extracted-images.zip'
                ).catch(console.error)}
                className="rounded-full h-11 text-xs font-bold border-zinc-700 hover:border-zinc-500 cursor-pointer"
              >
                <Archive className="w-4 h-4 mr-2" /> Download as ZIP
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* SINGLE FILE EXPORT RESULT */}
      {resultUrl && extractedImages.length === 0 && (
        <div className="max-w-xl mx-auto space-y-6">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] shadow-sm text-center p-6 space-y-5">
            <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 rounded-full flex items-center justify-center mx-auto shadow-inner border border-[var(--border-color)]">
              <CheckCircle className="w-7 h-7" />
            </div>

            <div>
              <CardTitle className="text-xl font-black text-[var(--text-primary)]">Document Export Ready!</CardTitle>
              <CardDescription className="text-xs text-[var(--text-secondary)] mt-1">Your compiled file has been generated and saved.</CardDescription>
            </div>

            <div className="flex items-center gap-3 p-4 bg-zinc-950/40 border border-[var(--border-color)] rounded-xl text-left">
              <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200 font-bold text-xs uppercase flex-shrink-0">
                {resultName.endsWith('.md') ? 'MD' : 'PDF'}
              </div>
              <div className="truncate flex-1 min-w-0">
                <span className="block text-xs font-bold truncate text-[var(--text-primary)]">{resultName}</span>
                <span className="text-[10px] text-[var(--text-secondary)] uppercase mt-0.5 block font-semibold">
                  Output Size: {formatBytes(resultSize)}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
              <a 
                href={resultUrl} 
                download={resultName}
                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-zinc-200 text-zinc-950 font-bold px-6 py-3 rounded-full text-xs shadow-sm cursor-pointer transition-all active:scale-95"
              >
                <Download className="w-4 h-4" /> Download Export File
              </a>
              <Button 
                variant="outline" 
                onClick={onReset}
                className="rounded-full h-10 text-xs border-[var(--border-color)] cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Process Another Document
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
};

