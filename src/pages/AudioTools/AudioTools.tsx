import { useState, useEffect, useRef } from 'react';
import { FileUploader } from '../../components/Common/FileUploader';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { TrimTimeline } from '../../components/Common/TrimTimeline';
import type { TrimSegment } from '../../components/Common/TrimTimeline';
import { compressAudio, getFFmpeg, terminateFFmpeg } from '../../utils/ffmpeg';
import { formatBytes } from '../../utils/image';
import { 
  PiMusicNotesLight as Music, PiDownloadLight as Download, PiArrowsClockwiseLight as RefreshCw, 
  PiCheckCircleLight as CheckCircle
} from 'react-icons/pi';
import { Switch } from '../../components/ui/switch';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

interface AudioToolsProps {
  onGoHome: () => void;
  onUploadSuccess: () => void;
}

export const AudioTools: React.FC<AudioToolsProps> = ({ onGoHome, onUploadSuccess }) => {
  
  // Human Comment: File and execution state tracking
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

  useEffect(() => {
    return () => {
      terminateFFmpeg().catch(() => {});
    };
  }, []);

  const cancelProcessing = () => {
    terminateFFmpeg();
    setProcessing(false);
    setProgress(0);
    setStatusText('Processing cancelled by user.');
    setLogs((prev) => [...prev, 'Process aborted by user.']);
  };

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
        compileMode: enableTrim ? trimCompileMode : undefined,
        duration: audioDuration
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
        <div className="max-w-2xl mx-auto py-6">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] shadow-sm overflow-hidden p-6 space-y-6">
            
            {/* Header / File Title */}
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2 truncate">
                <Music className="w-4 h-4 text-[var(--text-secondary)]" />
                <span className="text-xs font-bold text-[var(--text-primary)] truncate max-w-sm">{file.name}</span>
              </div>
              <Button variant="ghost" onClick={reset} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs h-7 px-2">
                Remove File
              </Button>
            </div>

            {/* Original vs Estimated Sizes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-[var(--bg-color)]/20 border border-[var(--border-color)] rounded-lg text-center">
                <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Original Size</span>
                <span className="block text-xl font-extrabold text-[var(--text-primary)] mt-1">{formatBytes(file.size)}</span>
              </div>
              <div className="p-3 bg-[var(--bg-color)]/20 border border-[var(--border-color)] rounded-lg text-center">
                <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Estimated Target</span>
                <span className="block text-xl font-extrabold text-[var(--text-primary)] mt-1">
                  {format === 'wav' 
                    ? formatBytes(file.size * 1.5) 
                    : formatBytes(file.size * (bitrate === '256k' ? 0.85 : bitrate === '192k' ? 0.65 : 0.45))
                  }
                </span>
              </div>
            </div>

            {/* Silent Animated Waveform Preview Block */}
            <div className="flex flex-col items-center justify-center py-8 bg-zinc-950/20 rounded-lg border border-[var(--border-color)] gap-3">
              <div className="flex items-center gap-1.5 justify-center">
                <span className="w-[3px] h-6 bg-[var(--text-secondary)] rounded-full animate-pulse" />
                <span className="w-[3px] h-8 bg-[var(--text-primary)] rounded-full animate-pulse" />
                <span className="w-[3px] h-10 bg-[var(--text-primary)] rounded-full animate-pulse" />
                <span className="w-[3px] h-8 bg-[var(--text-primary)] rounded-full animate-pulse" />
                <span className="w-[3px] h-6 bg-[var(--text-secondary)] rounded-full animate-pulse" />
              </div>
              <span className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] font-bold">Audio Preview Active</span>
            </div>

            {/* Hidden audio tag to parse metadata and manage duration */}
            <audio 
              ref={audioRef}
              src={previewUrl || undefined} 
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              className="hidden"
            />

            {/* Optional Timeline Trim Switch */}
            <div className="border-t border-[var(--border-color)]/40 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs text-[var(--text-primary)]">Trim audio timeline</h3>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Toggle to divide, cut, and splice audio waveforms visually.</p>
                </div>
                <Switch
                  checked={enableTrim}
                  onCheckedChange={setEnableTrim}
                  aria-label="Toggle trim timeline editor"
                />
              </div>
              {enableTrim && audioDuration > 0 && (
                <div className="mt-4">
                  <TrimTimeline 
                    duration={audioDuration}
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

            {/* Settings & Configurations */}
            <div className="border-t border-[var(--border-color)]/40 pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Format</label>
                  <Select value={format} onValueChange={(val) => setFormat(val || '')}>
                    <SelectTrigger className="w-full h-8 text-xs bg-transparent border-[var(--border-color)]">
                      <SelectValue placeholder="Format">
                        {format === 'mp3' ? "MP3 (Standard)" : format === 'm4a' ? "M4A (AAC)" : format === 'ogg' ? "OGG (Vorbis)" : "WAV (PCM)"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mp3">MP3 (Standard)</SelectItem>
                      <SelectItem value="m4a">M4A (AAC)</SelectItem>
                      <SelectItem value="ogg">OGG (Vorbis)</SelectItem>
                      <SelectItem value="wav">WAV (PCM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {format !== 'wav' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Bitrate</label>
                    <Select value={bitrate} onValueChange={(val) => setBitrate(val || '')}>
                      <SelectTrigger className="w-full h-8 text-xs bg-transparent border-[var(--border-color)]">
                        <SelectValue placeholder="Bitrate">
                          {bitrate === '64k' ? "64 kbps (Eco)" : bitrate === '128k' ? "128 kbps (Normal)" : bitrate === '192k' ? "192 kbps (High)" : "256 kbps (Premium)"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="64k">64 kbps (Eco)</SelectItem>
                        <SelectItem value="128k">128 kbps (Normal)</SelectItem>
                        <SelectItem value="192k">192 kbps (High)</SelectItem>
                        <SelectItem value="256k">256 kbps (Premium)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Start Button */}
            <Button
              onClick={startAudioProcessing}
              className="w-full mt-4 font-bold rounded-full py-6 text-sm bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 transition-colors cursor-pointer"
            >
              Process Audio
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
                Cancel Processing
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
        <div className="max-w-xl mx-auto space-y-6">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] shadow-sm text-center p-6 space-y-5">
            <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 rounded-full flex items-center justify-center mx-auto shadow-inner border border-[var(--border-color)]">
              <CheckCircle className="w-7 h-7" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-xl font-black text-[var(--text-primary)]">Processing Complete!</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Your audio file is ready to download.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto bg-[var(--bg-color)]/20 border border-[var(--border-color)] p-3 rounded-xl">
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

            <div className="border border-[var(--border-color)] p-4 rounded-xl bg-[var(--bg-color)]/20">
              <span className="text-[11px] font-bold text-[var(--text-secondary)] block mb-3">Preview Output Audio ({result.name.split('.').pop()?.toUpperCase()})</span>
              <audio src={result.url} controls className="w-full" />
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-3">
              <a 
                href={result.url} 
                download={result.name}
                className="inline-flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold px-6 py-3 rounded-full text-xs shadow-sm hover:shadow transition-all"
              >
                <Download className="w-4 h-4" /> Download Optimized Audio
              </a>
              <Button 
                variant="outline" 
                onClick={reset}
                className="h-10 text-xs rounded-full border-[var(--border-color)]"
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
