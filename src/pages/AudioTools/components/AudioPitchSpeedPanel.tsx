import React from 'react';
import { Sliders, Minus, Plus, RotateCcw, Zap } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { CustomAudioPlayer } from '../../../components/Common/CustomAudioPlayer';

export interface AudioPitchSpeedPanelProps {
  file: File;
  pitchSemitones: number;
  setPitchSemitones: (st: number | ((prev: number) => number)) => void;
  speedRatio: number;
  setSpeedRatio: (ratio: number | ((prev: number) => number)) => void;
  analyzingBpm: boolean;
  transposedKey: { root: string; mode: string };
  currentBpm: number | null;
  previewUrl: string | null;
  onReset: () => void;
  onRunProcess: () => void;
}

export const AudioPitchSpeedPanel: React.FC<AudioPitchSpeedPanelProps> = ({
  file,
  pitchSemitones,
  setPitchSemitones,
  speedRatio,
  setSpeedRatio,
  analyzingBpm,
  transposedKey,
  currentBpm,
  previewUrl,
  onReset,
  onRunProcess,
}) => {
  return (
    <div className="audio-mode-workbench audio-pitch-workbench w-full max-w-2xl mx-auto space-y-4 sm:space-y-6">
      <Card className="audio-editor-panel audio-pitch-panel border-zinc-800/80 bg-[#12121a] p-4 sm:p-6 space-y-5 sm:space-y-6 rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800/60 pb-3 min-w-0">
          <div className="flex items-center gap-2 truncate min-w-0 flex-1">
            <Sliders className="w-4 h-4 text-zinc-300 shrink-0" />
            <span className="text-xs font-bold text-white truncate max-w-[140px] xs:max-w-xs">{file.name}</span>
          </div>
          <Button variant="ghost" onClick={onReset} className="text-rose-400 hover:text-rose-300 text-xs h-7 px-2 font-semibold shrink-0 cursor-pointer">
            Remove
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-8 space-y-6">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 font-bold uppercase tracking-wider">PITCH</span>
                  {pitchSemitones !== 0 && (
                    <button
                      type="button"
                      onClick={() => setPitchSemitones(0)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 bg-indigo-950/60 border border-indigo-800/60 px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors"
                      title="Reset Pitch to 0 semitones"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPitchSemitones(prev => Math.max(-12, prev - 1))}
                    className="w-5 h-5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center cursor-pointer transition-colors"
                    title="Decrease 1 semitone"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-indigo-300 font-extrabold text-sm min-w-[3.2rem] text-center font-mono">
                    {pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones}
                    <span className="text-[10px] text-indigo-400 font-normal ml-0.5">st</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPitchSemitones(prev => Math.min(12, prev + 1))}
                    className="w-5 h-5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center cursor-pointer transition-colors"
                    title="Increase 1 semitone"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="relative flex items-center">
                <input 
                  type="range" 
                  min="-12" 
                  max="12" 
                  step="1"
                  value={pitchSemitones}
                  onDoubleClick={() => setPitchSemitones(0)}
                  onChange={(e) => setPitchSemitones(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500 h-2 bg-zinc-800/80 rounded-lg appearance-none cursor-pointer hover:bg-zinc-800 transition-colors"
                />
              </div>

              <div className="grid grid-cols-7 gap-1 pt-0.5 w-full">
                {[-12, -2, -1, 0, 1, 2, 12].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setPitchSemitones(st)}
                    className={`w-full px-0.5 py-1 rounded text-[10px] sm:text-xs font-mono font-semibold transition-all cursor-pointer flex items-center justify-center ${
                      pitchSemitones === st
                        ? 'bg-indigo-600 text-white shadow-sm font-bold'
                        : 'bg-zinc-900/80 border border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    {st === 0 ? '0' : st > 0 ? `+${st}` : st}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 font-bold uppercase tracking-wider">SPEED</span>
                  {speedRatio !== 1.0 && (
                    <button
                      type="button"
                      onClick={() => setSpeedRatio(1.0)}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors"
                      title="Reset Speed to 1.00x"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSpeedRatio(prev => Math.max(0.5, Math.round((prev - 0.05) * 100) / 100))}
                    className="w-5 h-5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center cursor-pointer transition-colors"
                    title="Decrease speed by 0.05x"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-emerald-300 font-extrabold text-sm min-w-[3.5rem] text-center font-mono">
                    {speedRatio.toFixed(2)}x
                  </span>
                  <button
                    type="button"
                    onClick={() => setSpeedRatio(prev => Math.min(2.0, Math.round((prev + 0.05) * 100) / 100))}
                    className="w-5 h-5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center cursor-pointer transition-colors"
                    title="Increase speed by 0.05x"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="relative flex items-center">
                <input 
                  type="range" 
                  min="0.5" 
                  max="2.0" 
                  step="0.05"
                  value={speedRatio}
                  onDoubleClick={() => setSpeedRatio(1.0)}
                  onChange={(e) => setSpeedRatio(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-2 bg-zinc-800/80 rounded-lg appearance-none cursor-pointer hover:bg-zinc-800 transition-colors"
                />
              </div>

              <div className="grid grid-cols-6 gap-1 pt-0.5 w-full">
                {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setSpeedRatio(spd)}
                    className={`w-full px-0.5 py-1 rounded text-[10px] sm:text-xs font-mono font-semibold transition-all cursor-pointer flex items-center justify-center ${
                      Math.abs(speedRatio - spd) < 0.01
                        ? 'bg-emerald-600 text-white shadow-sm font-bold'
                        : 'bg-zinc-900/80 border border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    {spd.toFixed(2)}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-1 gap-2.5 sm:gap-3">
            <div className="p-3 sm:p-4 bg-zinc-950/90 border border-zinc-800/90 rounded-xl text-center space-y-1 flex flex-col items-center justify-center min-h-[90px] sm:min-h-[105px]">
              <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">KEY</span>
              {analyzingBpm ? (
                <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto my-2" />
              ) : (
                <div className="flex flex-col items-center justify-center leading-none my-0.5">
                  <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">{transposedKey.root}</span>
                  <span className="text-[10px] sm:text-xs font-bold text-indigo-400 font-mono mt-0.5 uppercase tracking-wider">{transposedKey.mode}</span>
                </div>
              )}
            </div>

            <div className="p-3 sm:p-4 bg-zinc-950/90 border border-zinc-800/90 rounded-xl text-center space-y-1 flex flex-col items-center justify-center min-h-[90px] sm:min-h-[105px]">
              <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">BPM</span>
              {analyzingBpm ? (
                <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto my-1" />
              ) : currentBpm !== null ? (
                <div className="flex flex-col items-center justify-center leading-none my-0.5">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-400 block font-mono">{currentBpm}</span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-emerald-500/80 font-mono mt-0.5 uppercase tracking-wider">BEATS / MIN</span>
                </div>
              ) : (
                <span className="text-xl font-black text-zinc-600 block font-mono">—</span>
              )}
            </div>
          </div>
        </div>

        {previewUrl && (
          <div className="space-y-1.5 pt-3 border-t border-zinc-800/60">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">Live Pitch & Speed Audio Preview</span>
            <CustomAudioPlayer
              src={previewUrl}
              file={file}
              title={file.name}
              subtitle={`${pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones} Semitones • ${speedRatio.toFixed(2)}x Speed`}
              pitchSemitones={pitchSemitones}
              speedRatio={speedRatio}
            />
          </div>
        )}

        <Button 
          onClick={onRunProcess} 
          className="w-full h-11 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md cursor-pointer transition-all"
        >
          <Zap className="w-4 h-4 mr-2 fill-current" />
          <span>Apply Pitch & Speed Changes</span>
        </Button>
      </Card>
    </div>
  );
};

