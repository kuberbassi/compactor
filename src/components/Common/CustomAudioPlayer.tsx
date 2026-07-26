import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Music } from 'lucide-react';
import { Button } from '../ui/button';
import { PitchShifter } from 'soundtouchjs';

interface CustomAudioPlayerProps {
  src: string;
  file?: File | null;
  title?: string;
  subtitle?: string;
  pitchSemitones?: number;
  speedRatio?: number;
  className?: string;
}

export const CustomAudioPlayer: React.FC<CustomAudioPlayerProps> = ({
  src,
  file,
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
  const [isLoading, setIsLoading] = useState(false);

  // SoundTouch Web Audio Engine State
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pitchShifterRef = useRef<PitchShifter | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const decodedBufferRef = useRef<AudioBuffer | null>(null);

  const isPitchOrSpeedActive = pitchSemitones !== 0 || speedRatio !== 1.0;

  // Cleanup all Web Audio resources
  const cleanupWebAudio = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (pitchShifterRef.current) {
      try {
        pitchShifterRef.current.disconnect();
      } catch (err) {
        console.debug('Error disconnecting pitch shifter:', err);
      }
      pitchShifterRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch (err) {
        console.debug('Error closing audio context:', err);
      }
      audioCtxRef.current = null;
    }
    decodedBufferRef.current = null;
  };

  useEffect(() => {
    return () => cleanupWebAudio();
  }, []);

  // Update HTML5 audio speed when pitch shifting is not active
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isPitchOrSpeedActive) return;

    audio.playbackRate = speedRatio;
    (audio as any).preservesPitch = true;
    (audio as any).mozPreservesPitch = true;
    (audio as any).webkitPreservesPitch = true;
  }, [speedRatio, isPitchOrSpeedActive]);

  // Decode array buffer to AudioBuffer
  const loadAudioBuffer = async (): Promise<AudioBuffer | null> => {
    if (decodedBufferRef.current) return decodedBufferRef.current;

    try {
      let arrayBuffer: ArrayBuffer;
      if (file) {
        arrayBuffer = await file.arrayBuffer();
      } else {
        const resp = await fetch(src);
        arrayBuffer = await resp.arrayBuffer();
      }

      const tempCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const decoded = await tempCtx.decodeAudioData(arrayBuffer);
      await tempCtx.close();

      decodedBufferRef.current = decoded;
      setDuration(decoded.duration);
      return decoded;
    } catch (e) {
      console.warn('Could not decode audio buffer for SoundTouch:', e);
      return null;
    }
  };

  // Synchronize progress bar during SoundTouch playback
  const updateProgressLoop = () => {
    if (pitchShifterRef.current && audioCtxRef.current && audioCtxRef.current.state === 'running') {
      const time = pitchShifterRef.current.timePlayed;
      if (isFinite(time) && time >= 0) {
        setCurrentTime(time);
      }
      animationFrameRef.current = requestAnimationFrame(updateProgressLoop);
    }
  };

  // Start SoundTouch Web Audio playback at given timestamp
  const startSoundTouchPlayback = async (startPosSecs: number): Promise<boolean> => {
    setIsLoading(true);
    try {
      const buffer = await loadAudioBuffer();
      if (!buffer) {
        setIsLoading(false);
        return false;
      }

      // Cleanup existing Web Audio instance before creating new one
      if (pitchShifterRef.current) {
        try { pitchShifterRef.current.disconnect(); } catch (err) { console.debug('Disconnect error:', err); }
        pitchShifterRef.current = null;
      }
      if (audioCtxRef.current) {
        try { await audioCtxRef.current.close(); } catch (err) { console.debug('Close error:', err); }
        audioCtxRef.current = null;
      }

      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const shifter = new PitchShifter(ctx, buffer, 4096, () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });

      shifter.pitchSemitones = pitchSemitones;
      shifter.tempo = speedRatio;

      if (buffer.duration > 0 && startPosSecs > 0) {
        shifter.percentagePlayed = Math.min(0.99, startPosSecs / buffer.duration);
      }

      const gain = ctx.createGain();
      gain.gain.value = isMuted ? 0 : volume;

      shifter.connect(gain);
      gain.connect(ctx.destination);

      audioCtxRef.current = ctx;
      pitchShifterRef.current = shifter;
      gainNodeRef.current = gain;

      // Pause HTML5 audio if playing
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }

      setIsPlaying(true);
      updateProgressLoop();
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error('Error starting SoundTouch playback:', err);
      setIsLoading(false);
      return false;
    }
  };

  // Dynamically update active SoundTouch node when sliders move
  useEffect(() => {
    if (pitchShifterRef.current) {
      pitchShifterRef.current.pitchSemitones = pitchSemitones;
      pitchShifterRef.current.tempo = speedRatio;
    } else if (isPlaying && isPitchOrSpeedActive) {
      // Transition seamlessly from HTML5 audio to Web Audio pitch shifter while playing
      const currentPos = audioRef.current ? audioRef.current.currentTime : currentTime;
      startSoundTouchPlayback(currentPos);
    }
  }, [pitchSemitones, speedRatio]);

  // Reset state on src change
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    cleanupWebAudio();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [src]);

  const togglePlay = async () => {
    if (isPitchOrSpeedActive) {
      if (isPlaying) {
        if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
          await audioCtxRef.current.suspend();
        }
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        setIsPlaying(false);
      } else {
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          await audioCtxRef.current.resume();
          setIsPlaying(true);
          updateProgressLoop();
        } else {
          await startSoundTouchPlayback(currentTime);
        }
      }
    } else {
      // Standard HTML5 Audio fallback
      if (!audioRef.current) return;
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (e) {
          console.warn('Playback failed:', e);
        }
      }
    }
  };

  const handleTimeUpdate = () => {
    if (!isPitchOrSpeedActive && audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);

    if (pitchShifterRef.current && duration > 0) {
      pitchShifterRef.current.percentagePlayed = Math.min(0.99, val / duration);
    }
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = val;
    }
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = val === 0;
    }
  };

  const toggleMute = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newMute ? 0 : volume;
    }
    if (audioRef.current) {
      audioRef.current.muted = newMute;
    }
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
                title="Real-time pitch shift"
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
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Button
          type="button"
          onClick={togglePlay}
          disabled={isLoading}
          variant="outline"
          size="icon"
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white text-black hover:bg-zinc-200 border-none shrink-0 cursor-pointer shadow disabled:opacity-50"
        >
          {isLoading ? (
            <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current ml-0.5" />
          )}
        </Button>

        {/* Timeline Slider */}
        <div className="flex-1 flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="text-[10px] sm:text-[11px] font-mono text-zinc-400 shrink-0 w-7 sm:w-8 text-right">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white min-w-0"
          />
          <span className="text-[10px] sm:text-[11px] font-mono text-zinc-400 shrink-0 w-7 sm:w-8">
            {formatTime(duration)}
          </span>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={toggleMute}
            className="text-zinc-400 hover:text-white p-1 rounded-md transition-colors"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-12 sm:w-14 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white hidden xs:block"
          />
        </div>
      </div>
    </div>
  );
};
