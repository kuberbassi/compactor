import { useState, useEffect, useRef } from 'react';
import { FileUploader } from '../../components/Common/FileUploader';
import { CompressionPresetSelector } from '../../components/Common/CompressionPresetSelector';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { ToolHeader } from '../../components/Common/ToolHeader';
import { processImage, formatBytes, loadImage } from '../../utils/image';
import type { ImageProcessResult } from '../../utils/image';
import { appendUniqueFiles, downloadAll, getSizeSummary, isEditableShortcutTarget, loadSetting, saveSetting, shareResult } from '../../utils/batch';
import type { CompressionPreset } from '../../utils/batch';
import { 
  Image as ImageIcon, Download, RefreshCw, 
  CheckCircle,
  Sliders, Eye, Plus as PlusIcon,
  Crop as CropIcon, Expand as ResizeIcon, ArrowLeftRight as MirrorIcon,
  Palette as FilterIcon, FolderOpen as FormatIcon, ArrowLeft
} from 'lucide-react';
import { Slider } from '../../components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../../components/ui/select';
import { Input } from '../../components/ui/input';

interface FileSettings {
  quality: number;
  format: string;
  maxWidth: string;
  maxHeight: string;
  compressMethod: 'auto' | 'target';
  targetSize: string;
  targetUnit: 'KB' | 'MB';
  aspectRatioLocked: boolean;
  origWidth: number;
  origHeight: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  cropAspect: string;
  grayscale: boolean;
  cropLeftPct: number;
  cropTopPct: number;
  cropWidthPct: number;
  cropHeightPct: number;
  cropApplied: boolean;
}

interface ImageToolsProps {
  onGoHome: () => void;
  onUploadSuccess: () => void;
}

const TABS = [
  { id: 'compress',   label: 'Compress',  Icon: Sliders },
  { id: 'resize',     label: 'Resize',    Icon: ResizeIcon },
  { id: 'crop',       label: 'Crop',      Icon: CropIcon },
  { id: 'mirror',     label: 'Mirror',    Icon: MirrorIcon },
  { id: 'rotate',     label: 'Rotate',    Icon: RefreshCw },
  { id: 'format',     label: 'Convert',   Icon: FormatIcon },
  { id: 'filter',     label: 'Filters',   Icon: FilterIcon },
] as const;

type TabId = typeof TABS[number]['id'];

const detectDocumentContours = (img: HTMLImageElement) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  
  // Scale down for faster pixel scanning
  const w = 200;
  const h = Math.round((img.naturalHeight * 200) / img.naturalWidth);
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);
  
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  
  // 1. Calculate average luminance to set adaptive threshold
  let totalLum = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalLum += (0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
  }
  const avgLum = totalLum / (w * h);
  
  // 2. Scan from left, right, top, bottom to find transitions
  let left = 0, right = w - 1, top = 0, bottom = h - 1;
  const threshold = Math.max(40, avgLum * 0.85); // buffer threshold
  
  // Scan Left
  for (let x = 0; x < w; x++) {
    let columnSum = 0;
    for (let y = 0; y < h; y++) {
      const idx = (y * w + x) * 4;
      columnSum += (0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2]);
    }
    if (columnSum / h > threshold) {
      left = x;
      break;
    }
  }
  
  // Scan Right
  for (let x = w - 1; x >= 0; x--) {
    let columnSum = 0;
    for (let y = 0; y < h; y++) {
      const idx = (y * w + x) * 4;
      columnSum += (0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2]);
    }
    if (columnSum / h > threshold) {
      right = x;
      break;
    }
  }
  
  // Scan Top
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      rowSum += (0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2]);
    }
    if (rowSum / w > threshold) {
      top = y;
      break;
    }
  }
  
  // Scan Bottom
  for (let y = h - 1; y >= 0; y--) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      rowSum += (0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2]);
    }
    if (rowSum / w > threshold) {
      bottom = y;
      break;
    }
  }
  
  // 3. Return percentage bounds (clamped for margin buffer)
  const lPct = Math.max(0, Math.round((left / w) * 100));
  const tPct = Math.max(0, Math.round((top / h) * 100));
  const rPct = Math.min(100, Math.round((right / w) * 100));
  const bPct = Math.min(100, Math.round((bottom / h) * 100));
  
  const wPct = Math.max(15, rPct - lPct);
  const hPct = Math.max(15, bPct - tPct);
  
  return { left: lPct, top: tPct, width: wPct, height: hPct };
};

export const ImageTools: React.FC<ImageToolsProps> = ({ onGoHome, onUploadSuccess }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [fileSettingsList, setFileSettingsList] = useState<FileSettings[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [sameForAll, setSameForAll] = useState(true);
  const [compressionPreset, setCompressionPreset] = useState<CompressionPreset>(() =>
    loadSetting('compactor_image_compression_preset', 'balanced')
  );
  const [removeMetadata, setRemoveMetadata] = useState(() =>
    loadSetting('compactor_image_remove_metadata', true)
  );
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const saved = localStorage.getItem('compactor_img_active_tab');
    return (saved as TabId) || 'compress';
  });

  useEffect(() => {
    localStorage.setItem('compactor_img_active_tab', activeTab);
  }, [activeTab]);
  const [processing, setProcessing] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImageProcessResult[]>([]);
  const [failedFileIndexes, setFailedFileIndexes] = useState<number[]>([]);
  const [selectedForCompare, setSelectedForCompare] = useState<ImageProcessResult | null>(null);
  const cancellationRef = useRef<boolean>(false);

  // Interactive split slider preview states
  const [compareSplitPct, setCompareSplitPct] = useState<number>(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const startSplitDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplit(true);
  };

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent) => {
      if (!isDraggingSplit || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setCompareSplitPct(pct);
    };

    const handleGlobalUp = () => {
      setIsDraggingSplit(false);
    };

    if (isDraggingSplit) {
      window.addEventListener('mousemove', handleGlobalMove);
      window.addEventListener('mouseup', handleGlobalUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
    };
  }, [isDraggingSplit]);

  const [compressMethod, setCompressMethod] = useState<'auto' | 'target'>('auto');
  const [targetSize, setTargetSize] = useState<string>('30');
  const [targetUnit, setTargetUnit] = useState<'KB' | 'MB'>('KB');
  const [quality, setQuality] = useState(80);
  const [format, setFormat] = useState('preserve');
  const [maxWidth, setMaxWidth] = useState<string>('');
  const [maxHeight, setMaxHeight] = useState<string>('');
  const [aspectRatioLocked, setAspectRatioLocked] = useState(true);
  const [origWidth, setOrigWidth] = useState<number>(0);
  const [origHeight, setOrigHeight] = useState<number>(0);
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [cropAspect, setCropAspect] = useState<string>('none');
  const [grayscale, setGrayscale] = useState<boolean>(false);
  const [cropLeftPct, setCropLeftPct] = useState<number>(0);
  const [cropTopPct, setCropTopPct] = useState<number>(0);
  const [cropWidthPct, setCropWidthPct] = useState<number>(100);
  const [cropHeightPct, setCropHeightPct] = useState<number>(100);
  const [cropApplied, setCropApplied] = useState<boolean>(false);

  const [displayGrid, setDisplayGrid] = useState(true);
  const [draggedFileIndex, setDraggedFileIndex] = useState<number | null>(null);

  useEffect(() => {
    saveSetting('compactor_image_compression_preset', compressionPreset);
    saveSetting('compactor_image_remove_metadata', removeMetadata);
  }, [compressionPreset, removeMetadata]);

  const applyCompressionPreset = (preset: CompressionPreset) => {
    setCompressionPreset(preset);
    const presetQuality = preset === 'light' ? 90 : preset === 'balanced' ? 80 : 55;
    updateSetting('quality', presetQuality);
    updateSetting('compressMethod', 'auto');
  };

  // Preview URLs managed with cleanup
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [files]);

  const [imageRect, setImageRect] = useState<{ width: number; height: number; left: number; top: number } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const cropOverlayRef = useRef<HTMLDivElement>(null);

  const applyImmediateCrop = async () => {
    updateSetting('cropApplied', true);
    setCropApplied(true);
  };

  const revertImmediateCrop = () => {
    updateSetting('cropLeftPct', 0);
    updateSetting('cropTopPct', 0);
    updateSetting('cropWidthPct', 100);
    updateSetting('cropHeightPct', 100);
    updateSetting('cropAspect', 'none');
    updateSetting('cropApplied', false);

    setCropLeftPct(0);
    setCropTopPct(0);
    setCropWidthPct(100);
    setCropHeightPct(100);
    setCropAspect('none');
    setCropApplied(false);
  };

  const measureImage = () => {
    if (imageRef.current) {
      const img = imageRef.current;
      setImageRect({
        width: img.clientWidth,
        height: img.clientHeight,
        left: img.offsetLeft,
        top: img.offsetTop,
      });
    }
  };

  useEffect(() => {
    window.addEventListener('resize', measureImage);
    return () => window.removeEventListener('resize', measureImage);
  }, []);

  useEffect(() => {
    setTimeout(measureImage, 150);
  }, [activeIndex, activeTab, files]);

  const startDrag = (e: React.MouseEvent, type: 'move' | 'nw' | 'ne' | 'se' | 'sw') => {
    e.preventDefault();
    if (!imageRect) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initLeft = cropLeftPct;
    const initTop = cropTopPct;
    const initWidth = cropWidthPct;
    const initHeight = cropHeightPct;

    let finalLeft = initLeft;
    let finalTop = initTop;
    let finalWidth = initWidth;
    let finalHeight = initHeight;

    // Aspect ratio lock check
    let targetRatio = 0;
    let ratioInPct = 0;
    if (cropAspect !== 'none' && cropAspect !== 'full') {
      const parts = cropAspect.split(':');
      if (parts.length === 2) {
        targetRatio = parseFloat(parts[0]) / parseFloat(parts[1]);
        const currentImgW = activeSettings?.origWidth || origWidth || 100;
        const currentImgH = activeSettings?.origHeight || origHeight || 100;
        ratioInPct = targetRatio * (currentImgH / currentImgW);
      }
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      const dxPct = (dx / imageRect.width) * 100;
      const dyPct = (dy / imageRect.height) * 100;

      if (type === 'move') {
        finalLeft = Math.max(0, Math.min(100 - initWidth, initLeft + dxPct));
        finalTop = Math.max(0, Math.min(100 - initHeight, initTop + dyPct));
      } else {
        if (targetRatio > 0) {
          if (type === 'se') {
            finalWidth = Math.max(10, Math.min(100 - initLeft, initWidth + dxPct));
            finalHeight = finalWidth / ratioInPct;
            if (initTop + finalHeight > 100) {
              finalHeight = 100 - initTop;
              finalWidth = finalHeight * ratioInPct;
            }
          } else if (type === 'nw') {
            finalLeft = Math.max(0, Math.min(initLeft + initWidth - 10, initLeft + dxPct));
            finalWidth = initWidth - (finalLeft - initLeft);
            finalHeight = finalWidth / ratioInPct;
            finalTop = initTop + initHeight - finalHeight;
            if (finalTop < 0) {
              finalTop = 0;
              finalHeight = initTop + initHeight;
              finalWidth = finalHeight * ratioInPct;
              finalLeft = initLeft + initWidth - finalWidth;
            }
          } else if (type === 'ne') {
            finalWidth = Math.max(10, Math.min(100 - initLeft, initWidth + dxPct));
            finalHeight = finalWidth / ratioInPct;
            finalTop = initTop + initHeight - finalHeight;
            if (finalTop < 0) {
              finalTop = 0;
              finalHeight = initTop + initHeight;
              finalWidth = finalHeight * ratioInPct;
            }
          } else if (type === 'sw') {
            finalLeft = Math.max(0, Math.min(initLeft + initWidth - 10, initLeft + dxPct));
            finalWidth = initWidth - (finalLeft - initLeft);
            finalHeight = finalWidth / ratioInPct;
            if (initTop + finalHeight > 100) {
              finalHeight = 100 - initTop;
              finalWidth = finalHeight * ratioInPct;
              finalLeft = initLeft + initWidth - finalWidth;
            }
          }
        } else {
          if (type === 'se') {
            finalWidth = Math.max(10, Math.min(100 - initLeft, initWidth + dxPct));
            finalHeight = Math.max(10, Math.min(100 - initTop, initHeight + dyPct));
          } else if (type === 'nw') {
            finalLeft = Math.max(0, Math.min(initLeft + initWidth - 10, initLeft + dxPct));
            finalWidth = initWidth - (finalLeft - initLeft);
            finalTop = Math.max(0, Math.min(initTop + initHeight - 10, initTop + dyPct));
            finalHeight = initHeight - (finalTop - initTop);
          } else if (type === 'ne') {
            finalWidth = Math.max(10, Math.min(100 - initLeft, initWidth + dxPct));
            finalTop = Math.max(0, Math.min(initTop + initHeight - 10, initTop + dyPct));
            finalHeight = initHeight - (finalTop - initTop);
          } else if (type === 'sw') {
            finalLeft = Math.max(0, Math.min(initLeft + initWidth - 10, initLeft + dxPct));
            finalWidth = initWidth - (finalLeft - initLeft);
            finalHeight = Math.max(10, Math.min(100 - initTop, initHeight + dyPct));
          }
        }
      }

      // Update DOM directly for absolute smooth cursor tracking without React cycle lag
      if (cropOverlayRef.current) {
        cropOverlayRef.current.style.left = `${imageRect.left + (finalLeft / 100) * imageRect.width}px`;
        cropOverlayRef.current.style.top = `${imageRect.top + (finalTop / 100) * imageRect.height}px`;
        cropOverlayRef.current.style.width = `${(finalWidth / 100) * imageRect.width}px`;
        cropOverlayRef.current.style.height = `${(finalHeight / 100) * imageRect.height}px`;
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // Commit to React state and sync main settings only when dragging finishes
      setCropLeftPct(finalLeft);
      setCropTopPct(finalTop);
      setCropWidthPct(finalWidth);
      setCropHeightPct(finalHeight);

      setFileSettingsList((prev) => {
        const copy = prev.map(item => ({ ...item }));
        if (activeIndex !== null && copy[activeIndex]) {
          copy[activeIndex] = {
            ...copy[activeIndex],
            cropLeftPct: finalLeft,
            cropTopPct: finalTop,
            cropWidthPct: finalWidth,
            cropHeightPct: finalHeight
          };
        }
        return copy;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Hidden file input for queue add-more
  const addMoreRef = useRef<HTMLInputElement>(null);

  // ── Settings sync ──────────────────────────────────────────────────────────
  const updateSetting = <K extends keyof FileSettings>(key: K, value: FileSettings[K]) => {
    if (key === 'quality') setQuality(value as number);
    else if (key === 'format') setFormat(value as string);
    else if (key === 'maxWidth') setMaxWidth(value as string);
    else if (key === 'maxHeight') setMaxHeight(value as string);
    else if (key === 'compressMethod') setCompressMethod(value as 'auto' | 'target');
    else if (key === 'targetSize') setTargetSize(value as string);
    else if (key === 'targetUnit') setTargetUnit(value as 'KB' | 'MB');
    else if (key === 'aspectRatioLocked') setAspectRatioLocked(value as boolean);
    else if (key === 'rotation') setRotation(value as number);
    else if (key === 'flipH') setFlipH(value as boolean);
    else if (key === 'flipV') setFlipV(value as boolean);
    else if (key === 'cropAspect') setCropAspect(value as string);
    else if (key === 'grayscale') setGrayscale(value as boolean);
    else if (key === 'cropLeftPct') setCropLeftPct(value as number);
    else if (key === 'cropTopPct') setCropTopPct(value as number);
    else if (key === 'cropWidthPct') setCropWidthPct(value as number);
    else if (key === 'cropHeightPct') setCropHeightPct(value as number);
    else if (key === 'cropApplied') setCropApplied(value as boolean);

    setFileSettingsList((prev) => {
      const copy = prev.map(item => ({ ...item }));
      const isCropSetting = ['cropLeftPct','cropTopPct','cropWidthPct','cropHeightPct','cropApplied'].includes(key as string);
      if (sameForAll && !isCropSetting) return copy.map(item => ({ ...item, [key]: value }));
      if (activeIndex !== null && copy[activeIndex]) copy[activeIndex] = { ...copy[activeIndex], [key]: value };
      return copy;
    });
  };

  const toggleSameForAll = (checked: boolean) => {
    setSameForAll(checked);
    if (checked && activeIndex !== null) {
      const active = fileSettingsList[activeIndex];
      if (active) setFileSettingsList(prev => prev.map(item => ({
        ...active,
        cropLeftPct: item.cropLeftPct,
        cropTopPct: item.cropTopPct,
        cropWidthPct: item.cropWidthPct,
        cropHeightPct: item.cropHeightPct,
        cropApplied: item.cropApplied
      })));
    }
  };

  const selectActiveFile = (index: number) => {
    setActiveIndex(index);
    const s = fileSettingsList[index];
    if (!s) return;
    setQuality(s.quality); setFormat(s.format); setMaxWidth(s.maxWidth); setMaxHeight(s.maxHeight);
    setCompressMethod(s.compressMethod); setTargetSize(s.targetSize); setTargetUnit(s.targetUnit);
    setAspectRatioLocked(s.aspectRatioLocked); setOrigWidth(s.origWidth); setOrigHeight(s.origHeight);
    setRotation(s.rotation); setFlipH(s.flipH); setFlipV(s.flipV); setCropAspect(s.cropAspect);
    setGrayscale(s.grayscale);
    setCropLeftPct(s.cropLeftPct ?? 0); setCropTopPct(s.cropTopPct ?? 0);
    setCropWidthPct(s.cropWidthPct ?? 100); setCropHeightPct(s.cropHeightPct ?? 100);
    setCropApplied(s.cropApplied ?? false);
  };

  const handleWidthChange = (val: string) => {
    updateSetting('maxWidth', val);
    const s = activeIndex !== null ? fileSettingsList[activeIndex] : null;
    const ow = s?.origWidth ?? origWidth; const oh = s?.origHeight ?? origHeight;
    const locked = s?.aspectRatioLocked ?? aspectRatioLocked;
    if (locked && ow && oh && val) {
      const w = parseInt(val, 10);
      if (!isNaN(w)) updateSetting('maxHeight', Math.round((w * oh) / ow).toString());
    }
  };

  const handleHeightChange = (val: string) => {
    updateSetting('maxHeight', val);
    const s = activeIndex !== null ? fileSettingsList[activeIndex] : null;
    const ow = s?.origWidth ?? origWidth; const oh = s?.origHeight ?? origHeight;
    const locked = s?.aspectRatioLocked ?? aspectRatioLocked;
    if (locked && ow && oh && val) {
      const h = parseInt(val, 10);
      if (!isNaN(h)) updateSetting('maxWidth', Math.round((h * ow) / oh).toString());
    }
  };

  const getFormatLabel = (v: string) => {
    if (v === 'preserve') return 'Original';
    if (v === 'image/webp') return 'WebP';
    if (v === 'image/jpeg') return 'JPEG';
    if (v === 'image/jpg') return 'JPG';
    if (v === 'image/png') return 'PNG';
    if (v === 'image/gif') return 'GIF';
    return v;
  };

  const handleFilesSelected = async (selectedFiles: File[]) => {
    setResults([]);
    const uniqueFiles = appendUniqueFiles(files, selectedFiles).slice(files.length);
    if (uniqueFiles.length === 0) return;
    const newSettings: FileSettings[] = [];
    for (const file of uniqueFiles) {
      let ow = 0, oh = 0;
      try { const img = await loadImage(file); ow = img.naturalWidth; oh = img.naturalHeight; } catch {}
      newSettings.push({
        quality, format, maxWidth: ow ? ow.toString() : maxWidth,
        maxHeight: oh ? oh.toString() : maxHeight, compressMethod, targetSize, targetUnit,
        aspectRatioLocked, origWidth: ow, origHeight: oh, rotation, flipH, flipV, cropAspect: 'full',
        grayscale, cropLeftPct, cropTopPct, cropWidthPct, cropHeightPct, cropApplied: false
      });
    }
    setFiles(prev => [...prev, ...uniqueFiles]);
    setFileSettingsList(prev => [...prev, ...newSettings]);
    if (activeIndex === null && uniqueFiles.length > 0) {
      setActiveIndex(0);
      const f = newSettings[0];
      setQuality(f.quality); setFormat(f.format); setMaxWidth(f.maxWidth); setMaxHeight(f.maxHeight);
      setCompressMethod(f.compressMethod); setTargetSize(f.targetSize); setTargetUnit(f.targetUnit);
      setOrigWidth(f.origWidth); setOrigHeight(f.origHeight);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setFileSettingsList(prev => prev.filter((_, i) => i !== index));
    if (activeIndex === index) setActiveIndex(null);
    else if (activeIndex !== null && activeIndex > index) setActiveIndex(activeIndex - 1);
  };

  const clearQueue = () => { setFiles([]); setFileSettingsList([]); setActiveIndex(null); setResults([]); setFailedFileIndexes([]); setSelectedForCompare(null); };

  const startBatchCompression = async (retryIndexes?: number[]) => {
    if (files.length === 0) return;
    const indexes = retryIndexes ?? files.map((_, index) => index);
    setProcessing(true);
    if (!retryIndexes) setResults([]);
    setSelectedForCompare(null);
    cancellationRef.current = false;
    const processedResults: ImageProcessResult[] = [];
    const failedIndexes: number[] = [];
    
    for (let position = 0; position < indexes.length; position++) {
      if (cancellationRef.current) break;
      const i = indexes[position];
      setCurrentFileIndex(i); setProgress(0);
      const file = files[i];
      const s = fileSettingsList[i] || { 
        quality, format, maxWidth, maxHeight, compressMethod, targetSize, targetUnit, 
        aspectRatioLocked, origWidth, origHeight, rotation, flipH, flipV, cropAspect, 
        grayscale, cropLeftPct, cropTopPct, cropWidthPct, cropHeightPct, cropApplied: false
      };
      
      try {
        // Streaming check: yield execution so UI doesn't lock up
        await new Promise(resolve => setTimeout(resolve, 60));
        if (cancellationRef.current) break;

        const parsedFormat = s.format === 'preserve' ? file.type : s.format;
        const sizeVal = parseFloat(s.targetSize);
        const targetSizeKB = s.targetUnit === 'MB' ? sizeVal * 1024 : sizeVal;
        
        // Pass crop coordinates only if cropApplied is active
        const result = await processImage(file, {
          quality: s.quality / 100, format: parsedFormat,
          maxWidth: s.maxWidth ? parseInt(s.maxWidth, 10) : undefined,
          maxHeight: s.maxHeight ? parseInt(s.maxHeight, 10) : undefined,
          targetSizeKB: s.compressMethod === 'target' ? targetSizeKB : undefined,
          rotation: s.rotation, flipH: s.flipH, flipV: s.flipV,
          cropAspect: s.cropApplied ? s.cropAspect : undefined,
          grayscale: s.grayscale,
          cropLeftPct: s.cropApplied ? s.cropLeftPct : undefined,
          cropTopPct: s.cropApplied ? s.cropTopPct : undefined,
          cropWidthPct: s.cropApplied ? s.cropWidthPct : undefined,
          cropHeightPct: s.cropApplied ? s.cropHeightPct : undefined,
        });
        processedResults.push(result); onUploadSuccess();
        setProgress(((position + 1) / indexes.length) * 100);
      } catch (err) {
        failedIndexes.push(i);
        console.error(`Failed: ${file.name}`, err);
      }
    }
    
    setResults(prev => retryIndexes ? [...prev, ...processedResults] : processedResults);
    setFailedFileIndexes(failedIndexes);
    setProcessing(false);
  };

  const getSavings = (orig: number, opt: number) => { const d = orig - opt; return d <= 0 ? 0 : Math.round((d / orig) * 100); };
  const totalSavings = () => { const o = results.reduce((a,r) => a + r.originalSize, 0); const n = results.reduce((a,r) => a + r.newSize, 0); return getSavings(o, n); };
  const sizeSummary = getSizeSummary(results);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && files.length > 0 && !processing) {
        event.preventDefault();
        startBatchCompression();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && results.length > 0) {
        event.preventDefault();
        downloadAll(results);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  });

  // ── Active image info ──────────────────────────────────────────────────────
  const activeFile = activeIndex !== null ? files[activeIndex] : null;
  const activeSettings = activeIndex !== null ? fileSettingsList[activeIndex] : null;

  // Preview CSS filter (live preview for filters tab)
  const previewFilter = [
    grayscale ? 'grayscale(100%)' : '',
    rotation !== 0 ? '' : '',
  ].filter(Boolean).join(' ');

  const previewTransform = [
    rotation !== 0 ? `rotate(${rotation}deg)` : '',
    flipH ? 'scaleX(-1)' : '',
    flipV ? 'scaleY(-1)' : '',
  ].filter(Boolean).join(' ');

  // ── Settings content renderer ─────────────────────────────────────────────
  const renderSettings = () => (
    <div className="space-y-5">
      {activeTab === 'compress' && (
        <div className="space-y-4">
          <CompressionPresetSelector value={compressionPreset} onChange={applyCompressionPreset} />
          <label className="compression-privacy-toggle">
            <span>
              <span className="block text-xs font-bold text-zinc-200">Remove private metadata</span>
              <span className="block text-[10px] text-zinc-500 mt-0.5">Recommended. Canvas export removes EXIF and location data.</span>
            </span>
            <input type="checkbox" checked={removeMetadata} onChange={event => setRemoveMetadata(event.target.checked)} className="w-4 h-4 accent-white" />
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
                  <span>{cropAspect === 'none' ? 'Custom (Free)' : cropAspect === '1:1' ? 'Square (1:1)' : cropAspect}</span>
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
                className="h-9 w-9 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-400 shrink-0"
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
                className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold h-9 rounded-lg text-sm transition-all"
              >
                Revert
              </button>
            ) : (
              <button 
                onClick={applyImmediateCrop}
                className="flex-1 bg-zinc-50 hover:bg-zinc-200 text-zinc-950 font-bold h-9 rounded-lg text-sm transition-all"
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
            className="w-full bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800 text-zinc-200 font-bold h-9 rounded-lg text-[10px] uppercase tracking-wide transition-all"
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
              <SelectItem value="image/gif">GIF</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {activeTab === 'filter' && (
        <div className="space-y-4">
          <label className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-zinc-900 hover:border-zinc-800 cursor-pointer transition-colors">
            <span className="text-sm text-zinc-300">Grayscale</span>
            <input type="checkbox" checked={grayscale} onChange={e => updateSetting('grayscale', e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-zinc-100 cursor-pointer" />
          </label>
        </div>
      )}
    </div>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="tool-layout">
      <ToolHeader 
        title="Image Optimizer" 
        description="Compress, convert, resize, crop, and edit images right in your browser." 
        icon={ImageIcon} 
        onGoHome={() => {
          if (files.length > 0 || results.length > 0 || processing) {
            clearQueue();
          } else {
            onGoHome();
          }
        }} 
      />

      {files.length === 0 && !processing && results.length === 0 && (
        <div className="max-w-2xl mx-auto py-10">
          <FileUploader
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple={true}
            label="Upload images to process"
            subLabel="Drag & drop JPEG, PNG, WebP, or GIF files (Up to 10GB)"
            onFilesSelected={handleFilesSelected}
            maxSizeMB={10240}
          />
        </div>
      )}

      {(files.length > 0 || processing || results.length > 0) && (
        <div className="image-workbench">

          {/* ═══ LEFT SIDEBAR ═══════════════════════════════════════════════════ */}
          <aside className="image-workbench__sidebar">
            
            {/* Sidebar header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-900">
              <button onClick={results.length > 0 ? clearQueue : onGoHome}
                className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded-md hover:bg-zinc-900">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-zinc-200">Image Queue ({files.length})</span>
            </div>

            {files.length > 0 && !processing && results.length === 0 && (
              <>
                {/* Editing scope */}
                <div className="px-4 py-2.5 border-b border-zinc-900 flex items-center justify-between gap-2">
                  <p className="text-xs text-zinc-500 truncate flex-1 min-w-0">
                    {sameForAll ? 'All images' : (activeFile?.name ?? 'Select image')}
                  </p>
                  <label className="flex items-center gap-1.5 text-[11px] text-zinc-500 cursor-pointer shrink-0">
                    <input type="checkbox" checked={sameForAll} onChange={e => toggleSameForAll(e.target.checked)}
                      className="w-3 h-3 rounded border-zinc-700 bg-zinc-900 text-zinc-100" />
                    Copy settings to all
                  </label>
                </div>

                {/* Tool tabs */}
                <nav className="py-1 border-b border-zinc-900">
                  {TABS.map(({ id, label, Icon }) => (
                    <button key={id} onClick={() => setActiveTab(id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all ${
                        activeTab === id
                          ? 'text-zinc-50 bg-zinc-900/60 border-l-2 border-zinc-200 font-semibold'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/3 border-l-2 border-transparent font-medium'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {label}
                    </button>
                  ))}
                </nav>

                {/* Settings content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {renderSettings()}
                </div>

                {/* Optimize CTA */}
                <div className="p-3 border-t border-zinc-900">
                  <button onClick={() => startBatchCompression()} disabled={files.length === 0}
                    className="w-full bg-zinc-50 hover:bg-zinc-200 disabled:opacity-50 text-zinc-950 font-black py-3 rounded-xl text-sm transition-colors shadow-sm cursor-pointer">
                    Optimize {files.length} {files.length === 1 ? 'Image' : 'Images'} →
                  </button>
                </div>
              </>
            )}

            {/* Results sidebar info */}
            {results.length > 0 && !processing && (
              <div className="flex-1 p-4 space-y-4">
                <div className="text-center space-y-1">
                  <div className="w-10 h-10 bg-zinc-900/40 border border-zinc-800 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-5 h-5 text-zinc-200" />
                  </div>
                  <p className="text-sm font-bold text-white mt-2">Done!</p>
                  <p className="text-xs text-zinc-500">{results.length} images · saved {totalSavings()}%</p>
                </div>
                <button onClick={clearQueue}
                  className="w-full bg-zinc-50 hover:bg-zinc-200 text-zinc-950 font-bold py-2.5 rounded-lg text-sm transition-colors cursor-pointer">
                  Process More
                </button>
              </div>
            )}
          </aside>

          {/* ═══ MAIN AREA ══════════════════════════════════════════════════════ */}
          <div className="image-workbench__main">

            {/* ── Editing state ── */}
            {files.length > 0 && !processing && results.length === 0 && (
          <>
            {/* File info bar */}
            {activeFile && (
              <div className="h-10 border-b border-[var(--border-color)] bg-[var(--surface-color)] flex items-center px-5 gap-4 text-xs text-[var(--text-secondary)] shrink-0">
                <span className="font-medium text-[var(--text-primary)] truncate max-w-[260px]">{activeFile.name}</span>
                <span>{formatBytes(activeFile.size)}</span>
                {activeSettings && activeSettings.origWidth > 0 && (
                  <span>{activeSettings.origWidth} × {activeSettings.origHeight}px</span>
                )}
                <span className="ml-auto text-[var(--text-tertiary)]">{files.length} in queue</span>
              </div>
            )}

            {/* Image preview */}
            <div className="flex-1 flex items-center justify-center bg-[var(--bg-color)] relative overflow-hidden">
              {/* Subtle checker background */}
              <div className="absolute inset-0 opacity-[0.03]"
                style={{ backgroundImage: 'repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%)', backgroundSize: '20px 20px' }} />
              
               {activeIndex !== null && previewUrls[activeIndex] ? (
                <div className="relative max-w-full max-h-full p-6 flex items-center justify-center">
                  {selectedForCompare ? (
                    <div 
                      ref={splitContainerRef}
                      className="relative select-none overflow-hidden max-w-full rounded-lg shadow-2xl border border-zinc-800 bg-zinc-950 flex items-center justify-center"
                      style={{
                        width: imageRect ? `${imageRect.width}px` : '100%',
                        height: imageRect ? `${imageRect.height}px` : '400px',
                      }}
                    >
                      {/* Left Image: Original */}
                      <img 
                        src={previewUrls[activeIndex]}
                        alt="Original"
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none rounded-lg"
                        style={{
                          clipPath: `inset(0 ${100 - compareSplitPct}% 0 0)`
                        }}
                        draggable={false}
                      />

                      {/* Right Image: Optimized */}
                      <img 
                        src={selectedForCompare.url}
                        alt="Optimized"
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none rounded-lg"
                        style={{
                          clipPath: `inset(0 0 0 ${compareSplitPct}%)`
                        }}
                        draggable={false}
                      />

                      {/* Floating Labels */}
                      <div className="absolute top-4 left-4 bg-zinc-950/80 text-zinc-300 border border-zinc-800 px-3 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase backdrop-blur-sm z-10 select-none pointer-events-none">
                        Original
                      </div>
                      <div className="absolute top-4 right-4 bg-zinc-950/80 text-zinc-300 border border-zinc-800 px-3 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase backdrop-blur-sm z-10 select-none pointer-events-none">
                        Optimized ({formatBytes(selectedForCompare.newSize)})
                      </div>

                      {/* Split Control vertical divider */}
                      <div 
                        className="absolute top-0 bottom-0 w-1 bg-white cursor-col-resize z-20"
                        style={{ left: `${compareSplitPct}%` }}
                        onMouseDown={startSplitDrag}
                      >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-zinc-950 border border-zinc-500 flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
                            <path d="M8 5l-7 7 7 7M16 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>

                      {/* Close Compare Overlay button */}
                      <button 
                        onClick={() => setSelectedForCompare(null)}
                        className="absolute bottom-4 right-4 bg-zinc-950/90 text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all z-10 shadow-lg"
                      >
                        Exit Comparison
                      </button>
                    </div>
                  ) : (
                    <img
                      key={activeIndex}
                      ref={imageRef}
                      src={previewUrls[activeIndex]}
                      alt={activeFile?.name ?? 'Preview'}
                      className="max-w-full max-h-[calc(100vh-14rem)] object-contain rounded-lg shadow-2xl select-none transition-all duration-300"
                      style={{
                        filter: previewFilter || undefined,
                        transform: previewTransform || undefined,
                        clipPath: cropApplied ? `inset(${cropTopPct}% ${100 - cropLeftPct - cropWidthPct}% ${100 - cropTopPct - cropHeightPct}% ${cropLeftPct}%)` : undefined,
                      }}
                      draggable={false}
                      onLoad={measureImage}
                    />
                  )}

                  {/* Manual visual crop bounding box overlay */}
                  {imageRect && !cropApplied && (
                    <div 
                      ref={cropOverlayRef}
                      className={`absolute ${activeTab === 'crop' ? 'border-2 border-white opacity-100 pointer-events-auto' : 'border border-dashed border-zinc-500/30 opacity-40 pointer-events-none'}`}
                      style={{
                        left: `${imageRect.left + (cropLeftPct / 100) * imageRect.width}px`,
                        top: `${imageRect.top + (cropTopPct / 100) * imageRect.height}px`,
                        width: `${(cropWidthPct / 100) * imageRect.width}px`,
                        height: `${(cropHeightPct / 100) * imageRect.height}px`,
                        boxShadow: activeTab === 'crop' ? '0 0 0 9999px rgba(4,6,8,0.75)' : 'none',
                        zIndex: 20
                      }}
                      onMouseDown={activeTab === 'crop' ? (e) => startDrag(e, 'move') : undefined}
                    >
                      {/* Rule of Thirds Grid Overlay */}
                      {displayGrid && (
                        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                          {/* Vertical Third Lines */}
                          <div className="absolute top-0 bottom-0 left-1/3 w-[1px] bg-white/85 shadow-[0_0_4px_rgba(0,0,0,0.9)]" />
                          <div className="absolute top-0 bottom-0 left-2/3 w-[1px] bg-white/85 shadow-[0_0_4px_rgba(0,0,0,0.9)]" />
                          {/* Horizontal Third Lines */}
                          <div className="absolute left-0 right-0 top-1/3 h-[1px] bg-white/85 shadow-[0_0_4px_rgba(0,0,0,0.9)]" />
                          <div className="absolute left-0 right-0 top-2/3 h-[1px] bg-white/85 shadow-[0_0_4px_rgba(0,0,0,0.9)]" />
                        </div>
                      )}

                      {/* Manual Drag Handles */}
                      {activeTab === 'crop' && (
                        <>
                          {/* Corner NW */}
                          <div className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-zinc-950 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.8)] cursor-nwse-resize hover:scale-125 transition-transform z-30" onMouseDown={(e) => { e.stopPropagation(); startDrag(e, 'nw'); }} />
                          {/* Corner NE */}
                          <div className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-zinc-950 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.8)] cursor-nesw-resize hover:scale-125 transition-transform z-30" onMouseDown={(e) => { e.stopPropagation(); startDrag(e, 'ne'); }} />
                          {/* Corner SW */}
                          <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-zinc-950 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.8)] cursor-nesw-resize hover:scale-125 transition-transform z-30" onMouseDown={(e) => { e.stopPropagation(); startDrag(e, 'sw'); }} />
                          {/* Corner SE */}
                          <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-zinc-950 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.8)] cursor-nwse-resize hover:scale-125 transition-transform z-30" onMouseDown={(e) => { e.stopPropagation(); startDrag(e, 'se'); }} />
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center space-y-3 text-zinc-700">
                  <ImageIcon className="w-16 h-16 mx-auto opacity-30" />
                  <p className="text-sm">Select an image from the queue</p>
                </div>
              )}
            </div>

            {/* Queue strip */}
            <div className="h-[88px] border-t border-[var(--border-color)] bg-[var(--surface-color)] flex items-center gap-2 px-4 overflow-x-auto shrink-0"
              style={{ scrollbarWidth: 'none' }}>
              {files.map((file, idx) => (
                <div
                  key={`${file.name}:${file.size}:${file.lastModified}`}
                  draggable
                  onDragStart={() => setDraggedFileIndex(idx)}
                  onDragOver={event => event.preventDefault()}
                  onDrop={() => {
                    if (draggedFileIndex === null || draggedFileIndex === idx) return;
                    setFiles(prev => {
                      const copy = [...prev];
                      const [moved] = copy.splice(draggedFileIndex, 1);
                      copy.splice(idx, 0, moved);
                      return copy;
                    });
                    setFileSettingsList(prev => {
                      const copy = [...prev];
                      const [moved] = copy.splice(draggedFileIndex, 1);
                      copy.splice(idx, 0, moved);
                      return copy;
                    });
                    setActiveIndex(idx);
                    setDraggedFileIndex(null);
                  }}
                  onDragEnd={() => setDraggedFileIndex(null)}
                  className="relative flex-shrink-0 group cursor-grab"
                >
                  <button onClick={() => selectActiveFile(idx)}
                    className={`h-[60px] w-[60px] rounded-lg overflow-hidden border-2 transition-all block ${
                      activeIndex === idx
                        ? 'border-[var(--text-primary)] shadow-sm'
                        : 'border-[var(--border-color)] hover:border-zinc-500'
                    }`}>
                    {previewUrls[idx] && (
                      <img src={previewUrls[idx]} alt={file.name}
                        className="w-full h-full object-cover" draggable={false} />
                    )}
                  </button>
                  <button onClick={() => removeFile(idx)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                    <span className="text-[9px] text-white font-bold leading-none">✕</span>
                  </button>
                </div>
              ))}

              {/* Add more */}
              <button onClick={() => addMoreRef.current?.click()}
                className="flex-shrink-0 h-[60px] w-[60px] rounded-lg border-2 border-dashed border-[var(--border-color)] hover:border-zinc-500 hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">
                <PlusIcon className="w-5 h-5" />
              </button>
              <input ref={addMoreRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(e) => { handleFilesSelected(Array.from(e.target.files || [])); e.target.value = ''; }} />
            </div>
          </>
        )}

        {/* ── Processing state with cancellation ── */}
        {processing && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 bg-zinc-950/40">
            <div className="max-w-md w-full space-y-6 flex flex-col items-center">
              <ProgressBar
                progress={progress}
                statusText={`Processing ${currentFileIndex + 1} of ${files.length}…`}
                subText={`Web Worker streaming buffer: ${files[currentFileIndex]?.name}`}
              />
              <button
                onClick={() => { cancellationRef.current = true; }}
                className="px-5 py-2 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs font-semibold tracking-wide uppercase transition-all"
              >
                Cancel Process
              </button>
            </div>
          </div>
        )}

        {/* ── Results state ── */}
        {results.length > 0 && !processing && (
          <div className="flex-1 overflow-y-auto p-6">
            {/* Results table */}
            <div className="border border-zinc-900 rounded-xl overflow-hidden bg-[#06080d] text-left mb-6">
              <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-zinc-950/60 border-b border-zinc-900 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                <div className="col-span-5">File</div>
                <div className="col-span-2 text-right">Original</div>
                <div className="col-span-2 text-right">Result</div>
                <div className="col-span-1 text-right">Saved</div>
                <div className="col-span-2 text-center">Download</div>
              </div>
              <div className="divide-y divide-zinc-900">
                {results.map((res, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 px-5 py-3.5 items-center hover:bg-zinc-950/20 transition-colors">
                    <div className="col-span-5 truncate text-sm font-medium text-zinc-200" title={res.name}>{res.name}</div>
                    <div className="col-span-2 text-right text-xs text-zinc-500">{formatBytes(res.originalSize)}</div>
                    <div className="col-span-2 text-right text-sm font-bold text-zinc-100">{formatBytes(res.newSize)}</div>
                    <div className="col-span-1 text-right text-sm font-bold text-white">-{getSavings(res.originalSize, res.newSize)}%</div>
                    <div className="col-span-2 flex items-center justify-center gap-2">
                      <button onClick={() => setSelectedForCompare(res)}
                        className="w-8 h-8 rounded-lg border border-zinc-800 text-zinc-300 hover:bg-zinc-900 flex items-center justify-center transition-colors" title="Compare">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <a href={res.url} download={res.name}
                        className="w-8 h-8 rounded-lg border border-zinc-800 text-zinc-300 hover:bg-zinc-900 flex items-center justify-center transition-colors" title="Download">
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Download all */}
            <div className="flex flex-col items-center justify-center gap-3">
              <p className="text-xs text-zinc-400">
                {formatBytes(sizeSummary.originalSize)} → {formatBytes(sizeSummary.newSize)} · saved {formatBytes(sizeSummary.savedSize)} ({sizeSummary.savedPercent}%)
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => downloadAll(results)}
                  className="inline-flex items-center gap-2 bg-zinc-50 hover:bg-zinc-200 text-zinc-950 font-bold px-6 py-2.5 rounded-lg text-sm transition-colors"
                >
                  <Download className="w-4 h-4" /> Download All
                </button>
                {results.length === 1 && (
                  <button
                    type="button"
                    onClick={() => shareResult(results[0]).catch(console.error)}
                    className="batch-action batch-action--secondary"
                  >
                    Share
                  </button>
                )}
                {failedFileIndexes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => startBatchCompression(failedFileIndexes)}
                    className="inline-flex items-center gap-2 border border-rose-800 text-rose-300 font-bold px-6 py-2.5 rounded-lg text-sm"
                  >
                    Retry {failedFileIndexes.length} failed
                  </button>
                )}
              </div>
            </div>

            {/* Side-by-side compare */}
            {selectedForCompare && (
              <div className="mt-6 border border-zinc-900 rounded-xl overflow-hidden bg-[#06080d] p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-zinc-200">Comparing: {selectedForCompare.name}</h3>
                  <button onClick={() => setSelectedForCompare(null)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Close</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[  
                    { label: `Original · ${formatBytes(selectedForCompare.originalSize)}`, src: (() => { const f = files.find(f => selectedForCompare.name.includes(f.name.substring(0, f.name.lastIndexOf('.')))); return f ? URL.createObjectURL(f) : ''; })() },
                    { label: `Optimized · ${formatBytes(selectedForCompare.newSize)} · -${getSavings(selectedForCompare.originalSize, selectedForCompare.newSize)}%`, src: selectedForCompare.url }
                  ].map(({ label, src }) => (
                    <div key={label} className="space-y-2">
                      <p className="text-xs font-semibold text-zinc-500">{label}</p>
                      {src && <img src={src} alt={label} className="w-full max-h-[240px] object-contain rounded-lg bg-zinc-950 border border-zinc-900" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )}
</div>
  );
};
