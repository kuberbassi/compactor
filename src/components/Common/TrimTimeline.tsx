import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play as PlayIcon,
  Pause as PauseIcon,
  RotateCcw,
  Scissors,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Trash2,
  Layers,
  Sparkles
} from 'lucide-react';
import { Button } from '../ui/button';

export interface TrimSegment {
  id: string;
  start: number;
  end: number;
  mode: 'keep' | 'cut';
  fadeIn?: boolean;
  fadeOut?: boolean;
}

interface TrimTimelineProps {
  duration: number;
  currentTime: number;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onSeek: (time: number) => void;
  onChange: (segments: TrimSegment[], mode: 'keep-selected' | 'cut-selected') => void;
  className?: string;
}

export const TrimTimeline: React.FC<TrimTimelineProps> = ({
  duration,
  currentTime,
  isPlaying = false,
  onTogglePlay,
  onSeek,
  onChange,
  className = '',
}) => {
  const [editorMode, setEditorMode] = useState<'range' | 'multi'>('range');
  
  // Single Range Mode State
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(duration || 1);
  const [fadeIn, setFadeIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  // Multi-Cut Segment Mode State
  const [segments, setSegments] = useState<TrimSegment[]>([]);
  const [compileMode, setCompileMode] = useState<'keep-selected' | 'cut-selected'>('keep-selected');

  // Drag States
  const [activeDrag, setActiveDrag] = useState<'start' | 'end' | 'pan' | { type: 'boundary'; index: number } | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [initialRange, setInitialRange] = useState<{ start: number; end: number }>({ start: 0, end: duration });

  const trackRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;

  // Generate pseudo-waveform bars for the background track
  const waveformBars = useMemo(() => {
    const bars: number[] = [];
    const count = 54;
    for (let i = 0; i < count; i++) {
      const freq = Math.sin(i * 0.35) * 0.3 + Math.cos(i * 0.7) * 0.25 + 0.45;
      bars.push(Math.max(18, Math.min(95, Math.round(freq * 100))));
    }
    return bars;
  }, []);

  // Initialize bounds & segments when duration is loaded
  useEffect(() => {
    if (duration > 0) {
      setRangeStart(0);
      setRangeEnd(duration);
      setSegments([
        {
          id: 'seg-init',
          start: 0,
          end: duration,
          mode: 'keep'
        }
      ]);
    }
  }, [duration]);

  // Sync up to parent (using onChangeRef to completely prevent infinite loops)
  useEffect(() => {
    if (duration <= 0) return;

    if (editorMode === 'range') {
      const activeSeg: TrimSegment = {
        id: 'seg-range',
        start: Math.max(0, rangeStart),
        end: Math.min(duration, rangeEnd),
        mode: 'keep',
        fadeIn,
        fadeOut,
      };
      onChangeRef.current([activeSeg], 'keep-selected');
    } else {
      if (segments.length > 0) {
        onChangeRef.current(segments, compileMode);
      }
    }
  }, [editorMode, rangeStart, rangeEnd, fadeIn, fadeOut, segments, compileMode, duration]);

  const formatTime = useCallback((secs: number) => {
    if (!Number.isFinite(secs) || secs < 0) return '00:00.0';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  }, []);

  const getTimeFromClientX = useCallback((clientX: number) => {
    if (!trackRef.current || duration <= 0) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return parseFloat((ratio * duration).toFixed(2));
  }, [duration]);

  // Mouse & Touch Unified Drag Handler
  useEffect(() => {
    if (!activeDrag) return;

    const handleMove = (clientX: number) => {
      if (duration <= 0 || !trackRef.current) return;
      const targetTime = getTimeFromClientX(clientX);

      if (activeDrag === 'start') {
        const clamped = Math.max(0, Math.min(targetTime, rangeEnd - 0.2));
        setRangeStart(clamped);
        onSeekRef.current(clamped);
      } else if (activeDrag === 'end') {
        const clamped = Math.min(duration, Math.max(targetTime, rangeStart + 0.2));
        setRangeEnd(clamped);
        onSeekRef.current(clamped);
      } else if (activeDrag === 'pan') {
        const rect = trackRef.current.getBoundingClientRect();
        const deltaRatio = (clientX - dragStartX) / rect.width;
        const deltaTime = deltaRatio * duration;
        const segLength = initialRange.end - initialRange.start;

        let newStart = initialRange.start + deltaTime;
        let newEnd = initialRange.end + deltaTime;

        if (newStart < 0) {
          newStart = 0;
          newEnd = segLength;
        } else if (newEnd > duration) {
          newEnd = duration;
          newStart = duration - segLength;
        }

        const cleanStart = parseFloat(newStart.toFixed(2));
        const cleanEnd = parseFloat(newEnd.toFixed(2));
        setRangeStart(cleanStart);
        setRangeEnd(cleanEnd);
        onSeekRef.current(cleanStart);
      } else if (typeof activeDrag === 'object' && activeDrag.type === 'boundary') {
        const idx = activeDrag.index;
        setSegments(prev => {
          if (idx < 0 || idx >= prev.length - 1) return prev;
          const current = prev[idx];
          const next = prev[idx + 1];
          const minTime = current.start + 0.2;
          const maxTime = next.end - 0.2;
          const clampedTime = Math.max(minTime, Math.min(targetTime, maxTime));

          const updated = [...prev];
          updated[idx] = { ...updated[idx], end: parseFloat(clampedTime.toFixed(2)) };
          updated[idx + 1] = { ...updated[idx + 1], start: parseFloat(clampedTime.toFixed(2)) };
          return updated;
        });
        onSeekRef.current(targetTime);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleMove(e.clientX);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };

    const onEnd = () => {
      setActiveDrag(null);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: false });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [activeDrag, dragStartX, duration, getTimeFromClientX, initialRange, rangeEnd, rangeStart]);

  const handleStartDrag = (e: React.MouseEvent | React.TouchEvent, type: 'start' | 'end' | 'pan' | { type: 'boundary'; index: number }) => {
    e.stopPropagation();
    setActiveDrag(type);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setDragStartX(clientX);
    setInitialRange({ start: rangeStart, end: rangeEnd });
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    if (activeDrag || !trackRef.current || duration <= 0) return;
    const seekTime = getTimeFromClientX(e.clientX);
    onSeekRef.current(seekTime);
  };

  // Split segment at playhead
  const handleSplitAtPlayhead = () => {
    if (duration <= 0) return;
    const targetTime = Math.max(0.1, Math.min(currentTime, duration - 0.1));
    const idx = segments.findIndex(seg => targetTime > seg.start && targetTime < seg.end);
    if (idx === -1) return;

    const parent = segments[idx];
    const leftSeg: TrimSegment = {
      id: `seg-${Date.now()}-l`,
      start: parent.start,
      end: parseFloat(targetTime.toFixed(2)),
      mode: parent.mode
    };
    const rightSeg: TrimSegment = {
      id: `seg-${Date.now()}-r`,
      start: parseFloat(targetTime.toFixed(2)),
      end: parent.end,
      mode: parent.mode === 'keep' ? 'cut' : 'keep'
    };

    const newSegments = [...segments];
    newSegments.splice(idx, 1, leftSeg, rightSeg);
    setSegments(newSegments);
  };

  const toggleSegmentMode = (index: number) => {
    setSegments(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        mode: updated[index].mode === 'keep' ? 'cut' : 'keep'
      };
      return updated;
    });
  };

  const mergeWithNext = (index: number) => {
    if (index < 0 || index >= segments.length - 1) return;
    const current = segments[index];
    const next = segments[index + 1];

    const mergedSeg: TrimSegment = {
      id: `seg-merged-${Date.now()}`,
      start: current.start,
      end: next.end,
      mode: current.mode
    };

    const newSegments = [...segments];
    newSegments.splice(index, 2, mergedSeg);
    setSegments(newSegments);
  };

  const adjustStart = (delta: number) => {
    const next = Math.max(0, Math.min(rangeEnd - 0.2, parseFloat((rangeStart + delta).toFixed(2))));
    setRangeStart(next);
    onSeekRef.current(next);
  };

  const adjustEnd = (delta: number) => {
    const next = Math.min(duration, Math.max(rangeStart + 0.2, parseFloat((rangeEnd + delta).toFixed(2))));
    setRangeEnd(next);
    onSeekRef.current(next);
  };

  const resetAll = () => {
    setRangeStart(0);
    setRangeEnd(duration);
    setFadeIn(false);
    setFadeOut(false);
    setSegments([
      {
        id: `seg-init-${Date.now()}`,
        start: 0,
        end: duration,
        mode: 'keep'
      }
    ]);
    onSeekRef.current(0);
  };

  const selectedLength = editorMode === 'range'
    ? Math.max(0, rangeEnd - rangeStart)
    : segments
        .filter(s => (compileMode === 'keep-selected' ? s.mode === 'keep' : s.mode === 'cut'))
        .reduce((acc, curr) => acc + (curr.end - curr.start), 0);

  const selectedPct = duration > 0 ? Math.round((selectedLength / duration) * 100) : 100;
  const startPct = duration > 0 ? (rangeStart / duration) * 100 : 0;
  const endPct = duration > 0 ? (rangeEnd / duration) * 100 : 100;
  const widthPct = Math.max(0, endPct - startPct);
  const playheadPct = duration > 0 ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0;

  return (
    <div className={`trim-gallery-container trim-timeline-editor w-full rounded-2xl bg-[#18191e] border border-white/10 p-4 space-y-4 shadow-xl select-none ${className}`}>

      {/* Header: Mode Selector & Transport */}
      <div className="trim-timeline-toolbar flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">

        {/* Left: Mode Toggle Pills */}
        <div className="trim-timeline-modes flex items-center gap-1 bg-zinc-950/60 border border-white/10 p-1 rounded-xl shadow-inner">
          <button
            type="button"
            onClick={() => setEditorMode('range')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              editorMode === 'range'
                ? 'bg-white text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Range Trimmer</span>
          </button>

          <button
            type="button"
            onClick={() => setEditorMode('multi')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              editorMode === 'multi'
                ? 'bg-white text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Multi-Cut Splitter</span>
          </button>
        </div>

        {/* Right: Duration Pill, Play, Reset */}
        <div className="trim-timeline-transport flex items-center gap-2 self-end sm:self-center">
          <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-white shadow-sm">
            ✂ {selectedLength.toFixed(1)}s ({selectedPct}%)
          </span>

          {onTogglePlay && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onTogglePlay}
              className="h-8 px-3 bg-zinc-800 border-white/10 text-white hover:bg-zinc-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
              title={isPlaying ? "Pause playback" : "Play trimmed segment"}
            >
              {isPlaying ? (
                <>
                  <PauseIcon className="w-3.5 h-3.5 text-white fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <PlayIcon className="w-3.5 h-3.5 text-white fill-current" />
                  <span>Play</span>
                </>
              )}
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetAll}
            className="h-8 px-2.5 text-zinc-400 hover:text-white text-xs font-semibold cursor-pointer rounded-lg hover:bg-white/5"
            title="Reset full timeline"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            <span>Reset</span>
          </Button>
        </div>
      </div>

      {/* Main Interactive Studio Timeline Track */}
      <div className="trim-timeline-lane relative pt-6 pb-2 px-1">
        <div className="trim-timeline-ruler" aria-hidden="true">
          {[0, 25, 50, 75, 100].map(percent => (
            <span key={percent} style={{ left: `${percent}%` }}>
              {formatTime((duration * percent) / 100)}
            </span>
          ))}
        </div>
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className="trim-timeline-track relative h-16 w-full rounded-xl bg-zinc-900/90 border border-zinc-800/90 overflow-hidden cursor-pointer shadow-inner"
        >
          {/* Embedded Audio Waveform Graphic in Background */}
          <div className="absolute inset-0 flex items-center justify-between px-3 opacity-25 pointer-events-none">
            {waveformBars.map((height, i) => (
              <div
                key={i}
                className="w-1 bg-white rounded-full transition-all"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>

          {/* Mode 1: Single Range Trimmer */}
          {editorMode === 'range' ? (
            <>
              {/* Left Excluded Region */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-black/80 backdrop-blur-[1.5px] border-r border-zinc-800 z-10 pointer-events-none"
                style={{ width: `${startPct}%` }}
              />

              {/* Active Keep Zone (Draggable for Range Pan) */}
              <div
                onMouseDown={(e) => handleStartDrag(e, 'pan')}
                onTouchStart={(e) => handleStartDrag(e, 'pan')}
                className={`absolute top-0 bottom-0 z-20 cursor-grab active:cursor-grabbing border-y-2 transition-colors ${
                  activeDrag === 'pan'
                    ? 'border-white bg-white/20 shadow-[0_0_20px_rgba(255,255,255,0.15)]'
                    : 'border-white/90 bg-white/10 hover:bg-white/15'
                }`}
                style={{
                  left: `${startPct}%`,
                  width: `${widthPct}%`,
                  touchAction: 'none'
                }}
                title="Drag center to slide trimmed window"
              >
                {/* Fade In visual indicator */}
                {fadeIn && (
                  <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-emerald-500/40 to-transparent pointer-events-none border-l-2 border-emerald-400" />
                )}

                {/* Fade Out visual indicator */}
                {fadeOut && (
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-emerald-500/40 to-transparent pointer-events-none border-r-2 border-emerald-400" />
                )}

                {/* Center Drag Grip */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                  <div className="flex gap-1">
                    <div className="w-1 h-3.5 bg-white rounded-full" />
                    <div className="w-1 h-3.5 bg-white rounded-full" />
                  </div>
                </div>

                {/* Left Bracket Handle [ */}
                <div
                  onMouseDown={(e) => handleStartDrag(e, 'start')}
                  onTouchStart={(e) => handleStartDrag(e, 'start')}
                  className={`absolute left-0 top-0 bottom-0 w-6 -ml-3 flex items-center justify-center cursor-ew-resize z-30 touch-none group ${
                    activeDrag === 'start' ? 'scale-110' : ''
                  }`}
                  style={{ touchAction: 'none' }}
                  title="Drag to change Start Time"
                >
                  <div className="w-4 h-full rounded-l-lg bg-white text-zinc-950 flex items-center justify-center shadow-2xl border border-white hover:brightness-110">
                    <GripVertical className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  {/* Floating Start Tooltip */}
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-white text-zinc-950 font-mono font-bold text-[10px] whitespace-nowrap shadow-xl pointer-events-none">
                    {formatTime(rangeStart)}
                  </div>
                </div>

                {/* Right Bracket Handle ] */}
                <div
                  onMouseDown={(e) => handleStartDrag(e, 'end')}
                  onTouchStart={(e) => handleStartDrag(e, 'end')}
                  className={`absolute right-0 top-0 bottom-0 w-6 -mr-3 flex items-center justify-center cursor-ew-resize z-30 touch-none group ${
                    activeDrag === 'end' ? 'scale-110' : ''
                  }`}
                  style={{ touchAction: 'none' }}
                  title="Drag to change End Time"
                >
                  <div className="w-4 h-full rounded-r-lg bg-white text-zinc-950 flex items-center justify-center shadow-2xl border border-white hover:brightness-110">
                    <GripVertical className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  {/* Floating End Tooltip */}
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-white text-zinc-950 font-mono font-bold text-[10px] whitespace-nowrap shadow-xl pointer-events-none">
                    {formatTime(rangeEnd)}
                  </div>
                </div>
              </div>

              {/* Right Excluded Region */}
              <div
                className="absolute right-0 top-0 bottom-0 bg-black/80 backdrop-blur-[1.5px] border-l border-zinc-800 z-10 pointer-events-none"
                style={{ width: `${100 - endPct}%` }}
              />
            </>
          ) : (
            /* Mode 2: Multi-Cut Splitter Blocks */
            segments.map((seg, idx) => {
              const segStartPct = duration > 0 ? (seg.start / duration) * 100 : 0;
              const segEndPct = duration > 0 ? (seg.end / duration) * 100 : 100;
              const segWidthPct = Math.max(0, segEndPct - segStartPct);
              const isKeep = seg.mode === 'keep';
              const isActive = (compileMode === 'keep-selected' && isKeep) || (compileMode === 'cut-selected' && !isKeep);

              return (
                <div
                  key={seg.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSegmentMode(idx);
                  }}
                  className={`absolute top-0 bottom-0 flex items-center justify-center transition-all cursor-pointer border-y-2 select-none group ${
                    isActive
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                      : 'bg-black/80 border-rose-500/50 text-rose-400 opacity-60'
                  }`}
                  style={{
                    left: `${segStartPct}%`,
                    width: `${segWidthPct}%`,
                  }}
                  title={`Click to toggle Keep/Cut: Segment ${idx + 1} (${formatTime(seg.start)} - ${formatTime(seg.end)})`}
                >
                  {/* Segment Label Badge */}
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-950/80 border border-zinc-700/80 text-[10px] font-bold shadow-sm pointer-events-none">
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    <span>{isActive ? 'Keep' : 'Cut'}</span>
                    <span className="font-mono text-zinc-400">({(seg.end - seg.start).toFixed(1)}s)</span>
                  </div>

                  {/* Boundary Splitter Handle (between segments) */}
                  {idx < segments.length - 1 && (
                    <div
                      onMouseDown={(e) => handleStartDrag(e, { type: 'boundary', index: idx })}
                      onTouchStart={(e) => handleStartDrag(e, { type: 'boundary', index: idx })}
                      className="absolute right-0 top-0 bottom-0 w-6 -mr-3 flex items-center justify-center cursor-ew-resize z-40 touch-none group-hover:scale-110"
                      style={{ touchAction: 'none' }}
                      title="Drag partition cut point"
                    >
                      <div className="w-3.5 h-full rounded bg-white text-zinc-950 flex items-center justify-center shadow-lg border border-white">
                        <GripVertical className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Current Playhead Scrubber Line */}
          {duration > 0 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white z-40 pointer-events-none shadow-[0_0_8px_rgba(255,255,255,0.8)]"
              style={{ left: `${playheadPct}%` }}
            >
              <div className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-zinc-950 shadow-lg" />
            </div>
          )}
        </div>
      </div>

      {/* Mode Controls & Polish Features */}
      {editorMode === 'range' ? (
        <div className="trim-timeline-properties space-y-3 pt-2 border-t border-white/10">
          {/* Start & End Precision Steppers */}
          <div className="trim-timeline-time-fields grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Start Stepper */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-white/10">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Start Time</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustStart(-0.1)}
                  className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 flex items-center justify-center cursor-pointer font-bold transition-colors"
                  title="Step back 0.1s"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono font-bold text-white text-xs px-1.5 min-w-[4rem] text-center">
                  {formatTime(rangeStart)}
                </span>
                <button
                  type="button"
                  onClick={() => adjustStart(0.1)}
                  className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 flex items-center justify-center cursor-pointer font-bold transition-colors"
                  title="Step forward 0.1s"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* End Stepper */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-white/10">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">End Time</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustEnd(-0.1)}
                  className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 flex items-center justify-center cursor-pointer font-bold transition-colors"
                  title="Step back 0.1s"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono font-bold text-white text-xs px-1.5 min-w-[4rem] text-center">
                  {formatTime(rangeEnd)}
                </span>
                <button
                  type="button"
                  onClick={() => adjustEnd(0.1)}
                  className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 flex items-center justify-center cursor-pointer font-bold transition-colors"
                  title="Step forward 0.1s"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Fade Polish Toggles */}
          <div className="trim-timeline-fades flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-white/10 text-xs">
            <div className="trim-timeline-fades__label flex items-center gap-1.5 text-zinc-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
              <span>
                Audio fades
                <small>Smooth the clip edges</small>
              </span>
            </div>
            <div className="trim-timeline-fades__actions flex items-center gap-2" role="group" aria-label="Audio fade controls">
              <button
                type="button"
                onClick={() => setFadeIn(prev => !prev)}
                aria-pressed={fadeIn}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  fadeIn
                    ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-sm'
                    : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>Fade in</span>
                <small>1.5s</small>
              </button>
              <button
                type="button"
                onClick={() => setFadeOut(prev => !prev)}
                aria-pressed={fadeOut}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  fadeOut
                    ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-sm'
                    : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>Fade out</span>
                <small>1.5s</small>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Multi-Cut Splitter Controls */
        <div className="trim-timeline-properties trim-timeline-properties--multi space-y-3 pt-2 border-t border-white/10">
          {/* Split at Playhead Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-zinc-950/60 border border-white/10 text-xs">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleSplitAtPlayhead}
                className="h-9 px-4 bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Scissors className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Split at Playhead ({formatTime(currentTime)})</span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCompileMode(prev => prev === 'keep-selected' ? 'cut-selected' : 'keep-selected')}
                className="text-xs font-bold text-zinc-300 hover:text-white cursor-pointer bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 transition-colors"
              >
                Mode: {compileMode === 'keep-selected' ? 'Stitch Keep Zones' : 'Stitch Cut Regions'}
              </button>
            </div>
          </div>

          {/* Segment Chips List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
            {segments.map((seg, idx) => {
              const isKeep = seg.mode === 'keep';
              const isActive = (compileMode === 'keep-selected' && isKeep) || (compileMode === 'cut-selected' && !isKeep);
              return (
                <div
                  key={seg.id}
                  className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-colors ${
                    isActive
                      ? 'bg-zinc-900 border-emerald-500/40 text-white'
                      : 'bg-zinc-950/80 border-zinc-800/80 text-zinc-400 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                    <span className="font-bold text-white text-[11px] truncate">Seg {idx + 1}:</span>
                    <span className="font-mono text-zinc-300 text-[11px]">
                      {formatTime(seg.start)} - {formatTime(seg.end)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleSegmentMode(idx)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                        isKeep
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {isKeep ? 'Keep' : 'Cut'}
                    </button>

                    {idx < segments.length - 1 && (
                      <button
                        type="button"
                        onClick={() => mergeWithNext(idx)}
                        className="p-1 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded cursor-pointer transition-colors"
                        title="Merge with next segment"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
