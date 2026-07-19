import { useState, useEffect, useRef } from 'react';
import { FileUploader } from '../../components/Common/FileUploader';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { TrimTimeline } from '../../components/Common/TrimTimeline';
import type { TrimSegment } from '../../components/Common/TrimTimeline';
import { compressAudio, getFFmpeg } from '../../utils/ffmpeg';
import { formatBytes } from '../../utils/image';
import { 
  PiMusicNotesLight as Music, PiDownloadLight as Download, PiArrowsClockwiseLight as RefreshCw, 
  PiCheckCircleLight as CheckCircle, PiGearLight as Settings
} from 'react-icons/pi';
import { Switch } from '../../components/ui/switch';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useTheme } from '../../context/ThemeContext';
import SpecularButton from '../../components/ui/SpecularButton';

interface AudioToolsProps {
  onGoHome: () => void;
  onUploadSuccess: () => void;
}

export const AudioTools: React.FC<AudioToolsProps> = ({ onGoHome, onUploadSuccess }) => {
  const { theme } = useTheme();
  
  // Human Comment: File and execution state tracking
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // Human Comment: Playback syncing properties
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Human Comment: Audio segment range trackers
  const [enableTrim, setEnableTrim] = useState(false);
  const [trimSegments, setTrimSegments] = useState<TrimSegment[]>([]);
  const [trimCompileMode, setTrimCompileMode] = useState<'keep-selected' | 'cut-selected'>('keep-selected');

  // Human Comment: Sandbox output file format
  const [result, setResult] = useState<{
    url: string;
    name: string;
    blob: Blob;
    originalSize: number;
    newSize: number;
  } | null>(null);

  // Settings
  const [bitrate, setBitrate] = useState('128k');
  const [format, setFormat] = useState('mp3');

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleFilesSelected = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setResult(null);
    }
  };

  // Audio element metadata loader
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleLog = (message: string) => {
    setLogs((prev) => [...prev.slice(-100), message]);
    if (message.includes('Setting')) {
      setStatusText(message);
    }
  };

  const startAudioProcessing = async () => {
    if (!file) return;

    setProcessing(true);
    setProgress(0);
    setLogs([]);
    setStatusText('Warming up WebAssembly pipeline...');

    try {
      setStatusText('Loading FFmpeg core libraries...');
      await getFFmpeg(handleLog, setProgress);

      setStatusText('Encoding audio tracks client-side...');
      
      const config = {
        bitrate,
        format,
        segments: enableTrim ? trimSegments : undefined,
        compileMode: enableTrim ? trimCompileMode : undefined
      };

      const compressResult = await compressAudio(file, config, handleLog, setProgress);
      setResult(compressResult);
      onUploadSuccess();
      setProcessing(false);
    } catch (e: any) {
      console.error(e);
      setProcessing(false);
      setLogs((prev) => [...prev, `ERROR: ${e.message || e}`]);
      setStatusText('An error occurred during audio processing.');
      alert(`Processing failed: ${e.message || 'Make sure your browser supports SharedArrayBuffer.'}`);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setProgress(0);
    setLogs([]);
    setAudioDuration(0);
    setCurrentTime(0);
    setEnableTrim(false);
  };

  const getSavings = () => {
    if (!result) return 0;
    const diff = result.originalSize - result.newSize;
    if (diff <= 0) return 0;
    return Math.round((diff / result.originalSize) * 100);
  };

  return (
    <div className="tool-layout">
      <div className="tool-layout__header">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">Compress audio</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Trim a track, reduce its size, and choose the sound quality you want.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onGoHome} className="h-9">
          All tools
        </Button>
      </div>

      {!file && !result && (
        <div className="max-w-2xl mx-auto py-10">
          <FileUploader 
            accept="audio/*"
            label="Upload audio file to process"
            subLabel="Drag & drop any size MP3, WAV, OGG, M4A, or FLAC files (No limit)"
            onFilesSelected={handleFilesSelected}
            maxSizeMB={Infinity}
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
                    <Music className="w-4 h-4 text-sky-500" /> Source Player
                  </CardTitle>
                </div>
                <Button variant="ghost" onClick={reset} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs h-7 px-2">
                  Remove File
                </Button>
              </CardHeader>
              
              <CardContent className="p-5 flex flex-col gap-4">
                <audio 
                  ref={audioRef}
                  src={URL.createObjectURL(file)} 
                  controls 
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  className="w-full mt-2"
                />
                
                <div className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10 mt-2">
                  <span className="block text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{file.name}</span>
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">
                    Size: {formatBytes(file.size)} | Format: {file.name.split('.').pop()?.toUpperCase()}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Enable Trim Switch */}
            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Enable Timeline Split & Trim</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Toggle to divide, cut, and splice audio waveforms visually.</p>
              </div>
              <Switch
                checked={enableTrim}
                onCheckedChange={setEnableTrim}
                aria-label="Toggle trim timeline editor"
              />
            </Card>

            {enableTrim && audioDuration > 0 && (
              <TrimTimeline 
                duration={audioDuration}
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
            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
              <CardHeader className="p-4 bg-zinc-50/50 dark:bg-zinc-900/20 border-b border-zinc-100 dark:border-zinc-900">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200">
                  <Settings className="w-4 h-4 text-sky-500" /> Compression Settings
                </CardTitle>
              </CardHeader>
              
              <CardContent className="p-4 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">Convert to Format</label>
                  <Select value={format} onValueChange={(val) => setFormat(val || '')}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mp3">MP3 (Compressed standard)</SelectItem>
                      <SelectItem value="m4a">M4A (AAC Audio)</SelectItem>
                      <SelectItem value="ogg">OGG (Vorbis Codec)</SelectItem>
                      <SelectItem value="wav">WAV (Uncompressed PCM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {format !== 'wav' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">Audio Bitrate</label>
                    <Select value={bitrate} onValueChange={(val) => setBitrate(val || '')}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Bitrate" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="64k">64 kbps (Low quality, ultra small)</SelectItem>
                        <SelectItem value="128k">128 kbps (Standard quality, recommended)</SelectItem>
                        <SelectItem value="192k">192 kbps (High quality)</SelectItem>
                        <SelectItem value="256k">256 kbps (Premium CD quality)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <SpecularButton
                  onClick={startAudioProcessing}
                  className="w-full mt-4 font-bold rounded-full py-4 text-sm"
                  tint="#84cc16"
                  lineColor="#84cc16"
                  baseColor={theme === 'dark' ? '#0f172a' : '#f7fee7'}
                  textColor={theme === 'dark' ? '#f8fafc' : '#3f6212'}
                >
                  Process Audio
                </SpecularButton>
              </CardContent>
            </Card>
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
        <div className="max-w-xl mx-auto space-y-6">
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm text-center p-6 space-y-5">
            <div className="w-14 h-14 bg-green-50 dark:bg-green-950/40 text-green-500 dark:text-green-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle className="w-7 h-7" />
            </div>
            
            <div className="space-y-1">
              <CardTitle className="text-xl font-black text-zinc-900 dark:text-zinc-50">Processing Complete!</CardTitle>
              <CardDescription className="text-xs">
                Your audio file is ready to download.
              </CardDescription>
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto bg-zinc-50 dark:bg-zinc-900/20 border border-zinc-100 dark:border-zinc-900 p-3 rounded-xl">
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

            <div className="border border-zinc-100 dark:border-zinc-900 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/10">
              <span className="text-[11px] font-bold text-zinc-400 block mb-3">Preview Output Audio ({result.name.split('.').pop()?.toUpperCase()})</span>
              <audio src={result.url} controls className="w-full" />
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-3">
              <a 
                href={result.url} 
                download={result.name}
                className="inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white font-bold px-6 py-3 rounded-full text-xs shadow-sm hover:shadow transition-all"
              >
                <Download className="w-4 h-4" /> Download Optimized Audio
              </a>
              <Button 
                variant="outline" 
                onClick={reset}
                className="h-10 text-xs rounded-full border-zinc-200 dark:border-zinc-800"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Process Another Audio
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
