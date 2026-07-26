import React, { useState, useEffect, useRef } from 'react';
import { FileUploader } from '../../components/Common/FileUploader';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { ToolHeader } from '../../components/Common/ToolHeader';
import { TrimTimeline } from '../../components/Common/TrimTimeline';
import type { TrimSegment } from '../../components/Common/TrimTimeline';
import { CustomAudioPlayer } from '../../components/Common/CustomAudioPlayer';

import { compressAudio, getFFmpeg, terminateFFmpeg } from '../../utils/ffmpeg';
import { formatBytes } from '../../utils/image';
import { analyzeAudioBPMAndKey } from '../../utils/audioAnalysis';
import type { AudioAnalysisResult } from '../../utils/audioAnalysis';
import { joinAudioFiles } from '../../utils/audioJoiner';
import { processPitchAndSpeed } from '../../utils/audioPitchSpeed';

import { 
  Music, Download, RefreshCw, CheckCircle, 
  Disc, Sliders, Layers, ArrowUp, ArrowDown, Trash2, Zap, Plus, Minus, RotateCcw
} from 'lucide-react';
import { Switch } from '../../components/ui/switch';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

interface AudioToolsProps {
  mode?: string;
  onGoHome: () => void;
  onUploadSuccess: () => void;
}

const AUDIO_TOOLS_CONFIG = [
  { id: 'audio-optimizer', label: 'Compress Audio', shortLabel: 'Compress', desc: 'Trim a track, reduce file size & transcode audio formats', icon: Music },
  { id: 'audio-joiner', label: 'Audio Joiner', shortLabel: 'Joiner', desc: 'Merge multiple audio files together into a single track', icon: Layers },
  { id: 'audio-bpm-finder', label: 'Key & BPM Finder', shortLabel: 'Key/BPM', desc: 'Detect musical key, tempo (BPM) & Camelot wheel code', icon: Disc },
  { id: 'audio-pitch-speed', label: 'Pitch & Speed', shortLabel: 'Pitch/Speed', desc: 'Transpose key pitch (-12 to +12) and adjust tempo (0.5x to 2.0x)', icon: Sliders },
];

function transposeKeyDisplay(baseKey: string | null, semitones: number): { root: string; mode: string } {
  if (!baseKey) {
    const pitchNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
    const idx = ((0 + semitones) % 12 + 12) % 12;
    return { root: pitchNames[idx], mode: 'major' };
  }

  const parts = baseKey.trim().split(/\s+/);
  const rawRoot = parts[0] || 'C';
  const modeStr = parts[1] || 'Major';
  const isMinor = modeStr.toLowerCase() === 'minor';

  const pitchNamesMajor = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  const pitchNamesMinor = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'];

  const flatToIdx: Record<string, number> = {
    'C': 0, 'C#': 1, 'C♯': 1, 'Db': 1, 'D♭': 1,
    'D': 2, 'D#': 3, 'D♯': 3, 'Eb': 3, 'E♭': 3,
    'E': 4,
    'F': 5, 'F#': 6, 'F♯': 6, 'Gb': 6, 'G♭': 6,
    'G': 7, 'G#': 8, 'G♯': 8, 'Ab': 8, 'A♭': 8,
    'A': 9, 'A#': 10, 'A♯': 10, 'Bb': 10, 'B♭': 10,
    'B': 11
  };

  const baseIdx = flatToIdx[rawRoot] !== undefined ? flatToIdx[rawRoot] : 0;
  const targetIdx = ((baseIdx + semitones) % 12 + 12) % 12;
  const pitchNames = isMinor ? pitchNamesMinor : pitchNamesMajor;
  const rootDisplay = pitchNames[targetIdx];

  return {
    root: rootDisplay,
    mode: isMinor ? 'minor' : 'major',
  };
}

export const AudioTools: React.FC<AudioToolsProps> = ({ mode = 'audio-optimizer', onGoHome, onUploadSuccess }) => {
  const [activeTool, setActiveTool] = useState<string>(mode);

  useEffect(() => {
    if (mode) setActiveTool(mode);
  }, [mode]);

  // Single File State
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // Multi-File Joiner State
  const [joinFiles, setJoinFiles] = useState<File[]>([]);

  // Execution & Processing State
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  // Trim State (for audio-optimizer)
  const [enableTrim, setEnableTrim] = useState(false);
  const [trimSegments, setTrimSegments] = useState<TrimSegment[]>([]);
  const [trimCompileMode, setTrimCompileMode] = useState<'keep-selected' | 'cut-selected'>('keep-selected');
  const [bitrate, setBitrate] = useState('128k');
  const [format, setFormat] = useState('mp3');
  const [audioDuration, setAudioDuration] = useState(0);

  // Key & BPM Finder State
  const [analysisResult, setAnalysisResult] = useState<AudioAnalysisResult | null>(null);
  const [analyzingBpm, setAnalyzingBpm] = useState(false);

  // Pitch & Speed State
  const [pitchSemitones, setPitchSemitones] = useState<number>(0);
  const [speedRatio, setSpeedRatio] = useState<number>(1.0);

  // Result State
  const [result, setResult] = useState<{
    url: string;
    name: string;
    blob: Blob;
    originalSize: number;
    newSize: number;
  } | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);
  const addTracksInputRef = useRef<HTMLInputElement>(null);

  // Set Preview URL for loaded track
  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      setAudioDuration(0);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    const tempAudio = new Audio(url);
    tempAudio.onloadedmetadata = () => setAudioDuration(tempAudio.duration);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    return () => {
      terminateFFmpeg().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleLog = (message: string) => {
    setLogs((prev) => [...prev.slice(-100), message]);
    if (message.includes('Setting')) {
      setStatusText(message);
    }
  };

  const reset = () => {
    setFile(null);
    setJoinFiles([]);
    setResult(null);
    setProgress(0);
    setLogs([]);
    setAudioDuration(0);
    setEnableTrim(false);
    setAnalysisResult(null);
    setPitchSemitones(0);
    setSpeedRatio(1.0);
  };

  // Mode Handlers
  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0) return;
    if (activeTool === 'audio-joiner') {
      setJoinFiles((prev) => [...prev, ...files]);
    } else {
      setFile(files[0]);
      setResult(null);
      setAnalysisResult(null);

      // Auto-analyze key & BPM for Pitch & Speed and Key Finder
      if (activeTool === 'audio-bpm-finder' || activeTool === 'audio-pitch-speed') {
        runBPMAnalysis(files[0]);
      }
    }
  };

  // Run BPM & Key Analysis
  const runBPMAnalysis = async (targetFile: File) => {
    setAnalyzingBpm(true);
    setStatusText('Analyzing waveform, BPM & pitch profile...');
    try {
      const res = await analyzeAudioBPMAndKey(targetFile);
      setAnalysisResult(res);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
    } finally {
      setAnalyzingBpm(false);
    }
  };

  // Run Audio Processing
  const startAudioProcessing = async () => {
    if (activeTool === 'audio-joiner') {
      if (joinFiles.length < 2) {
        alert('Please upload at least 2 audio files to join.');
        return;
      }
      setProcessing(true);
      setProgress(10);
      setStatusText('Joining audio tracks 100% client-side...');
      try {
        const joined = await joinAudioFiles(joinFiles, (pct) => setProgress(pct));
        const totalOrig = joinFiles.reduce((acc, f) => acc + f.size, 0);
        setResult({
          url: joined.url,
          name: `joined_audio_${Date.now()}.wav`,
          blob: joined.blob,
          originalSize: totalOrig,
          newSize: joined.totalSize,
        });
        onUploadSuccess();
      } catch (e: any) {
        console.error(e);
        alert(`Joining failed: ${e.message || e}`);
      } finally {
        setProcessing(false);
      }
      return;
    }

    if (activeTool === 'audio-pitch-speed') {
      if (!file) return;
      if (pitchSemitones === 0 && speedRatio === 1.0) {
        alert('No changes applied — adjust pitch or speed before exporting.');
        return;
      }
      setProcessing(true);
      setProgress(5);
      const pitchLabel = pitchSemitones !== 0 ? `${pitchSemitones > 0 ? '+' : ''}${pitchSemitones}st` : null;
      const speedLabel = speedRatio !== 1.0 ? `${speedRatio.toFixed(2)}x` : null;
      const changeDesc = [pitchLabel, speedLabel].filter(Boolean).join(' ');
      setStatusText(`Applying ${changeDesc} via Rubber Band WASM — processing offline...`);
      try {
        const processed = await processPitchAndSpeed(
          file,
          { pitchSemitones, speedRatio },
          (pct) => setProgress(pct)
        );
        const pitchSuffix = pitchSemitones !== 0 ? `_pitch${pitchSemitones > 0 ? '+' : ''}${pitchSemitones}` : '';
        const speedSuffix = speedRatio !== 1.0 ? `_${speedRatio.toFixed(2)}x` : '';
        setResult({
          url: processed.url,
          name: `${file.name.replace(/\.[^/.]+$/, '')}${pitchSuffix}${speedSuffix}.wav`,
          blob: processed.blob,
          originalSize: file.size,
          newSize: processed.blob.size,
        });
        onUploadSuccess();
      } catch (e: any) {
        console.error(e);
        alert(`Pitch/Speed change failed: ${e.message || e}`);
      } finally {
        setProcessing(false);
      }
      return;
    }

    // Default: audio-optimizer (Compress Audio)
    if (!file) return;

    setProcessing(true);
    setProgress(0);
    setLogs([]);
    setStatusText('Warming up WebAssembly pipeline...');

    try {
      await getFFmpeg(handleLog, setProgress);
      const config = {
        bitrate,
        format,
        segments: enableTrim ? trimSegments : undefined,
        compileMode: enableTrim ? trimCompileMode : undefined,
        duration: audioDuration
      };

      const compressResult = await compressAudio(file, config, handleLog, setProgress);
      setResult(compressResult);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setLogs((prev) => [...prev, `ERROR: ${e.message || e}`]);
      alert(`Processing failed: ${e.message || 'Make sure your browser supports SharedArrayBuffer.'}`);
    } finally {
      setProcessing(false);
    }
  };

  const getToolInfo = () => {
    return AUDIO_TOOLS_CONFIG.find(t => t.id === activeTool) || AUDIO_TOOLS_CONFIG[0];
  };

  const currentToolInfo = getToolInfo();
  const transposedKey = transposeKeyDisplay(analysisResult?.key || null, pitchSemitones);
  const currentBpm = analysisResult ? Math.round(analysisResult.bpm * speedRatio) : null;

  return (
    <div className="w-full tool-layout space-y-4 sm:space-y-6">
      <ToolHeader 
        title={currentToolInfo.label} 
        description={currentToolInfo.desc} 
        icon={currentToolInfo.icon} 
        onGoHome={() => {
          if (file || joinFiles.length > 0 || result || processing) {
            reset();
          } else {
            onGoHome();
          }
        }} 
      />

      {/* Top Audio Sub-Tool Navigation Bar matching VideoCompressor reference */}
      {!processing && !result && (
        <div className="w-full flex justify-center mt-1 mb-3 sm:mb-4 px-1">
          <div 
            className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-sm w-full max-w-full sm:w-auto overflow-x-auto no-scrollbar"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {AUDIO_TOOLS_CONFIG.map((t) => {
              const isActive = activeTool === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveTool(t.id);
                    reset();
                  }}
                  className={`flex-1 sm:flex-none px-2 sm:px-3.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 min-h-[36px] flex items-center justify-center ${
                    isActive
                      ? 'bg-zinc-800 text-white font-extrabold shadow-sm border border-zinc-700'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="inline sm:hidden">{t.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MODE 1: AUDIO JOINER SETUP ── */}
      {activeTool === 'audio-joiner' && !result && !processing && (
        <div className="w-full max-w-2xl mx-auto space-y-4 sm:space-y-6">
          {joinFiles.length === 0 ? (
            <FileUploader 
              accept="audio/*"
              label="Upload Audio Tracks to Merge"
              subLabel="Drag & drop multiple audio tracks (MP3, WAV, AAC, M4A, FLAC)"
              onFilesSelected={handleFilesSelected}
              multiple={true}
              maxSizeMB={Infinity}
            />
          ) : (
            <div className="p-3 bg-zinc-950/60 border border-[var(--border-color)] rounded-xl flex items-center justify-between min-w-0 gap-2">
              <span className="text-xs text-zinc-400 font-medium truncate pr-1 min-w-0 flex-1">Add more audio files to queue...</span>
              <input
                ref={addTracksInputRef}
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    handleFilesSelected(Array.from(e.target.files));
                  }
                }}
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => addTracksInputRef.current?.click()}
                className="h-8 text-xs font-semibold shrink-0 border-[var(--border-color)]"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span className="hidden xs:inline">Add Tracks</span>
                <span className="xs:hidden">Add</span>
              </Button>
            </div>
          )}

          {joinFiles.length > 0 && (
            <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-4 sm:p-6 space-y-4 sm:space-y-5 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Audio Queue ({joinFiles.length} Tracks)
                </span>
                <Button variant="ghost" onClick={() => setJoinFiles([])} className="text-rose-400 hover:text-rose-300 text-xs h-7 px-2 font-semibold">
                  Clear All
                </Button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {joinFiles.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-zinc-950/60 border border-[var(--border-color)] text-xs text-[var(--text-primary)] min-w-0 gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 truncate flex-1 min-w-0 pr-1">
                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-[10px] flex items-center justify-center font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1 truncate">
                        <span className="truncate font-semibold text-xs block max-w-[140px] xs:max-w-xs">{f.name}</span>
                        <span className="text-[10px] text-zinc-500 font-mono block sm:hidden">{formatBytes(f.size)}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono shrink-0 hidden sm:inline">{formatBytes(f.size)}</span>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      {idx > 0 && (
                        <Button 
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const copy = [...joinFiles];
                            [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
                            setJoinFiles(copy);
                          }}
                          className="h-7 w-7 text-zinc-400 hover:text-white"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {idx < joinFiles.length - 1 && (
                        <Button 
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const copy = [...joinFiles];
                            [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
                            setJoinFiles(copy);
                          }}
                          className="h-7 w-7 text-zinc-400 hover:text-white"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost"
                        size="icon"
                        onClick={() => setJoinFiles(joinFiles.filter((_, i) => i !== idx))}
                        className="h-7 w-7 text-zinc-500 hover:text-rose-400"
                        title="Remove Track"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Button 
                onClick={startAudioProcessing} 
                disabled={joinFiles.length < 2}
                className="w-full h-11 bg-white text-black hover:bg-zinc-200 font-bold text-xs sm:text-sm rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Layers className="w-4 h-4 mr-2" />
                <span>Merge {joinFiles.length} Audio Tracks</span>
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* ── MODE 2, 3, 4 SINGLE FILE UPLOADER ── */}
      {activeTool !== 'audio-joiner' && !file && !result && (
        <div className="w-full max-w-2xl mx-auto py-2 sm:py-4">
          <FileUploader 
            accept="audio/*"
            label={`Upload Audio for ${currentToolInfo.label}`}
            subLabel="Drag & drop any size MP3, WAV, OGG, M4A, or FLAC files"
            onFilesSelected={handleFilesSelected}
            maxSizeMB={Infinity}
          />
        </div>
      )}

      {/* ── MODE 3: KEY & BPM FINDER RESULT VIEW ── */}
      {activeTool === 'audio-bpm-finder' && file && !result && (
        <div className="w-full max-w-2xl mx-auto space-y-4 sm:space-y-6">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-4 sm:p-6 space-y-4 sm:space-y-5 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-color)] pb-3 min-w-0">
              <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                <Disc className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="text-xs font-bold text-[var(--text-primary)] truncate max-w-[140px] xs:max-w-xs">{file.name}</span>
              </div>
              <Button variant="ghost" onClick={reset} className="text-rose-400 hover:text-rose-300 text-xs h-7 px-2 font-semibold shrink-0 whitespace-nowrap">
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
      )}

      {/* ── MODE 4: PITCH & SPEED CONTROLS WITH LIVE KEY/BPM DISPLAY ── */}
      {activeTool === 'audio-pitch-speed' && file && !result && !processing && (
        <div className="w-full max-w-2xl mx-auto space-y-4 sm:space-y-6">
          <Card className="border-zinc-800/80 bg-[#12121a] p-4 sm:p-6 space-y-5 sm:space-y-6 rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800/60 pb-3 min-w-0">
              <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                <Sliders className="w-4 h-4 text-zinc-300 shrink-0" />
                <span className="text-xs font-bold text-white truncate max-w-[140px] xs:max-w-xs">{file.name}</span>
              </div>
              <Button variant="ghost" onClick={reset} className="text-rose-400 hover:text-rose-300 text-xs h-7 px-2 font-semibold shrink-0">
                Remove
              </Button>
            </div>

            {/* Pitch & Speed Control Section Matching Screenshot */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Sliders Column */}
              <div className="md:col-span-8 space-y-6">
                {/* PITCH SLIDER CONTROL WITH STEPPER & PRESETS */}
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
                        onClick={() => setPitchSemitones(Math.max(-12, pitchSemitones - 1))}
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
                        onClick={() => setPitchSemitones(Math.min(12, pitchSemitones + 1))}
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

                  {/* Quick Pitch Presets */}
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

                {/* SPEED SLIDER CONTROL WITH STEPPER & PRESETS */}
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
                        onClick={() => setSpeedRatio(Math.max(0.5, Math.round((speedRatio - 0.05) * 100) / 100))}
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
                        onClick={() => setSpeedRatio(Math.min(2.0, Math.round((speedRatio + 0.05) * 100) / 100))}
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

                  {/* Quick Speed Presets */}
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

              {/* Dynamic KEY & BPM Info Cards Column */}
              <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-1 gap-2.5 sm:gap-3">
                {/* KEY DISPLAY CARD */}
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

                {/* BPM DISPLAY CARD */}
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

            {/* Instant Audio Preview */}
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
              onClick={startAudioProcessing} 
              className="w-full h-11 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md cursor-pointer transition-all"
            >
              <Zap className="w-4 h-4 mr-2 fill-current" />
              <span>Apply Pitch & Speed Changes</span>
            </Button>
          </Card>
        </div>
      )}

      {/* ── MODE 1: COMPRESS AUDIO SETTINGS ── */}
      {activeTool === 'audio-optimizer' && file && !result && !processing && (
        <div className="w-full max-w-2xl mx-auto space-y-4 sm:space-y-6">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-4 sm:p-6 space-y-4 sm:space-y-5 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-color)] pb-3 min-w-0">
              <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                <Music className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="text-xs font-bold text-[var(--text-primary)] truncate max-w-[140px] xs:max-w-xs">{file.name}</span>
              </div>
              <Button variant="ghost" onClick={reset} className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 text-xs h-7 px-2 font-semibold shrink-0">
                <span className="hidden xs:inline">Remove File</span>
                <span className="xs:hidden">Remove</span>
              </Button>
            </div>

            <div className="p-3 bg-zinc-950/50 border border-[var(--border-color)] rounded-xl text-center">
              <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Original Size</span>
              <span className="block text-xl font-extrabold text-[var(--text-primary)] mt-0.5">{formatBytes(file.size)}</span>
            </div>

            {/* Custom Audio Player */}
            {previewUrl && (
              <CustomAudioPlayer
                src={previewUrl}
                title={file.name}
                subtitle={`${format.toUpperCase()} Audio Track`}
              />
            )}

            {/* Trim Timeline */}
            <div className="space-y-3 pt-2 border-t border-[var(--border-color)]">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <label className="text-xs font-bold text-[var(--text-primary)] block">Trim Timeline</label>
                  <p className="text-[11px] text-zinc-400 truncate">Cut or keep specific timestamps</p>
                </div>
                <Switch 
                  checked={enableTrim} 
                  onCheckedChange={setEnableTrim} 
                  className="shrink-0"
                />
              </div>

              {enableTrim && audioDuration > 0 && (
                <div className="p-3 bg-zinc-950/50 border border-[var(--border-color)] rounded-xl space-y-3">
                  <TrimTimeline 
                    duration={audioDuration}
                    currentTime={0}
                    onSeek={() => {}}
                    onChange={(segs, mode) => {
                      setTrimSegments(segs);
                      setTrimCompileMode(mode);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Config Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2 border-t border-[var(--border-color)]">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Target Bitrate</label>
                <Select value={bitrate} onValueChange={(val) => val && setBitrate(val)}>
                  <SelectTrigger className="h-9 text-xs border-[var(--border-color)]">
                    <SelectValue placeholder="Bitrate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="64k">64 kbps (Low)</SelectItem>
                    <SelectItem value="96k">96 kbps (Medium)</SelectItem>
                    <SelectItem value="128k">128 kbps (Standard)</SelectItem>
                    <SelectItem value="192k">192 kbps (High Quality)</SelectItem>
                    <SelectItem value="320k">320 kbps (Maximum)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Output Format</label>
                <Select value={format} onValueChange={(val) => val && setFormat(val)}>
                  <SelectTrigger className="h-9 text-xs border-[var(--border-color)]">
                    <SelectValue placeholder="Format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mp3">MP3 Audio</SelectItem>
                    <SelectItem value="aac">AAC Audio</SelectItem>
                    <SelectItem value="wav">WAV Uncompressed</SelectItem>
                    <SelectItem value="ogg">OGG Vorbis</SelectItem>
                    <SelectItem value="flac">FLAC Lossless</SelectItem>
                    <SelectItem value="m4a">M4A Audio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={startAudioProcessing} 
              className="w-full h-11 bg-white text-black hover:bg-zinc-200 font-bold text-xs sm:text-sm rounded-xl shadow-sm cursor-pointer"
            >
              Start Audio Processing
            </Button>
          </Card>
        </div>
      )}

      {/* ── PROCESSING VIEW ── */}
      {processing && (
        <div className="w-full max-w-2xl mx-auto py-6 sm:py-8">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-5 sm:p-8 text-center space-y-6 rounded-2xl shadow-sm">
            <div className="space-y-2">
              <h3 className="text-base font-bold text-[var(--text-primary)]">{statusText || 'Processing Audio...'}</h3>
              <p className="text-xs text-zinc-400">All audio processing is executed 100% inside your browser.</p>
            </div>

            <ProgressBar progress={progress} />
          </Card>
        </div>
      )}

      {/* ── RESULT DOWNLOAD VIEW ── */}
      {result && (
        <div className="w-full max-w-2xl mx-auto py-2 sm:py-4">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-5 sm:p-8 text-center space-y-5 sm:space-y-6 rounded-2xl shadow-sm">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-extrabold text-[var(--text-primary)]">Audio Processing Complete!</h3>
              <p className="text-xs text-zinc-400">{result.name}</p>
            </div>

            <div className="p-4 bg-zinc-950/50 border border-[var(--border-color)] rounded-xl flex items-center justify-around">
              <div>
                <span className="block text-[10px] font-bold text-zinc-400 uppercase">Original</span>
                <span className="text-sm font-bold text-[var(--text-primary)]">{formatBytes(result.originalSize)}</span>
              </div>
              <div className="h-8 w-px bg-[var(--border-color)]" />
              <div>
                <span className="block text-[10px] font-bold text-zinc-400 uppercase">New File</span>
                <span className="text-sm font-extrabold text-emerald-500">{formatBytes(result.newSize)}</span>
              </div>
            </div>

            <CustomAudioPlayer
              src={result.url}
              title={result.name}
              subtitle="Processed Output Track"
            />

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={reset} variant="outline" className="flex-1 h-10 text-xs font-semibold border-[var(--border-color)] rounded-xl">
                <RefreshCw className="w-4 h-4 mr-2" />
                Process Another Track
              </Button>

              <a 
                href={result.url} 
                download={result.name}
                className="flex-1 h-10 bg-white text-black hover:bg-zinc-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Audio
              </a>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
