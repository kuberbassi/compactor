import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Music } from 'lucide-react';
import { Button } from '../ui/button';

interface CustomAudioPlayerProps {
  src: string;
  title?: string;
  subtitle?: string;
  /**
   * When set, shows a pitch badge and applies speed-only preview
   * (actual pitch processing happens server-side via Rubber Band WASM).
   */
  pitchSemitones?: number;
  /**
   * When set, applies playback speed to the preview player.
   * This is accurate for speed changes.
   */
  speedRatio?: number;
  className?: string;
}

export const CustomAudioPlayer: React.FC<CustomAudioPlayerProps> = ({
  src,
  title,
  subtitle,
  pitchSemitones = 0,
  speedRatio = 1.0,
  className = '',
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Speed preview: apply speedRatio to playback rate.
  // For pitch: we do NOT fake pitch via playbackRate — that changes speed too.
  // The pitch badge is informational only; true pitch shift requires Rubber Band export.
  // Always preserve pitch when using playbackRate (browser-native pitch correction).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Apply speed-only via playbackRate with pitch preservation enabled
    audio.playbackRate = speedRatio;
    (audio as any).preservesPitch = true;
    (audio as any).mozPreservesPitch = true;
    (audio as any).webkitPreservesPitch = true;
  }, [speedRatio]);

  // Reset position when src changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatTime = (secs: number) => {
    if (!isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const hasPitchBadge = pitchSemitones !== 0;
  const hasSpeedBadge = speedRatio !== 1.0;

  return (
    <div className={`p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-3 shadow-sm ${className}`}>
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />

      {/* Header Info */}
      {(title || subtitle) && (
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800/60 pb-2.5 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
              <Music className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              {title && <span className="text-xs font-bold text-white block truncate">{title}</span>}
              {subtitle && <span className="text-[10px] text-zinc-400 font-medium block truncate">{subtitle}</span>}
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {hasPitchBadge && (
              <span
                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-800/80 text-indigo-300 whitespace-nowrap"
                title="Pitch shift applied on export via Rubber Band WASM"
              >
                {pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones} st
              </span>
            )}
            {hasSpeedBadge && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 whitespace-nowrap">
                {speedRatio.toFixed(2)}x
              </span>
            )}
          </div>
        </div>
      )}


      {/* Main Controls Row */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={togglePlay}
          variant="outline"
          size="icon"
          className="w-9 h-9 rounded-full bg-white text-black hover:bg-zinc-200 border-none shrink-0 cursor-pointer shadow"
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </Button>

        {/* Timeline Slider */}
        <div className="flex-1 flex items-center gap-2">
          <span className="text-[11px] font-mono text-zinc-400 shrink-0 w-8 text-right">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
          />
          <span className="text-[11px] font-mono text-zinc-400 shrink-0 w-8">
            {formatTime(duration)}
          </span>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={toggleMute}
            className="text-zinc-400 hover:text-white p-1 rounded-md transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-14 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white hidden sm:block"
          />
        </div>
      </div>
    </div>
  );
};
