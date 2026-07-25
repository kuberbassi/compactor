import { useState, useEffect, useRef } from 'react';
import { FileUploader } from '../../components/Common/FileUploader';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { ToolHeader } from '../../components/Common/ToolHeader';
import { TrimTimeline } from '../../components/Common/TrimTimeline';
import type { TrimSegment } from '../../components/Common/TrimTimeline';
import { compressVideo, getFFmpeg, terminateFFmpeg, remuxVideoBlob } from '../../utils/ffmpeg';
import { compressVideoNative } from '../../utils/nativeCompressor';
import { formatBytes } from '../../utils/image';
import { 
  PiDownloadLight as Download, PiArrowsClockwiseLight as RefreshCw, 
  PiFileVideoLight as FileVideo, 
  PiGearLight as Settings,
  PiWarningLight as WarningIcon
} from 'react-icons/pi';
import { Switch } from '../../components/ui/switch';
import { Button } from '../../components/ui/button';
import { Slider } from '../../components/ui/slider';
import { Card } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';

interface VideoCompressorProps {
  mode: 'compress' | 'gif' | 'mute' | 'to-audio' | 'to-text' | 'whatsapp' | 'instagram' | 'tiktok' | 'x' | 'discord' | 'telegram' | 'facebook' | 'youtube' | 'convert';
  onGoHome: () => void;
  onUploadSuccess: () => void;
}

export const VideoCompressor: React.FC<VideoCompressorProps> = ({ mode, onGoHome, onUploadSuccess }) => {
  const currentMode = mode === ('compressor' as any) ? 'compress' : mode;
  
  // Human Comment: File and processing status trackers
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      terminateFFmpeg().catch(() => {});
    };
  }, []);

  const cancelProcessing = () => {
    isCancelledRef.current = true;
    setShowAbortConfirm(false);
    abortControllerRef.current?.abort();
    terminateFFmpeg();
    setProcessing(false);
    setProgress(0);
    setStatusText('Processing cancelled by user.');
    setLogs((prev) => [...prev, 'Process aborted by user.']);
  };

  // Human Comment: Engine choice: wasm for quality, native for fast large-file support
  const [engine, setEngine] = useState<'wasm' | 'native'>('wasm');
  
  // Human Comment: Media player sync hooks
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  // Human Comment: Trim segments list and editing state
  const [enableTrim, setEnableTrim] = useState(false);
  const [trimSegments, setTrimSegments] = useState<TrimSegment[]>([]);
  const [trimCompileMode, setTrimCompileMode] = useState<'keep-selected' | 'cut-selected'>('keep-selected');
  
  // Human Comment: Completed compression results metadata
  const [result, setResult] = useState<{
    url: string;
    name: string;
    blob: Blob;
    originalSize: number;
    newSize: number;
  } | null>(null);

  // WASM Engine Settings
  const [crf, setCrf] = useState(28);
  const [scale, setScale] = useState('no-scale');
  const [preset, setPreset] = useState('fast');
  const [removeAudio, setRemoveAudio] = useState(mode === 'mute');
  // Audio & GIF Specific Settings
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'aac' | 'wav'>('mp3');
  const [audioBitrate, setAudioBitrate] = useState<'128k' | '192k' | '320k'>('192k');
  const [gifFps, setGifFps] = useState<number>(15);

  // Target Platform Presets (General, WhatsApp, Discord, TikTok, Instagram)
  const [targetPreset, setTargetPreset] = useState<'general' | 'whatsapp' | 'discord' | 'tiktok' | 'instagram'>('general');
  const [format, setFormat] = useState<string>('mp4');
  const [nativeBitrate, setNativeBitrate] = useState<number>(3000);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  useEffect(() => {
    if (['whatsapp', 'discord', 'tiktok', 'instagram'].includes(currentMode)) {
      setTargetPreset(currentMode as any);
    }
  }, [currentMode]);




  const getToolDescription = () => {
    switch (currentMode) {
      case 'to-audio': return 'Extract high quality MP3, AAC, or WAV sound tracks from any video file.';
      case 'gif': return 'Convert video clips or segments into lightweight animated GIFs.';
      case 'mute': return 'Strip audio channels from your video files with zero quality loss.';
      default: return 'Trim, resize, and compress videos for the way you want to share them.';
    }
  };

  const getActionButtonText = () => {
    switch (currentMode) {
      case 'to-audio': return 'Extract Audio Track';
      case 'gif': return 'Convert to GIF';
      case 'mute': return 'Mute Video';
      default: return 'Start Compression';
    }
  };

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    setRemoveAudio(mode === 'mute');
    setFormat(mode === 'gif' ? 'gif' : mode === 'to-audio' ? 'mp3' : 'mp4');
    setFile(null);
    setResult(null);
    setLogs([]);
    setProgress(0);
    setProcessing(false);
    setEnableTrim(false);
  }, [mode]);

  const TARGET_PRESET_MAP: Record<string, { name: string; maxMB?: number; badge: string }> = {
    general: { name: 'General / Custom Compression', maxMB: undefined, badge: 'Standard quality compression' },
    whatsapp: { name: 'WhatsApp Video (≤16 MB)', maxMB: 15.2, badge: 'Guaranteed ≤15.5 MB for WhatsApp attachments' },
    discord: { name: 'Discord Free (≤10 MB)', maxMB: 9.3, badge: 'Guaranteed ≤9.5 MB for Discord free upload limit' },
    tiktok: { name: 'TikTok Upload (≤70 MB)', maxMB: 68.0, badge: 'Optimized for TikTok mobile feed' },
    instagram: { name: 'Instagram Reels & Stories (≤95 MB)', maxMB: 92.0, badge: 'Optimized for Instagram Reels & Stories' },
  };

  useEffect(() => {
    // Auto-calculate bitrate targets if platform target preset is selected
    const platformInfo = TARGET_PRESET_MAP[targetPreset];
    const targetMB = platformInfo?.maxMB;
    if (targetMB && videoDuration > 0) {
      const totalBytes = targetMB * 1024 * 1024;
      const totalBitrateBps = (totalBytes * 8) / videoDuration;
      const videoBps = Math.max(80000, totalBitrateBps - 96000);
      setNativeBitrate(Math.round(videoBps / 1000));
    }
  }, [targetPreset, videoDuration]);

  const handleFilesSelected = (files: File[]) => {
    if (files.length > 0) {
      const f = files[0];
      setFile(f);
      setResult(null);
      // Auto-toggle to Native Engine if file size exceeds 500MB
      if (f.size > 500 * 1024 * 1024) {
        setEngine('native');
      } else {
        setEngine('wasm');
      }
      
      const fileExt = f.name.split('.').pop()?.toLowerCase() || 'mp4';
      if (currentMode !== 'gif' && currentMode !== 'to-audio') {
        const supported = ['mp4', 'webm', 'mov', 'mkv', 'avi'];
        if (supported.includes(fileExt)) {
          setFormat(fileExt);
        } else {
          setFormat('mp4');
        }
      }
    }
  };

  // Video element meta loaders
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleLog = (message: string) => {
    setLogs((prev) => [...prev.slice(-100), message]);
    if (message.includes('Setting')) {
      setStatusText(message);
    } else if (message.includes('frame=')) {
      setStatusText('Processing frames and encoding streams...');
    }
  };

  const executeWasmCompress = async () => {
    if (!file) return;
    setStatusText('Loading FFmpeg core libraries (approx. 30MB, cached locally)...');
    await getFFmpeg(handleLog, setProgress);
    
    setStatusText('Encoding video frames client-side using WASM...');

    let targetVideoBitrate: string | undefined;
    let targetAudioBitrate: string | undefined;
    
    const platformInfo = TARGET_PRESET_MAP[targetPreset];
    const targetMB = platformInfo?.maxMB;

    if (targetMB && videoDuration > 0) {
      const totalBytes = targetMB * 1024 * 1024;
      const totalBitrateBps = (totalBytes * 8) / videoDuration;
      const audioBps = 96000;
      const videoBps = Math.max(80000, totalBitrateBps - audioBps);
      
      targetVideoBitrate = `${Math.round(videoBps / 1000)}k`;
      targetAudioBitrate = `${Math.round(audioBps / 1000)}k`;
    }

    const config = {
      crf,
      scale,
      preset,
      removeAudio: currentMode === 'mute' ? true : currentMode === 'to-audio' ? false : removeAudio,
      format: currentMode === 'gif' ? 'gif' : currentMode === 'to-audio' ? audioFormat : format,
      segments: enableTrim ? trimSegments : undefined,
      compileMode: enableTrim ? trimCompileMode : undefined,
      videoBitrate: targetVideoBitrate,
      audioBitrate: currentMode === 'to-audio' ? audioBitrate : targetAudioBitrate,
      frameRate: currentMode === 'gif' ? gifFps : undefined,
      duration: videoDuration,
      targetMaxMB: targetMB
    };

    return await compressVideo(file, config, handleLog, setProgress);
  };

  const executeNativeCompress = async () => {
    if (!file) return;
    abortControllerRef.current = new AbortController();
    const config = {
      bitrateKbps: nativeBitrate,
      scale,
      removeAudio: removeAudio || mode === 'mute',
      segments: enableTrim ? trimSegments : undefined,
      compileMode: enableTrim ? trimCompileMode : undefined,
      onProgress: setProgress,
      onLog: handleLog,
      signal: abortControllerRef.current.signal
    };

    return await compressVideoNative(file, config);
  };

  const startCompression = async () => {
    if (!file) return;
    
    isCancelledRef.current = false;
    setShowAbortConfirm(false);
    setProcessing(true);
    setProgress(0);
    setLogs([]);
    setStatusText('Preparing sandbox pipelines...');

    try {
      let compressResult;
      if (engine === 'wasm') {
        compressResult = await executeWasmCompress();
      } else {
        compressResult = await executeNativeCompress();
        if (compressResult && format !== 'webm' && format !== 'gif') {
          setStatusText(`Converting WebM stream to target ${format.toUpperCase()} container...`);
          const remuxed = await remuxVideoBlob(
            compressResult.blob,
            file.name,
            format,
            handleLog,
            setProgress
          );
          compressResult = {
            ...compressResult,
            blob: remuxed.blob,
            url: remuxed.url,
            name: remuxed.name,
            newSize: remuxed.blob.size
          };
        }
      }
      
      if (compressResult && !isCancelledRef.current) {
        setResult(compressResult);
        onUploadSuccess();
      }
      setProcessing(false);
    } catch (e: any) {
      console.error(e);
      setProcessing(false);
      setShowAbortConfirm(false);
      const errMsg = e?.message || String(e);
      const isCancelled = isCancelledRef.current || errMsg.includes('terminate') || errMsg.includes('aborted') || errMsg.includes('cancel');

      if (isCancelled) {
        setStatusText('Processing cancelled by user.');
        setLogs((prev) => [...prev, 'Process cancelled by user.']);
        return;
      }

      setLogs((prev) => [...prev, `ERROR: ${errMsg}`]);
      setStatusText('An error occurred during video processing.');
      alert(`Compression failed: ${errMsg}`);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setProgress(0);
    setLogs([]);
    setVideoDuration(0);
    setCurrentTime(0);
    setEnableTrim(false);
  };

  const getSavings = () => {
    if (!result) return 0;
    const diff = result.originalSize - result.newSize;
    if (diff <= 0) return 0;
    return Math.round((diff / result.originalSize) * 100);
  };

  const getToolTitle = () => {
    if (mode === 'gif') return 'Video to GIF';
    if (mode === 'mute') return 'Mute Video';
    if (mode === 'to-audio') return 'Video to Audio Converter';
    if (mode === 'to-text') return 'Video to Text Transcriber';
    if (mode === 'whatsapp') return 'WhatsApp Video Compressor (≤16MB)';
    if (mode === 'discord') return 'Discord Video Compressor (≤10MB)';
    if (mode === 'tiktok') return 'TikTok Video Compressor (≤72MB)';
    if (mode === 'instagram') return 'Instagram Video Compressor (≤100MB)';
    if (mode === 'x') return 'Twitter/X Video Compressor (≤512MB)';
    if (mode === 'telegram') return 'Telegram Video Compressor (≤2GB)';
    if (mode === 'facebook') return 'Facebook Video Compressor (≤4GB)';
    if (mode === 'youtube') return 'YouTube Video Compressor (≤500MB)';
    if (mode === 'convert') return 'Video Format Converter';
    return 'Video Compressor';
  };

  return (
    <div className="tool-layout">
      <ToolHeader 
        title={getToolTitle()} 
        description={getToolDescription()} 
        icon={FileVideo} 
        onGoHome={() => {
          if (file || result || processing) {
            reset();
          } else {
            onGoHome();
          }
        }} 
      />

      {/* Top Video Sub-Tool Navigation Bar */}
      {!processing && !result && (
        <div className="w-full flex justify-center mt-1 mb-3 sm:mb-4">
          <div className="flex items-center gap-0.5 sm:gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-sm w-full sm:w-auto overflow-x-auto no-scrollbar" style={{WebkitOverflowScrolling: 'touch'}}>
            {[
              { id: 'compress', label: 'Compress' },
              { id: 'to-audio', label: 'To Audio' },
              { id: 'gif', label: 'To GIF' },
              { id: 'mute', label: 'Mute' }
            ].map((tab) => {
              const isActive = currentMode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { window.location.hash = tab.id === 'compress' ? 'video-compressor' : `video-${tab.id}`; }}
                  className={`flex-1 sm:flex-none px-3 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 min-h-[36px] ${
                    isActive
                      ? 'bg-zinc-800 text-white font-extrabold shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!file && !result && (
        <div className="w-full max-w-2xl mx-auto py-2">
          <FileUploader 
            accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/avi,video/x-flv,video/x-ms-wmv,video/3gpp,video/mpeg,.mp4,.webm,.mov,.mkv,.avi,.flv,.wmv,.3gp,.mpeg"
            label="Upload video file to process"
            subLabel="Drag & drop MP4, WebM, MOV, MKV, FLV, WMV, 3GP, or MPEG files (No size limits)"
            onFilesSelected={handleFilesSelected}
            maxSizeMB={12000} // Bumps file uploader size limit for native compression!
          />
        </div>
      )}

      {file && !result && !processing && (
        <div className="w-full max-w-2xl mx-auto py-2">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] shadow-sm overflow-hidden p-6 space-y-6">
            
            {/* Header / File Title */}
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2 truncate">
                <FileVideo className="w-4 h-4 text-[var(--text-secondary)]" />
                <span className="text-xs font-bold text-[var(--text-primary)] truncate max-w-sm">{file.name}</span>
              </div>
              <Button variant="ghost" onClick={reset} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs h-7 px-2">
                Remove File
              </Button>
            </div>

            {/* File Metrics */}
            <div className="p-3 bg-[var(--bg-color)]/20 border border-[var(--border-color)] rounded-lg text-center">
              <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Original Size</span>
              <span className="block text-xl font-extrabold text-[var(--text-primary)] mt-1">{formatBytes(file.size)}</span>
            </div>

            {/* Looping Silent Preview Video */}
            <div className="relative overflow-hidden rounded-lg bg-black/40 border border-[var(--border-color)]">
              <video 
                ref={videoRef}
                src={previewUrl || undefined} 
                autoPlay
                loop
                muted
                playsInline
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                className="w-full max-h-[220px] sm:max-h-[280px] object-contain opacity-80"
              />
            </div>

            {/* Optional Trim Timeline Toggle */}
            <div className="border-t border-[var(--border-color)]/40 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs text-[var(--text-primary)]">Trim & Cut Media</h3>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Launch precision gallery handles and frame-step editor.</p>
                </div>
                <Switch
                  checked={enableTrim}
                  onCheckedChange={setEnableTrim}
                  aria-label="Toggle trim timeline editor"
                />
              </div>
              {enableTrim && videoDuration > 0 && (
                <div className="mt-4">
                  <TrimTimeline 
                    duration={videoDuration}
                    currentTime={currentTime}
                    isPlaying={isPlaying}
                    onTogglePlay={togglePlay}
                    onSeek={handleSeek}
                    onChange={(segs, mode) => {
                      setTrimSegments(segs);
                      setTrimCompileMode(mode);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Settings & Configurations Tailored Per Sub-Tool */}
            <div className="border-t border-[var(--border-color)]/40 pt-4 space-y-4">
              {mode === 'to-audio' ? (
                /* Video to Audio Controls */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Audio Format</label>
                    <Select value={audioFormat} onValueChange={(val: any) => setAudioFormat(val)}>
                      <SelectTrigger className="w-full h-8 text-xs bg-transparent border-[var(--border-color)]">
                        <SelectValue>
                          {audioFormat === 'mp3' ? 'MP3 (Standard Audio)' : audioFormat === 'aac' ? 'AAC (High Efficiency)' : 'WAV (Uncompressed PCM)'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mp3">MP3 (Standard Audio)</SelectItem>
                        <SelectItem value="aac">AAC (High Efficiency)</SelectItem>
                        <SelectItem value="wav">WAV (Uncompressed PCM)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Audio Bitrate</label>
                    <Select value={audioBitrate} onValueChange={(val: any) => setAudioBitrate(val)}>
                      <SelectTrigger className="w-full h-8 text-xs bg-transparent border-[var(--border-color)]">
                        <SelectValue>
                          {audioBitrate === '320k' ? '320 kbps (High Quality)' : audioBitrate === '192k' ? '192 kbps (Standard)' : '128 kbps (Compact)'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="320k">320 kbps (High Quality)</SelectItem>
                        <SelectItem value="192k">192 kbps (Standard)</SelectItem>
                        <SelectItem value="128k">128 kbps (Compact)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : mode === 'gif' ? (
                /* Video to GIF Controls */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">GIF Framerate</label>
                    <Select value={gifFps.toString()} onValueChange={(val) => setGifFps(parseInt(val || '15', 10))}>
                      <SelectTrigger className="w-full h-8 text-xs bg-transparent border-[var(--border-color)]">
                        <SelectValue>
                          {gifFps === 24 ? '24 FPS (Smooth)' : gifFps === 15 ? '15 FPS (Standard)' : '10 FPS (Compact)'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24">24 FPS (Smooth)</SelectItem>
                        <SelectItem value="15">15 FPS (Standard)</SelectItem>
                        <SelectItem value="10">10 FPS (Compact)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Dimensions</label>
                    <Select value={scale} onValueChange={(val) => setScale(val || 'no-scale')}>
                      <SelectTrigger className="w-full h-8 text-xs bg-transparent border-[var(--border-color)]">
                        <SelectValue>
                          {scale === '480:360' ? '480p (Standard)' : scale === '640:480' ? '640p (HD GIF)' : scale === '320:240' ? '320p (Small)' : 'Original Dimensions'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no-scale">Original Dimensions</SelectItem>
                        <SelectItem value="640:480">640p (HD GIF)</SelectItem>
                        <SelectItem value="480:360">480p (Standard)</SelectItem>
                        <SelectItem value="320:240">320p (Small)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : mode === 'mute' ? (
                /* Mute Video Controls */
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Output Format</label>
                      <Select value={format} onValueChange={(val) => setFormat(val || 'mp4')}>
                        <SelectTrigger className="w-full h-8 text-xs bg-transparent border-[var(--border-color)]">
                          <SelectValue>
                            {format === 'mp4' ? 'MP4 (Standard)' : format === 'webm' ? 'WebM (VP9)' : format === 'mov' ? 'MOV (QuickTime)' : format === 'mkv' ? 'MKV (Matroska)' : format.toUpperCase()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mp4">MP4 (Standard)</SelectItem>
                          <SelectItem value="webm">WebM (VP9)</SelectItem>
                          <SelectItem value="mov">MOV (QuickTime)</SelectItem>
                          <SelectItem value="mkv">MKV (Matroska)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Audio Status</label>
                      <div className="h-8 px-3 rounded-md bg-rose-500/10 border border-rose-500/20 flex items-center justify-between text-xs font-bold text-rose-400">
                        <span>Audio Channel</span>
                        <span className="text-[10px] font-mono uppercase bg-rose-950 px-1.5 py-0.5 rounded border border-rose-800">Muted</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Standard Video Compression Controls */
                <>
                  <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {/* Target Platform Preset Selector */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Target Preset</label>
                      <Select value={targetPreset} onValueChange={(val: any) => setTargetPreset(val)}>
                        <SelectTrigger className="w-full h-8 text-xs bg-transparent border-[var(--border-color)] font-bold">
                          <SelectValue>
                            {targetPreset === 'whatsapp' ? 'WhatsApp (≤16 MB)' :
                             targetPreset === 'discord' ? 'Discord Free (≤10 MB)' :
                             targetPreset === 'tiktok' ? 'TikTok (≤70 MB)' :
                             targetPreset === 'instagram' ? 'Instagram (≤95 MB)' : 'General / Custom Size'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General / Custom Size</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp (≤16 MB)</SelectItem>
                          <SelectItem value="discord">Discord Free (≤10 MB)</SelectItem>
                          <SelectItem value="tiktok">TikTok (≤70 MB)</SelectItem>
                          <SelectItem value="instagram">Instagram (≤95 MB)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Engine Selector */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Engine</label>
                      <Tabs value={engine} onValueChange={(v: string) => setEngine(v as any)} className="w-full">
                        <TabsList className="grid grid-cols-2 w-full h-8">
                          <TabsTrigger value="wasm" className="text-[11px] py-1">WASM</TabsTrigger>
                          <TabsTrigger value="native" className="text-[11px] py-1">Native</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>

                    {/* Quality Presets */}
                    {engine === 'wasm' ? (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Compression</label>
                        <Select value={crf.toString()} onValueChange={(val) => setCrf(parseInt(val || '28', 10))}>
                          <SelectTrigger className="w-full h-8 text-xs bg-transparent border-[var(--border-color)]">
                            <SelectValue>
                              {crf === 22 ? "High Quality (CRF 22)" : crf === 28 ? "Balanced (CRF 28)" : "Eco Mode (CRF 32)"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="22">High Quality (CRF 22)</SelectItem>
                            <SelectItem value="28">Balanced (CRF 28)</SelectItem>
                            <SelectItem value="32">Eco Mode (CRF 32)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Compression</label>
                        <Select value={nativeBitrate.toString()} onValueChange={(val) => setNativeBitrate(parseInt(val || '3000', 10))}>
                          <SelectTrigger className="w-full h-8 text-xs bg-transparent border-[var(--border-color)]">
                            <SelectValue>
                              {nativeBitrate === 5000 ? "High Quality (5 Mbps)" : nativeBitrate === 3000 ? "Balanced (3 Mbps)" : "Eco Mode (1.5 Mbps)"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5000">High Quality (5 Mbps)</SelectItem>
                            <SelectItem value="3000">Balanced (3 Mbps)</SelectItem>
                            <SelectItem value="1500">Eco Mode (1.5 Mbps)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Output Format */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Format</label>
                      <Select value={format} onValueChange={(val) => setFormat(val || 'mp4')}>
                        <SelectTrigger className="w-full h-8 text-xs bg-transparent border-[var(--border-color)]">
                          <SelectValue>
                            {format === 'mp4' ? 'MP4 (Standard)' : format === 'webm' ? 'WebM (VP9)' : format === 'mov' ? 'MOV (QuickTime)' : format === 'mkv' ? 'MKV (Matroska)' : format === 'avi' ? 'AVI (Video)' : format.toUpperCase()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mp4">MP4 (Standard)</SelectItem>
                          <SelectItem value="webm">WebM (VP9)</SelectItem>
                          <SelectItem value="mov">MOV (QuickTime)</SelectItem>
                          <SelectItem value="mkv">MKV (Matroska)</SelectItem>
                          <SelectItem value="avi">AVI (Video)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Platform Size Guarantee Banner */}
                  {targetPreset !== 'general' && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 font-bold flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="dot-glow-blue shrink-0" />
                        <span>{TARGET_PRESET_MAP[targetPreset]?.badge}</span>
                      </div>
                      <span className="text-[9px] font-mono font-black uppercase bg-blue-950 px-2.5 py-0.5 rounded border border-blue-800 text-blue-200 shadow">
                        Guaranteed
                      </span>
                    </div>
                  )}
                </div>

                  {/* Advanced Settings trigger button */}
                  <Button 
                    variant="ghost" 
                    onClick={() => setShowAdvanced(!showAdvanced)} 
                    className="w-full text-[11px] h-7 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    {showAdvanced ? "Hide Advanced Settings" : "Show Advanced Settings"}
                  </Button>

                  {/* Advanced Settings Collapsible */}
                  {showAdvanced && (
                    <div className="space-y-4 pt-3 border-t border-[var(--border-color)]/30 animation-[fade-up_0.2s_ease-out]">
                      {engine === 'wasm' ? (
                        <>
                          {/* Custom CRF slider */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Custom Constant Rate Factor (CRF)</span>
                              <span className="font-bold text-[var(--text-primary)]">{crf}</span>
                            </div>
                            <Slider 
                              min={18} 
                              max={38} 
                              step={1} 
                              value={[crf]} 
                              onValueChange={(val) => setCrf(Array.isArray(val) ? val[0] : val)}
                              className="py-1"
                            />
                          </div>

                          {/* Custom Resolution scale */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block">Custom Resolution</label>
                            <Select value={scale} onValueChange={(val) => setScale(val || 'no-scale')}>
                              <SelectTrigger className="w-full h-8 text-xs bg-transparent border-[var(--border-color)]">
                                <SelectValue>
                                  {scale === '1920:1080' ? '1080p (Full HD)' : scale === '1280:720' ? '720p (HD Ready)' : scale === '854:480' ? '480p (Web Standard)' : scale === '640:360' ? '360p (Mobile Size)' : 'Original Dimensions'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="no-scale">Original Dimensions</SelectItem>
                                <SelectItem value="1920:1080">1080p (Full HD)</SelectItem>
                                <SelectItem value="1280:720">720p (HD Ready)</SelectItem>
                                <SelectItem value="854:480">480p (Web Standard)</SelectItem>
                                <SelectItem value="640:360">360p (Mobile Size)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* WASM Speed preset */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block">WASM Core Speed</label>
                            <Select value={preset} onValueChange={(val) => setPreset(val || 'fast')}>
                              <SelectTrigger className="w-full h-8 text-xs bg-transparent border-[var(--border-color)]">
                                <SelectValue>
                                  {preset === 'ultrafast' ? 'Ultrafast (High size, fast)' : preset === 'fast' ? 'Fast' : preset === 'medium' ? 'Medium (Standard)' : preset === 'slow' ? 'Slow (Best size, slow)' : 'Fast'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ultrafast">Ultrafast (High size, fast)</SelectItem>
                                <SelectItem value="fast">Fast</SelectItem>
                                <SelectItem value="medium">Medium (Standard)</SelectItem>
                                <SelectItem value="slow">Slow (Best size, slow)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Native Custom target bitrate */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Custom Target Bitrate</span>
                              <span className="font-bold text-[var(--text-primary)]">{(nativeBitrate / 1000).toFixed(1)} Mbps</span>
                            </div>
                            <Slider 
                              min={500} 
                              max={12000} 
                              step={250} 
                              value={[nativeBitrate]} 
                              onValueChange={(val) => setNativeBitrate(Array.isArray(val) ? val[0] : val)}
                              className="py-1"
                            />
                          </div>

                          {/* Native Custom Resolution scale */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block">Custom Resolution</label>
                            <Select value={scale} onValueChange={(val) => setScale(val || 'no-scale')}>
                              <SelectTrigger className="w-full h-8 text-xs bg-transparent border-[var(--border-color)]">
                                <SelectValue>
                                  {scale === '1920:1080' ? '1080p (Full HD)' : scale === '1280:720' ? '720p (HD Ready)' : scale === '854:480' ? '480p (Web Standard)' : scale === '640:360' ? '360p (Mobile Size)' : 'Original Dimensions'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="no-scale">Original Dimensions</SelectItem>
                                <SelectItem value="1920:1080">1080p (Full HD)</SelectItem>
                                <SelectItem value="1280:720">720p (HD Ready)</SelectItem>
                                <SelectItem value="854:480">480p (Web Standard)</SelectItem>
                                <SelectItem value="640:360">360p (Mobile Size)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Strip Audio toggle */}
                  <div className="flex items-center space-x-2 border-t border-[var(--border-color)]/30 pt-3">
                    <Switch
                      id="nativeRemoveAudio"
                      checked={removeAudio}
                      onCheckedChange={setRemoveAudio}
                    />
                    <label htmlFor="nativeRemoveAudio" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                      Strip audio track (Mute)
                    </label>
                  </div>
                </>
              )}
            </div>

            {/* Dynamic Primary Action Button */}
            <Button
              onClick={startCompression}
              className="w-full mt-4 font-bold rounded-full py-6 text-sm bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 transition-colors cursor-pointer"
            >
              {getActionButtonText()}
            </Button>
          </Card>
        </div>
      )}

      {processing && (
        <div className="max-w-2xl mx-auto py-12">
          <ProgressBar progress={progress} statusText={statusText} />
          
          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="flex gap-4">
              <Button 
                variant="ghost" 
                onClick={() => setShowLogs(!showLogs)}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold cursor-pointer"
              >
                {showLogs ? 'Hide Console Logs' : 'View Console Logs'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowAbortConfirm(true)}
                className="text-xs font-bold text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:bg-rose-500/10 rounded-full px-4 h-8 cursor-pointer transition-colors"
              >
                Cancel Compression
              </Button>
            </div>
            
            {showLogs && (
              <pre className="w-full bg-[var(--surface-color)] text-[var(--text-primary)] p-4 rounded-xl font-mono text-[11px] h-48 overflow-y-auto mt-3 border border-[var(--border-color)] leading-relaxed">
                {logs.map((log, idx) => (
                  <div key={idx} className="border-b border-[var(--border-color)]/40 pb-1 break-all">
                    {log}
                  </div>
                ))}
                <div ref={logEndRef} />
              </pre>
            )}
          </div>

          {/* Custom Styled Abort Confirmation Dialog */}
          <Dialog open={showAbortConfirm} onOpenChange={setShowAbortConfirm}>
            <DialogContent className="max-w-md bg-[var(--surface-color)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-2xl p-6 shadow-2xl">
              <DialogHeader className="space-y-3">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <WarningIcon className="w-5 h-5" />
                </div>
                <DialogTitle className="text-base font-bold text-[var(--text-primary)]">
                  Abort Compression?
                </DialogTitle>
                <DialogDescription className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Are you sure you want to stop processing? The current encoding progress will be discarded.
                </DialogDescription>
              </DialogHeader>

              <DialogFooter className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAbortConfirm(false)}
                  className="h-9 text-xs font-bold rounded-xl border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  Continue Processing
                </Button>
                <Button
                  onClick={() => {
                    setShowAbortConfirm(false);
                    cancelProcessing();
                  }}
                  className="h-9 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white cursor-pointer transition-colors"
                >
                  Yes, Abort Compression
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {result && (
        <div className="max-w-2xl mx-auto space-y-6 animate-[fade-up_0.35s_ease-out]">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] shadow-xl overflow-hidden p-6 space-y-5 relative">
            {/* Card Top Bar with File Tag & Reset */}
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2 truncate bg-[var(--bg-color)]/50 px-3 py-1.5 rounded-full border border-[var(--border-color)]">
                <FileVideo className="w-4 h-4 text-sky-500 shrink-0" />
                <span className="text-xs font-bold text-[var(--text-primary)] truncate max-w-xs">{file?.name || result.name}</span>
              </div>
              <Button 
                variant="ghost" 
                onClick={reset} 
                className="text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 text-xs h-7 px-2 rounded-full cursor-pointer transition-colors"
                title="Start over with another file"
              >
                ✕
              </Button>
            </div>

            {/* Original vs Compressed Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[var(--bg-color)]/30 border border-[var(--border-color)] rounded-xl text-center">
                <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Original Size</span>
                <span className="block text-2xl font-black text-[var(--text-primary)] mt-1">{formatBytes(result.originalSize)}</span>
              </div>
              <div className="p-4 bg-[var(--bg-color)]/30 border border-[var(--border-color)] rounded-xl text-center">
                <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Compressed Size</span>
                <span className="block text-2xl font-black text-white mt-1">{formatBytes(result.newSize)}</span>
              </div>
            </div>

            {/* Media Player Preview Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  {mode === 'to-audio' ? 'Audio Track Preview' : mode === 'gif' ? 'GIF Animation Preview' : 'Video Preview'}
                </span>
                <span className="text-[11px] font-bold text-zinc-200 bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700">
                  {result.name.split('.').pop()?.toUpperCase()} Format
                </span>
              </div>

              <div className="relative overflow-hidden rounded-xl bg-black border border-[var(--border-color)] shadow-inner">
                {mode === 'to-audio' || ['mp3', 'aac', 'wav', 'flac', 'ogg', 'm4a'].includes(result.name.split('.').pop()?.toLowerCase() || '') ? (
                  <div className="p-4 sm:p-6 flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300">
                      <FileVideo className="w-6 h-6" />
                    </div>
                    <audio src={result.url} controls className="w-full max-w-md" />
                  </div>
                ) : mode === 'gif' || result.name.endsWith('.gif') ? (
                  <img src={result.url} alt="Result GIF" className="w-full max-h-[280px] sm:max-h-[360px] object-contain mx-auto" />
                ) : (
                  <video 
                    src={result.url} 
                    controls 
                    preload="metadata"
                    playsInline
                    className="w-full max-h-[280px] sm:max-h-[360px] object-contain mx-auto" 
                  />
                )}
              </div>
            </div>

              {/* Bottom Bar: Savings Tag & Download Action */}
              <div className="pt-3 border-t border-[var(--border-color)]/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="status-dot-glow shrink-0" />
                  <span className="text-xs font-bold text-zinc-200">
                  {getSavings() > 0 
                    ? `Saved ${getSavings()}% of original size` 
                    : `Optimal Size (${formatBytes(result.newSize)})`}
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  onClick={reset}
                  className="h-11 text-xs rounded-xl border-[var(--border-color)] px-4 font-bold cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Another
                </Button>
                <a 
                  href={result.url} 
                  download={result.name}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold px-6 py-3 rounded-xl text-xs shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" /> 
                  {mode === 'to-audio' ? 'Download Audio Track' : mode === 'gif' ? 'Download GIF' : mode === 'mute' ? 'Download Muted Video' : 'Download Compressed Video'}
                </a>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
