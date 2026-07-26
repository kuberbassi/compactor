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
  Disc, Sliders, Layers, ArrowUp, ArrowDown, Trash2, Zap, Plus
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
  { id: 'audio-optimizer', label: 'Compress Audio', desc: 'Trim a track, reduce file size & transcode audio formats', icon: Music },
  { id: 'audio-joiner', label: 'Audio Joiner', desc: 'Merge multiple audio files together into a single track', icon: Layers },
  { id: 'audio-bpm-finder', label: 'Key & BPM Finder', desc: 'Detect musical key, tempo (BPM) & Camelot wheel code', icon: Disc },
  { id: 'audio-pitch-speed', label: 'Pitch & Speed', desc: 'Transpose key pitch (-12 to +12) and adjust tempo (0.5x to 2.0x)', icon: Sliders },
];

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

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    const tempAudio = new Audio(url);
    tempAudio.onloadedmetadata = () => {
      setAudioDuration(tempAudio.duration);
    };

    return () => {
      URL.revokeObjectURL(url);
    };
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

      if (activeTool === 'audio-bpm-finder') {
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
      alert('Failed to analyze audio key and BPM.');
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
      setProcessing(true);
      setProgress(10);
      setStatusText('Modifying pitch & speed client-side...');
      try {
        const processed = await processPitchAndSpeed(
          file,
          { pitchSemitones, speedRatio },
          (pct) => setProgress(pct)
        );
        setResult({
          url: processed.url,
          name: `${file.name.replace(/\.[^/.]+$/, '')}_pitch${pitchSemitones}_speed${speedRatio}x.wav`,
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

  return (
    <div className="tool-layout space-y-3">
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

      {/* Mode Selector Header Bar - Reduced bottom padding */}
      <div className="w-full flex justify-center pb-1">
        <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-sm overflow-x-auto no-scrollbar max-w-full">
          {AUDIO_TOOLS_CONFIG.map((t) => {
            const IconComponent = t.icon;
            const isActive = activeTool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTool(t.id);
                  reset();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700 font-extrabold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                <IconComponent className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MODE 1: AUDIO JOINER SETUP ── */}
      {activeTool === 'audio-joiner' && !result && !processing && (
        <div className="max-w-xl mx-auto space-y-3">
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
            /* Condensed Add Tracks Bar when files are already queued */
            <div className="p-3 bg-zinc-950/60 border border-[var(--border-color)] rounded-xl flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-medium truncate pr-2">Add more audio files to queue...</span>
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
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                <span>Add Tracks</span>
              </Button>
            </div>
          )}

          {joinFiles.length > 0 && (
            <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-5 sm:p-6 space-y-5 rounded-2xl shadow-sm">
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
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-[var(--border-color)] text-xs text-[var(--text-primary)]">
                    <div className="flex items-center gap-3 truncate flex-1 min-w-0 pr-2">
                      <span className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-[10px] flex items-center justify-center font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <span className="truncate font-semibold text-xs">{f.name}</span>
                      <span className="text-[10px] text-zinc-500 font-mono shrink-0">{formatBytes(f.size)}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
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
        <div className="max-w-xl mx-auto py-4">
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
        <div className="max-w-xl mx-auto space-y-3">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-5 sm:p-6 space-y-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                <Disc className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="text-xs font-bold text-[var(--text-primary)] truncate">{file.name}</span>
              </div>
              <Button variant="ghost" onClick={reset} className="text-rose-400 hover:text-rose-300 text-xs h-7 px-2 font-semibold shrink-0">
                Analyze Another
              </Button>
            </div>

            {analyzingBpm ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-9 h-9 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-mono font-bold text-zinc-300">Analyzing Pitch Profiles & Onset BPM...</p>
              </div>
            ) : analysisResult ? (
              <div className="space-y-5">
                {/* Big Metric Display */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-zinc-950/70 border border-[var(--border-color)] text-center space-y-1">
                    <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">TEMPO</span>
                    <span className="text-3xl sm:text-4xl font-black text-white block">{analysisResult.bpm}</span>
                    <span className="text-[10px] font-mono font-bold text-emerald-400">BEATS PER MINUTE</span>
                  </div>

                  <div className="p-4 rounded-xl bg-zinc-950/70 border border-[var(--border-color)] text-center space-y-1">
                    <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">MUSICAL KEY</span>
                    <span className="text-2xl sm:text-3xl font-black text-white block truncate">{analysisResult.key}</span>
                    <span className="text-[10px] font-mono font-bold text-indigo-400">CAMELOT {analysisResult.camelot}</span>
                  </div>
                </div>

                {/* Additional Technical Breakdown with Proper Spacing */}
                <div className="p-3 bg-zinc-950/50 border border-[var(--border-color)] rounded-xl flex flex-wrap items-center justify-around gap-2 text-xs font-mono text-zinc-400">
                  <span>Confidence: <strong className="text-white">{analysisResult.confidence}%</strong></span>
                  <span className="text-zinc-600 hidden sm:inline">&bull;</span>
                  <span>Sample Rate: <strong className="text-white">{analysisResult.sampleRate} Hz</strong></span>
                  <span className="text-zinc-600 hidden sm:inline">&bull;</span>
                  <span>Scale: <strong className="text-white">{analysisResult.mode}</strong></span>
                </div>

                {/* Custom Audio Player */}
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

      {/* ── MODE 4: PITCH & SPEED CONTROLS WITH INSTANT 60FPS PREVIEW ── */}
      {activeTool === 'audio-pitch-speed' && file && !result && !processing && (
        <div className="max-w-xl mx-auto space-y-3">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-5 sm:p-6 space-y-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                <Sliders className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="text-xs font-bold text-[var(--text-primary)] truncate">{file.name}</span>
              </div>
              <Button variant="ghost" onClick={reset} className="text-rose-400 hover:text-rose-300 text-xs h-7 px-2 font-semibold shrink-0">
                Remove
              </Button>
            </div>

            {/* Pitch Semitone Control */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono font-bold">
                <span className="text-zinc-300">Pitch Transposition</span>
                <span className="text-indigo-400">{pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones} semitones</span>
              </div>
              <input 
                type="range" 
                min="-12" 
                max="12" 
                step="1"
                value={pitchSemitones}
                onChange={(e) => setPitchSemitones(parseInt(e.target.value, 10))}
                className="w-full accent-white cursor-pointer"
              />
              <div className="flex gap-1.5 flex-wrap pt-0.5">
                {[-12, -2, -1, 0, 1, 2, 7, 12].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPitchSemitones(s)}
                    className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer ${
                      pitchSemitones === s 
                        ? 'bg-white text-black font-extrabold shadow-sm' 
                        : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                  >
                    {s > 0 ? `+${s}` : s}
                  </button>
                ))}
              </div>
            </div>

            {/* Speed Multiplier Control */}
            <div className="space-y-2.5 pt-3 border-t border-[var(--border-color)]">
              <div className="flex items-center justify-between text-xs font-mono font-bold">
                <span className="text-zinc-300">Playback Speed / Tempo</span>
                <span className="text-emerald-400">{speedRatio}x</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.05"
                value={speedRatio}
                onChange={(e) => setSpeedRatio(parseFloat(e.target.value))}
                className="w-full accent-white cursor-pointer"
              />
              <div className="flex gap-1.5 flex-wrap pt-0.5">
                {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSpeedRatio(r)}
                    className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer ${
                      speedRatio === r 
                        ? 'bg-white text-black font-extrabold shadow-sm' 
                        : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            </div>

            {/* Instant Audio Preview */}
            {previewUrl && (
              <div className="space-y-1.5 pt-2 border-t border-[var(--border-color)]">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">Live Pitch & Speed Audio Preview</span>
                <CustomAudioPlayer
                  src={previewUrl}
                  title={file.name}
                  subtitle={`${pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones} Semitones • ${speedRatio}x Speed`}
                  pitchSemitones={pitchSemitones}
                  speedRatio={speedRatio}
                />
              </div>
            )}

            <Button 
              onClick={startAudioProcessing} 
              className="w-full h-11 bg-white text-black hover:bg-zinc-200 font-bold text-xs sm:text-sm rounded-xl shadow-sm cursor-pointer"
            >
              <Zap className="w-4 h-4 mr-2 fill-current" />
              <span>Apply Pitch & Speed Changes</span>
            </Button>
          </Card>
        </div>
      )}

      {/* ── MODE 1: COMPRESS AUDIO SETTINGS ── */}
      {activeTool === 'audio-optimizer' && file && !result && !processing && (
        <div className="max-w-xl mx-auto space-y-3">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-5 sm:p-6 space-y-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                <Music className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="text-xs font-bold text-[var(--text-primary)] truncate">{file.name}</span>
              </div>
              <Button variant="ghost" onClick={reset} className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 text-xs h-7 px-2 font-semibold shrink-0">
                Remove File
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
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-xs font-bold text-[var(--text-primary)] block">Trim Timeline</label>
                  <p className="text-[11px] text-zinc-400">Cut or keep specific timestamps</p>
                </div>
                <Switch 
                  checked={enableTrim} 
                  onCheckedChange={setEnableTrim} 
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
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[var(--border-color)]">
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
        <div className="max-w-xl mx-auto py-8">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-8 text-center space-y-6 rounded-2xl shadow-sm">
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
        <div className="max-w-xl mx-auto py-4">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-6 sm:p-8 text-center space-y-6 rounded-2xl shadow-sm">
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

            <div className="flex gap-3">
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
