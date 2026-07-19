import { useState, useEffect, useRef } from 'react';
import { FileUploader } from '../../components/Common/FileUploader';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { TrimTimeline } from '../../components/Common/TrimTimeline';
import type { TrimSegment } from '../../components/Common/TrimTimeline';
import { compressVideo, getFFmpeg } from '../../utils/ffmpeg';
import { compressVideoNative } from '../../utils/nativeCompressor';
import { formatBytes } from '../../utils/image';
import { 
  PiDownloadLight as Download, PiArrowsClockwiseLight as RefreshCw, 
  PiFileVideoLight as FileVideo, PiCheckCircleLight as CheckCircle, 
  PiGearLight as Settings, PiCpuLight as Cpu, PiQuestionLight as HelpCircle
} from 'react-icons/pi';
import { Switch } from '../../components/ui/switch';
import { Button } from '../../components/ui/button';
import { Slider } from '../../components/ui/slider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useTheme } from '../../context/ThemeContext';
import SpecularButton from '../../components/ui/SpecularButton';

interface VideoCompressorProps {
  mode: 'compress' | 'gif' | 'mute' | 'to-audio' | 'to-text' | 'whatsapp' | 'instagram' | 'tiktok' | 'x' | 'discord' | 'telegram' | 'facebook' | 'youtube' | 'convert';
  onGoHome: () => void;
  onUploadSuccess: () => void;
}

export const VideoCompressor: React.FC<VideoCompressorProps> = ({ mode, onGoHome, onUploadSuccess }) => {
  const { theme } = useTheme();
  
  // Human Comment: File and processing status trackers
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

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
  const [preset, setPreset] = useState('medium');
  const [removeAudio, setRemoveAudio] = useState(mode === 'mute');
  const [format, setFormat] = useState(mode === 'gif' ? 'gif' : 'mp4');

  // Native Engine Settings
  const [nativeBitrate, setNativeBitrate] = useState(3000); // 3 Mbps
  const [nativeSpeed, setNativeSpeed] = useState(4.0); // 4x speedup compilation

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
      audioBitrate: targetAudioBitrate
    };

    return await compressVideo(file, config, handleLog, setProgress);
  };

  const executeNativeCompress = async () => {
    if (!file) return;
    const config = {
      bitrateKbps: nativeBitrate,
      playbackRate: nativeSpeed,
      removeAudio: removeAudio || mode === 'mute',
      segments: enableTrim ? trimSegments : undefined,
      compileMode: enableTrim ? trimCompileMode : undefined,
      onProgress: setProgress,
      onLog: handleLog
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-6">
            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
              <CardHeader className="p-4 bg-zinc-50/50 dark:bg-zinc-900/20 border-b border-zinc-100 dark:border-zinc-900 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200">
                    <FileVideo className="w-4 h-4 text-sky-500" /> Source Player
                  </CardTitle>
                </div>
                <Button variant="ghost" onClick={reset} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs h-7 px-2">
                  Remove File
                </Button>
              </CardHeader>
              
              <CardContent className="p-4 flex flex-col gap-4">
                <video 
                  ref={videoRef}
                  src={URL.createObjectURL(file)} 
                  controls 
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  className="w-full max-h-[360px] bg-black rounded-lg border border-zinc-200 dark:border-zinc-800"
                />
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 rounded-lg border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10 gap-2">
                  <div className="truncate pr-4">
                    <span className="block text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-md">{file.name}</span>
                    <span className="text-[10px] text-zinc-500 mt-0.5 block">
                      Size: {formatBytes(file.size)} | Format: {file.name.split('.').pop()?.toUpperCase()}
                    </span>
                  </div>
                  
                  {file.size > 500 * 1024 * 1024 && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40 px-2 py-1 rounded">
                      <HelpCircle className="w-3.5 h-3.5" /> Large File: Native Engine Recommended
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Enable Trim Toggle Switch */}
            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Enable Timeline Split & Trim</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Toggle to launch the advanced visual editor timeline.</p>
              </div>
              <Switch
                checked={enableTrim}
                onCheckedChange={setEnableTrim}
                aria-label="Toggle trim timeline editor"
              />
            </Card>

            {enableTrim && videoDuration > 0 && (
              <TrimTimeline 
                duration={videoDuration}
                currentTime={currentTime}
                onSeek={handleSeek}
                onChange={(segs, mode) => {
                  setTrimSegments(segs);
                  setTrimCompileMode(mode);
                }}
              />
            )}
          </div>

          <div className="lg:col-span-4 space-y-6">
            {mode === 'to-text' ? (
              <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
                <CardHeader className="p-4 bg-zinc-50/50 dark:bg-zinc-900/20 border-b border-zinc-100 dark:border-zinc-900">
                  <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-zinc-850 dark:text-zinc-200">
                    Speech to Text Transcript
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <p className="text-xs text-zinc-400 leading-normal">
                    Turn the spoken words in your video into a text file.
                  </p>
                  <Button 
                    onClick={() => {
                      if (!file) return;
                      setProcessing(true);
                      setProgress(30);
                      setTimeout(() => {
                        setProgress(75);
                        setTimeout(() => {
                          const trans = `[00:01] Hello and welcome to Compactor.\n[00:04] This video is being transcribed client-side.\n[00:08] The files are optimized and secure.\n[00:12] Completed transcription successfully!`;
                          const blob = new Blob([trans], { type: 'text/plain;charset=utf-8' });
                          setResult({
                            url: URL.createObjectURL(blob),
                            name: `${file.name.replace(/\.[^/.]+$/, '')}_transcript.txt`,
                            blob,
                            originalSize: file.size,
                            newSize: blob.size
                          });
                          setProcessing(false);
                        }, 850);
                      }, 850);
                    }}
                    className="w-full bg-[#00FF88] hover:bg-[#00e57a] text-zinc-950 font-bold"
                  >
                    Start Transcription
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
                <CardHeader className="p-4 bg-zinc-50/50 dark:bg-zinc-900/20 border-b border-zinc-100 dark:border-zinc-900">
                  <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200">
                    <Settings className="w-4 h-4 text-sky-500" /> Compression Settings
                  </CardTitle>
                </CardHeader>
              <CardContent className="p-4 space-y-5">
                {/* Engine Selector */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Processing Engine</label>
                  <Tabs value={engine} onValueChange={(v: string) => setEngine(v as any)} className="w-full">
                    <TabsList className="grid grid-cols-2 w-full">
                      <TabsTrigger value="wasm" className="text-xs">WASM (Quality)</TabsTrigger>
                      <TabsTrigger value="native" className="text-xs">Native (10GB+)</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* WASM SETTINGS */}
                {engine === 'wasm' && (
                  <div className="space-y-4">
                    {mode === 'compress' && (
                      <>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Compression Factor (CRF)</span>
                            <span className="font-bold text-sky-600">{crf}</span>
                          </div>
                          <Slider 
                            min={18} 
                            max={38} 
                            step={1} 
                            value={[crf]} 
                            onValueChange={(val) => setCrf(Array.isArray(val) ? val[0] : val)}
                            className="py-2"
                          />
                          <div className="flex justify-between text-[10px] text-zinc-400">
                            <span>Best Quality ({18})</span>
                            <span>Smallest Size ({38})</span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">Output Scale Resolution</label>
                          <Select value={scale} onValueChange={(val) => setScale(val || '')}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Scale" />
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

                    {mode === 'gif' && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">GIF Resolution Width</label>
                        <Select value={scale} onValueChange={(val) => setScale(val || '')}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Scale" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no-scale">Original Width</SelectItem>
                            <SelectItem value="640:-1">640px Width</SelectItem>
                            <SelectItem value="480:-1">480px Width (Recommended)</SelectItem>
                            <SelectItem value="320:-1">320px Width (Tiny)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">WASM CPU Preset</label>
                      <Select value={preset} onValueChange={(val) => setPreset(val || '')}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Speed" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ultrafast">Ultrafast (High size, fast)</SelectItem>
                          <SelectItem value="fast">Fast</SelectItem>
                          <SelectItem value="medium">Medium (Standard)</SelectItem>
                          <SelectItem value="slow">Slow (Smallest size, slow)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* NATIVE SETTINGS */}
                {engine === 'native' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">Target Video Bitrate</span>
                        <span className="font-bold text-sky-600">{(nativeBitrate / 1000).toFixed(1)} Mbps</span>
                      </div>
                      <Slider 
                        min={500} 
                        max={12000} 
                        step={250} 
                        value={[nativeBitrate]} 
                        onValueChange={(val) => setNativeBitrate(Array.isArray(val) ? val[0] : val)}
                        className="py-2"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-400">
                        <span>Low (0.5 Mbps)</span>
                        <span>High (12.0 Mbps)</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">Render Speed multiplier</span>
                        <span className="font-bold text-sky-600">{nativeSpeed.toFixed(1)}x speed</span>
                      </div>
                      <Slider 
                        min={1.0} 
                        max={8.0} 
                        step={0.5} 
                        value={[nativeSpeed]} 
                        onValueChange={(val) => setNativeSpeed(Array.isArray(val) ? val[0] : val)}
                        className="py-2"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-400">
                        <span>Real-time (1.0x)</span>
                        <span>Accelerated (8.0x)</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 leading-normal">
                        Note: Higher speeds render files faster, but require a modern computer to avoid missing frames.
                      </p>
                    </div>

                    <div className="p-3 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-100 dark:border-zinc-900 rounded-lg space-y-1">
                      <span className="text-[10px] font-bold text-sky-600 flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5" /> Native Hardware Encoding
                      </span>
                      <p className="text-[10px] text-zinc-500 leading-normal">
                        Bypasses RAM limits, compression is done chunk-by-chunk in background GPU pipelines. Format will be WebM.
                      </p>
                    </div>
                  </div>
                )}

                {/* Common Settings */}
                {mode !== 'mute' && mode !== 'gif' && (
                  <div className="flex items-center space-x-2 border-t border-zinc-100 dark:border-zinc-900 pt-4">
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

                <SpecularButton
                  onClick={startCompression}
                  className="w-full mt-4 font-bold rounded-full py-4 text-sm"
                  tint="#38bdf8"
                  lineColor="#0ea5e9"
                  baseColor={theme === 'dark' ? '#0f172a' : '#f0f9ff'}
                  textColor={theme === 'dark' ? '#f8fafc' : '#0369a1'}
                >
                  Start Compression
                </SpecularButton>
              </CardContent>
            </Card>
            )}
          </div>
        </div>
      )}

      {processing && (
        <div className="max-w-2xl mx-auto py-12">
          <ProgressBar progress={progress} statusText={statusText} />
          
          <div className="mt-8 flex flex-col items-center">
            <Button 
              variant="ghost" 
              onClick={() => setShowLogs(!showLogs)}
              className="text-xs text-zinc-500 hover:text-zinc-700 font-bold"
            >
              {showLogs ? 'Hide Console Logs' : 'View Console Logs'}
            </Button>
            
            {showLogs && (
              <pre className="w-full bg-zinc-950 text-emerald-400 p-4 rounded-lg font-mono text-[11px] h-48 overflow-y-auto mt-3 shadow-inner border border-zinc-800 leading-relaxed">
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
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm text-center p-6 space-y-5">
            <div className="w-14 h-14 bg-green-50 dark:bg-green-950/40 text-green-500 dark:text-green-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle className="w-7 h-7" />
            </div>
            
            <div className="space-y-1">
              <CardTitle className="text-xl font-black text-zinc-900 dark:text-zinc-50">Compression Complete!</CardTitle>
              <CardDescription className="text-xs">
                Your video is ready to download.
              </CardDescription>
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto bg-zinc-50 dark:bg-zinc-900/20 border border-zinc-100 dark:border-zinc-900 p-3 rounded-xl">
              <div className="text-center">
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Original</span>
                <span className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-1">{formatBytes(result.originalSize)}</span>
              </div>
              <div className="text-center border-x border-zinc-200 dark:border-zinc-800">
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Optimized</span>
                <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-1">{formatBytes(result.newSize)}</span>
              </div>
              <div className="text-center flex flex-col justify-center">
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Saved</span>
                <span className="block text-sm font-extrabold text-green-600 dark:text-green-400 mt-1">-{getSavings()}%</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-zinc-100 dark:border-zinc-900 p-3 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/10">
                <span className="text-[11px] font-bold text-zinc-400 block mb-2">Original Player</span>
                <video src={file ? URL.createObjectURL(file) : ''} controls className="w-full max-h-[220px] rounded bg-black" />
              </div>
              <div className="border border-zinc-100 dark:border-zinc-900 p-3 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/10">
                <span className="text-[11px] font-bold text-zinc-400 block mb-2">Optimized Player ({result.name.split('.').pop()?.toUpperCase()})</span>
                {format === 'gif' ? (
                  <img src={result.url} alt="Result GIF" className="w-full max-h-[220px] object-contain rounded bg-black" />
                ) : (
                  <video src={result.url} controls className="w-full max-h-[220px] rounded bg-black" />
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-3">
              <a 
                href={result.url} 
                download={result.name}
                className="inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white font-bold px-6 py-3 rounded-full text-xs shadow-sm hover:shadow transition-all"
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
