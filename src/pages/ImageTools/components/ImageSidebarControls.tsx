import React from 'react';
import { Slider } from '../../../components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../../../components/ui/select';
import { Input } from '../../../components/ui/input';
import { Switch } from '../../../components/ui/switch';
import { CompressionPresetSelector } from '../../../components/Common/CompressionPresetSelector';
import type { CompressionPreset } from '../../../utils/batch';
import type { FileSettings, ImageTabId } from '../imageToolsConfig';
import { detectDocumentContours } from '../../../utils/imageContours';

export interface ImageSidebarControlsProps {
  activeTab: ImageTabId;
  activeFile: File | null;
  activeSettings: FileSettings | null;
  compressionPreset: CompressionPreset;
  applyCompressionPreset: (preset: CompressionPreset) => void;
  removeMetadata: boolean;
  setRemoveMetadata: (val: boolean) => void;
  updateSetting: <K extends keyof FileSettings>(key: K, val: FileSettings[K]) => void;
  handleWidthChange: (val: string) => void;
  handleHeightChange: (val: string) => void;
  imageRef: React.RefObject<HTMLImageElement | null>;
  setCropLeftPct: (val: number) => void;
  setCropTopPct: (val: number) => void;
  setCropWidthPct: (val: number) => void;
  setCropHeightPct: (val: number) => void;
  setCropApplied: (val: boolean) => void;
  setCropAspect: (val: string) => void;
  measureImage: () => void;
  displayGrid: boolean;
  setDisplayGrid: (val: boolean) => void;
  applyImmediateCrop: () => void;
  revertImmediateCrop: () => void;
  pdfFilter: 'original' | 'smart-scan' | 'whiteboard' | 'bw' | 'vibrant';
  setPdfFilter: (value: 'original' | 'smart-scan' | 'whiteboard' | 'bw' | 'vibrant') => void;
  pdfOrientation: 'auto' | 'portrait' | 'landscape';
  setPdfOrientation: (value: 'auto' | 'portrait' | 'landscape') => void;
  pdfPageSize: 'fit' | 'a4' | 'letter';
  setPdfPageSize: (value: 'fit' | 'a4' | 'letter') => void;
  pdfMargin: 'none' | 'small' | 'big';
  setPdfMargin: (value: 'none' | 'small' | 'big') => void;
}

export const ImageSidebarControls: React.FC<ImageSidebarControlsProps> = ({
  activeTab,
  activeFile,
  activeSettings,
  compressionPreset,
  applyCompressionPreset,
  removeMetadata,
  setRemoveMetadata,
  updateSetting,
  handleWidthChange,
  handleHeightChange,
  imageRef,
  setCropLeftPct,
  setCropTopPct,
  setCropWidthPct,
  setCropHeightPct,
  setCropApplied,
  setCropAspect,
  measureImage,
  displayGrid,
  setDisplayGrid,
  applyImmediateCrop,
  revertImmediateCrop,
  pdfFilter, setPdfFilter, pdfOrientation, setPdfOrientation,
  pdfPageSize, setPdfPageSize, pdfMargin, setPdfMargin,
}) => {
  const quality = activeSettings?.quality ?? 80;
  const compressMethod = activeSettings?.compressMethod ?? 'auto';
  const targetSize = activeSettings?.targetSize ?? '500';
  const targetUnit = activeSettings?.targetUnit ?? 'KB';
  const aspectRatioLocked = activeSettings?.aspectRatioLocked ?? true;
  const maxWidth = activeSettings?.maxWidth ?? '';
  const maxHeight = activeSettings?.maxHeight ?? '';
  const origWidth = activeSettings?.origWidth ?? 0;
  const origHeight = activeSettings?.origHeight ?? 0;
  const cropWidthPct = activeSettings?.cropWidthPct ?? 100;
  const cropHeightPct = activeSettings?.cropHeightPct ?? 100;
  const cropLeftPct = activeSettings?.cropLeftPct ?? 0;
  const cropTopPct = activeSettings?.cropTopPct ?? 0;
  const cropAspect = activeSettings?.cropAspect ?? 'none';
  const cropApplied = activeSettings?.cropApplied ?? false;
  const flipH = activeSettings?.flipH ?? false;
  const flipV = activeSettings?.flipV ?? false;
  const rotation = activeSettings?.rotation ?? 0;
  const format = activeSettings?.format ?? 'preserve';
  const grayscale = activeSettings?.grayscale ?? false;

  const getFormatLabel = (fmt: string) => {
    switch (fmt) {
      case 'image/webp': return 'WebP (Modern, compact)';
      case 'image/jpeg': return 'JPEG (Standard photo)';
      case 'image/jpg': return 'JPG (Standard photo)';
      case 'image/png': return 'PNG (Lossless, transparency)';
      default: return 'Original Format';
    }
  };

  return (
    <div className="space-y-5">
      {activeTab === 'compress' && (
        <div className="space-y-4">
          <CompressionPresetSelector value={compressionPreset} onChange={applyCompressionPreset} />
          <label className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 cursor-pointer select-none transition-colors">
            <span className="text-xs font-medium text-zinc-300">Remove EXIF metadata</span>
            <input
              type="checkbox"
              checked={removeMetadata}
              onChange={event => setRemoveMetadata(event.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-zinc-100 accent-white cursor-pointer"
            />
          </label>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-400">Method</label>
            <Select value={compressMethod} onValueChange={v => updateSetting('compressMethod', v as 'auto' | 'target')}>
              <SelectTrigger className="w-full h-9 text-sm"><span>{compressMethod === 'auto' ? 'Auto Quality' : 'Target Size'}</span></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto Quality</SelectItem>
                <SelectItem value="target">Target Size</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {compressMethod === 'auto' ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-zinc-400">Quality</label>
                <div className="flex items-center gap-1">
                  <Input type="number" min={10} max={100} value={quality}
                    onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 10 && v <= 100) updateSetting('quality', v); }}
                    className="w-14 h-7 text-center text-sm p-1 font-bold bg-zinc-900 border-zinc-800 focus-visible:ring-1 focus-visible:ring-zinc-400"
                  />
                  <span className="text-xs text-zinc-500">%</span>
                </div>
              </div>
              <Slider min={10} max={100} step={5} value={[quality]} onValueChange={v => updateSetting('quality', Array.isArray(v) ? v[0] : v)} className="py-1" />
              <div className="flex justify-between text-[11px] text-zinc-600">
                <span>Max compress</span><span>Best quality</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400">Target Size</label>
              <div className="flex gap-2">
                <Input type="number" placeholder="e.g. 150" value={targetSize}
                  onChange={(e) => updateSetting('targetSize', e.target.value)}
                  className="h-9 flex-1 text-sm"
                />
                <Select value={targetUnit} onValueChange={v => updateSetting('targetUnit', v as 'KB' | 'MB')}>
                  <SelectTrigger className="w-20 h-9"><span>{targetUnit}</span></SelectTrigger>
                  <SelectContent><SelectItem value="KB">KB</SelectItem><SelectItem value="MB">MB</SelectItem></SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-zinc-600">Quality & dimensions auto-adjust to hit target.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'resize' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-400">Fixed Ratio</label>
            <input type="checkbox" checked={aspectRatioLocked} onChange={e => updateSetting('aspectRatioLocked', e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-zinc-100 cursor-pointer" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500">Width (px)</label>
              <Input type="number" placeholder="1920" value={maxWidth} onChange={e => handleWidthChange(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500">Height (px)</label>
              <Input type="number" placeholder="1080" value={maxHeight} onChange={e => handleHeightChange(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          {activeFile && activeSettings && (
            <p className="text-[11px] text-zinc-600">Original: {activeSettings.origWidth} × {activeSettings.origHeight}px</p>
          )}
        </div>
      )}

      {activeTab === 'crop' && (
        <div className="space-y-4 text-left">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Width</label>
              <Input 
                type="number" 
                value={Math.round((cropWidthPct / 100) * (activeSettings?.origWidth || origWidth))} 
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const maxW = activeSettings?.origWidth || origWidth;
                  if (!isNaN(val) && val > 0 && maxW > 0) {
                    const pct = Math.min(100 - cropLeftPct, (val / maxW) * 100);
                    updateSetting('cropWidthPct', pct);
                  }
                }}
                className="h-9 text-sm bg-zinc-950 border-zinc-850"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Height</label>
              <Input 
                type="number" 
                value={Math.round((cropHeightPct / 100) * (activeSettings?.origHeight || origHeight))} 
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const maxH = activeSettings?.origHeight || origHeight;
                  if (!isNaN(val) && val > 0 && maxH > 0) {
                    const pct = Math.min(100 - cropTopPct, (val / maxH) * 100);
                    updateSetting('cropHeightPct', pct);
                  }
                }}
                className="h-9 text-sm bg-zinc-950 border-zinc-850"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Aspect Ratio</label>
            <div className="flex gap-2 items-center">
              <Select value={cropAspect} onValueChange={val => {
                const activeVal = val ?? 'none';
                updateSetting('cropAspect', activeVal);
                
                let ratio = 1;
                if (activeVal === '1:1') ratio = 1;
                else if (activeVal === '16:9') ratio = 16/9;
                else if (activeVal === '4:3') ratio = 4/3;
                else if (activeVal === '3:2') ratio = 3/2;
                else if (activeVal === '5:4') ratio = 5/4;
                
                if (activeVal !== 'none' && activeVal !== 'full') {
                  const currentImgW = activeSettings?.origWidth || origWidth || 100;
                  const currentImgH = activeSettings?.origHeight || origHeight || 100;
                  
                  let newW = 100;
                  let newH = 100;
                  
                  if (currentImgW / currentImgH > ratio) {
                    newH = 80;
                    newW = (ratio * currentImgH * 80) / currentImgW;
                  } else {
                    newW = 80;
                    newH = (currentImgW * 80) / (ratio * currentImgH);
                  }
                  
                  updateSetting('cropWidthPct', newW);
                  updateSetting('cropHeightPct', newH);
                  updateSetting('cropLeftPct', (100 - newW) / 2);
                  updateSetting('cropTopPct', (100 - newH) / 2);
                  
                  setCropWidthPct(newW);
                  setCropHeightPct(newH);
                  setCropLeftPct((100 - newW) / 2);
                  setCropTopPct((100 - newH) / 2);
                } else if (activeVal === 'full') {
                  updateSetting('cropWidthPct', 100);
                  updateSetting('cropHeightPct', 100);
                  updateSetting('cropLeftPct', 0);
                  updateSetting('cropTopPct', 0);
                  setCropWidthPct(100);
                  setCropHeightPct(100);
                  setCropLeftPct(0);
                  setCropTopPct(0);
                }
              }}>
                <SelectTrigger className="h-9 flex-1 bg-zinc-950 border-zinc-850">
                  <span>
                    {cropAspect === 'none'
                      ? 'Custom (Free)'
                      : cropAspect === 'full'
                      ? 'Full (Original)'
                      : cropAspect === '1:1'
                      ? 'Square (1:1)'
                      : cropAspect}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Custom (Free)</SelectItem>
                  <SelectItem value="full">Full (Original)</SelectItem>
                  <SelectItem value="1:1">Square (1:1)</SelectItem>
                  <SelectItem value="16:9">16:9</SelectItem>
                  <SelectItem value="4:3">4:3</SelectItem>
                  <SelectItem value="3:2">3:2</SelectItem>
                  <SelectItem value="5:4">5:4</SelectItem>
                </SelectContent>
              </Select>

              <button 
                onClick={() => {
                  let nextAspect = cropAspect;
                  if (cropAspect === '16:9') nextAspect = '9:16';
                  else if (cropAspect === '9:16') nextAspect = '16:9';
                  else if (cropAspect === '4:3') nextAspect = '3:4';
                  else if (cropAspect === '3:4') nextAspect = '4:3';
                  else if (cropAspect === '3:2') nextAspect = '2:3';
                  else if (cropAspect === '2:3') nextAspect = '3:2';
                  else if (cropAspect === '5:4') nextAspect = '4:5';
                  else if (cropAspect === '4:5') nextAspect = '5:4';

                  const currentImgW = activeSettings?.origWidth || origWidth || 100;
                  const currentImgH = activeSettings?.origHeight || origHeight || 100;

                  let r = 1;
                  if (nextAspect === '16:9') r = 16 / 9;
                  else if (nextAspect === '9:16') r = 9 / 16;
                  else if (nextAspect === '4:3') r = 4 / 3;
                  else if (nextAspect === '3:4') r = 3 / 4;
                  else if (nextAspect === '3:2') r = 3 / 2;
                  else if (nextAspect === '2:3') r = 2 / 3;
                  else if (nextAspect === '5:4') r = 5 / 4;
                  else if (nextAspect === '4:5') r = 4 / 5;

                  let nextW = 90;
                  let nextH = 90;

                  if (nextAspect !== 'none') {
                    if (currentImgW / currentImgH > r) {
                      nextH = 90;
                      nextW = ((r * currentImgH * 90) / currentImgW);
                    } else {
                      nextW = 90;
                      nextH = ((currentImgW * 90) / (r * currentImgH));
                    }
                  } else {
                    const w = cropWidthPct;
                    const h = cropHeightPct;
                    const pxW = (h / 100) * currentImgH;
                    const pxH = (w / 100) * currentImgW;
                    nextW = Math.min(100, (pxW / currentImgW) * 100);
                    nextH = Math.min(100, (pxH / currentImgH) * 100);
                  }

                  if (nextW > 100) { nextW = 100; nextH = (currentImgW / (r * currentImgH)) * 100; }
                  if (nextH > 100) { nextH = 100; nextW = ((r * currentImgH) / currentImgW) * 100; }

                  const nextLeft = (100 - nextW) / 2;
                  const nextTop = (100 - nextH) / 2;

                  updateSetting('cropAspect', nextAspect);
                  updateSetting('cropWidthPct', nextW);
                  updateSetting('cropHeightPct', nextH);
                  updateSetting('cropLeftPct', nextLeft);
                  updateSetting('cropTopPct', nextTop);

                  setCropAspect(nextAspect);
                  setCropWidthPct(nextW);
                  setCropHeightPct(nextH);
                  setCropLeftPct(nextLeft);
                  setCropTopPct(nextTop);
                  
                  setTimeout(measureImage, 100);
                }}
                className="h-9 w-9 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-400 shrink-0 cursor-pointer"
                title="Swap orientation"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 12V4h8m8 8v8h-8" />
                  <path d="M14 2L22 10M10 22L2 14" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-zinc-400">Display grid</span>
            <input 
              type="checkbox" 
              checked={displayGrid} 
              onChange={(e) => setDisplayGrid(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-zinc-100 cursor-pointer" 
            />
          </div>

          <div className="flex gap-2">
            {cropApplied ? (
              <button 
                onClick={revertImmediateCrop}
                className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold h-9 rounded-lg text-sm transition-all cursor-pointer"
              >
                Revert
              </button>
            ) : (
              <button 
                onClick={applyImmediateCrop}
                className="flex-1 bg-zinc-50 hover:bg-zinc-200 text-zinc-950 font-bold h-9 rounded-lg text-sm transition-all cursor-pointer"
              >
                Crop
              </button>
            )}
          </div>
          
          <button
            onClick={() => {
              if (imageRef.current) {
                const bounds = detectDocumentContours(imageRef.current);
                if (bounds) {
                  updateSetting('cropLeftPct', bounds.left);
                  updateSetting('cropTopPct', bounds.top);
                  updateSetting('cropWidthPct', bounds.width);
                  updateSetting('cropHeightPct', bounds.height);
                  setCropLeftPct(bounds.left);
                  setCropTopPct(bounds.top);
                  setCropWidthPct(bounds.width);
                  setCropHeightPct(bounds.height);
                  updateSetting('cropApplied', true);
                  setCropApplied(true);
                  setTimeout(measureImage, 80);
                }
              }
            }}
            className="w-full bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800 text-zinc-200 font-bold h-9 rounded-lg text-[10px] uppercase tracking-wide transition-all cursor-pointer"
          >
            Auto Detect Document Borders
          </button>
        </div>
      )}

      {activeTab === 'mirror' && (
        <div className="space-y-2">
          {[{ label: 'Flip Horizontal', key: 'flipH' as const, val: flipH }, { label: 'Flip Vertical', key: 'flipV' as const, val: flipV }].map(item => (
            <label key={item.key} className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-zinc-900 hover:border-zinc-800 cursor-pointer transition-colors">
              <span className="text-sm text-zinc-300">{item.label}</span>
              <input type="checkbox" checked={item.val} onChange={e => updateSetting(item.key, e.target.checked)}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-zinc-100" />
            </label>
          ))}
        </div>
      )}

      {activeTab === 'rotate' && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-400">Angle</label>
          <Select value={rotation.toString()} onValueChange={v => updateSetting('rotation', parseInt(v || '0', 10))}>
            <SelectTrigger className="w-full h-9">
              <span>{rotation === 0 ? '0° — None' : rotation === 90 ? '90° Clockwise' : rotation === 180 ? '180° Half Turn' : '270° Counter-CW'}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0° — None</SelectItem>
              <SelectItem value="90">90° Clockwise</SelectItem>
              <SelectItem value="180">180° Half Turn</SelectItem>
              <SelectItem value="270">270° Counter-CW</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {activeTab === 'format' && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-400">Output Format</label>
          <Select value={format} onValueChange={v => updateSetting('format', v ?? 'preserve')}>
            <SelectTrigger className="w-full h-9"><span>{getFormatLabel(format)}</span></SelectTrigger>
            <SelectContent>
              <SelectItem value="preserve">Original</SelectItem>
              <SelectItem value="image/webp">WebP</SelectItem>
              <SelectItem value="image/jpeg">JPEG</SelectItem>
              <SelectItem value="image/jpg">JPG</SelectItem>
              <SelectItem value="image/png">PNG</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {activeTab === 'filter' && (
        <div className="space-y-4">
          <div className="image-filter-preview-note">
            <span aria-hidden="true" /> Changes appear on the image instantly
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-bold text-white uppercase tracking-wider block">Color Filters</span>
            <label className="flex items-center justify-between py-2.5 px-3 rounded-xl border border-white/10 bg-zinc-900/60 hover:bg-zinc-800/80 cursor-pointer transition-colors">
              <span className="text-xs font-semibold text-zinc-200">Grayscale (B&W)</span>
              <input
                type="checkbox"
                checked={grayscale}
                onChange={e => updateSetting('grayscale', e.target.checked)}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-zinc-100 cursor-pointer"
              />
            </label>
          </div>

          <div className="space-y-2 pt-2 border-t border-white/10">
            <span className="text-[11px] font-bold text-white uppercase tracking-wider block">Document & Art Filters</span>
            <div className="space-y-1.5">
              {([
                { id: 'none', label: 'Standard', hint: 'Original image tones' },
                { id: 'smart-contrast', label: 'High Contrast', hint: 'Text boost & shadow removal' },
                { id: 'crisp-bw', label: 'B&W Document', hint: 'Clean text & receipts' },
                { id: 'halftone', label: 'Classic Halftone Dots', hint: 'Dot-matrix raster art' },
              ] as const).map(({ id, label, hint }) => {
                const isSelected = (activeSettings?.scanEnhanceMode ?? 'none') === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => updateSetting('scanEnhanceMode', id)}
                    className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none ${
                      isSelected
                        ? '!bg-white !text-zinc-950 !border-white font-bold shadow-md'
                        : 'border-white/10 bg-zinc-900/60 text-zinc-400 hover:border-white/20 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <span className={`text-xs ${isSelected ? '!text-zinc-950 font-bold' : 'text-zinc-200'}`}>{label}</span>
                    <span className={`text-[10px] ${isSelected ? '!text-zinc-600 font-semibold' : 'text-zinc-500'}`}>{hint}</span>
                  </button>
                );
              })}
            </div>

            {activeSettings?.scanEnhanceMode === 'halftone' && (
              <div className="space-y-3 pt-3 mt-2 border-t border-white/10">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Dot Raster Size — {activeSettings?.halftoneDotSize ?? 10}px
                  </label>
                  <Slider
                    min={4}
                    max={40}
                    step={1}
                    value={[activeSettings?.halftoneDotSize ?? 10]}
                    onValueChange={(v) => {
                      const n = Array.isArray(v) ? (v as number[])[0] : (v as number);
                      updateSetting('halftoneDotSize', n ?? 10);
                    }}
                    className="w-full"
                  />
                </div>

                <label className="halftone-invert-row flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-semibold text-zinc-200">Invert Dots</span>
                  <Switch
                    checked={activeSettings?.halftoneInvert ?? false}
                    onCheckedChange={checked => updateSetting('halftoneInvert', checked)}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'watermark' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1">Watermark Text</label>
            <input
              type="text"
              value={activeSettings?.watermarkText ?? ''}
              onChange={e => updateSetting('watermarkText', e.target.value)}
              placeholder="e.g. CONFIDENTIAL"
              className="w-full h-9 px-3 rounded-lg border border-zinc-800 bg-zinc-950 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1">Position / Layout</label>
            <Select
              value={activeSettings?.watermarkPosition ?? 'center'}
              onValueChange={v => updateSetting('watermarkPosition', v as FileSettings['watermarkPosition'])}
            >
              <SelectTrigger className="w-full h-9">
                <span className="text-xs text-zinc-200">
                  {activeSettings?.watermarkPosition === 'pattern'
                    ? 'Pattern (Diagonal Grid)'
                    : activeSettings?.watermarkPosition === 'top-left'
                    ? 'Top Left'
                    : activeSettings?.watermarkPosition === 'top-right'
                    ? 'Top Right'
                    : activeSettings?.watermarkPosition === 'bottom-left'
                    ? 'Bottom Left'
                    : activeSettings?.watermarkPosition === 'bottom-right'
                    ? 'Bottom Right'
                    : 'Center'}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="pattern">Pattern (Diagonal Grid)</SelectItem>
                <SelectItem value="top-left">Top Left</SelectItem>
                <SelectItem value="top-right">Top Right</SelectItem>
                <SelectItem value="bottom-left">Bottom Left</SelectItem>
                <SelectItem value="bottom-right">Bottom Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1">
              Opacity — {Math.round((activeSettings?.watermarkOpacity ?? 0.4) * 100)}%
            </label>
            <Slider
              min={5} max={100}
              value={[Math.round((activeSettings?.watermarkOpacity ?? 0.4) * 100)]}
              onValueChange={(v) => {
                const n = Array.isArray(v) ? (v as number[])[0] : (v as number);
                updateSetting('watermarkOpacity', (n ?? 40) / 100);
              }}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1">
              Font Size — {activeSettings?.watermarkFontSize ?? 48}px
            </label>
            <Slider
              min={12} max={200}
              value={[activeSettings?.watermarkFontSize ?? 48]}
              onValueChange={(v) => {
                const n = Array.isArray(v) ? (v as number[])[0] : (v as number);
                updateSetting('watermarkFontSize', n ?? 48);
              }}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={activeSettings?.watermarkColor ?? '#ffffff'}
                onChange={e => updateSetting('watermarkColor', e.target.value)}
                className="w-9 h-9 rounded-lg border border-zinc-700 bg-zinc-900 cursor-pointer p-0.5"
              />
              <span className="text-xs text-zinc-400">{activeSettings?.watermarkColor ?? '#ffffff'}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'image-to-pdf' && (
        <div className="image-pdf-controls">
          <div className="image-pdf-controls__intro"><strong>PDF setup</strong><span>Settings apply to every page.</span></div>
          <label>Document filter<Select value={pdfFilter} onValueChange={value => setPdfFilter(value as typeof pdfFilter)}><SelectTrigger><span>{pdfFilter === 'smart-scan' ? 'Magic color' : pdfFilter === 'bw' ? 'Black & white' : pdfFilter === 'whiteboard' ? 'Whiteboard clean' : pdfFilter === 'vibrant' ? 'Vibrant' : 'Original'}</span></SelectTrigger><SelectContent><SelectItem value="smart-scan">Magic color</SelectItem><SelectItem value="whiteboard">Whiteboard clean</SelectItem><SelectItem value="bw">Black &amp; white</SelectItem><SelectItem value="vibrant">Vibrant</SelectItem><SelectItem value="original">Original</SelectItem></SelectContent></Select></label>
          <fieldset><legend>Orientation</legend><div className="image-pdf-controls__segments">{(['auto','portrait','landscape'] as const).map(value => <button type="button" key={value} className={pdfOrientation === value ? 'is-active' : ''} onClick={() => setPdfOrientation(value)}>{value}</button>)}</div></fieldset>
          <label>Page size<Select value={pdfPageSize} onValueChange={value => setPdfPageSize(value as typeof pdfPageSize)}><SelectTrigger><span>{pdfPageSize === 'fit' ? 'Fit image' : pdfPageSize === 'a4' ? 'A4' : 'US Letter'}</span></SelectTrigger><SelectContent><SelectItem value="fit">Fit image</SelectItem><SelectItem value="a4">A4</SelectItem><SelectItem value="letter">US Letter</SelectItem></SelectContent></Select></label>
          <label>Page margin<Select value={pdfMargin} onValueChange={value => setPdfMargin(value as typeof pdfMargin)}><SelectTrigger><span>{pdfMargin === 'none' ? 'None' : pdfMargin === 'small' ? 'Small' : 'Large'}</span></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="small">Small</SelectItem><SelectItem value="big">Large</SelectItem></SelectContent></Select></label>
          <fieldset><legend>Rotate selected image</legend><div className="image-pdf-controls__segments is-two"><button type="button" onClick={() => updateSetting('rotation', (rotation + 270) % 360)}>↶ Left</button><button type="button" onClick={() => updateSetting('rotation', (rotation + 90) % 360)}>Right ↷</button></div><small>{rotation}° rotation</small></fieldset>
        </div>
      )}
    </div>
  );
};
