import { useState, useEffect, useRef } from 'react';
import { FileUploader } from '../../components/Common/FileUploader';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { TrimTimeline } from '../../components/Common/TrimTimeline';
import type { TrimSegment } from '../../components/Common/TrimTimeline';
import { compressVideo, getFFmpeg, terminateFFmpeg, remuxVideoBlob } from '../../utils/ffmpeg';
import { compressVideoNative } from '../../utils/nativeCompressor';
import { formatBytes } from '../../utils/image';
import { 
  PiDownloadLight as Download, PiArrowsClockwiseLight as RefreshCw, 
  PiFileVideoLight as FileVideo, PiCheckCircleLight as CheckCircle, 
  PiGearLight as Settings
} from 'react-icons/pi';
import { Switch } from '../../components/ui/switch';
import { Button } from '../../components/ui/button';
import { Slider } from '../../components/ui/slider';
import { Card } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';

interface VideoCompressorProps {
  mode: 'compress' | 'gif' | 'mute' | 'to-audio' | 'to-text' | 'whatsapp' | 'instagram' | 'tiktok' | 'x' | 'discord' | 'telegram' | 'facebook' | 'youtube' | 'convert';
  onGoHome: () => void;
  onUploadSuccess: () => void;
}

export const VideoCompressor: React.FC<VideoCompressorProps> = ({ mode, onGoHome, onUploadSuccess }) => {
  
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

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      terminateFFmpeg();
    };
  }, []);

  const cancelProcessing = () => {
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
  const [format, setFormat] = useState(mode === 'gif' ? 'gif' : 'mp4');

  // Native Engine Settings
  const [nativeBitrate, setNativeBitrate] = useState(3000); // 3 Mbps
  const [nativeSpeed, setNativeSpeed] = useState(4.0); // 4x speedup compilation
  const [showAdvanced, setShowAdvanced] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    setRemoveAudio(mode === 'mute');
    setFormat(mode === 'gif' ? 'gif' : 'mp4');
    setFile(null);
    setResult(null);
    setLogs([]);
    setProgress(0);
    setProcessing(false);
    setEnableTrim(false);

    // Auto-calculate native bitrate targets if mode has specific sizes
    const targetSizes: { [key: string]: number } = {
      whatsapp: 15.5,
      discord: 9.5,
      tiktok: 70,
      instagram: 95,
      x: 500,
      telegram: 2000,
      facebook: 4000,
      youtube: 480
    };
    const targetMB = targetSizes[mode];
    if (targetMB && videoDuration > 0) {
      const totalBytes = targetMB * 1024 * 1024;
      const totalBitrateBps = (totalBytes * 8) / videoDuration;
      const videoBps = Math.max(150000, totalBitrateBps - 96000);
      setNativeBitrate(Math.round(videoBps / 1000));
    }
  }, [mode, videoDuration]);

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
      if (mode !== 'gif' && mode !== 'to-audio') {
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
    
    const targetSizes: { [key: string]: number } = {
      whatsapp: 15.5,
      discord: 9.5,
      tiktok: 70,
      instagram: 95,
      x: 500,
      telegram: 2000,
      facebook: 4000,
      youtube: 480
    };

    const targetMB = targetSizes[mode];
    if (targetMB && videoDuration > 0) {
      const totalBytes = targetMB * 1024 * 1024;
      const totalBitrateBps = (totalBytes * 8) / videoDuration;
      const audioBps = 96000;
      const videoBps = Math.max(120000, totalBitrateBps - audioBps);
      
      targetVideoBitrate = `${Math.round(videoBps / 1000)}k`;
      targetAudioBitrate = `${Math.round(audioBps / 1000)}k`;
    }

    const config = {
      crf,
      scale,
      preset,
      removeAudio: removeAudio || mode === 'mute' || mode === 'to-audio',
      format: mode === 'gif' ? 'gif' : mode === 'to-audio' ? 'mp3' : format,
      segments: enableTrim ? trimSegments : undefined,
      compileMode: enableTrim ? trimCompileMode : undefined,
      videoBitrate: targetVideoBitrate,
      audioBitrate: targetAudioBitrate,
      duration: videoDuration
    };

    return await compressVideo(file, config, handleLog, setProgress);
  };

  const executeNativeCompress = async () => {
    if (!file) return;
    abortControllerRef.current = new AbortController();
    const config = {
      bitrateKbps: nativeBitrate,
      playbackRate: nativeSpeed,
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
      
      if (compressResult) {
        setResult(compressResult);
        onUploadSuccess();
      }
      setProcessing(false);
    } catch (e: any) {
      console.error(e);
      setProcessing(false);
      setLogs((prev) => [...prev, `ERROR: ${e.message || e}`]);
      setStatusText('An error occurred during video processing.');
      alert(`Compression failed: ${e.message || 'Make sure your file is valid and fits your browser memory.'}`);
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
      <div className="tool-layout__header">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">{getToolTitle()}</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Trim, resize, and compress videos for the way you want to share them.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onGoHome} className="h-9">
          All tools
        </Button>
      </div>

      {!file && !result && (
        <div className="max-w-2xl mx-auto py-10">
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
        <div className="max-w-2xl mx-auto py-6">
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

            {/* Original vs Target Sizes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-[var(--bg-color)]/20 border border-[var(--border-color)] rounded-lg text-center">
                <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Original Size</span>
                <span className="block text-xl font-extrabold text-[var(--text-primary)] mt-1">{formatBytes(file.size)}</span>
              </div>
              <div className="p-3 bg-[var(--bg-color)]/20 border border-[var(--border-color)] rounded-lg text-center">
                <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Estimated Target</span>
                <span className="block text-xl font-extrabold text-[var(--text-primary)] mt-1">
                  {engine === 'wasm'
                    ? formatBytes(file.size * (crf >= 32 ? 0.35 : crf >= 28 ? 0.55 : 0.75))
                    : formatBytes(file.size * (nativeBitrate >= 5000 ? 0.75 : nativeBitrate >= 3000 ? 0.55 : 0.35))
                  }
                </span>
              </div>
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
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                className="w-full max-h-[280px] object-contain opacity-60 pointer-events-none"
              />
            </div>

            {/* Optional Trim Timeline Toggle */}
            <div className="border-t border-[var(--border-color)]/40 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs text-[var(--text-primary)]">Trim video timeline</h3>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Toggle to launch the advanced visual editor timeline.</p>
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
                    onSeek={handleSeek}
                    onChange={(segs, mode) => {
                      setTrimSegments(segs);
                      setTrimCompileMode(mode);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Settings & Compression Configurations */}
            <div className="border-t border-[var(--border-color)]/40 pt-4 space-y-4">
              <div className={`grid gap-4 ${mode !== 'gif' && mode !== 'to-audio' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'}`}>
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
                {mode !== 'gif' && mode !== 'to-audio' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Format</label>
                    <Select value={format} onValueChange={(val) => setFormat(val || 'mp4')}>
                      <SelectTrigger className="w-full h-8 text-xs bg-transparent border-[var(--border-color)]">
                        <SelectValue />
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
                        <Select value={scale} onValueChange={(val) => setScale(val || '')}>
                          <SelectTrigger className="w-full h-8 text-xs bg-transparent border-[var(--border-color)]">
                            <SelectValue />
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
                        <Select value={preset} onValueChange={(val) => setPreset(val || '')}>
                          <SelectTrigger className="w-full h-8 text-xs bg-transparent border-[var(--border-color)]">
                            <SelectValue />
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

                      {/* Native Render multiplier speed */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">Render Speed Multiplier</span>
                          <span className="font-bold text-[var(--text-primary)]">{nativeSpeed.toFixed(1)}x speed</span>
                        </div>
                        <Slider 
                          min={1.0} 
                          max={8.0} 
                          step={0.5} 
                          value={[nativeSpeed]} 
                          onValueChange={(val) => setNativeSpeed(Array.isArray(val) ? val[0] : val)}
                          className="py-1"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Strip Audio toggle */}
              {mode !== 'mute' && mode !== 'gif' && (
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
              )}
            </div>

            {/* Start Button */}
            <Button
              onClick={startCompression}
              className="w-full mt-4 font-bold rounded-full py-6 text-sm bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 transition-colors cursor-pointer"
            >
              Start Compression
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
                className="text-xs text-zinc-500 hover:text-zinc-700 font-bold cursor-pointer"
              >
                {showLogs ? 'Hide Console Logs' : 'View Console Logs'}
              </Button>
              <Button 
                variant="outline" 
                onClick={cancelProcessing}
                className="text-xs font-bold text-rose-500 hover:text-rose-600 border border-rose-500/20 hover:bg-rose-500/5 rounded-full px-4 h-8 cursor-pointer"
              >
                Cancel Compression
              </Button>
            </div>
            
            {showLogs && (
              <pre className="w-full bg-zinc-950 text-zinc-350 p-4 rounded-lg font-mono text-[11px] h-48 overflow-y-auto mt-3 shadow-inner border border-zinc-800 leading-relaxed">
                {logs.map((log, idx) => (
                  <div key={idx} className="border-b border-zinc-900/50 pb-1 break-all">
                    {log}
                  </div>
                ))}
                <div ref={logEndRef} />
              </pre>
            )}
          </div>
        </div>
      )}

      {result && (
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] shadow-sm text-center p-6 space-y-5">
            <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 rounded-full flex items-center justify-center mx-auto shadow-inner border border-[var(--border-color)]">
              <CheckCircle className="w-7 h-7" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-xl font-black text-[var(--text-primary)]">Compression Complete!</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Your video is ready to download.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto bg-[var(--bg-color)]/20 border border-[var(--border-color)] p-3 rounded-xl">
              <div className="text-center">
                <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Original</span>
                <span className="block text-sm font-bold text-[var(--text-primary)] mt-1">{formatBytes(result.originalSize)}</span>
              </div>
              <div className="text-center border-x border-[var(--border-color)] px-4">
                <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Optimized</span>
                <span className="block text-sm font-bold text-[var(--text-primary)] mt-1">{formatBytes(result.newSize)}</span>
              </div>
              <div className="text-center flex flex-col justify-center">
                <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Saved</span>
                <span className="block text-sm font-extrabold text-[var(--text-primary)] mt-1">-{getSavings()}%</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-[var(--border-color)] p-3 rounded-lg bg-[var(--bg-color)]/20">
                <span className="text-[11px] font-bold text-[var(--text-secondary)] block mb-2">Original Player</span>
                <video 
                  src={file ? previewUrl : ''} 
                  controls 
                  preload="auto"
                  playsInline
                  onLoadedMetadata={(e) => {
                    const video = e.currentTarget;
                    video.currentTime = 1e9;
                    video.onseeked = () => {
                      video.currentTime = 0;
                      video.onseeked = null;
                    };
                  }}
                  onClick={(e) => {
                    const video = e.currentTarget;
                    if (video.paused) {
                      video.play().catch(err => console.log('Original play failed:', err));
                    } else {
                      video.pause();
                    }
                  }}
                  className="w-full max-h-[220px] rounded bg-black cursor-pointer" 
                />
              </div>
              <div className="border border-[var(--border-color)] p-3 rounded-lg bg-[var(--bg-color)]/20">
                <span className="text-[11px] font-bold text-[var(--text-secondary)] block mb-2">Optimized Player ({result.name.split('.').pop()?.toUpperCase()})</span>
                {format === 'gif' ? (
                  <img src={result.url} alt="Result GIF" className="w-full max-h-[220px] object-contain rounded bg-black" />
                ) : (
                  <video 
                    src={result.url} 
                    controls 
                    preload="auto"
                    playsInline
                    onLoadedMetadata={(e) => {
                      const video = e.currentTarget;
                      video.currentTime = 1e9;
                      video.onseeked = () => {
                        video.currentTime = 0;
                        video.onseeked = null;
                      };
                    }}
                    onClick={(e) => {
                      const video = e.currentTarget;
                      if (video.paused) {
                        video.play().catch(err => console.log('Optimized play failed:', err));
                      } else {
                        video.pause();
                      }
                    }}
                    className="w-full max-h-[220px] rounded bg-black cursor-pointer" 
                  />
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-3">
              <a 
                href={result.url} 
                download={result.name}
                className="inline-flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold px-6 py-3 rounded-full text-xs shadow-sm hover:shadow transition-all"
              >
                <Download className="w-4 h-4" /> Download Optimized Video
              </a>
              <Button 
                variant="outline" 
                onClick={reset}
                className="h-10 text-xs rounded-full border-zinc-200 dark:border-zinc-800"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Compress Another Video
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
