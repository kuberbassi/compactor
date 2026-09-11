import React, { useState, useEffect, useRef } from 'react';
import { FileUploader } from '../../components/Common/FileUploader';
import { CompressionPresetSelector } from '../../components/Common/CompressionPresetSelector';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { TrimTimeline } from '../../components/Common/TrimTimeline';
import type { TrimSegment } from '../../components/Common/TrimTimeline';
import { CustomAudioPlayer } from '../../components/Common/CustomAudioPlayer';
import { EditorSidebar } from '../../components/Workspace/EditorChrome';
import { ToolHeader } from '../../components/Common/ToolHeader';
import { ErrorBanner } from '../../components/Common/ErrorBanner';

import { compressAudio, getFFmpeg, terminateFFmpeg } from '../../utils/ffmpeg';
import { formatBytes } from '../../utils/image';
import { isEditableShortcutTarget, loadSetting, saveSetting, shareResult } from '../../utils/batch';
import type { CompressionPreset } from '../../utils/batch';
import { analyzeAudioBPMAndKey } from '../../utils/audioAnalysis';
import type { AudioAnalysisResult } from '../../utils/audioAnalysis';
import { joinAudioFiles } from '../../utils/audioJoiner';
import { processPitchAndSpeed } from '../../utils/audioPitchSpeed';

import { 
  Music, Download, RefreshCw, CheckCircle, 
  Disc, Sliders, Layers, PanelLeft, PanelLeftClose
} from 'lucide-react';
import { Switch } from '../../components/ui/switch';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../../components/ui/select';
import { AudioJoinerPanel } from './components/AudioJoinerPanel';
import { AudioBpmPanel } from './components/AudioBpmPanel';
import { AudioPitchSpeedPanel } from './components/AudioPitchSpeedPanel';
import { AudioWorkspaceBar } from './components/AudioWorkspaceBar';
import { AudioModeNav } from './components/AudioModeNav';

interface AudioToolsProps {
  mode?: string;
  onGoHome: () => void;
  onSelectTool: (toolId: string) => void;
  onUploadSuccess: () => void;
}

const AUDIO_TOOLS_CONFIG = [
  { id: 'audio-optimizer', label: 'Compress Audio', shortLabel: 'Compress', desc: 'Trim a track, reduce file size & transcode audio formats', icon: Music },
  { id: 'audio-joiner', label: 'Join Audio', shortLabel: 'Join', desc: 'Merge multiple audio files together into a single track', icon: Layers },
  { id: 'audio-bpm-finder', label: 'Find Key & BPM', shortLabel: 'Key & BPM', desc: 'Detect musical key, tempo (BPM) & Camelot wheel code', icon: Disc },
  { id: 'audio-pitch-speed', label: 'Pitch & Speed', shortLabel: 'Pitch & Speed', desc: 'Transpose key pitch (-12 to +12) and adjust tempo (0.5x to 2.0x)', icon: Sliders },
];

const AUDIO_FORMAT_LABELS: Record<string, string> = {
  mp3: 'MP3 Audio',
  aac: 'AAC Audio',
  wav: 'WAV Uncompressed',
  ogg: 'OGG Vorbis',
  flac: 'FLAC Lossless',
  m4a: 'M4A Audio',
};

const AUDIO_BITRATE_LABELS: Record<string, string> = {
  '64k': '64 kbps · Low',
  '96k': '96 kbps · Medium',
  '128k': '128 kbps · Standard',
  '192k': '192 kbps · High quality',
  '320k': '320 kbps · Maximum',
};

const formatFadeDuration = (seconds: number) => seconds === 0 ? 'None' : `${seconds}s`;

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
  const [audioSidebarCollapsed, setAudioSidebarCollapsed] = useState(false);

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
  const [compressionPreset, setCompressionPreset] = useState<CompressionPreset>(() =>
    loadSetting('compactor_audio_compression_preset', 'balanced')
  );
  const [removeMetadata, setRemoveMetadata] = useState(() =>
    loadSetting('compactor_audio_remove_metadata', true)
  );
  const [normalizeAudio, setNormalizeAudio] = useState(false);
  const [fadeInDuration, setFadeInDuration] = useState(0);
  const [fadeOutDuration, setFadeOutDuration] = useState(0);
  const [audioChannels, setAudioChannels] = useState<'original' | 'mono' | 'stereo'>('original');
  const [removeSilence, setRemoveSilence] = useState(false);
  const [noiseReduction, setNoiseReduction] = useState(false);
  const [bassBoost, setBassBoost] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [seekToTime, setSeekToTime] = useState<number | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  useEffect(() => {
    return () => {
      if (result?.url) {
        URL.revokeObjectURL(result.url);
      }
    };
  }, [result?.url]);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveSetting('compactor_audio_compression_preset', compressionPreset);
    saveSetting('compactor_audio_remove_metadata', removeMetadata);
  }, [compressionPreset, removeMetadata]);

  const applyCompressionPreset = (value: CompressionPreset) => {
    setCompressionPreset(value);
    setBitrate(value === 'light' ? '192k' : value === 'balanced' ? '128k' : '64k');
    if (format === 'wav' || format === 'flac') setFormat('mp3');
  };

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
      setFile(current => current ?? files[0]);
      setJoinFiles(prev => {
        const seen = new Set(prev.map(item => `${item.name}:${item.size}:${item.lastModified}`));
        return [...prev, ...files.filter(item => {
          const key = `${item.name}:${item.size}:${item.lastModified}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })];
      });
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

  // Keep the four operations in one editor session. External routes can still
  // choose an initial operation through `mode`; editor navigation stays local.
  const selectAudioMode = (toolId: string) => {
    if (toolId === 'audio-joiner' && file) {
      setJoinFiles(current => {
        const sourceKey = `${file.name}:${file.size}:${file.lastModified}`;
        return current.some(item => `${item.name}:${item.size}:${item.lastModified}` === sourceKey)
          ? current
          : [file, ...current];
      });
    }
    setActiveTool(toolId);
    setAudioSidebarCollapsed(false);
    if ((toolId === 'audio-bpm-finder' || toolId === 'audio-pitch-speed') && file && !analysisResult) {
      void runBPMAnalysis(file);
    }
  };

  // Run Audio Processing
  const startAudioProcessing = async () => {
    setErrorMessage(null);
    if (activeTool === 'audio-joiner') {
      if (joinFiles.length < 2) {
        setErrorMessage('Please upload at least 2 audio files to join.');
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
        setErrorMessage(`Joining failed: ${e.message || e}`);
      } finally {
        setProcessing(false);
      }
      return;
    }

    if (activeTool === 'audio-pitch-speed') {
      if (!file) return;
      if (pitchSemitones === 0 && speedRatio === 1.0) {
        setErrorMessage('No changes applied — adjust pitch or speed before exporting.');
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
        setErrorMessage(`Pitch/Speed change failed: ${e.message || e}`);
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
        duration: audioDuration,
        removeMetadata,
        normalizeAudio,
        fadeInDuration: fadeInDuration > 0 ? fadeInDuration : undefined,
        fadeOutDuration: fadeOutDuration > 0 ? fadeOutDuration : undefined,
        channels: audioChannels !== 'original' ? audioChannels : undefined,
        removeSilence,
        noiseReduction,
        bassBoost,
      };

      const compressResult = await compressAudio(file, config, handleLog, setProgress);
      setResult(compressResult);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setLogs((prev) => [...prev, `ERROR: ${e.message || e}`]);
      setErrorMessage(`Processing failed: ${e.message || 'Make sure your browser supports SharedArrayBuffer.'}`);
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

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && file && !processing && !result) {
        event.preventDefault();
        startAudioProcessing();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && result) {
        event.preventDefault();
        const anchor = document.createElement('a');
        anchor.href = result.url;
        anchor.download = result.name;
        anchor.click();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  });

  const hasActiveSession = Boolean(file || joinFiles.length > 0 || result || processing);
  const sourceFormat = file?.name.split('.').pop()?.toUpperCase() || 'AUDIO';

  return (
    <div className={`w-full tool-layout audio-tool-layout ${hasActiveSession ? 'has-active-session' : 'is-empty-session'}`}>
      <ToolHeader
        title="Audio"
        description={currentToolInfo.desc}
        icon={Music}
        onGoHome={() => {
          if (hasActiveSession) {
            reset();
          } else {
            onGoHome();
          }
        }}
        backLabel={hasActiveSession ? 'Back to Audio upload' : 'Back to all tools'}
      />
      {/* ── EMPTY UPLOAD STATE ── */}
      {!hasActiveSession && (
        <div className="tool-upload-frame w-full max-w-2xl mx-auto py-2">
          <FileUploader 
            accept="audio/*,video/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,.webm,.mp4,.mov,.mkv,.avi"
            label={activeTool === 'audio-joiner' ? "Upload Audio Tracks to Merge" : `Upload Audio or Video for ${currentToolInfo.label}`}
            subLabel={activeTool === 'audio-joiner' ? "Drag & drop multiple audio tracks (MP3, WAV, AAC, M4A, FLAC, OPUS)" : "Drag & drop audio (MP3, WAV, OGG, M4A, FLAC, OPUS) or video files (MP4, MOV, MKV, WebM) to extract & process audio"}
            onFilesSelected={handleFilesSelected}
            multiple={activeTool === 'audio-joiner'}
            maxSizeMB={Infinity}
          />
        </div>
      )}

      {/* ── ACTIVE WORKSPACE SESSION ── */}
      {hasActiveSession && (
        <section className="audio-workspace-shell has-active-session" aria-label={`${currentToolInfo.label} workspace`}>
          <div className="audio-workspace-content">

      {/* ── MODE 1: AUDIO JOINER SETUP ── */}
      {activeTool === 'audio-joiner' && !result && !processing && (
        <AudioJoinerPanel
          file={joinFiles[0] ?? file!}
          joinFiles={joinFiles}
          setJoinFiles={setJoinFiles}
          onFilesSelected={handleFilesSelected}
          onRunJoin={startAudioProcessing}
          onReset={reset}
          activeTool={activeTool}
          onSelectTool={selectAudioMode}
        />
      )}

      {/* ── MODE 3: KEY & BPM FINDER RESULT VIEW ── */}
      {activeTool === 'audio-bpm-finder' && file && !result && (
        <AudioBpmPanel
          file={file}
          analyzingBpm={analyzingBpm}
          analysisResult={analysisResult}
          previewUrl={previewUrl}
          onReset={reset}
          activeTool={activeTool}
          onSelectTool={selectAudioMode}
        />
      )}

      {/* ── MODE 4: PITCH & SPEED CONTROLS WITH LIVE KEY/BPM DISPLAY ── */}
      {activeTool === 'audio-pitch-speed' && file && !result && !processing && (
        <AudioPitchSpeedPanel
          file={file}
          pitchSemitones={pitchSemitones}
          setPitchSemitones={setPitchSemitones}
          speedRatio={speedRatio}
          setSpeedRatio={setSpeedRatio}
          analyzingBpm={analyzingBpm}
          transposedKey={transposedKey}
          currentBpm={currentBpm}
          previewUrl={previewUrl}
          onReset={reset}
          onRunProcess={startAudioProcessing}
          activeTool={activeTool}
          onSelectTool={selectAudioMode}
        />
      )}

      {/* ── MODE 1: COMPRESS AUDIO SETTINGS ── */}
      {activeTool === 'audio-optimizer' && file && !result && !processing && (
        <div className="audio-optimizer-session w-full max-w-2xl mx-auto">
          <div className={`audio-editor-panel audio-optimizer-stage ${audioSidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
            <AudioWorkspaceBar
              title={file.name}
              meta={`${sourceFormat} source · ${formatBytes(file.size)} → ${AUDIO_FORMAT_LABELS[format]}`}
              onRemove={reset}
            />

            {errorMessage && (
              <div className="p-3">
                <ErrorBanner 
                  message={errorMessage} 
                  onDismiss={() => setErrorMessage(null)} 
                  onRetry={startAudioProcessing} 
                />
              </div>
            )}

            {/* Useful source summary and real playback controls. */}
            {previewUrl && (
              <div className="audio-preview-canvas audio-preview-canvas--player-only">
                <CustomAudioPlayer 
                  src={previewUrl} 
                  title={file.name} 
                  subtitle={`${sourceFormat} Audio Track · ${formatBytes(file.size)}`}
                  onTimeUpdate={(t: number) => setAudioCurrentTime(t)}
                  onPlayStateChange={(p: boolean) => setIsAudioPlaying(p)}
                  seekToTime={seekToTime}
                />
              </div>
            )}

            {/* Trim Timeline */}
            <div className="audio-timeline-panel space-y-3">
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
                <div className="pt-1">
                  <TrimTimeline 
                    duration={audioDuration}
                    currentTime={audioCurrentTime}
                    isPlaying={isAudioPlaying}
                    onSeek={(time) => {
                      setAudioCurrentTime(time);
                      setSeekToTime(time);
                    }}
                    onChange={(segs, mode) => {
                      setTrimSegments(segs);
                      setTrimCompileMode(mode);
                    }}
                    showFadeControls={false}
                  />
                </div>
              )}
            </div>

            {!enableTrim && (
              <div className="audio-local-note" role="note">
                <Sliders aria-hidden="true" />
                <strong>Ready to process</strong>
                <span>Adjust settings or enable Trim Timeline.</span>
              </div>
            )}

            {/* Config Selectors */}
            <EditorSidebar className={`audio-optimizer-inspector ${audioSidebarCollapsed ? 'is-collapsed' : ''}`}>
            {audioSidebarCollapsed ? (
              <div className="audio-sidebar-rail">
                <div className="flex flex-col items-center gap-1.5 w-full px-2">
                  <button type="button" onClick={() => setAudioSidebarCollapsed(false)} title="Expand audio controls" aria-label="Expand audio controls"><PanelLeft /></button>
                  <div className="w-6 h-px bg-white/10 my-1" />
                  <div className="flex flex-col items-center gap-1 w-full">
                    {AUDIO_TOOLS_CONFIG.map((tool) => {
                      const Icon = tool.icon;
                      const isActive = tool.id === activeTool;
                      return (
                        <button
                          key={tool.id}
                          type="button"
                          onClick={() => selectAudioMode(tool.id)}
                          title={tool.label}
                          aria-label={tool.label}
                          className={isActive ? 'audio-sidebar-rail__tool is-active' : 'audio-sidebar-rail__tool'}
                        >
                          <Icon />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button type="button" className="audio-sidebar-rail__process" onClick={startAudioProcessing} title="Process audio" aria-label="Process audio">→</button>
              </div>
            ) : (
            <>
            <div className="audio-inspector-heading">
              <div className="audio-inspector-heading__title">
                <strong>Audio controls</strong>
                <span>{sourceFormat}</span>
              </div>
              <button type="button" onClick={() => setAudioSidebarCollapsed(true)} title="Collapse audio controls" aria-label="Collapse audio controls"><PanelLeftClose /></button>
            </div>
            <AudioModeNav activeId={activeTool} onChange={selectAudioMode} />
            <div className="audio-presets-panel workbench-section"><CompressionPresetSelector value={compressionPreset} onChange={applyCompressionPreset} /></div>

            <div className="audio-enhancement-options space-y-0">
              <div className="compression-privacy-toggle audio-privacy-panel" title="Remove embedded title, artist, album, comments, and other tags.">
                <span className="text-xs font-bold text-[var(--text-primary)]">Remove private metadata</span>
                <Switch checked={removeMetadata} onCheckedChange={setRemoveMetadata} className="shrink-0" />
              </div>

              <div className="compression-privacy-toggle audio-privacy-panel" title="Level quiet passages and loud peaks to a consistent broadcast loudness.">
                <span className="text-xs font-bold text-[var(--text-primary)]">Normalize volume (EBU R128)</span>
                <Switch checked={normalizeAudio} onCheckedChange={setNormalizeAudio} className="shrink-0" />
              </div>

              <div className="compression-privacy-toggle audio-privacy-panel" title="Trim long pauses from voice notes, podcasts, and recordings.">
                <span className="text-xs font-bold text-[var(--text-primary)]">Remove dead silence</span>
                <Switch checked={removeSilence} onCheckedChange={setRemoveSilence} className="shrink-0" />
              </div>

              <div className="compression-privacy-toggle audio-privacy-panel" title="Filter low-end rumble and harsh high-frequency background hiss.">
                <span className="text-xs font-bold text-[var(--text-primary)]">Voice noise filter</span>
                <Switch checked={noiseReduction} onCheckedChange={setNoiseReduction} className="shrink-0" />
              </div>

              <div className="compression-privacy-toggle audio-privacy-panel" title="Add low-end punch and warmth to flat recordings.">
                <span className="text-xs font-bold text-[var(--text-primary)]">Bass boost (+5 dB)</span>
                <Switch checked={bassBoost} onCheckedChange={setBassBoost} className="shrink-0" />
              </div>
            </div>

            <section className="audio-export-settings" aria-label="Export settings">
              <div className="audio-advanced-settings__body">
            {/* Fade In / Out */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Fade In (s)</label>
                <Select value={String(fadeInDuration)} onValueChange={(v) => v && setFadeInDuration(Number(v))}>
                  <SelectTrigger className="h-9 text-xs border-[var(--border-color)]">{formatFadeDuration(fadeInDuration)}</SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">None</SelectItem>
                    <SelectItem value="0.5">0.5s</SelectItem>
                    <SelectItem value="1">1s</SelectItem>
                    <SelectItem value="2">2s</SelectItem>
                    <SelectItem value="3">3s</SelectItem>
                    <SelectItem value="5">5s</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Fade Out (s)</label>
                <Select value={String(fadeOutDuration)} onValueChange={(v) => v && setFadeOutDuration(Number(v))}>
                  <SelectTrigger className="h-9 text-xs border-[var(--border-color)]">{formatFadeDuration(fadeOutDuration)}</SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">None</SelectItem>
                    <SelectItem value="0.5">0.5s</SelectItem>
                    <SelectItem value="1">1s</SelectItem>
                    <SelectItem value="2">2s</SelectItem>
                    <SelectItem value="3">3s</SelectItem>
                    <SelectItem value="5">5s</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Channel Mode */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Channel Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {(['original', 'stereo', 'mono'] as const).map((ch) => (
                  <Button
                    key={ch}
                    type="button"
                    onClick={() => setAudioChannels(ch)}
                    variant={audioChannels === ch ? 'default' : 'outline'}
                    size="sm"
                    className={`h-9 text-xs ${
                      audioChannels === ch ? 'text-zinc-950' : 'text-zinc-400'
                    }`}
                  >
                    {ch.charAt(0).toUpperCase() + ch.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="audio-output-panel grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Target Bitrate</label>
                <Select value={bitrate} onValueChange={(val) => val && setBitrate(val)}>
                  <SelectTrigger className="h-9 text-xs border-[var(--border-color)]">
                    {AUDIO_BITRATE_LABELS[bitrate] ?? bitrate}
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
                    {AUDIO_FORMAT_LABELS[format] ?? format.toUpperCase()}
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

              </div>
            </section>
            <div className="audio-inspector-action">
              <Button onClick={startAudioProcessing} className="w-full h-11 text-xs uppercase tracking-wider rounded-xl">
                Process audio <span aria-hidden="true">→</span>
              </Button>
            </div>
            </>
            )}
            </EditorSidebar>
          </div>
        </div>
      )}

      {/* ── PROCESSING VIEW ── */}
      {processing && (
        <div className="audio-processing-workbench w-full max-w-2xl mx-auto py-6 sm:py-8">
          <Card className="audio-processing-panel border-[var(--border-color)] bg-[var(--surface-color)] p-5 sm:p-8 text-center space-y-6 rounded-2xl shadow-sm">
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
        <div className="audio-result-workbench">
          <aside className="audio-result-summary" aria-label="Output summary">
            <div className="audio-result-summary__status">
              <CheckCircle aria-hidden="true" />
              <div><strong>Audio ready</strong><span>1 track processed</span></div>
            </div>
            <div className="audio-result-summary__stats">
              <span>Original size <strong>{formatBytes(result.originalSize)}</strong></span>
              <span>Output size <strong>{formatBytes(result.newSize)}</strong></span>
              <span className={result.newSize < result.originalSize ? 'is-saving' : ''}>
                {result.newSize < result.originalSize ? 'Total saved' : 'Size change'}
                <strong>{formatBytes(Math.abs(result.originalSize - result.newSize))}{result.originalSize > 0 ? ` (${Math.round(Math.abs(result.originalSize - result.newSize) / result.originalSize * 100)}%)` : ''}</strong>
              </span>
            </div>
            <Button onClick={reset} variant="outline" className="audio-result-summary__reset">
              <RefreshCw /> Process another track
            </Button>
          </aside>

          <main className="audio-result-main">
            <section className="audio-result-hero">
              <div>
                <span className="audio-result-hero__badge"><CheckCircle aria-hidden="true" /> Export complete</span>
                <h3>{result.newSize < result.originalSize ? `Saved ${formatBytes(result.originalSize - result.newSize)}` : 'Audio export complete'}</h3>
                <p>{result.name}</p>
              </div>
              <div className="audio-result-hero__actions">
                <Button variant="outline" onClick={() => shareResult(result).catch(console.error)}>Share</Button>
                <a href={result.url} download={result.name} className="audio-result-download"><Download /> Download</a>
              </div>
            </section>

            <section className="audio-result-track">
              <span>Processed track</span>
              <CustomAudioPlayer src={result.url} title={result.name} subtitle={`${AUDIO_FORMAT_LABELS[format] ?? format.toUpperCase()} · ${formatBytes(result.newSize)}`} />
            </section>
          </main>
        </div>
      )}
          </div>
        </section>
      )}
    </div>
  );
};
