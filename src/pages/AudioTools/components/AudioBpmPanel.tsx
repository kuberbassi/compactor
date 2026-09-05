import React from 'react';
import { Disc } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { CustomAudioPlayer } from '../../../components/Common/CustomAudioPlayer';
import type { AudioAnalysisResult } from '../../../utils/audioAnalysis';

export interface AudioBpmPanelProps {
  file: File;
  analyzingBpm: boolean;
  analysisResult: AudioAnalysisResult | null;
  previewUrl: string | null;
  onReset: () => void;
}

export const AudioBpmPanel: React.FC<AudioBpmPanelProps> = ({
  file,
  analyzingBpm,
  analysisResult,
  previewUrl,
  onReset,
}) => {
  return (
    <div className="audio-mode-workbench audio-analysis-workbench audio-optimizer-workbench">
      <Card className="audio-editor-panel audio-analysis-panel audio-optimizer-stage">
        <div className="audio-editor-panel__filebar flex items-center justify-between gap-2 border-b border-[var(--border-color)] pb-3 min-w-0">
          <div className="flex items-center gap-2 truncate min-w-0 flex-1">
            <Disc className="w-4 h-4 text-zinc-400 shrink-0" />
            <span className="text-xs font-bold text-[var(--text-primary)] truncate max-w-[140px] xs:max-w-xs">{file.name}</span>
          </div>
          <Button variant="ghost" onClick={onReset} className="text-rose-400 hover:text-rose-300 text-xs h-7 px-2 font-semibold shrink-0 whitespace-nowrap cursor-pointer">
            <span className="hidden xs:inline">Analyze Another</span>
            <span className="xs:hidden">Reset</span>
          </Button>
        </div>

        {analyzingBpm ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-9 h-9 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-mono font-bold text-zinc-300">Analyzing Pitch Profiles & Onset BPM...</p>
          </div>
        ) : analysisResult ? (
          <div className="space-y-4 sm:space-y-5">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="p-3 sm:p-4 rounded-xl bg-zinc-950/70 border border-[var(--border-color)] text-center space-y-1 min-w-0 flex flex-col items-center justify-center min-h-[90px] sm:min-h-[105px]">
                <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">TEMPO</span>
                <span className="text-2xl sm:text-4xl font-black text-white block truncate">{analysisResult.bpm}</span>
                <span className="text-[9px] sm:text-[10px] font-mono font-bold text-emerald-400 block truncate">BEATS PER MINUTE</span>
              </div>

              <div className="p-3 sm:p-4 rounded-xl bg-zinc-950/70 border border-[var(--border-color)] text-center space-y-1 min-w-0 flex flex-col items-center justify-center min-h-[90px] sm:min-h-[105px]">
                <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">MUSICAL KEY</span>
                <span className="text-lg sm:text-3xl font-black text-white block truncate leading-tight">{analysisResult.key}</span>
                <span className="text-[9px] sm:text-[10px] font-mono font-bold text-indigo-400 block truncate">CAMELOT {analysisResult.camelot}</span>
              </div>
            </div>

            <div className="p-2.5 sm:p-3 bg-zinc-950/50 border border-[var(--border-color)] rounded-xl flex items-center justify-between gap-1 text-center font-mono text-zinc-400">
              <div className="flex-1 min-w-0 px-1">
                <span className="text-zinc-500 block text-[9px] sm:text-[10px] uppercase font-bold truncate">Confidence</span>
                <strong className="text-white text-xs sm:text-sm block truncate">{analysisResult.confidence}%</strong>
              </div>
              <div className="h-6 w-px bg-zinc-800 shrink-0" />
              <div className="flex-1 min-w-0 px-1">
                <span className="text-zinc-500 block text-[9px] sm:text-[10px] uppercase font-bold truncate">Sample Rate</span>
                <strong className="text-white text-xs sm:text-sm block truncate">{analysisResult.sampleRate} Hz</strong>
              </div>
              <div className="h-6 w-px bg-zinc-800 shrink-0" />
              <div className="flex-1 min-w-0 px-1">
                <span className="text-zinc-500 block text-[9px] sm:text-[10px] uppercase font-bold truncate">Scale</span>
                <strong className="text-white text-xs sm:text-sm uppercase block truncate">{analysisResult.mode}</strong>
              </div>
            </div>

            {previewUrl && (
              <CustomAudioPlayer
                src={previewUrl}
                title={file.name}
                subtitle="Track Audio Preview"
              />
            )}
          </div>
        ) : null}
      </Card>
    </div>
  );
};

