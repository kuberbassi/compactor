import { useState, useEffect, useRef } from 'react';
import { FileUploader } from '../../components/Common/FileUploader';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { ToolHeader } from '../../components/Common/ToolHeader';
import { TrimTimeline } from '../../components/Common/TrimTimeline';
import type { TrimSegment } from '../../components/Common/TrimTimeline';
import { WorkspaceToolNav } from '../../components/Workspace/WorkspaceControls';
import type { WorkspaceToolItem } from '../../components/Workspace/WorkspaceControls';
import { compressVideo, getFFmpeg, terminateFFmpeg } from '../../utils/ffmpeg';
import { formatBytes } from '../../utils/image';
import { getFileFormatLabel } from '../../utils/conversionCapabilities';
import { getBrowserVideoProcessingLimitBytes, isGifFile } from '../../utils/mediaFiles';
import { isEditableShortcutTarget, loadSetting, saveSetting } from '../../utils/batch';
import type { CompressionPreset } from '../../utils/batch';
import { 
  Video as FileVideo, 
  AlertTriangle as WarningIcon,
  Zap,
  Scissors,
  Film,
  Music,
  PanelLeft,
  PanelLeftClose,
  Play,
  Pause,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { VideoSettingsPanel, type VideoTabId } from './components/VideoSettingsPanel';
import { VideoResultCard } from './components/VideoResultCard';

interface VideoCompressorProps {
  mode: 'compress' | 'gif' | 'mute' | 'to-audio' | 'to-text' | 'whatsapp' | 'instagram' | 'tiktok' | 'x' | 'discord' | 'telegram' | 'facebook' | 'youtube' | 'convert';
  onGoHome: () => void;
  onSelectTool: (toolId: string) => void;
  onUploadSuccess: () => void;
}

const VIDEO_TABS: WorkspaceToolItem<VideoTabId>[] = [
  { id: 'compress', label: 'Compress', Icon: Zap },
  { id: 'trim', label: 'Trim', Icon: Scissors },
  { id: 'format', label: 'Format', Icon: Film },
  { id: 'audio', label: 'Audio', Icon: Music },
];

const TARGET_PRESET_MAP: Record<string, { name: string; maxMB?: number; badge: string }> = {
  general: { name: 'General / Custom Compression', maxMB: undefined, badge: 'Standard quality compression' },
  whatsapp: { name: 'WhatsApp Video (≤16 MB)', maxMB: 15.2, badge: 'Guaranteed ≤15.5 MB for WhatsApp attachments' },
  discord: { name: 'Discord Free (≤10 MB)', maxMB: 9.3, badge: 'Guaranteed ≤9.5 MB for Discord free upload limit' },
  tiktok: { name: 'TikTok Upload (≤70 MB)', maxMB: 68.0, badge: 'Optimized for TikTok mobile feed' },
  instagram: { name: 'Instagram Reels & Stories (≤95 MB)', maxMB: 92.0, badge: 'Optimized for Instagram Reels & Stories' },
};

export const VideoCompressor: React.FC<VideoCompressorProps> = ({ mode, onGoHome, onUploadSuccess }) => {
  const currentMode = mode === ('compressor' as any) ? 'compress' : mode;
  
  // File and processing status trackers
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [format, setFormat] = useState<string>(mode === 'gif' ? 'gif' : 'mp4');
  const sourceIsGif = Boolean(file && isGifFile(file));
  const createsGif = format === 'gif' || sourceIsGif;
  const browserMemoryGB = typeof navigator !== 'undefined'
    ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    : undefined;
  const browserProcessingLimit = getBrowserVideoProcessingLimitBytes(browserMemoryGB);
  const exceedsBrowserProcessingLimit = Boolean(file && file.size > browserProcessingLimit);

  const [activeTab, setActiveTab] = useState<VideoTabId>(
    currentMode === 'gif' ? 'format' : currentMode === 'to-audio' || currentMode === 'mute' ? 'audio' : 'compress'
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

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

  const isCancelledRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      terminateFFmpeg().catch(() => {});
    };
  }, []);

  const cancelProcessing = () => {
    isCancelledRef.current = true;
    setShowAbortConfirm(false);
    terminateFFmpeg();
    setProcessing(false);
    setProgress(0);
    setStatusText('Processing cancelled by user.');
    setLogs((prev) => [...prev, 'Process aborted by user.']);
  };

  // Media player sync hooks
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

  // Trim segments list and editing state
  const [enableTrim, setEnableTrim] = useState(false);
  const [trimSegments, setTrimSegments] = useState<TrimSegment[]>([]);
  const [trimCompileMode, setTrimCompileMode] = useState<'keep-selected' | 'cut-selected'>('keep-selected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [removeAudio, setRemoveAudio] = useState(mode === 'mute');
  const [extractAudio, setExtractAudio] = useState(mode === 'to-audio');

  const reset = () => {
    setFile(null);
    setResult(null);
    setProgress(0);
    setProcessing(false);
    setStatusText('');
    setLogs([]);
    setErrorMessage(null);
    setEnableTrim(false);
    setTrimSegments([]);
    const startsInAudioMode = mode === 'to-audio';
    const startsInGifMode = mode === 'gif';
    setExtractAudio(startsInAudioMode);
    setRemoveAudio(mode === 'mute');
    setFormat(startsInGifMode ? 'gif' : 'mp4');
    setActiveTab(startsInGifMode ? 'format' : startsInAudioMode || mode === 'mute' ? 'audio' : 'compress');
  };
  
  // Completed compression results metadata
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

  // WASM Engine Settings
  const [compressionPreset, setCompressionPreset] = useState<CompressionPreset>(() =>
    loadSetting('compactor_video_compression_preset', 'balanced')
  );
  const [removeMetadata, setRemoveMetadata] = useState(() =>
    loadSetting('compactor_video_remove_metadata', true)
  );
  const [crf, setCrf] = useState(28);
  const [scale, setScale] = useState('no-scale');
  const [preset, setPreset] = useState('fast');
  // Audio & GIF Specific Settings
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'aac' | 'wav'>('mp3');
  const [audioBitrate, setAudioBitrate] = useState<'128k' | '192k' | '320k'>('192k');
  const [gifFps, setGifFps] = useState<number>(15);

  // Target Platform Presets (General, WhatsApp, Discord, TikTok, Instagram)
  const [targetPreset, setTargetPreset] = useState<'general' | 'whatsapp' | 'discord' | 'tiktok' | 'instagram'>('general');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  useEffect(() => {
    saveSetting('compactor_video_compression_preset', compressionPreset);
    saveSetting('compactor_video_remove_metadata', removeMetadata);
  }, [compressionPreset, removeMetadata]);

  const applyCompressionPreset = (value: CompressionPreset) => {
    setCompressionPreset(value);
    if (value === 'light') {
      setCrf(22); setPreset('fast');
    } else if (value === 'balanced') {
      setCrf(28); setPreset('medium');
    } else {
      setCrf(32); setPreset('slow');
    }
  };

  useEffect(() => {
    if (['whatsapp', 'discord', 'tiktok', 'instagram'].includes(currentMode)) {
      setTargetPreset(currentMode as any);
    }
  }, [currentMode]);




  const getToolDescription = () => {
    if (sourceIsGif) return 'Preview and recompress animated GIFs locally with adjustable frame rate, scale, and quality.';
    if (createsGif) return 'Trim and convert video into a looping GIF with adjustable size and frame rate.';
    if (extractAudio) return 'Extract an MP3, AAC, or WAV audio track from your video without downloading another video file.';
    switch (currentMode) {
      case 'mute': return 'Strip audio channels from your video files with zero quality loss.';
      default: return 'Trim, resize, and compress videos for the way you want to share them.';
    }
  };

  const getActionButtonText = () => {
    if (sourceIsGif) return 'Compress GIF';
    if (createsGif) return 'Export GIF';
    if (extractAudio) return 'Extract Audio';
    switch (currentMode) {
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
    setExtractAudio(mode === 'to-audio');
    setActiveTab(mode === 'gif' ? 'format' : mode === 'to-audio' || mode === 'mute' ? 'audio' : 'compress');
    setFormat(mode === 'gif' ? 'gif' : 'mp4');
    setFile(null);
    setResult(null);
    setLogs([]);
    setProgress(0);
    setProcessing(false);
    setEnableTrim(false);
  }, [mode]);

  const handleFilesSelected = (files: File[]) => {
    if (files.length > 0) {
      const f = files[0];
      setFile(f);
      setResult(null);
      setVideoDuration(0);
      setCurrentTime(0);
      setEnableTrim(false);
      if (isGifFile(f)) {
        setFormat('gif');
        setRemoveAudio(true);
        setExtractAudio(false);
        return;
      }
      const fileExt = f.name.split('.').pop()?.toLowerCase() || 'mp4';
      if (currentMode !== 'gif') {
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
      removeAudio: createsGif || currentMode === 'mute' ? true : extractAudio ? false : removeAudio,
      format: createsGif ? 'gif' : extractAudio ? audioFormat : format,
      segments: !sourceIsGif && enableTrim ? trimSegments : undefined,
      compileMode: !sourceIsGif && enableTrim ? trimCompileMode : undefined,
      videoBitrate: targetVideoBitrate,
      audioBitrate: extractAudio ? audioBitrate : targetAudioBitrate,
      frameRate: createsGif ? gifFps : undefined,
      duration: sourceIsGif ? undefined : videoDuration,
      targetMaxMB: targetMB,
      removeMetadata,
    };

    return await compressVideo(file, config, handleLog, setProgress);
  };

  const startCompression = async () => {
    if (!file) return;
    if (file.size > browserProcessingLimit) {
      const message = `${formatBytes(file.size)} is too large for reliable in-browser encoding. This browser can safely process files up to ${formatBytes(browserProcessingLimit)} at a time.`;
      setErrorMessage(message);
      setStatusText('Export blocked before processing to protect browser memory.');
      setLogs((prev) => [...prev, `SAFETY CHECK: ${message}`]);
      return;
    }
    
    isCancelledRef.current = false;
    setShowAbortConfirm(false);
    setProcessing(true);
    setProgress(0);
    setLogs([]);
    setStatusText('Preparing sandbox pipelines...');

    try {
      const compressResult = await executeWasmCompress();
      
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
      setErrorMessage(`Compression failed: ${errMsg}`);
    }
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && file && !processing && !result) {
        event.preventDefault();
        startCompression();
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

  const getToolTitle = () => {
    if (sourceIsGif) return 'GIF Compressor';
    if (mode === 'mute') return 'Mute Video';
    if (mode === 'to-text') return 'Video to Text';
    if (mode === 'whatsapp') return 'Compress for WhatsApp';
    if (mode === 'discord') return 'Compress for Discord';
    if (mode === 'tiktok') return 'Compress for TikTok';
    if (mode === 'instagram') return 'Compress for Instagram';
    if (mode === 'x') return 'Compress for X';
    if (mode === 'telegram') return 'Compress for Telegram';
    if (mode === 'facebook') return 'Compress for Facebook';
    if (mode === 'youtube') return 'Compress for YouTube';
    if (mode === 'convert') return 'Convert Video';
    return 'Video';
  };

  return (
    <div className={`tool-layout video-tool-layout ${file || result || processing ? 'has-active-session' : 'is-empty-session'}`}>
      <ToolHeader 
        title={getToolTitle()} 
        description={getToolDescription()} 
        icon={FileVideo} 
        fileName={file?.name || result?.name}
        fileMeta={file ? formatBytes(file.size) : result ? formatBytes(result.newSize) : undefined}
        onGoHome={() => {
          if (file || result || processing) {
            reset();
          } else {
            onGoHome();
          }
        }}
      />

      {!file && !result && !processing && (
        <div className="tool-upload-frame w-full max-w-2xl mx-auto py-2">
          <FileUploader 
            accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/avi,video/x-flv,video/x-ms-wmv,video/3gpp,video/mpeg,image/gif,.mp4,.webm,.mov,.mkv,.avi,.flv,.wmv,.3gp,.mpeg,.gif"
            label="Upload video or animated GIF"
            subLabel="Drag & drop MP4, WebM, MOV, MKV, AVI, GIF, and other common media files"
            onFilesSelected={handleFilesSelected}
            maxSizeMB={Math.floor(browserProcessingLimit / (1024 * 1024))}
          />
        </div>
      )}

      {/* Active Video Workbench Workspace */}
      {file && !result && !processing && (
        <div className={`image-workbench flex-1 flex h-full overflow-hidden bg-[#111216] ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
            {/* ═══ LEFT SIDEBAR ═══════════════════════════════════════════════════ */}
            <aside className={`image-workbench__sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
              {sidebarCollapsed ? (
                /* Collapsed Icon Rail */
                <div className="h-full flex flex-col items-center py-3 bg-[#18191e] justify-between w-full select-none">
                  <div className="flex flex-col items-center gap-1.5 w-full px-2">
                    <button
                      type="button"
                      onClick={() => setSidebarCollapsed(false)}
                      className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer mb-1"
                      title="Expand sidebar"
                    >
                      <PanelLeft className="w-4 h-4" />
                    </button>

                    <div className="w-6 h-[1px] bg-white/10 mb-1" />

                    <div className="flex flex-col items-center gap-1 w-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                      {VIDEO_TABS.map((tab) => {
                        const Icon = tab.Icon;
                        const isActive = activeTab === tab.id;
                        const isDisabled = extractAudio
                          ? tab.id === 'compress' || tab.id === 'format'
                          : createsGif && (tab.id === 'compress' || tab.id === 'audio');
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              setActiveTab(tab.id);
                              setSidebarCollapsed(false);
                            }}
                            disabled={isDisabled}
                            title={isDisabled ? `${tab.label} is unavailable for ${extractAudio ? 'audio-only' : 'GIF'} export` : `${tab.label} Settings`}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer relative group ${
                              isActive
                                ? 'bg-white text-zinc-950 font-bold shadow-md'
                                : 'text-zinc-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <div className="absolute left-full ml-3 px-2.5 py-1 bg-zinc-900 border border-zinc-700/80 text-zinc-100 text-xs font-semibold rounded-md shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                              {tab.label}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 w-full flex justify-center px-2">
                    <button
                      type="button"
                      onClick={startCompression}
                      disabled={processing || exceedsBrowserProcessingLimit}
                      title={getActionButtonText()}
                      className="w-9 h-9 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 flex items-center justify-center shadow-md cursor-pointer transition-all hover:scale-105 active:scale-95 group relative font-bold disabled:opacity-50"
                    >
                      <span className="text-sm leading-none font-black">→</span>
                      <div className="absolute left-full ml-3 px-2.5 py-1 bg-zinc-900 border border-zinc-700/80 text-zinc-100 text-xs font-semibold rounded-md shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                        {getActionButtonText()}
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                /* Expanded Compact Sidebar */
                <div className="h-full flex flex-col min-h-0 bg-[#18191e]">
                  <div className="h-11 px-4 border-b border-white/10 flex items-center justify-between bg-transparent shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-white">Video Controls</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-lg bg-white/10 text-zinc-300 font-mono">
                        {getFileFormatLabel(file)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSidebarCollapsed(true)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                      title="Collapse to icon rail"
                    >
                      <PanelLeftClose className="w-4 h-4" />
                    </button>
                  </div>

                  <WorkspaceToolNav
                    items={VIDEO_TABS}
                    activeId={activeTab}
                    onChange={setActiveTab}
                    label="Video settings"
                    disabledIds={extractAudio ? ['compress', 'format'] : createsGif ? ['compress', 'audio'] : []}
                  />

                  <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                    <VideoSettingsPanel
                      activeTab={activeTab}
                      file={file}
                      mode={mode}
                      currentMode={currentMode}
                      sourceIsGif={sourceIsGif}
                      createsGif={createsGif}
                      videoDuration={videoDuration}
                      enableTrim={enableTrim}
                      setEnableTrim={setEnableTrim}
                      compressionPreset={compressionPreset}
                      applyCompressionPreset={applyCompressionPreset}
                      removeMetadata={removeMetadata}
                      setRemoveMetadata={setRemoveMetadata}
                      audioFormat={audioFormat}
                      setAudioFormat={setAudioFormat}
                      audioBitrate={audioBitrate}
                      setAudioBitrate={setAudioBitrate}
                      gifFps={gifFps}
                      setGifFps={setGifFps}
                      scale={scale}
                      setScale={setScale}
                      format={format}
                      setFormat={(value) => {
                        setFormat(value);
                        if (value === 'gif') setExtractAudio(false);
                      }}
                      targetPreset={targetPreset}
                      setTargetPreset={setTargetPreset}
                      crf={crf}
                      setCrf={setCrf}
                      showAdvanced={showAdvanced}
                      setShowAdvanced={setShowAdvanced}
                      preset={preset}
                      setPreset={setPreset}
                      removeAudio={removeAudio}
                      setRemoveAudio={(value) => {
                        setRemoveAudio(value);
                        if (value) setExtractAudio(false);
                      }}
                      extractAudio={extractAudio}
                      setExtractAudio={(value) => {
                        setExtractAudio(value);
                        if (value) {
                          setRemoveAudio(false);
                          setActiveTab('audio');
                        } else {
                          setActiveTab('compress');
                        }
                      }}
                      exceedsBrowserProcessingLimit={exceedsBrowserProcessingLimit}
                      browserProcessingLimitLabel={formatBytes(browserProcessingLimit)}
                    />
                  </div>

                  <div className="p-3.5 border-t border-white/10 bg-[#18191e] shrink-0">
                    <button
                      type="button"
                      onClick={startCompression}
                      disabled={processing}
                      className="w-full h-11 bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
                    >
                      <span>{exceedsBrowserProcessingLimit ? 'File too large for browser encoding' : processing ? 'Processing Video…' : getActionButtonText()}</span>
                      <span className="text-sm font-black">→</span>
                    </button>
                  </div>
                </div>
              )}
            </aside>

            {/* ═══ MAIN VIDEO STAGE ══════════════════════════════════════════════ */}
            <div className="image-workbench__main flex-1 flex flex-col h-full overflow-hidden bg-[#111216]">
              {/* File info bar */}
              <div className="image-filebar h-11 border-b border-white/10 bg-[#18191e] flex items-center px-4 gap-3 text-xs text-zinc-400 shrink-0 justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-bold text-white truncate max-w-[220px]">{file.name}</span>
                  <span className="text-zinc-400 font-mono text-[11px]">{formatBytes(file.size)}</span>
                  {videoDuration > 0 && (
                    <span className="px-2 py-0.5 rounded-lg bg-white/10 text-[11px] font-mono font-semibold text-zinc-300">
                      {Math.floor(videoDuration / 60)}:{Math.floor(videoDuration % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                </div>

                {!sourceIsGif && (
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>
                )}
              </div>

              {/* Error banner if any */}
              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border-b border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
                  <span>{errorMessage}</span>
                  <button onClick={() => setErrorMessage(null)} className="text-rose-400 font-bold ml-2 cursor-pointer">✕</button>
                </div>
              )}

              {/* Processing Overlay State */}
              {processing && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-950/80 z-30 overflow-y-auto">
                  <div className="max-w-md w-full space-y-6 flex flex-col items-center">
                    <ProgressBar
                      progress={progress}
                      statusText={statusText}
                      subText="Encoding video frames safely inside your browser"
                    />

                    <div className="flex items-center gap-3 w-full justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowLogs(!showLogs)}
                        className="text-xs text-zinc-400 hover:text-white"
                      >
                        {showLogs ? 'Hide Logs' : 'Console Logs'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAbortConfirm(true)}
                        className="text-xs border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                      >
                        Abort Job
                      </Button>
                    </div>

                    {showLogs && (
                      <pre className="w-full max-h-40 overflow-y-auto p-3 rounded-xl bg-black/60 border border-white/10 text-[10px] text-zinc-300 font-mono text-left">
                        {logs.map((l, i) => <div key={i}>{l}</div>)}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {/* Video Player Canvas & Trim Stage */}
              {!processing && (
                <div className={`video-preview-workspace ${!sourceIsGif && enableTrim && videoDuration > 0 ? 'has-trim-timeline' : ''}`}>
                  <div className="video-source-preview group">
                    {sourceIsGif ? (
                      <img
                        src={previewUrl || undefined}
                        alt={`Animated GIF preview for ${file.name}`}
                        className="video-source-media"
                      />
                    ) : (
                      <video
                        ref={videoRef}
                        src={previewUrl || undefined}
                        autoPlay
                        loop
                        muted
                        playsInline
                        onClick={togglePlay}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onLoadedMetadata={handleLoadedMetadata}
                        onTimeUpdate={handleTimeUpdate}
                        className="video-source-media cursor-pointer"
                      />
                    )}
                    {!sourceIsGif && (
                      <button
                        type="button"
                        onClick={togglePlay}
                        className="video-preview-play"
                        title={isPlaying ? 'Pause' : 'Play'}
                        aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
                      >
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                      </button>
                    )}
                  </div>

                  {/* Trim Timeline directly without redundant nested wrapper */}
                  {!sourceIsGif && enableTrim && videoDuration > 0 && (
                    <TrimTimeline
                      className="video-trim-timeline"
                      duration={videoDuration}
                      currentTime={currentTime}
                      isPlaying={isPlaying}
                      onTogglePlay={togglePlay}
                      onSeek={handleSeek}
                      onChange={(segs, mode) => {
                        setTrimSegments(segs);
                        setTrimCompileMode(mode);
                        setEnableTrim(true);
                      }}
                    />
                  )}
                </div>
              )}
            </div>
        </div>
      )}

      {/* Custom Styled Abort Confirmation Dialog */}
      <Dialog open={showAbortConfirm} onOpenChange={setShowAbortConfirm}>
        <DialogContent className="max-w-md bg-[#18191e] border border-white/15 text-white rounded-2xl p-6 shadow-2xl gap-6">
          <DialogHeader className="space-y-3 text-left">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <WarningIcon className="w-6 h-6" />
            </div>
            <DialogTitle className="text-base font-bold text-white tracking-tight">
              Abort Compression?
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 leading-relaxed">
              Are you sure you want to stop processing? The current encoding progress will be discarded.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-0">
            <Button
              variant="outline"
              onClick={() => setShowAbortConfirm(false)}
              className="h-10 px-4 text-xs font-bold rounded-xl border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 cursor-pointer"
            >
              Continue Processing
            </Button>
            <Button
              onClick={() => {
                setShowAbortConfirm(false);
                cancelProcessing();
              }}
              className="h-10 px-4 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white cursor-pointer transition-colors shadow-lg shadow-rose-950/40"
            >
              Yes, Abort Compression
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result State */}
      {result && (
        <VideoResultCard
          file={file}
          result={result}
          mode={mode}
          createsGif={createsGif}
          extractAudio={extractAudio}
          onReset={reset}
        />
      )}
    </div>
  );
};
