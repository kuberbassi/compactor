import { useState, useEffect, useRef } from 'react';
import { FileUploader } from '../../components/Common/FileUploader';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { ToolHeader } from '../../components/Common/ToolHeader';
import { ToolModeSwitcher } from '../../components/Common/ToolModeSwitcher';
import { WorkspaceShell } from '../../components/Workspace/WorkspaceShell';
import { WorkspaceToolNav, WorkspaceZoomControls } from '../../components/Workspace/WorkspaceControls';
import { processImage, formatBytes, loadImage, watermarkImage } from '../../utils/image';
import type { ImageProcessResult } from '../../utils/image';
import { appendUniqueFiles, downloadAll, isEditableShortcutTarget, loadSetting, saveSetting } from '../../utils/batch';
import type { CompressionPreset } from '../../utils/batch';
import { 
  Image as ImageIcon,
  CheckCircle,
  PanelLeftClose,
  PanelLeft,
  Plus,
  X,
  Download,
  FileCheck2,
} from 'lucide-react';

import { renderClassicHalftone } from '../../utils/posterEngine';
import { ImageSidebarControls } from './components/ImageSidebarControls';
import { ImageBatchResults } from './components/ImageBatchResults';
import { createObjectUrlOwner } from '../../utils/objectUrl';
import { IMAGE_TABS as TABS } from './imageToolsConfig';
import type { FileSettings, ImageTabId as TabId } from './imageToolsConfig';
import { moveQueueItem, remapActiveQueueIndex } from './imagePdfQueue';

const HalftoneImagePreview: React.FC<{
  src: string;
  dotSize: number;
  invert: boolean;
  transform?: string;
  clipPath?: string;
  onLoad?: () => void;
}> = ({ src, dotSize, invert, transform, clipPath, onLoad }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const render = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      const targetW = Math.min(1200, Math.max(600, img.naturalWidth || img.width));
      const targetH = Math.max(1, Math.round((targetW * (img.naturalHeight || img.height)) / (img.naturalWidth || img.width)));

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, targetW, targetH);
      const mappedDotSize = Math.max(4, Math.round((dotSize / 14) * (targetW / 80)));
      renderClassicHalftone(ctx, targetW, targetH, mappedDotSize, 0, 0, invert);
    });
  };

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      onLoad?.();
      render();
    };
    img.src = src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    render();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dotSize, invert]);

  return (
    <canvas
      ref={canvasRef}
      className="max-w-full max-h-[calc(100vh-14rem)] object-contain rounded-lg shadow-2xl select-none transition-all duration-300"
      style={{
        transform: transform || undefined,
        clipPath: clipPath || undefined,
      }}
      aria-label="Halftone preview"
    />
  );
};

type PdfImageFilter = 'original' | 'smart-scan' | 'whiteboard' | 'bw' | 'vibrant';

const DocumentFilterPreview: React.FC<{
  src: string;
  filter: PdfImageFilter;
  transform?: string;
}> = ({ src, filter, transform }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = async () => {
      if (cancelled || !canvasRef.current) return;
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = canvasRef.current;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0, width, height);
      const { applyDocumentScanFilter } = await import('../../utils/pdf');
      if (cancelled) return;
      applyDocumentScanFilter(context, width, height, filter);
    };
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, filter]);

  return (
    <canvas
      ref={canvasRef}
      className="max-w-full max-h-[calc(100vh-14rem)] object-contain rounded-lg shadow-2xl select-none transition-transform duration-300"
      style={{ transform: transform || undefined }}
      aria-label={`${filter} document filter preview`}
    />
  );
};

interface ImageToolsProps {
  initialTab?: TabId;
  onGoHome: () => void;
  onSelectTool: (toolId: string) => void;
  onUploadSuccess: () => void;
}

export const ImageTools: React.FC<ImageToolsProps> = ({ initialTab = 'compress', onGoHome, onSelectTool, onUploadSuccess }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [fileSettingsList, setFileSettingsList] = useState<FileSettings[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [sameForAll, setSameForAll] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [compressionPreset, setCompressionPreset] = useState<CompressionPreset>(() =>
    loadSetting('compactor_image_compression_preset', 'balanced')
  );
  const [removeMetadata, setRemoveMetadata] = useState(() =>
    loadSetting('compactor_image_remove_metadata', true)
  );
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [pdfFilter, setPdfFilter] = useState<PdfImageFilter>('smart-scan');
  const [pdfOrientation, setPdfOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [pdfPageSize, setPdfPageSize] = useState<'fit' | 'a4' | 'letter'>('fit');
  const [pdfMargin, setPdfMargin] = useState<'none' | 'small' | 'big'>('none');
  const [processing, setProcessing] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [results, setResultsState] = useState<ImageProcessResult[]>([]);
  const resultsOwnerRef = useRef(createObjectUrlOwner<ImageProcessResult[]>([], currentResults =>
    currentResults.map(result => result.url)
  ));
  const [failedFileIndexes, setFailedFileIndexes] = useState<number[]>([]);
  const [imageZoom, setImageZoom] = useState(80);
  const [draggedQueueIndex, setDraggedQueueIndex] = useState<number | null>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const cancellationRef = useRef<boolean>(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Canvas encoding does not expose granular progress for one image. Keep the
  // user-facing percentage tied to completed work so both processing surfaces
  // report the same, honest batch progress.
  const batchProgress = files.length > 0
    ? Math.min(100, Math.max(0, ((currentFileIndex + progress / 100) / files.length) * 100))
    : 0;

  useEffect(() => {
    saveSetting('compactor_image_compression_preset', compressionPreset);
    saveSetting('compactor_image_remove_metadata', removeMetadata);
  }, [compressionPreset, removeMetadata]);

  useEffect(() => {
    const viewport = previewViewportRef.current;
    if (!viewport) return;
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const cursorX = event.clientX - rect.left + viewport.scrollLeft;
      const cursorY = event.clientY - rect.top + viewport.scrollTop;
      const direction = event.deltaY < 0 ? 1 : -1;
      setImageZoom(current => {
        const next = Math.max(25, Math.min(300, current + direction * 10));
        if (next === current) return current;
        const ratio = next / current;
        requestAnimationFrame(() => {
          viewport.scrollLeft = cursorX * ratio - (event.clientX - rect.left);
          viewport.scrollTop = cursorY * ratio - (event.clientY - rect.top);
        });
        return next;
      });
    };
    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [files.length]);

  useEffect(() => setImageZoom(80), [activeIndex]);

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
  // Keep an unbounded display angle so quarter-turn animations always travel
  // in the direction the user clicked (for example, 0 -> -90 instead of 270).
  const [previewRotation, setPreviewRotation] = useState<number>(0);
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

  const applyCompressionPreset = (preset: CompressionPreset) => {
    setCompressionPreset(preset);
    const presetQuality = preset === 'light' ? 90 : preset === 'balanced' ? 80 : 55;
    updateSetting('quality', presetQuality);
    updateSetting('compressMethod', 'auto');
  };

  // Preview URLs managed with ref and explicit cleanup on file removal
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const previewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    previewUrlsRef.current = previewUrls;
  }, [previewUrls]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
    };
  }, []);

  const replaceResults = (
    nextOrUpdater: ImageProcessResult[] | ((previous: ImageProcessResult[]) => ImageProcessResult[]),
  ) => {
    const previous = resultsOwnerRef.current.current();
    const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(previous) : nextOrUpdater;
    resultsOwnerRef.current.replace(next);
    setResultsState(next);
  };

  useEffect(() => {
    const resultsOwner = resultsOwnerRef.current;
    return () => {
      resultsOwner.cleanup();
    };
  }, []);

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

      // Read the rendered bounds while dragging. The preview can be zoomed, so
      // the stored unscaled dimensions are not the cursor's coordinate space.
      const renderedImageRect = imageRef.current?.getBoundingClientRect();
      const interactionWidth = renderedImageRect?.width || imageRect.width;
      const interactionHeight = renderedImageRect?.height || imageRect.height;

      const dxPct = (dx / interactionWidth) * 100;
      const dyPct = (dy / interactionHeight) * 100;

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
        cropOverlayRef.current.style.left = `${finalLeft}%`;
        cropOverlayRef.current.style.top = `${finalTop}%`;
        cropOverlayRef.current.style.width = `${finalWidth}%`;
        cropOverlayRef.current.style.height = `${finalHeight}%`;
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
    else if (key === 'rotation') {
      const nextRotation = value as number;
      setRotation(nextRotation);
      setPreviewRotation((current) => {
        const normalizedCurrent = ((current % 360) + 360) % 360;
        let delta = nextRotation - normalizedCurrent;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        return current + delta;
      });
    }
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
    setRotation(s.rotation); setPreviewRotation(s.rotation); setFlipH(s.flipH); setFlipV(s.flipV); setCropAspect(s.cropAspect);
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

  const handleFilesSelected = async (selectedFiles: File[]) => {
    replaceResults([]);
    const uniqueFiles = appendUniqueFiles(files, selectedFiles).slice(files.length);
    if (uniqueFiles.length === 0) return;
    const newUrls = uniqueFiles.map(f => URL.createObjectURL(f));
    const newSettings: FileSettings[] = [];
    for (const file of uniqueFiles) {
      let ow = 0, oh = 0;
      try { const img = await loadImage(file); ow = img.naturalWidth; oh = img.naturalHeight; } catch {}
      newSettings.push({
        quality, format, maxWidth: ow ? ow.toString() : maxWidth,
        maxHeight: oh ? oh.toString() : maxHeight, compressMethod, targetSize, targetUnit,
        aspectRatioLocked, origWidth: ow, origHeight: oh, rotation, flipH, flipV, cropAspect: 'full',
        grayscale, cropLeftPct, cropTopPct, cropWidthPct, cropHeightPct, cropApplied: false,
        watermarkText: '', watermarkPosition: 'center', watermarkOpacity: 0.4,
        watermarkFontSize: 48, watermarkColor: '#ffffff',
        scanEnhanceMode: 'none',
        halftoneDotSize: 10,
        halftoneInvert: false,
      });
    }
    setFiles(prev => [...prev, ...uniqueFiles]);
    setPreviewUrls(prev => [...prev, ...newUrls]);
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
    const urlToRemove = previewUrls[index];
    if (urlToRemove) URL.revokeObjectURL(urlToRemove);
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    setFiles(prev => prev.filter((_, i) => i !== index));
    setFileSettingsList(prev => prev.filter((_, i) => i !== index));
    if (activeIndex === index) setActiveIndex(files.length > 1 ? Math.min(index, files.length - 2) : null);
    else if (activeIndex !== null && activeIndex > index) setActiveIndex(activeIndex - 1);
  };

  const reorderQueue = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= files.length || to >= files.length) return;
    setFiles(items => moveQueueItem(items, from, to));
    setPreviewUrls(items => moveQueueItem(items, from, to));
    setFileSettingsList(items => moveQueueItem(items, from, to));
    setActiveIndex(current => remapActiveQueueIndex(current, from, to));
  };

  const clearQueue = () => {
    previewUrls.forEach(u => URL.revokeObjectURL(u));
    setPreviewUrls([]);
    setFiles([]); setFileSettingsList([]); setActiveIndex(null); replaceResults([]);
    setFailedFileIndexes([]); setSameForAll(true);
    setCompressionPreset('balanced'); setRemoveMetadata(true); setActiveTab('compress');
    setCompressMethod('auto'); setTargetSize('30'); setTargetUnit('KB');
    setQuality(80); setFormat('preserve'); setMaxWidth(''); setMaxHeight('');
    setAspectRatioLocked(true); setOrigWidth(0); setOrigHeight(0); setRotation(0); setPreviewRotation(0);
    setFlipH(false); setFlipV(false); setCropAspect('none'); setGrayscale(false);
    setCropLeftPct(0); setCropTopPct(0); setCropWidthPct(100); setCropHeightPct(100);
    setCropApplied(false); setImageZoom(80);
  };

  const startBatchCompression = async (retryIndexes?: number[]) => {
    if (files.length === 0) return;
    const indexes = retryIndexes ?? files.map((_, index) => index);
    setProcessing(true);
    if (!retryIndexes) replaceResults([]);
   
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
        grayscale, cropLeftPct, cropTopPct, cropWidthPct, cropHeightPct, cropApplied: false,
        watermarkText: '', watermarkPosition: 'center' as const, watermarkOpacity: 0.4,
        watermarkFontSize: 48, watermarkColor: '#ffffff',
        scanEnhanceMode: 'smart-contrast' as const,
      };
      
      try {
        // Streaming check: yield execution so UI doesn't lock up
        await new Promise(resolve => setTimeout(resolve, 60));
        if (cancellationRef.current) break;

        const parsedFormat = s.format === 'preserve' || s.format === 'original' ? file.type : s.format;
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
    
    replaceResults(prev => retryIndexes ? [...prev, ...processedResults] : processedResults);
    setFailedFileIndexes(failedIndexes);
    setProcessing(false);
  };

  const startBatchWatermark = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    replaceResults([]);
   
    cancellationRef.current = false;
    const processedResults: ImageProcessResult[] = [];
    const failedIndexes: number[] = [];

    for (let i = 0; i < files.length; i++) {
      if (cancellationRef.current) break;
      setCurrentFileIndex(i);
      setProgress(0);
      const file = files[i];
      const s = fileSettingsList[i];
      const wText = s?.watermarkText || 'WATERMARK';
      try {
        await new Promise(resolve => setTimeout(resolve, 40));
        const result = await watermarkImage(file, {
          text: wText,
          position: s?.watermarkPosition ?? 'center',
          opacity: s?.watermarkOpacity ?? 0.4,
          fontSize: s?.watermarkFontSize ?? 48,
          color: s?.watermarkColor ?? '#ffffff',
        });
        processedResults.push(result);
        onUploadSuccess();
        setProgress(((i + 1) / files.length) * 100);
      } catch (err) {
        failedIndexes.push(i);
        console.error(`Watermark failed: ${file.name}`, err);
      }
    }

    replaceResults(processedResults);
    setFailedFileIndexes(failedIndexes);
    setProcessing(false);
  };

  const startBatchImageToPdf = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    replaceResults([]);
   
    cancellationRef.current = false;
    const { imagesToPdf } = await import('../../utils/pdf');
    try {
      setCurrentFileIndex(0);
      setProgress(20);
      const blob = await imagesToPdf(files, {
        pageSize: pdfPageSize,
        orientation: pdfOrientation,
        margin: pdfMargin,
        filter: pdfFilter,
        rotations: fileSettingsList.map(settings => settings.rotation),
      });
      if (cancellationRef.current) return;
      const url = URL.createObjectURL(blob);
      replaceResults([{
        blob,
        url,
        name: files.length === 1 ? `${files[0].name.replace(/\.[^.]+$/, '')}.pdf` : 'images.pdf',
        originalSize: files.reduce((total, file) => total + file.size, 0),
        newSize: blob.size,
        width: 0,
        height: 0,
      }]);
      setFailedFileIndexes([]);
      setProgress(100);
      onUploadSuccess();
    } catch (err) {
      console.error('PDF conversion failed', err);
      setFailedFileIndexes(files.map((_, index) => index));
    } finally {
      setProcessing(false);
    }
  };

  const startBatchScanEnhance = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    replaceResults([]);
   
    cancellationRef.current = false;
    const processedResults: ImageProcessResult[] = [];
    const failedIndexes: number[] = [];

    const { enhanceScanImage } = await import('../../utils/imageCleanup');

    for (let i = 0; i < files.length; i++) {
      if (cancellationRef.current) break;
      setCurrentFileIndex(i);
      setProgress(0);
      const file = files[i];
      const s = fileSettingsList[i];
      try {
        await new Promise(resolve => setTimeout(resolve, 40));
        const result = await enhanceScanImage(file, {
          mode: s?.scanEnhanceMode ?? 'smart-contrast',
          halftoneDotSize: s?.halftoneDotSize ?? 10,
          halftoneInvert: s?.halftoneInvert ?? false,
        });
        processedResults.push(result);
        onUploadSuccess();
        setProgress(((i + 1) / files.length) * 100);
      } catch (err) {
        failedIndexes.push(i);
        console.error(`Scan enhancement failed: ${file.name}`, err);
      }
    }

    replaceResults(processedResults);
    setFailedFileIndexes(failedIndexes);
    setProcessing(false);
  };

  const getActionLabel = () => {
    const count = files.length;
    const countSuffix = count > 1 ? ` (${count})` : '';
    if (activeTab === 'watermark') return `Watermark & Export${countSuffix}`;
    if (activeTab === 'image-to-pdf') return `Convert to PDF${countSuffix}`;
    if (activeTab === 'filter') return `Apply Filters & Export${countSuffix}`;
    if (activeTab === 'compress') return `Compress${countSuffix}`;
    return `Export${countSuffix}`;
  };

  const handlePrimaryAction = () => {
    if (activeTab === 'watermark') startBatchWatermark();
    else if (activeTab === 'image-to-pdf') startBatchImageToPdf();
    else if (activeTab === 'filter' && activeSettings?.scanEnhanceMode && activeSettings.scanEnhanceMode !== 'none') {
      startBatchScanEnhance();
    }
    else startBatchCompression();
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && files.length > 0 && !processing) {
        event.preventDefault();
        handlePrimaryAction();
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

  // Preview CSS filter (live preview for filters and enhance tabs)
  const activeFlipH = activeSettings?.flipH ?? flipH;
  const activeFlipV = activeSettings?.flipV ?? flipV;
  const activeGrayscale = activeSettings?.grayscale ?? grayscale;
  const activeEnhanceMode = activeSettings?.scanEnhanceMode ?? 'none';

  const previewFilter = [
    activeGrayscale ? 'grayscale(100%)' : '',
    activeEnhanceMode === 'smart-contrast'
      ? 'contrast(145%) brightness(104%)'
      : activeEnhanceMode === 'crisp-bw'
      ? 'grayscale(100%) contrast(240%) brightness(98%)'
      : '',
  ].filter(Boolean).join(' ');

  const previewTransform = [
    previewRotation !== 0 ? `rotate(${previewRotation}deg)` : '',
    activeTab !== 'image-to-pdf' && activeFlipH ? 'scaleX(-1)' : '',
    activeTab !== 'image-to-pdf' && activeFlipV ? 'scaleY(-1)' : '',
  ].filter(Boolean).join(' ');



  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className={`tool-layout image-tool-layout ${files.length > 0 || processing || results.length > 0 ? 'has-active-session' : 'is-empty-session'}`}>
      <ToolHeader
        title="Images"
        description="Compress, convert, resize, crop, and edit images right in your browser." 
        icon={ImageIcon} 
        onGoHome={() => {
          if (files.length > 0 || results.length > 0 || processing) {
            clearQueue();
          } else {
            onGoHome();
          }
        }} 
        actions={!processing && results.length === 0 ? <ToolModeSwitcher
          label="Image tools"
          activeId={activeTab === 'image-to-pdf' ? '' : 'image-optimizer'}
          options={[
            { id: 'image-optimizer', label: 'Edit' },
            { id: 'rasterbator', label: 'Poster' },
          ]}
          onSelect={onSelectTool}
        /> : undefined}
      />

      {files.length === 0 && !processing && results.length === 0 && (
        <div className="tool-upload-frame max-w-2xl mx-auto py-10">
          <FileUploader
            accept="image/jpeg,image/png,image/webp"
            multiple={true}
            label="Upload images to process"
            subLabel="Drag & drop JPEG, PNG, WebP, or GIF files (Up to 10GB)"
            onFilesSelected={handleFilesSelected}
            maxSizeMB={10240}
          />
        </div>
      )}

      {(files.length > 0 || processing || results.length > 0) && (
        <WorkspaceShell
          className="workspace-shell--embedded"
          title="Images"
          fileName={activeFile?.name || (files.length > 1 ? `${files.length} images` : 'Image workspace')}
          fileMeta={activeFile ? `${formatBytes(activeFile.size)}${activeSettings?.origWidth ? ` · ${activeSettings.origWidth} × ${activeSettings.origHeight}px` : ''}` : `${files.length} files in queue`}
          status={processing ? 'Processing' : results.length > 0 ? 'Export ready' : 'Ready to edit'}
          statusDetail={processing ? `${Math.round(progress)}% · file ${currentFileIndex + 1} of ${files.length}` : activeTab ? `${TABS.find(tab => tab.id === activeTab)?.label || 'Edit'} controls active` : undefined}
          onExit={results.length > 0 ? clearQueue : onGoHome}
          actions={files.length > 0 && !processing && results.length === 0 ? (
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="image-queue-action-btn"
            >
              <span>{getActionLabel()}</span>
              <span className="font-black text-sm">→</span>
            </button>
          ) : undefined}
        >
        <div className={`image-workbench ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>

          {/* ═══ LEFT SIDEBAR ═══════════════════════════════════════════════════ */}
          <aside className={`image-workbench__sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
            {files.length > 0 && !processing && results.length === 0 && (
              sidebarCollapsed ? (
                /* Collapsed Icon Rail with Tooltips */
                <div className="h-full flex flex-col items-center py-3 bg-[#18191e] justify-between w-full select-none">
                  <div className="flex flex-col items-center gap-1.5 w-full px-2">
                    {/* Expand button */}
                    <button
                      type="button"
                      onClick={() => setSidebarCollapsed(false)}
                      className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer mb-1"
                      title="Expand sidebar"
                    >
                      <PanelLeft className="w-4 h-4" />
                    </button>

                    <div className="w-6 h-[1px] bg-white/10 mb-1" />

                    {/* Tool icons with tooltip */}
                    <div className="flex flex-col items-center gap-1 w-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                      {TABS.map((tab) => {
                        const Icon = tab.Icon;
                        const isActive = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              setActiveTab(tab.id);
                              setSidebarCollapsed(false);
                            }}
                            title={`${tab.label} (Click to open)`}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer relative group ${
                              isActive
                                ? 'bg-white text-zinc-950 font-bold shadow-md'
                                : 'text-zinc-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            {/* Hover Tooltip */}
                            <div className="absolute left-full ml-3 px-2.5 py-1 bg-zinc-900 border border-zinc-700/80 text-zinc-100 text-xs font-semibold rounded-md shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                              {tab.label}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Collapsed CTA button */}
                  <div className="pt-2 border-t border-white/10 w-full flex justify-center px-2">
                    <button
                      type="button"
                      onClick={handlePrimaryAction}
                      title={getActionLabel()}
                      className="w-9 h-9 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 flex items-center justify-center shadow-md cursor-pointer transition-all hover:scale-105 active:scale-95 group relative font-bold"
                    >
                      <span className="text-sm leading-none font-black">→</span>
                      <div className="absolute left-full ml-3 px-2.5 py-1 bg-zinc-900 border border-zinc-700/80 text-zinc-100 text-xs font-semibold rounded-md shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                        {getActionLabel()}
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                /* Expanded Compact Sidebar */
                <div className="h-full flex flex-col min-h-0 bg-[#18191e]">
                  {/* Compact Header with Collapse button */}
                  <div className="h-10 px-3.5 border-b border-white/10 flex items-center justify-between bg-transparent shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Tools</span>
                      {files.length > 1 && (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-semibold text-zinc-400">
                          {files.length} files
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSidebarCollapsed(true)}
                      className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                      title="Collapse to icon rail"
                    >
                      <PanelLeftClose className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Tool tabs */}
                  <WorkspaceToolNav items={TABS} activeId={activeTab} onChange={setActiveTab} label="Image editing tools" />

                  {/* Scrollable settings content */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                    <ImageSidebarControls
                      activeTab={activeTab}
                      activeFile={activeFile}
                      activeSettings={activeSettings}
                      compressionPreset={compressionPreset}
                      applyCompressionPreset={applyCompressionPreset}
                      removeMetadata={removeMetadata}
                      setRemoveMetadata={setRemoveMetadata}
                      updateSetting={updateSetting}
                      handleWidthChange={handleWidthChange}
                      handleHeightChange={handleHeightChange}
                      imageRef={imageRef}
                      setCropLeftPct={setCropLeftPct}
                      setCropTopPct={setCropTopPct}
                      setCropWidthPct={setCropWidthPct}
                      setCropHeightPct={setCropHeightPct}
                      setCropApplied={setCropApplied}
                      setCropAspect={setCropAspect}
                      measureImage={measureImage}
                      displayGrid={displayGrid}
                      setDisplayGrid={setDisplayGrid}
                      applyImmediateCrop={applyImmediateCrop}
                      revertImmediateCrop={revertImmediateCrop}
                      pdfFilter={pdfFilter}
                      setPdfFilter={setPdfFilter}
                      pdfOrientation={pdfOrientation}
                      setPdfOrientation={setPdfOrientation}
                      pdfPageSize={pdfPageSize}
                      setPdfPageSize={setPdfPageSize}
                      pdfMargin={pdfMargin}
                      setPdfMargin={setPdfMargin}
                    />
                  </div>

                  {/* Sidebar Footer with primary action */}
                  <div className="p-3.5 border-t border-white/10 bg-zinc-900/50 backdrop-blur-sm shrink-0 space-y-2.5">
                    {files.length > 1 && activeTab !== 'image-to-pdf' && (
                      <label className="flex items-center justify-between text-xs text-zinc-400 px-1 cursor-pointer select-none">
                        <span>Apply to all ({files.length})</span>
                        <input
                          type="checkbox"
                          checked={sameForAll}
                          onChange={e => toggleSameForAll(e.target.checked)}
                          className="w-3.5 h-3.5 accent-white rounded"
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={handlePrimaryAction}
                      className="workspace-primary-action w-full h-10 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <span>{getActionLabel()}</span>
                      <span className="font-black text-sm">→</span>
                    </button>
                  </div>
                </div>
              )
            )}

            {/* Processing state in sidebar */}
            {processing && (
              <div className="flex-1 min-h-0 p-4 flex flex-col select-none">
                <div className="min-h-0 flex-1 space-y-4 flex flex-col">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Status</span>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      {activeTab === 'image-to-pdf' ? 'Creating PDF…' : 'Optimizing Files…'}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      File {currentFileIndex + 1} of {files.length}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-zinc-400">Batch Progress</span>
                      <span className="text-white font-mono">{Math.round(batchProgress)}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-950 border border-white/10 overflow-hidden">
                      <div
                        className="h-full bg-white transition-all duration-200"
                        style={{ width: `${Math.round(batchProgress)}%` }}
                      />
                    </div>
                  </div>

                  {/* Queued files status */}
                  <div className="min-h-0 flex-1 flex flex-col space-y-1 pt-2 border-t border-white/10">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Queue Status</span>
                    <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto pr-1">
                      {files.map((file, idx) => {
                        const isDone = idx < currentFileIndex;
                        const isCurrent = idx === currentFileIndex;
                        return (
                          <div
                            key={`${file.name}-${idx}`}
                            className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                              isCurrent
                                ? 'border-white/30 bg-white/5 text-white font-semibold'
                                : isDone
                                ? 'border-white/5 bg-zinc-950/30 text-zinc-400'
                                : 'border-transparent text-zinc-500'
                            }`}
                          >
                            <span className="truncate max-w-[150px]">{file.name}</span>
                            <span className="text-[10px] shrink-0 font-mono">
                              {isDone ? '✓ Done' : isCurrent ? `${Math.round(progress)}%` : 'Waiting'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Results sidebar info */}
            {results.length > 0 && !processing && (
              <div className="flex-1 p-4 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <CheckCircle className="w-5 h-5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-white">{activeTab === 'image-to-pdf' ? 'PDF Ready' : 'Batch Complete'}</p>
                      <p className="text-[11px] text-emerald-400/90">{activeTab === 'image-to-pdf' ? `${files.length} ${files.length === 1 ? 'page' : 'pages'} assembled` : `${results.length} ${results.length === 1 ? 'image' : 'images'} processed`}</p>
                    </div>
                  </div>

                  {activeTab === 'image-to-pdf' ? (
                    <div className="p-3.5 rounded-xl border border-white/10 bg-zinc-900/60 space-y-2.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Document</span>
                      <div className="flex justify-between text-xs text-zinc-400"><span>Pages</span><span className="font-mono text-zinc-200">{files.length}</span></div>
                      <div className="flex justify-between text-xs text-zinc-400"><span>PDF size</span><span className="font-mono text-zinc-200">{formatBytes(results[0]?.newSize ?? 0)}</span></div>
                    </div>
                  ) : <div className="p-3.5 rounded-xl border border-white/10 bg-zinc-900/60 space-y-2.5">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Summary Stats</span>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-zinc-400">
                        <span>Original Size</span>
                        <span className="font-mono text-zinc-200">
                          {formatBytes(results.reduce((a, r) => a + r.originalSize, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>Optimized Size</span>
                        <span className="font-mono text-zinc-200">
                          {formatBytes(results.reduce((a, r) => a + r.newSize, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold pt-1.5 border-t border-white/10 text-white">
                        <span>Total Saved</span>
                        <span className="font-mono text-emerald-400">
                          {(() => {
                            const o = results.reduce((a, r) => a + r.originalSize, 0);
                            const n = results.reduce((a, r) => a + r.newSize, 0);
                            const s = Math.max(0, o - n);
                            const p = o > 0 ? Math.round((s / o) * 100) : 0;
                            return `${formatBytes(s)} (${p}%)`;
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>}
                </div>

                <button
                  type="button"
                  onClick={clearQueue}
                  className="w-full bg-white hover:bg-zinc-200 text-zinc-950 font-bold py-2.5 rounded-xl text-xs transition-all shadow-md cursor-pointer"
                >
                  {activeTab === 'image-to-pdf' ? 'Create Another PDF' : 'Process More Images'}
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
              <div className="image-filebar h-10 border-b border-[var(--border-color)] bg-[var(--surface-color)] flex items-center px-4 gap-3 text-xs text-[var(--text-secondary)] shrink-0 justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-semibold text-[var(--text-primary)] truncate max-w-[200px]">{activeFile.name}</span>
                  <span className="text-zinc-500">{formatBytes(activeFile.size)}</span>
                  {activeSettings && activeSettings.origWidth > 0 && (
                    <span className="text-zinc-500 hidden sm:inline">{activeSettings.origWidth} × {activeSettings.origHeight}px</span>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <WorkspaceZoomControls value={imageZoom} onChange={setImageZoom} />
                </div>
              </div>
            )}
            <input ref={addMoreRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => { handleFilesSelected(Array.from(e.target.files || [])); e.target.value = ''; }} />

            {/* Image preview and asset queue */}
            <div className="image-editor-stage">
            <div ref={previewViewportRef} className="image-preview-viewport workbench-scroll-region flex-1 bg-[var(--bg-color)] relative">
               {activeIndex !== null && previewUrls[activeIndex] ? (
                <div
                  className="image-preview-stage relative min-w-full min-h-full p-6 flex items-center justify-center"
                >
                  <div className="image-preview-pan-space">
                    <div className="image-preview-zoom-layer" style={{ zoom: `${imageZoom}%` }}>
                    <div className="image-preview-image-frame relative inline-flex">
                    {activeTab === 'image-to-pdf' ? (
                      <DocumentFilterPreview
                        key={activeIndex}
                        src={previewUrls[activeIndex]}
                        filter={pdfFilter}
                        transform={previewTransform}
                      />
                    ) : activeEnhanceMode === 'halftone' ? (
                      <HalftoneImagePreview
                        key={activeIndex}
                        src={previewUrls[activeIndex]}
                        dotSize={activeSettings?.halftoneDotSize ?? 10}
                        invert={activeSettings?.halftoneInvert ?? false}
                        transform={previewTransform}
                        clipPath={cropApplied ? `inset(${cropTopPct}% ${100 - cropLeftPct - cropWidthPct}% ${100 - cropTopPct - cropHeightPct}% ${cropLeftPct}%)` : undefined}
                        onLoad={measureImage}
                      />
                    ) : (
                      <img
                        key={activeIndex}
                        ref={imageRef}
                        src={previewUrls[activeIndex]}
                        alt={activeFile?.name ?? 'Preview'}
                        className="max-w-full max-h-[calc(100vh-14rem)] object-contain rounded-lg shadow-2xl select-none transition-all duration-300"
                        style={{
                          filter: previewFilter || 'none',
                          transform: previewTransform || undefined,
                          clipPath: cropApplied ? `inset(${cropTopPct}% ${100 - cropLeftPct - cropWidthPct}% ${100 - cropTopPct - cropHeightPct}% ${cropLeftPct}%)` : undefined,
                        }}
                        draggable={false}
                        onLoad={measureImage}
                      />
                    )}

                    {/* Manual visual crop bounding box overlay */}
                    {activeTab === 'crop' && imageRect && !cropApplied && (
                    <div 
                      ref={cropOverlayRef}
                      className="absolute border-2 border-white opacity-100 pointer-events-auto"
                      style={{
                        left: `${cropLeftPct}%`,
                        top: `${cropTopPct}%`,
                        width: `${cropWidthPct}%`,
                        height: `${cropHeightPct}%`,
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

                    {/* Live Watermark Overlay Preview */}
                    {activeTab === 'watermark' && (activeSettings?.watermarkText || '') && (
                      (activeSettings?.watermarkPosition ?? 'center') === 'pattern' ? (
                        <div
                          className="absolute inset-0 pointer-events-none overflow-hidden select-none z-20 flex items-center justify-center"
                          style={{ opacity: activeSettings?.watermarkOpacity ?? 0.4 }}
                        >
                          <div
                            className="w-[220%] h-[220%] flex flex-wrap content-center justify-center gap-x-16 gap-y-12 shrink-0 select-none"
                            style={{
                              transform: 'rotate(-30deg)',
                              color: activeSettings?.watermarkColor ?? '#ffffff',
                              fontSize: `${Math.max(12, Math.min(36, (activeSettings?.watermarkFontSize ?? 48) * (imageZoom / 100) * 0.75))}px`,
                              fontWeight: 800,
                              textShadow: '0 2px 8px rgba(0,0,0,0.85)',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {Array.from({ length: 48 }).map((_, pIdx) => (
                              <span key={pIdx} className="whitespace-nowrap select-none">
                                {activeSettings?.watermarkText}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="absolute inset-0 pointer-events-none flex z-20"
                          style={{
                            justifyContent:
                              (activeSettings?.watermarkPosition ?? 'center') === 'top-left' || (activeSettings?.watermarkPosition ?? 'center') === 'bottom-left'
                                ? 'flex-start'
                                : (activeSettings?.watermarkPosition ?? 'center') === 'top-right' || (activeSettings?.watermarkPosition ?? 'center') === 'bottom-right'
                                ? 'flex-end'
                                : 'center',
                            alignItems:
                              (activeSettings?.watermarkPosition ?? 'center') === 'top-left' || (activeSettings?.watermarkPosition ?? 'center') === 'top-right'
                                ? 'flex-start'
                                : (activeSettings?.watermarkPosition ?? 'center') === 'bottom-left' || (activeSettings?.watermarkPosition ?? 'center') === 'bottom-right'
                                ? 'flex-end'
                                : 'center',
                            padding: '1.75rem',
                          }}
                        >
                          <div
                            style={{
                              opacity: activeSettings?.watermarkOpacity ?? 0.4,
                              fontSize: `${Math.max(14, Math.min(64, (activeSettings?.watermarkFontSize ?? 48) * (imageZoom / 100)))}px`,
                              color: activeSettings?.watermarkColor ?? '#ffffff',
                              fontWeight: 800,
                              textShadow: '0 2px 10px rgba(0,0,0,0.85)',
                              userSelect: 'none',
                              letterSpacing: '0.04em',
                              textAlign: 'center',
                            }}
                          >
                            {activeSettings?.watermarkText}
                          </div>
                        </div>
                      )
                    )}
                    </div>
                  </div>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-3 text-zinc-700">
                  <ImageIcon className="w-16 h-16 mx-auto opacity-30" />
                  <p className="text-sm">Select an image from the queue</p>
                </div>
              )}
            </div>
            <aside className="image-queue-rail" aria-label={`${files.length} image${files.length === 1 ? '' : 's'} in queue`}>
              <div className="image-queue-rail__header">Queue <b>{files.length}</b></div>
              <button
                type="button"
                onClick={() => addMoreRef.current?.click()}
                title="Add images to queue"
                aria-label="Add images to queue"
                className="image-queue-strip__add"
              >
                <Plus aria-hidden="true" />
              </button>
              <div className="image-queue-strip" role="list">
                {files.map((queuedFile, idx) => (
                  <div
                    key={`${queuedFile.name}-${idx}`}
                    className={`image-queue-strip__item ${draggedQueueIndex === idx ? 'is-dragging' : ''}`}
                    role="listitem"
                    draggable={activeTab === 'image-to-pdf'}
                    onDragStart={(event) => {
                      if (activeTab !== 'image-to-pdf') return;
                      setDraggedQueueIndex(idx);
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', String(idx));
                    }}
                    onDragOver={(event) => {
                      if (activeTab === 'image-to-pdf') event.preventDefault();
                    }}
                    onDrop={(event) => {
                      if (activeTab !== 'image-to-pdf') return;
                      event.preventDefault();
                      const from = draggedQueueIndex ?? Number(event.dataTransfer.getData('text/plain'));
                      reorderQueue(from, idx);
                      setDraggedQueueIndex(null);
                    }}
                    onDragEnd={() => setDraggedQueueIndex(null)}
                    title={activeTab === 'image-to-pdf' ? 'Drag to change PDF page order' : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => selectActiveFile(idx)}
                      title={`Image ${idx + 1}: ${queuedFile.name}`}
                      aria-label={`Select image ${idx + 1}: ${queuedFile.name}`}
                      aria-current={activeIndex === idx ? 'true' : undefined}
                      className={`image-queue-strip__thumb ${activeIndex === idx ? 'is-active' : ''}`}
                    >
                      {previewUrls[idx] ? <img src={previewUrls[idx]} alt="" /> : <ImageIcon aria-hidden="true" />}
                      <span className="image-queue-strip__index" aria-hidden="true">{idx + 1}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      title={`Remove ${queuedFile.name}`}
                      aria-label={`Remove ${queuedFile.name} from queue`}
                      className="image-queue-strip__remove"
                    >
                      <X aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </aside>
            </div>
          </>
        )}

        {/* ── Processing state with cancellation ── */}
        {processing && (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-8 bg-zinc-950/40">
            <div className="max-w-md w-full flex flex-col items-center gap-6">
              <ProgressBar
                progress={batchProgress}
                statusText={activeTab === 'image-to-pdf' ? 'Creating PDF…' : `Processing ${currentFileIndex + 1} of ${files.length}…`}
                subText={activeTab === 'image-to-pdf' ? `Assembling ${files.length} ordered ${files.length === 1 ? 'page' : 'pages'} · ${Math.round(batchProgress)}% complete` : `Optimizing ${files[currentFileIndex]?.name || 'image'} · ${Math.round(batchProgress)}% of batch complete`}
              />
              <button
                type="button"
                onClick={() => { cancellationRef.current = true; }}
                className="mt-2 px-6 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold tracking-wider uppercase transition-all shadow-sm cursor-pointer"
              >
                Cancel Process
              </button>
            </div>
          </div>
        )}

        {/* ── Results state ── */}
        {results.length > 0 && !processing && (
          activeTab === 'image-to-pdf' ? (
            <div className="pdf-export-result-wrap">
              <section className="pdf-export-result w-full max-w-xl p-8 text-center space-y-5">
                <span className="pdf-export-result__success-icon"><FileCheck2 aria-hidden="true" /></span>
                <div><h2 className="text-xl font-bold text-white">PDF created</h2><p className="mt-1 text-sm text-zinc-400">{files.length} {files.length === 1 ? 'image' : 'images'} exported as ordered PDF pages.</p></div>
                <div className="pdf-export-result__file flex items-center justify-between gap-4 p-4 text-left">
                  <div className="min-w-0"><strong className="block truncate text-sm text-white">{results[0].name}</strong><span className="text-xs text-zinc-400">{formatBytes(results[0].newSize)} · {files.length} {files.length === 1 ? 'page' : 'pages'}</span></div>
                  <a className="pdf-export-result__primary inline-flex items-center gap-2 px-4 text-xs font-bold" href={results[0].url} download={results[0].name}><Download className="w-4 h-4" aria-hidden="true" />Download PDF</a>
                </div>
              </section>
            </div>
          ) : <ImageBatchResults
            results={results}
            files={files}
            previewUrls={previewUrls}
            failedFileIndexes={failedFileIndexes}
            onRetryFailed={(indexes) => startBatchCompression(indexes)}
          />
        )}
      </div>
    </div>
    </WorkspaceShell>
  )}
</div>
  );
};
