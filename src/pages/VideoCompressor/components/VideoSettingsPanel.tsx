import React from 'react';
import {
  Sliders,
  Sparkles,
} from 'lucide-react';
import { Switch } from '../../../components/ui/switch';
import { Slider } from '../../../components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { CompressionPresetSelector } from '../../../components/Common/CompressionPresetSelector';
import type { CompressionPreset } from '../../../utils/batch';

export type VideoTabId = 'compress' | 'trim' | 'format' | 'audio';

const TARGET_PRESET_LABELS: Record<string, string> = {
  general: 'Standard Quality Compression',
  whatsapp: 'WhatsApp Video (≤16 MB limit)',
  discord: 'Discord Free (≤10 MB limit)',
  tiktok: 'TikTok Feed (≤70 MB limit)',
  instagram: 'Instagram Reels (≤95 MB limit)',
};

const PRESET_LABELS: Record<string, string> = {
  ultrafast: 'Ultra Fast (Lowest CPU)',
  superfast: 'Super Fast',
  veryfast: 'Very Fast',
  faster: 'Faster',
  fast: 'Fast (Standard)',
  medium: 'Medium (Best Compression)',
  slow: 'Slow (Max Quality)',
};

const FORMAT_LABELS: Record<string, string> = {
  mp4: 'MP4 (H.264 Universal Compatibility)',
  webm: 'WebM (VP9 Open Standard)',
  mov: 'MOV (QuickTime Movie)',
  mkv: 'MKV (Matroska Media Container)',
  gif: 'Animated GIF',
};

const SCALE_LABELS: Record<string, string> = {
  'no-scale': 'Original Resolution (100%)',
  'original': 'Original Resolution (100%)',
  '1920:1080': '1080p Full HD (1920 × 1080)',
  '1280:720': '720p HD (1280 × 720)',
  '854:480': '480p SD (854 × 480)',
  '640:360': '360p Low (640 × 360)',
  'iw/2:ih/2': '50% Half Dimensions',
};

const GIF_SCALE_LABELS: Record<string, string> = {
  'no-scale': '480 px wide (Recommended)',
  'original': '480 px wide (Recommended)',
  '1920:1080': '1920 px wide (Very large file)',
  '1280:720': '1280 px wide',
  '854:480': '854 px wide',
  '640:360': '640 px wide',
  'iw/2:ih/2': '50% width',
};

const AUDIO_BITRATE_LABELS: Record<string, string> = {
  '320k': '320 kbps (High Fidelity)',
  '192k': '192 kbps (Standard)',
  '128k': '128 kbps (Compact)',
};

export interface VideoSettingsPanelProps {
  activeTab: VideoTabId;
  file: File;
  mode: string;
  currentMode: string;
  sourceIsGif: boolean;
  createsGif: boolean;
  videoDuration: number;
  enableTrim: boolean;
  setEnableTrim: (val: boolean) => void;
  compressionPreset: CompressionPreset;
  applyCompressionPreset: (val: CompressionPreset) => void;
  removeMetadata: boolean;
  setRemoveMetadata: (val: boolean) => void;
  audioFormat: 'mp3' | 'aac' | 'wav';
  setAudioFormat: (val: 'mp3' | 'aac' | 'wav') => void;
  audioBitrate: '192k' | '128k' | '320k';
  setAudioBitrate: (val: '192k' | '128k' | '320k') => void;
  gifFps: number;
  setGifFps: (val: number) => void;
  scale: string;
  setScale: (val: string) => void;
  format: string;
  setFormat: (val: string) => void;
  targetPreset: 'general' | 'whatsapp' | 'discord' | 'tiktok' | 'instagram';
  setTargetPreset: (val: 'general' | 'whatsapp' | 'discord' | 'tiktok' | 'instagram') => void;
  crf: number;
  setCrf: (val: number) => void;
  showAdvanced: boolean;
  setShowAdvanced: (val: boolean) => void;
  preset: string;
  setPreset: (val: string) => void;
  removeAudio: boolean;
  setRemoveAudio: (val: boolean) => void;
  extractAudio: boolean;
  setExtractAudio: (val: boolean) => void;
  exceedsBrowserProcessingLimit: boolean;
  browserProcessingLimitLabel: string;
}

export const VideoSettingsPanel: React.FC<VideoSettingsPanelProps> = ({
  activeTab,
  file: _file,
  mode: _mode,
  currentMode: _currentMode,
  sourceIsGif,
  createsGif,
  videoDuration: _videoDuration,
  enableTrim,
  setEnableTrim,
  compressionPreset,
  applyCompressionPreset,
  removeMetadata,
  setRemoveMetadata,
  audioFormat,
  setAudioFormat,
  audioBitrate,
  setAudioBitrate,
  gifFps,
  setGifFps,
  scale,
  setScale,
  format,
  setFormat,
  targetPreset,
  setTargetPreset,
  crf,
  setCrf,
  showAdvanced,
  setShowAdvanced,
  preset,
  setPreset,
  removeAudio,
  setRemoveAudio,
  extractAudio,
  setExtractAudio,
  exceedsBrowserProcessingLimit,
  browserProcessingLimitLabel,
}) => {
  return (
    <div className="space-y-4">
      {exceedsBrowserProcessingLimit && (
        <div role="alert" className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.08] p-3.5 text-xs leading-relaxed text-amber-100">
          <span className="block font-bold">File is too large for safe browser encoding</span>
          <span className="mt-1 block text-amber-100/75">This file can be previewed, but FFmpeg needs several in-memory copies while exporting. Limit for this browser: {browserProcessingLimitLabel}.</span>
        </div>
      )}
      {/* ═══ 1. COMPRESS TAB ══════════════════════════════════════════════ */}
      {activeTab === 'compress' && (
        <div className="space-y-4">
          {/* Target Preset Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Target Preset
            </label>
            <Select value={targetPreset} onValueChange={(v) => v && setTargetPreset(v as any)}>
              <SelectTrigger className="h-10 text-xs bg-zinc-950/60 border-white/10 text-white rounded-xl">
                <SelectValue>{TARGET_PRESET_LABELS[targetPreset] || targetPreset}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-[#18191e] border-white/10 text-zinc-200">
                <SelectItem value="general">Standard Quality Compression</SelectItem>
                <SelectItem value="whatsapp">WhatsApp Video (≤16 MB limit)</SelectItem>
                <SelectItem value="discord">Discord Free (≤10 MB limit)</SelectItem>
                <SelectItem value="tiktok">TikTok Feed (≤70 MB limit)</SelectItem>
                <SelectItem value="instagram">Instagram Reels (≤95 MB limit)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quality Preset Selector */}
          {!createsGif && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Quality Preset
              </label>
              <CompressionPresetSelector value={compressionPreset} onChange={applyCompressionPreset} compact />
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2.5">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
            <div>
              <span className="block text-xs font-bold text-zinc-200">Reliable FFmpeg encoding</span>
              <span className="mt-0.5 block text-[10px] leading-relaxed text-zinc-400">Re-encodes the complete file with synchronized video and audio timestamps.</span>
            </div>
          </div>

          {/* Advanced Encoding Controls Accordion */}
          <div className="border border-white/10 rounded-2xl p-3.5 bg-white/5 space-y-3">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-xs font-bold text-zinc-300 hover:text-white cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                <span>Advanced Tuning</span>
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">{showAdvanced ? '▲ Close' : '▼ Open'}</span>
            </button>

            {showAdvanced && (
              <div className="space-y-3.5 pt-3 border-t border-white/10">
                <>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-400">CRF Rate Factor:</span>
                        <span className="font-mono text-zinc-200 font-bold">{crf} ({crf <= 23 ? 'HQ' : crf <= 28 ? 'Balanced' : 'Small'})</span>
                      </div>
                      <Slider min={18} max={38} step={1} value={[crf]} onValueChange={(v) => setCrf(Array.isArray(v) ? v[0] : v)} />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Encoder Speed Preset</label>
                      <Select value={preset} onValueChange={(v) => v && setPreset(v)}>
                        <SelectTrigger className="h-9 text-xs bg-zinc-950/60 border-white/10 text-white rounded-xl">
                          <SelectValue>{PRESET_LABELS[preset] || preset}</SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-[#18191e] border-white/10 text-zinc-200">
                          <SelectItem value="ultrafast">Ultra Fast (Lowest CPU)</SelectItem>
                          <SelectItem value="superfast">Super Fast</SelectItem>
                          <SelectItem value="veryfast">Very Fast</SelectItem>
                          <SelectItem value="faster">Faster</SelectItem>
                          <SelectItem value="fast">Fast (Standard)</SelectItem>
                          <SelectItem value="medium">Medium (Best Compression)</SelectItem>
                          <SelectItem value="slow">Slow (Max Quality)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                </>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ 2. TRIM & CUT TAB ═════════════════════════════════════════════ */}
      {activeTab === 'trim' && (
        <div className="space-y-5">
          <div className="video-trim-toggle flex items-center justify-between gap-5 p-4 bg-white/5 border border-white/10 rounded-xl">
            <div className="min-w-0 pr-2">
              <span className="text-xs font-bold text-zinc-200 block">Enable Video Trimmer</span>
              <span className="text-[10px] leading-relaxed text-zinc-400 block mt-1">Show the timeline and choose the exact range to keep.</span>
            </div>
            <Switch className="shrink-0" checked={enableTrim} onCheckedChange={setEnableTrim} />
          </div>

        </div>
      )}

      {/* ═══ 3. FORMAT & RESOLUTION TAB ════════════════════════════════════ */}
      {activeTab === 'format' && (
        <div className="space-y-4">
          {/* Target Container Format */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Output Format</label>
            <Select value={createsGif ? 'gif' : format} onValueChange={(v) => v && setFormat(v)} disabled={sourceIsGif}>
              <SelectTrigger className="h-10 text-xs bg-zinc-950/60 border-white/10 text-white rounded-xl">
                <SelectValue>{FORMAT_LABELS[format] || format.toUpperCase()}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-[#18191e] border-white/10 text-zinc-200">
                <SelectItem value="mp4">MP4 (H.264 Universal Compatibility)</SelectItem>
                <SelectItem value="webm">WebM (VP9 Open Standard)</SelectItem>
                <SelectItem value="mov">MOV (QuickTime Movie)</SelectItem>
                <SelectItem value="mkv">MKV (Matroska Media Container)</SelectItem>
                <SelectItem value="gif">Animated GIF</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {createsGif && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-[10px] leading-relaxed text-emerald-200/80">
              GIF export uses the selected trim range, removes audio, and loops continuously.
            </div>
          )}

          {/* Resolution Scaling */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              {createsGif ? 'GIF Width' : 'Resolution / Scale'}
            </label>
            <Select value={scale} onValueChange={(v) => v && setScale(v)}>
              <SelectTrigger className="h-10 text-xs bg-zinc-950/60 border-white/10 text-white rounded-xl">
                <SelectValue>{(createsGif ? GIF_SCALE_LABELS : SCALE_LABELS)[scale] || scale}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-[#18191e] border-white/10 text-zinc-200">
                {createsGif ? (
                  <>
                    <SelectItem value="no-scale">480 px wide (Recommended)</SelectItem>
                    <SelectItem value="640:360">640 px wide</SelectItem>
                    <SelectItem value="854:480">854 px wide</SelectItem>
                    <SelectItem value="1280:720">1280 px wide</SelectItem>
                    <SelectItem value="1920:1080">1920 px wide (Very large file)</SelectItem>
                    <SelectItem value="iw/2:ih/2">50% width</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="no-scale">Original Resolution (100%)</SelectItem>
                    <SelectItem value="1920:1080">1080p Full HD (1920 × 1080)</SelectItem>
                    <SelectItem value="1280:720">720p HD (1280 × 720)</SelectItem>
                    <SelectItem value="854:480">480p SD (854 × 480)</SelectItem>
                    <SelectItem value="640:360">360p Low (640 × 360)</SelectItem>
                    <SelectItem value="iw/2:ih/2">50% Half Dimensions</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* If GIF is selected */}
          {createsGif && (
            <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl space-y-2">
              <span className="text-xs font-bold text-zinc-200 block">GIF Frame Rate</span>
              <div className="grid grid-cols-4 gap-1.5">
                {[10, 15, 24, 30].map((fps) => (
                  <button
                    key={fps}
                    type="button"
                    onClick={() => setGifFps(fps)}
                    aria-pressed={gifFps === fps}
                    className={`video-gif-fps h-8 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      gifFps === fps
                        ? 'bg-white text-zinc-950 border-white font-bold'
                        : 'bg-zinc-900/60 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {fps} FPS
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ 4. AUDIO & METADATA TAB ══════════════════════════════════════ */}
      {activeTab === 'audio' && (
        <div className="space-y-4">
          <div className={`flex items-center justify-between gap-4 p-3.5 border rounded-2xl transition-colors ${extractAudio ? 'bg-emerald-500/10 border-emerald-500/35' : 'bg-white/5 border-white/10'}`}>
            <div className="min-w-0">
              <span className="text-xs font-bold text-zinc-200 block">Extract Audio Only</span>
              <span className="text-[10px] text-zinc-400 block mt-0.5">Only audio will download; no video file.</span>
            </div>
            <Switch className="shrink-0" checked={extractAudio} onCheckedChange={setExtractAudio} />
          </div>

          <div className={`flex items-center justify-between p-3.5 border border-white/10 rounded-2xl transition-opacity ${extractAudio ? 'bg-white/[0.025] opacity-40' : 'bg-white/5'}`} aria-disabled={extractAudio}>
            <div>
              <span className="text-xs font-bold text-zinc-200 block">Mute Audio Track</span>
              <span className="text-[10px] text-zinc-400 block">Strip all sound for silent video</span>
            </div>
            <Switch checked={removeAudio} onCheckedChange={setRemoveAudio} disabled={extractAudio} />
          </div>

          <div className="flex items-center justify-between p-3.5 bg-white/5 border border-white/10 rounded-2xl">
            <div>
              <span className="text-xs font-bold text-zinc-200 block">Strip Private Metadata</span>
              <span className="text-[10px] text-zinc-400 block">Remove camera, GPS location, and author tags</span>
            </div>
            <Switch checked={removeMetadata} onCheckedChange={setRemoveMetadata} />
          </div>

          {extractAudio && (
            <div className="space-y-1.5 p-3.5 bg-zinc-950/60 border border-white/10 rounded-2xl">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Audio Format</label>
              <Select value={audioFormat} onValueChange={(value) => value && setAudioFormat(value as 'mp3' | 'aac' | 'wav')}>
                <SelectTrigger className="h-10 text-xs bg-zinc-950/60 border-white/10 text-white rounded-xl">
                  <SelectValue>{audioFormat.toUpperCase()}</SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-[#18191e] border-white/10 text-zinc-200">
                  <SelectItem value="mp3">MP3 (Universal)</SelectItem>
                  <SelectItem value="aac">AAC (Efficient)</SelectItem>
                  <SelectItem value="wav">WAV (Lossless)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {!removeAudio && (
            <div className="space-y-1.5 p-3.5 bg-zinc-950/60 border border-white/10 rounded-2xl">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">{extractAudio ? 'Export Bitrate' : 'Video Audio Bitrate'}</label>
              <Select value={audioBitrate} onValueChange={(v: any) => setAudioBitrate(v)}>
                <SelectTrigger className="h-10 text-xs bg-zinc-950/60 border-white/10 text-white rounded-xl">
                  <SelectValue>{AUDIO_BITRATE_LABELS[audioBitrate] || audioBitrate}</SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-[#18191e] border-white/10 text-zinc-200">
                  <SelectItem value="320k">320 kbps (High Fidelity)</SelectItem>
                  <SelectItem value="192k">192 kbps (Standard)</SelectItem>
                  <SelectItem value="128k">128 kbps (Compact)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
