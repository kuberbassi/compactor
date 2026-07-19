import React, { useState, useEffect, useRef } from 'react';
import { PiScissorsLight as Scissors, PiTrashLight as Trash2, PiArrowCounterClockwiseLight as RotateCcw } from 'react-icons/pi';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
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
  onSeek: (time: number) => void;
  onChange: (segments: TrimSegment[], mode: 'keep-selected' | 'cut-selected') => void;
}

export const TrimTimeline: React.FC<TrimTimelineProps> = ({
  duration,
  currentTime,
  onSeek,
  onChange
}) => {
  const [segments, setSegments] = useState<TrimSegment[]>([]);
  const [compileMode, setCompileMode] = useState<'keep-selected' | 'cut-selected'>('keep-selected');
  const trackRef = useRef<HTMLDivElement>(null);
  const dragInfo = useRef<{ type: 'boundary'; index: number } | null>(null);

  // Initialize with a single segment spanning the full duration
  useEffect(() => {
    if (duration > 0 && segments.length === 0) {
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

  // Sync changes up to parent
  useEffect(() => {
    if (segments.length > 0) {
      onChange(segments, compileMode);
    }
  }, [segments, compileMode]);

  // Split the segment containing the playhead time
  const handleSplit = () => {
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

  // Toggle segment between keep (bright) and cut (darkened)
  const toggleSegmentMode = (index: number) => {
    const newSegments = [...segments];
    newSegments[index] = {
      ...newSegments[index],
      mode: newSegments[index].mode === 'keep' ? 'cut' : 'keep'
    };
    setSegments(newSegments);
  };

  // Merge segment index with the next segment (removes the boundary)
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
    setSegments([
      {
        id: 'seg-reset',
        start: 0,
        end: duration,
        mode: 'keep'
      }
    ]);
  };

  // Drag boundary logic
  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    dragInfo.current = { type: 'boundary', index };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragInfo.current || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const percentage = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
    const newTime = parseFloat((percentage * duration).toFixed(2));

    const { index } = dragInfo.current;
    const current = segments[index];
    const next = segments[index + 1];

    // Constrain boundary between start of current and end of next with a 0.2s minimum length buffer
    const minTime = current.start + 0.2;
    const maxTime = next.end - 0.2;
    const clampedTime = Math.max(minTime, Math.min(newTime, maxTime));

    setSegments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], end: clampedTime };
      updated[index + 1] = { ...updated[index + 1], start: clampedTime };
      return updated;
    });
  };

  const handleMouseUp = () => {
    dragInfo.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('timeline-segment')) return;
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const seekTime = parseFloat((percentage * duration).toFixed(2));
    onSeek(seekTime);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="p-4 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col gap-4 shadow-sm w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Scissors className="w-4 h-4 text-sky-500" /> Advanced Multi-Segment Cut Editor
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Divide your file into segments, toggle between Keep/Cut status, and choose how to compile.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {compileMode === 'keep-selected' ? 'Stitch Bright portions' : 'Stitch Darkened portions'}
            </span>
            <Switch
              checked={compileMode === 'cut-selected'}
              onCheckedChange={(checked: boolean) => setCompileMode(checked ? 'cut-selected' : 'keep-selected')}
              aria-label="Toggle compilation mode"
            />
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={resetTimeline} 
            className="text-xs h-8"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
          </Button>
        </div>
      </div>

      {/* Visual Timeline Track */}
      <div className="relative w-full py-4 mt-2">
        <div 
          ref={trackRef}
          onClick={handleTrackClick}
          className="relative h-10 w-full rounded-lg bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 overflow-visible flex cursor-pointer"
        >
          {segments.map((seg, idx) => {
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
                className={`timeline-segment h-full flex items-center justify-center relative select-none border-r border-dashed border-zinc-400/40 last:border-r-0 transition-colors duration-200 ${
                  isActive 
                    ? 'bg-sky-500/25 dark:bg-sky-500/20 text-sky-800 dark:text-sky-200 hover:bg-sky-500/35' 
                    : 'bg-zinc-950/70 dark:bg-zinc-950/80 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-950/60'
                }`}
                style={{ width: `${widthPct}%` }}
                title={`Click to toggle: ${isKeep ? 'Keep' : 'Cut'} (${formatTime(seg.start)} - ${formatTime(seg.end)})`}
              >
                <span className="text-[10px] font-bold px-1 overflow-hidden text-ellipsis whitespace-nowrap pointer-events-none">
                  {isKeep ? 'BRIGHT (Keep)' : 'DARKENED (Cut)'}
                </span>

                {/* Render dragging handle boundary at the end of the segment (except the last one) */}
                {idx < segments.length - 1 && (
                  <div
                    onMouseDown={(e) => handleMouseDown(e, idx)}
                    className="absolute right-[-6px] top-[-4px] h-[48px] w-[12px] cursor-col-resize z-30 flex items-center justify-center"
                    title="Drag to adjust cut point"
                  >
                    <div className="h-full w-[2px] bg-sky-500 dark:bg-sky-400 shadow-sm relative">
                      <div className="absolute top-[18px] left-[-3px] w-2 h-2 rounded-full bg-sky-500 dark:bg-sky-400 border border-white"></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Current playback playhead indicator */}
          {duration > 0 && (
            <div 
              className="absolute top-0 bottom-0 w-[2px] bg-red-500 pointer-events-none z-20 shadow-sm"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            >
              <div className="absolute top-[-6px] left-[-5px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-red-500"></div>
            </div>
          )}
        </div>
      </div>

      {/* Control Buttons & Playhead displays */}
      <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-900">
        <span className="text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400">
          Playhead: <strong className="text-zinc-900 dark:text-zinc-50">{formatTime(currentTime)}</strong> / {formatTime(duration)}
        </span>

        <Button 
          variant="secondary" 
          size="sm" 
          onClick={handleSplit}
          className="text-xs h-8 bg-sky-100 text-sky-800 hover:bg-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:hover:bg-sky-900"
        >
          <Scissors className="w-3.5 h-3.5 mr-1" /> Split at Playhead
        </Button>
      </div>

      {/* Tabular manual input grid */}
      <div className="flex flex-col gap-2 mt-2">
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Segments List ({segments.length})</span>
        <div className="grid grid-cols-1 gap-2 max-h-[160px] overflow-y-auto pr-1">
          {segments.map((seg, idx) => {
            const isKeep = seg.mode === 'keep';
            const isActive = (compileMode === 'keep-selected' && isKeep) || (compileMode === 'cut-selected' && !isKeep);
            return (
              <div 
                key={seg.id} 
                className={`flex justify-between items-center p-2 rounded border text-xs transition-colors ${
                  isActive 
                    ? 'border-sky-200 bg-sky-50/20 dark:border-sky-950 dark:bg-sky-950/10' 
                    : 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 opacity-70'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-zinc-500'}`}></span>
                  <span className="font-semibold text-zinc-850 dark:text-zinc-200">Segment {idx + 1}</span>
                  <span className="font-mono text-zinc-500 dark:text-zinc-400">
                    [{formatTime(seg.start)} - {formatTime(seg.end)}]
                  </span>
                  <span className="text-[10px] text-zinc-400">({(seg.end - seg.start).toFixed(1)}s)</span>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-2.5 text-[11px] font-bold ${
                      isKeep 
                        ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950/40 hover:bg-green-100' 
                        : 'text-zinc-600 bg-zinc-100 dark:text-zinc-400 dark:bg-zinc-800 hover:bg-zinc-200'
                    }`}
                    onClick={() => toggleSegmentMode(idx)}
                  >
                    {isKeep ? 'Bright (Keep)' : 'Darkened (Cut)'}
                  </Button>

                  {idx < segments.length - 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      onClick={() => mergeWithNext(idx)}
                      title="Merge with next segment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
