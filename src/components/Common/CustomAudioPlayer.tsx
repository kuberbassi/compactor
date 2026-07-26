import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Music } from 'lucide-react';
import { Button } from '../ui/button';

interface CustomAudioPlayerProps {
  src: string;
  title?: string;
  subtitle?: string;
  pitchSemitones?: number;
  speedRatio?: number;
  playbackRate?: number;
  preservesPitch?: boolean;
  className?: string;
}

export const CustomAudioPlayer: React.FC<CustomAudioPlayerProps> = ({
  src,
  title,
  subtitle,
  pitchSemitones = 0,
  speedRatio = 1.0,
  playbackRate,
  preservesPitch,
  className = '',
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Calculate rate and preservesPitch mode
  const effectivePitchFactor = Math.pow(2, pitchSemitones / 12);
  const effectiveRate = playbackRate !== undefined ? playbackRate : (effectivePitchFactor * speedRatio);
  const effectivePreservesPitch = preservesPitch !== undefined ? preservesPitch : (pitchSemitones === 0);

  useEffect(() => {
    if (audioRef.current) {
      (audioRef.current as any).preservesPitch = effectivePreservesPitch;
      (audioRef.current as any).mozPreservesPitch = effectivePreservesPitch;
      (audioRef.current as any).webkitPreservesPitch = effectivePreservesPitch;
      audioRef.current.playbackRate = effectiveRate;
    }
  }, [effectiveRate, effectivePreservesPitch]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
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
    if (isMuted) {
      audioRef.current.muted = false;
      setIsMuted(false);
    } else {
      audioRef.current.muted = true;
      setIsMuted(true);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-3 shadow-sm ${className}`}>
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />

      {(title || subtitle) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
              <Music className="w-3.5 h-3.5 text-zinc-300" />
            </div>
            <div className="truncate">
              {title && <span className="text-xs font-bold text-white block truncate">{title}</span>}
              {subtitle && <span className="text-[10px] text-zinc-400 font-medium block truncate">{subtitle}</span>}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {pitchSemitones !== 0 && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300">
                {pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones} Semitones
              </span>
            )}
            {speedRatio !== 1.0 && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300">
                {speedRatio}x Speed
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

        {/* Volume Mute Toggle */}
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
