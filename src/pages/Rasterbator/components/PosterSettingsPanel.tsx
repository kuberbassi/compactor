import React from 'react';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Switch } from '../../../components/ui/switch';
import { Slider } from '../../../components/ui/slider';
import {
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  ArrowLeftRight,
  Minus,
  Plus,
} from 'lucide-react';
import { PAGE_SIZES, HALFTONE_CELL_SIZE } from '../../../utils/posterEngine';

export type PosterTabId = 'grid' | 'style';

export interface PosterSettingsPanelProps {
  activeTab: PosterTabId;
  pageSize: keyof typeof PAGE_SIZES;
  orientation: 'Portrait' | 'Landscape';
  columns: number;
  rows: number;
  styleMode: 'color' | 'bw' | 'halftone';
  lockAspect: boolean;
  showCropMarks: boolean;
  showSheetNumbers: boolean;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  dotSize: number;
  invertHalftone: boolean;
  onPageSizeChange: (size: keyof typeof PAGE_SIZES) => void;
  onOrientationChange: (orient: 'Portrait' | 'Landscape') => void;
  onColumnsChange: (cols: number) => void;
  onRowsChange: (rows: number) => void;
  onSwapGrid: () => void;
  onApplyPhysicalWidthPreset?: (widthMeters: number) => void;
  setStyleMode: (mode: 'color' | 'bw' | 'halftone') => void;
  setLockAspect: (val: boolean) => void;
  setShowCropMarks: (val: boolean) => void;
  setShowSheetNumbers: (val: boolean) => void;
  onRotateCW: () => void;
  onRotateCCW: () => void;
  onRotate180?: () => void;
  onToggleFlipH: () => void;
  onToggleFlipV: () => void;
  onResetTransforms: () => void;
  setDotSize: (size: number) => void;
  setInvertHalftone: (inv: boolean) => void;
}

export const PosterSettingsPanel: React.FC<PosterSettingsPanelProps> = ({
  activeTab,
  pageSize,
  orientation,
  columns,
  rows,
  styleMode,
  lockAspect,
  showCropMarks,
  showSheetNumbers,
  rotation,
  flipH,
  flipV,
  dotSize = HALFTONE_CELL_SIZE,
  invertHalftone = false,
  onPageSizeChange,
  onOrientationChange,
  onColumnsChange,
  onRowsChange,
  onSwapGrid,
  setStyleMode,
  setLockAspect,
  setShowCropMarks,
  setShowSheetNumbers,
  onRotateCW,
  onRotateCCW,
  onRotate180: _onRotate180,
  onToggleFlipH,
  onToggleFlipV,
  onResetTransforms,
  setDotSize,
  setInvertHalftone,
}) => {
  const getPaperLabel = (key: keyof typeof PAGE_SIZES, orient: 'Portrait' | 'Landscape') => {
    const p = PAGE_SIZES[key];
    const mmW = orient === 'Portrait' ? p.mmW : p.mmH;
    const mmH = orient === 'Portrait' ? p.mmH : p.mmW;
    return `${key} (${mmW} × ${mmH} mm)`;
  };

  return (
    <div className="poster-settings-stack space-y-4">
      {/* ═══ 1. PAGE SETUP TAB ═══════════════════════════════════════════════ */}
      {activeTab === 'grid' && (
        <div className="poster-settings-stack space-y-4">
          {/* Tile Dimensions */}
          <div className="poster-setting-card space-y-3 p-3 bg-white/5 border border-white/10 rounded-xl">
            <span className="text-[11px] font-bold text-white uppercase tracking-wider block">Tile Dimensions</span>
            
            <div className="space-y-2">
              <span className="text-[10px] text-zinc-400 uppercase font-semibold">Page Size</span>
              <Select value={pageSize} onValueChange={(v) => { if (v) onPageSizeChange(v as keyof typeof PAGE_SIZES); }}>
                <SelectTrigger className="h-9 text-xs bg-zinc-900 border-white/10 text-white">
                  <SelectValue placeholder="Paper Size">{getPaperLabel(pageSize, orientation)}</SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                  {Object.keys(PAGE_SIZES).map((key) => (
                    <SelectItem key={key} value={key}>
                      {getPaperLabel(key as keyof typeof PAGE_SIZES, orientation)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-zinc-400 uppercase font-semibold">Orientation</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onOrientationChange('Portrait')}
                  className={`h-8 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    orientation === 'Portrait'
                      ? 'bg-white text-zinc-950 border-white font-bold shadow-sm'
                      : 'bg-zinc-900/60 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  Portrait
                </button>
                <button
                  type="button"
                  onClick={() => onOrientationChange('Landscape')}
                  className={`h-8 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    orientation === 'Landscape'
                      ? 'bg-white text-zinc-950 border-white font-bold shadow-sm'
                      : 'bg-zinc-900/60 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  Landscape
                </button>
              </div>
            </div>
          </div>

          {/* Tile Count (Grid) */}
          <div className="poster-setting-card poster-tile-count space-y-3 p-3 bg-white/5 border border-white/10 rounded-xl">
            <div className="poster-setting-card__header flex items-center justify-between">
              <span className="text-[11px] font-bold text-white uppercase tracking-wider">Tile Count</span>
              <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer select-none">
                <Switch
                  checked={lockAspect}
                  onCheckedChange={setLockAspect}
                />
                <span className="font-medium">Auto Ratio</span>
              </label>
            </div>

            <div className="poster-count-grid grid grid-cols-2 gap-3">
              <div className="poster-count-field space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold">Columns</span>
                <div className="poster-stepper flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onColumnsChange(Math.max(1, columns - 1))}
                    disabled={columns <= 1}
                    className="w-7 h-9 rounded-lg bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white flex items-center justify-center disabled:opacity-30 cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <Input
                    type="number"
                    min={1}
                    max={25}
                    value={columns}
                    onChange={e => onColumnsChange(parseInt(e.target.value, 10) || 1)}
                    className="h-9 flex-1 text-center text-xs bg-zinc-900 border-white/10 text-white font-bold px-1"
                  />
                  <button
                    type="button"
                    onClick={() => onColumnsChange(Math.min(25, columns + 1))}
                    disabled={columns >= 25}
                    className="w-7 h-9 rounded-lg bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white flex items-center justify-center disabled:opacity-30 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="poster-count-field space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold">Rows</span>
                <div className="poster-stepper flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onRowsChange(Math.max(1, rows - 1))}
                    disabled={lockAspect || rows <= 1}
                    className="w-7 h-9 rounded-lg bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white flex items-center justify-center disabled:opacity-30 cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <Input
                    type="number"
                    min={1}
                    max={25}
                    value={rows}
                    disabled={lockAspect}
                    onChange={e => onRowsChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="h-9 flex-1 text-center text-xs bg-zinc-900 border-white/10 text-white font-bold px-1 disabled:opacity-40"
                  />
                  <button
                    type="button"
                    onClick={() => onRowsChange(Math.min(25, rows + 1))}
                    disabled={lockAspect || rows >= 25}
                    className="w-7 h-9 rounded-lg bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white flex items-center justify-center disabled:opacity-30 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onSwapGrid}
              className="poster-swap-grid w-full h-8 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-zinc-400" />
              <span>Swap</span>
            </button>
          </div>

          {/* Print Guides */}
          <div className="poster-setting-card poster-print-guides space-y-2 p-3 bg-white/5 border border-white/10 rounded-xl">
            <span className="text-[11px] font-bold text-white uppercase tracking-wider block">Print Guides</span>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-300">Corner Crop Marks</span>
              <Switch checked={showCropMarks} onCheckedChange={setShowCropMarks} />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-xs text-zinc-300">Sheet Page Numbers</span>
              <Switch checked={showSheetNumbers} onCheckedChange={setShowSheetNumbers} />
            </div>
          </div>
        </div>
      )}

      {/* ═══ 2. STYLE & ROTATE TAB ════════════════════════════════════════════ */}
      {activeTab === 'style' && (
        <div className="space-y-4">
          <div className="space-y-2 p-3 bg-white/5 border border-white/10 rounded-xl">
            <span className="text-[11px] font-bold text-white uppercase tracking-wider block">Color & Raster Style</span>
            <div className="space-y-1.5">
              {[
                { id: 'color', label: 'Full Color Photo', desc: 'Original full color image' },
                { id: 'bw', label: 'Monochrome B&W', desc: 'Grayscale black & white ink' },
                { id: 'halftone', label: 'Classic Halftone Dots', desc: 'Vintage dot-matrix raster art' },
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setStyleMode(m.id as 'color' | 'bw' | 'halftone')}
                  className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                    styleMode === m.id
                      ? '!bg-white !text-zinc-950 !border-white font-bold shadow-md'
                      : 'bg-zinc-900/60 border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 hover:border-white/20'
                  }`}
                >
                  <span className={`text-xs font-bold ${styleMode === m.id ? '!text-zinc-950' : 'text-white'}`}>{m.label}</span>
                  <span className={`text-[10px] ${styleMode === m.id ? '!text-zinc-700 font-semibold' : 'text-zinc-400'}`}>{m.desc}</span>
                </button>
              ))}
            </div>

            {styleMode === 'halftone' && (
              <div className="space-y-3 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-200">Dot Size ({dotSize}px)</span>
                  <span className="text-[10px] text-zinc-400 font-semibold">
                    {dotSize <= 8 ? 'Fine' : dotSize <= 16 ? 'Standard' : dotSize <= 24 ? 'Bold' : 'Coarse'}
                  </span>
                </div>

                <Slider
                  min={6}
                  max={32}
                  step={2}
                  value={[dotSize]}
                  onValueChange={v => setDotSize(Array.isArray(v) ? v[0] : v)}
                />

                <label className="halftone-invert-row flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-semibold text-zinc-200">Invert Dots</span>
                  <Switch checked={invertHalftone} onCheckedChange={setInvertHalftone} />
                </label>
              </div>
            )}
          </div>

          <div className="space-y-3 p-3 bg-white/5 border border-white/10 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white uppercase tracking-wider block">Rotate & Mirror</span>
              {rotation !== 0 && (
                <span className="text-[10px] font-mono font-bold text-zinc-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                  {rotation}°
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onRotateCCW}
                className="h-10 rounded-xl bg-zinc-900/60 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer transition-all active:scale-[0.98]"
              >
                <RotateCcw className="w-4 h-4 text-zinc-400" />
                <span>Rotate Left</span>
              </button>

              <button
                type="button"
                onClick={onRotateCW}
                className="h-10 rounded-xl bg-zinc-900/60 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer transition-all active:scale-[0.98]"
              >
                <RotateCw className="w-4 h-4 text-zinc-400" />
                <span>Rotate Right</span>
              </button>

              <button
                type="button"
                onClick={onToggleFlipH}
                className={`h-10 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer transition-all active:scale-[0.98] ${
                  flipH
                    ? '!bg-white !text-zinc-950 !border-white font-bold shadow-md'
                    : 'bg-zinc-900/60 border-white/10 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <FlipHorizontal className={`w-4 h-4 ${flipH ? '!text-zinc-950' : 'text-zinc-400'}`} />
                <span>Flip Horiz</span>
              </button>

              <button
                type="button"
                onClick={onToggleFlipV}
                className={`h-10 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer transition-all active:scale-[0.98] ${
                  flipV
                    ? '!bg-white !text-zinc-950 !border-white font-bold shadow-md'
                    : 'bg-zinc-900/60 border-white/10 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <FlipVertical className={`w-4 h-4 ${flipV ? '!text-zinc-950' : 'text-zinc-400'}`} />
                <span>Flip Vert</span>
              </button>
            </div>

            {(rotation !== 0 || flipH || flipV) && (
              <button
                type="button"
                onClick={onResetTransforms}
                className="w-full h-8 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-xs font-semibold cursor-pointer transition-colors mt-2"
              >
                Reset Orientation (0°)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
