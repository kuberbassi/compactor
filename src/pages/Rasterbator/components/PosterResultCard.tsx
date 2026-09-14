import React from 'react';
import { Card, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { CheckCircle, Printer as PrinterIcon, RefreshCw } from 'lucide-react';
import { ResultDownloadButton } from '../../../components/Common/ResultDownloadButton';

export interface PosterResultCardProps {
  resultUrl: string;
  resultName: string;
  columns: number;
  rows: number;
  pageSize: string;
  posterMeterW: string;
  posterMeterH: string;
  onReset: () => void;
}

export const PosterResultCard: React.FC<PosterResultCardProps> = ({
  resultUrl,
  resultName,
  columns,
  rows,
  pageSize,
  posterMeterW,
  posterMeterH,
  onReset,
}) => {
  return (
    <div className="w-full max-w-xl mx-auto">
      <Card className="border-[var(--border-color)] bg-[var(--surface-color)] shadow-xl text-center p-8 sm:p-10 space-y-6 rounded-2xl">
        <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 rounded-full flex items-center justify-center mx-auto shadow-inner border border-[var(--border-color)]">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>

        <div className="space-y-1.5">
          <CardTitle className="text-2xl font-black text-[var(--text-primary)]">Poster Package Ready!</CardTitle>
          <CardDescription className="text-xs text-[var(--text-secondary)]">Multi-page vector PDF compiled with precision crop guides.</CardDescription>
        </div>

        <div className="flex items-center gap-3.5 p-4 bg-zinc-950/30 border border-[var(--border-color)] rounded-xl text-left">
          <div className="p-3 bg-zinc-900/40 dark:bg-white/5 border border-[var(--border-color)] rounded-lg shrink-0">
            <PrinterIcon className="w-6 h-6 text-[var(--text-primary)]" />
          </div>
          <div className="truncate flex-1 min-w-0">
            <span className="block text-xs font-bold truncate text-[var(--text-primary)]">{resultName}</span>
            <span className="text-[10px] text-[var(--text-secondary)] uppercase mt-0.5 block font-semibold">
              {columns}×{rows} Grid Poster ({columns * rows} {pageSize} Sheets) &bull; {posterMeterW}m × {posterMeterH}m
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
          <ResultDownloadButton
            result={{ url: resultUrl, name: resultName }}
            className="inline-flex items-center justify-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-black px-6 py-3.5 rounded-full text-xs shadow-sm cursor-pointer transition-all hover:scale-[1.02]"
          >
            Download Poster PDF
          </ResultDownloadButton>
          <Button variant="outline" onClick={onReset} className="rounded-full h-11 px-5 text-xs border-[var(--border-color)] cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Create Another Poster
          </Button>
        </div>
      </Card>
    </div>
  );
};
