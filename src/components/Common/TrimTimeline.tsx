import React, { useState, useEffect, useRef } from 'react';
import { 
  PiScissorsLight as Scissors, 
  PiTrashLight as Trash2, 
  PiArrowCounterClockwiseLight as RotateCcw,
  PiPlayFill as PlayIcon,
  PiPauseFill as PauseIcon
} from 'react-icons/pi';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

export interface TrimSegment {
  id: string;
  start: number;
  end: number;
  mode: 'keep' | 'cut';
}

interface TrimTimelineProps {
  duration: number;
  currentTime: number;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onSeek: (time: number) => void;
  onChange: (segments: TrimSegment[], mode: 'keep-selected' | 'cut-selected') => void;
}

export const TrimTimeline: React.FC<TrimTimelineProps> = ({
  duration,
  currentTime,
  isPlaying = false,
  onTogglePlay,
  onSeek,
  onChange
}) => {
  const [editorTab, setEditorTab] = useState<'range' | 'multi'>('range');
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(duration);
  
  const [segments, setSegments] = useState<TrimSegment[]>([]);
  const [compileMode, setCompileMode] = useState<'keep-selected' | 'cut-selected'>('keep-selected');
  
  const trackRef = useRef<HTMLDivElement>(null);
  const activeHandle = useRef<'start' | 'end' | 'boundary' | 'scrub' | null>(null);
  const boundaryIndex = useRef<number>(-1);

  // Initialize bounds when duration is loaded
  useEffect(() => {
    if (duration > 0) {
      setRangeStart(0);
      setRangeEnd(duration);
      if (segments.length === 0) {
        setSegments([
          {
            id: 'seg-init',
            start: 0,
            end: duration,
            mode: 'keep'
          }
        ]);
      }
    }
  }, [duration]);

  // Sync up to parent whenever range or multi-segment state changes
  useEffect(() => {
    if (duration <= 0) return;
    if (editorTab === 'range') {
      const activeSeg: TrimSegment = {
        id: 'seg-range',
        start: Math.max(0, rangeStart),
        end: Math.min(duration, rangeEnd),
        mode: 'keep'
      };
      onChange([activeSeg], 'keep-selected');
    } else {
      if (segments.length > 0) {
        onChange(segments, compileMode);
      }
    }
  }, [editorTab, rangeStart, rangeEnd, segments, compileMode, duration]);

  // Range Handle Dragging
  const handleRangeMouseDown = (e: React.MouseEvent, type: 'start' | 'end') => {
    e.preventDefault();
    e.stopPropagation();
    activeHandle.current = type;
    document.addEventListener('mousemove', handleRangeMouseMove);
    document.addEventListener('mouseup', handleRangeMouseUp);
  };

  const handleRangeMouseMove = (e: MouseEvent) => {
    if (!activeHandle.current || !trackRef.current || duration <= 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = parseFloat((percentage * duration).toFixed(2));

    if (activeHandle.current === 'start') {
      const clamped = Math.max(0, Math.min(targetTime, rangeEnd - 0.2));
      setRangeStart(clamped);
      onSeek(clamped);
    } else if (activeHandle.current === 'end') {
      const clamped = Math.min(duration, Math.max(targetTime, rangeStart + 0.2));
      setRangeEnd(clamped);
      onSeek(clamped);
    }
  };

  const handleRangeMouseUp = () => {
    activeHandle.current = null;
    document.removeEventListener('mousemove', handleRangeMouseMove);
    document.removeEventListener('mouseup', handleRangeMouseUp);
  };

  // Multi-Segment Boundary Dragging
  const handleBoundaryMouseDown = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    activeHandle.current = 'boundary';
    boundaryIndex.current = index;
    document.addEventListener('mousemove', handleBoundaryMouseMove);
    document.addEventListener('mouseup', handleBoundaryMouseUp);
  };

  const handleBoundaryMouseMove = (e: MouseEvent) => {
    if (activeHandle.current !== 'boundary' || !trackRef.current || duration <= 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = parseFloat((percentage * duration).toFixed(2));

    const idx = boundaryIndex.current;
    if (idx < 0 || idx >= segments.length - 1) return;

    const current = segments[idx];
    const next = segments[idx + 1];

    const minTime = current.start + 0.2;
    const maxTime = next.end - 0.2;
    const clampedTime = Math.max(minTime, Math.min(newTime, maxTime));

    setSegments(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], end: clampedTime };
      updated[idx + 1] = { ...updated[idx + 1], start: clampedTime };
      return updated;
    });
  };

  const handleBoundaryMouseUp = () => {
    activeHandle.current = null;
    boundaryIndex.current = -1;
    document.removeEventListener('mousemove', handleBoundaryMouseMove);
    document.removeEventListener('mouseup', handleBoundaryMouseUp);
  };

  // Track click to scrub playhead
  const handleTrackClick = (e: React.MouseEvent) => {
    if (!trackRef.current || duration <= 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const seekTime = parseFloat((percentage * duration).toFixed(2));
    onSeek(seekTime);
  };

  // Split segment at current playhead
  const handleSplitAtPlayhead = () => {
    if (duration <= 0) return;
    const targetTime = Math.max(0.1, Math.min(currentTime, duration - 0.1));
    const idx = segments.findIndex(seg => targetTime > seg.start && targetTime < seg.end);
    if (idx === -1) return;

    const parent = segments[idx];
    const leftSeg: TrimSegment = {
      id: `seg-${Date.now()}-l`,
      start: parent.start,
      end: targetTime,
      mode: parent.mode
    };
    const rightSeg: TrimSegment = {
      id: `seg-${Date.now()}-r`,
      start: targetTime,
      end: parent.end,
      mode: parent.mode
    };

    const newSegments = [...segments];
    newSegments.splice(idx, 1, leftSeg, rightSeg);
    setSegments(newSegments);
  };

  const toggleSegmentMode = (index: number) => {
    const newSegments = [...segments];
    newSegments[index] = {
      ...newSegments[index],
      mode: newSegments[index].mode === 'keep' ? 'cut' : 'keep'
    };
    setSegments(newSegments);
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

  const resetTimeline = () => {
    setRangeStart(0);
    setRangeEnd(duration);
    setSegments([
      {
        id: 'seg-reset',
        start: 0,
        end: duration,
        mode: 'keep'
      }
    ]);
  };

  const stepFrame = (deltaSeconds: number) => {
    const next = Math.max(0, Math.min(duration, currentTime + deltaSeconds));
    onSeek(parseFloat(next.toFixed(2)));
  };

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || secs < 0) return "00:00.0";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const activeDuration = editorTab === 'range' 
    ? Math.max(0, rangeEnd - rangeStart)
    : segments
        .filter(s => (compileMode === 'keep-selected' ? s.mode === 'keep' : s.mode === 'cut'))
        .reduce((acc, curr) => acc + (curr.end - curr.start), 0);

  return (
    <Card className="p-5 border border-[var(--border-color)] bg-[var(--surface-color)] text-[var(--text-primary)] flex flex-col gap-4 shadow-xl rounded-2xl w-full">
      {/* Editor Top Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[var(--border-color)] pb-3">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-[var(--text-primary)] shrink-0" />
          <h4 className="font-extrabold text-xs tracking-tight text-[var(--text-primary)] uppercase">
            Trim & Cut Studio
          </h4>
        </div>

        {/* Tab Selector & Reset */}
        <div className="flex items-center gap-3">
          <div className="flex bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg p-0.5 text-xs font-semibold">
            <button
              onClick={() => setEditorTab('range')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                editorTab === 'range' 
                  ? 'bg-[var(--surface-hover)] text-[var(--text-primary)] font-bold shadow-sm border border-[var(--border-color)]' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Gallery Trimmer
            </button>
            <button
              onClick={() => setEditorTab('multi')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                editorTab === 'multi' 
                  ? 'bg-[var(--surface-hover)] text-[var(--text-primary)] font-bold shadow-sm border border-[var(--border-color)]' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Multi-Cut Splitter
            </button>
          </div>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={resetTimeline} 
            className="text-xs h-7 px-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-lg cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
          </Button>
        </div>
      </div>

      {/* Visual Timeline Track Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-[11px] font-bold text-[var(--text-secondary)]">
          <span>Timeline View ({formatTime(duration)})</span>
          <span className="text-[var(--text-primary)] font-mono">
            Selected: {activeDuration.toFixed(1)}s ({duration > 0 ? Math.round((activeDuration / duration) * 100) : 0}%)
          </span>
        </div>

        <div 
          ref={trackRef}
          onClick={handleTrackClick}
          className="relative h-12 w-full rounded-xl bg-[var(--bg-color)] border border-[var(--border-color)] overflow-visible flex cursor-pointer select-none shadow-inner"
        >
          {editorTab === 'range' ? (
            <>
              {/* Left excluded region */}
              <div 
                className="h-full bg-[var(--bg-color)]/90 border-r border-[var(--border-color)] relative flex items-center justify-center opacity-60"
                style={{ width: `${(rangeStart / duration) * 100}%` }}
              />

              {/* Active Keep Zone */}
              <div 
                className="h-full bg-[var(--surface-hover)] border-y-2 border-[var(--text-primary)] relative flex items-center justify-center text-[var(--text-primary)] font-bold text-[10px] uppercase tracking-wider"
                style={{ width: `${((rangeEnd - rangeStart) / duration) * 100}%` }}
              >
                <span>Keep Zone ({formatTime(rangeStart)} - {formatTime(rangeEnd)})</span>

                {/* Left Drag Handle */}
                <div
                  onMouseDown={(e) => handleRangeMouseDown(e, 'start')}
                  className="absolute left-0 top-0 bottom-0 w-3.5 bg-[var(--text-primary)] hover:opacity-90 cursor-col-resize z-30 flex items-center justify-center shadow-lg rounded-l-sm"
                  title="Drag left handle to change Start time"
                >
                  <div className="w-1 h-4 bg-[var(--surface-color)] rounded-full" />
                </div>

                {/* Right Drag Handle */}
                <div
                  onMouseDown={(e) => handleRangeMouseDown(e, 'end')}
                  className="absolute right-0 top-0 bottom-0 w-3.5 bg-[var(--text-primary)] hover:opacity-90 cursor-col-resize z-30 flex items-center justify-center shadow-lg rounded-r-sm"
                  title="Drag right handle to change End time"
                >
                  <div className="w-1 h-4 bg-[var(--surface-color)] rounded-full" />
                </div>
              </div>

              {/* Right excluded region */}
              <div 
                className="h-full bg-[var(--bg-color)]/90 border-l border-[var(--border-color)] relative flex items-center justify-center opacity-60"
                style={{ width: `${((duration - rangeEnd) / duration) * 100}%` }}
              />
            </>
          ) : (
            segments.map((seg, idx) => {
              const widthPct = ((seg.end - seg.start) / duration) * 100;
              const isKeep = seg.mode === 'keep';
              const isActive = (compileMode === 'keep-selected' && isKeep) || (compileMode === 'cut-selected' && !isKeep);

              return (
                <div
                  key={seg.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSegmentMode(idx);
                  }}
                  className={`h-full flex items-center justify-center relative select-none border-r border-dashed border-[var(--border-color)] last:border-r-0 transition-colors duration-200 ${
                    isActive 
                      ? 'bg-[var(--surface-hover)] text-[var(--text-primary)] font-extrabold' 
                      : 'bg-[var(--bg-color)] text-[var(--text-secondary)] opacity-50'
                  }`}
                  style={{ width: `${widthPct}%` }}
                  title={`Click to toggle: ${isKeep ? 'Keep Zone' : 'Excluded Cut'} (${formatTime(seg.start)} - ${formatTime(seg.end)})`}
                >
                  <span className="text-[10px] font-bold px-1 overflow-hidden text-ellipsis whitespace-nowrap pointer-events-none uppercase tracking-wider">
                    {isKeep ? 'Keep Zone' : 'Excluded Cut'}
                  </span>

                  {idx < segments.length - 1 && (
                    <div
                      onMouseDown={(e) => handleBoundaryMouseDown(e, idx)}
                      className="absolute right-[-6px] top-[-2px] bottom-[-2px] w-3 cursor-col-resize z-30 flex items-center justify-center"
                      title="Drag boundary cut point"
                    >
                      <div className="h-full w-1 bg-[var(--text-primary)] shadow-md rounded-full" />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Current Playhead Scrubber Bar */}
          {duration > 0 && (
            <div 
              className="absolute top-0 bottom-0 w-[2px] bg-rose-500 pointer-events-none z-40 shadow-md"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            >
              <div className="absolute top-[-6px] left-[-5px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-rose-500" />
            </div>
          )}
        </div>
      </div>

      {/* Frame Step Controls & Video Play/Pause Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-[var(--bg-color)]/60 p-3 rounded-xl border border-[var(--border-color)] gap-3">
        <div className="flex items-center gap-3">
          {/* Play/Pause Video Toggle Button */}
          {onTogglePlay && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onTogglePlay} 
              className="text-xs h-8 px-3 border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] cursor-pointer font-bold flex items-center gap-1.5 rounded-lg shadow-sm"
              title={isPlaying ? "Pause video playback" : "Play video from playhead"}
            >
              {isPlaying ? (
                <>
                  <PauseIcon className="w-3.5 h-3.5 text-amber-500" /> Pause
                </>
              ) : (
                <>
                  <PlayIcon className="w-3.5 h-3.5 text-white" /> Play
                </>
              )}
            </Button>
          )}

          <span className="text-xs font-mono text-[var(--text-secondary)]">
            Playhead: <strong className="text-[var(--text-primary)] font-bold">{formatTime(currentTime)}</strong> / {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Frame Step Buttons */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => stepFrame(-0.1)} 
            className="text-[11px] h-7 px-2.5 border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer font-mono rounded-lg"
            title="Step back 0.1s"
          >
            -0.1s
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => stepFrame(0.1)} 
            className="text-[11px] h-7 px-2.5 border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer font-mono rounded-lg"
            title="Step forward 0.1s"
          >
            +0.1s
          </Button>

          {editorTab === 'multi' && (
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleSplitAtPlayhead}
              className="text-xs h-7 bg-[var(--text-primary)] text-[var(--bg-color)] font-bold cursor-pointer rounded-lg hover:opacity-90"
            >
              <Scissors className="w-3.5 h-3.5 mr-1" /> Split Playhead
            </Button>
          )}
        </div>
      </div>

      {/* Multi-Segment Cut Table (when Multi mode active) */}
      {editorTab === 'multi' && (
        <div className="flex flex-col gap-2 pt-1 border-t border-[var(--border-color)]/50">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Segment Regions ({segments.length})
            </span>
            <button
              onClick={() => setCompileMode(prev => prev === 'keep-selected' ? 'cut-selected' : 'keep-selected')}
              className="text-[11px] font-bold text-[var(--text-primary)] hover:underline cursor-pointer"
            >
              Mode: {compileMode === 'keep-selected' ? 'Stitch Keep Zones' : 'Stitch Cut Regions'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 max-h-[140px] overflow-y-auto pr-1">
            {segments.map((seg, idx) => {
              const isKeep = seg.mode === 'keep';
              const isActive = (compileMode === 'keep-selected' && isKeep) || (compileMode === 'cut-selected' && !isKeep);
              return (
                <div 
                  key={seg.id} 
                  className={`flex justify-between items-center p-2 rounded-lg border text-xs transition-colors ${
                    isActive 
                      ? 'border-[var(--border-color)] bg-[var(--surface-hover)]' 
                      : 'border-[var(--border-color)]/50 bg-[var(--bg-color)] opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-[var(--text-primary)]' : 'bg-[var(--text-secondary)]'}`} />
                    <span className="font-bold text-[var(--text-primary)]">Seg {idx + 1}</span>
                    <span className="font-mono text-[var(--text-secondary)]">
                      [{formatTime(seg.start)} - {formatTime(seg.end)}]
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)]">({(seg.end - seg.start).toFixed(1)}s)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-6 px-2 text-[10px] font-bold rounded-md cursor-pointer ${
                        isKeep 
                          ? 'text-[var(--text-primary)] bg-[var(--surface-hover)]' 
                          : 'text-[var(--text-secondary)] bg-[var(--bg-color)]'
                      }`}
                      onClick={() => toggleSegmentMode(idx)}
                    >
                      {isKeep ? 'Keep Zone' : 'Excluded Cut'}
                    </Button>

                    {idx < segments.length - 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-[var(--text-secondary)] hover:text-rose-500 hover:bg-[var(--surface-hover)] cursor-pointer"
                        onClick={() => mergeWithNext(idx)}
                        title="Merge with next segment"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
};

