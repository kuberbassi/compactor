import { 
  Sliders,
  Crop as CropIcon, 
  Expand as ResizeIcon, 
  ArrowLeftRight as MirrorIcon,
  RefreshCw,
  Palette as FilterIcon, 
  FolderOpen as FormatIcon,
  FileText as PdfIcon,
  Droplets as WatermarkIcon,
} from 'lucide-react';

export interface FileSettings {
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
  // Watermark fields
  watermarkText: string;
  watermarkPosition: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'pattern';
  watermarkOpacity: number;
  watermarkFontSize: number;
  watermarkColor: string;
  // Scan Cleanup & Halftone
  scanEnhanceMode: 'none' | 'smart-contrast' | 'crisp-bw' | 'halftone';
  halftoneDotSize: number;
  halftoneInvert: boolean;
}

export const IMAGE_TABS = [
  { id: 'compress',    label: 'Compress',    Icon: Sliders },
  { id: 'resize',      label: 'Resize',      Icon: ResizeIcon },
  { id: 'crop',        label: 'Crop',        Icon: CropIcon },
  { id: 'mirror',      label: 'Mirror',      Icon: MirrorIcon },
  { id: 'rotate',      label: 'Rotate',      Icon: RefreshCw },
  { id: 'format',      label: 'Convert',     Icon: FormatIcon },
  { id: 'filter',      label: 'Filters',     Icon: FilterIcon },
  { id: 'watermark',   label: 'Watermark',   Icon: WatermarkIcon },
  { id: 'image-to-pdf', label: 'To PDF',     Icon: PdfIcon },
] as const;

export type ImageTabId = typeof IMAGE_TABS[number]['id'];

export const DEFAULT_FILE_SETTINGS: FileSettings = {
  quality: 80,
  format: 'preserve',
  maxWidth: '',
  maxHeight: '',
  compressMethod: 'auto',
  targetSize: '500',
  targetUnit: 'KB',
  aspectRatioLocked: true,
  origWidth: 0,
  origHeight: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
  cropAspect: 'free',
  grayscale: false,
  cropLeftPct: 0,
  cropTopPct: 0,
  cropWidthPct: 100,
  cropHeightPct: 100,
  cropApplied: false,
  watermarkText: '',
  watermarkPosition: 'center',
  watermarkOpacity: 0.4,
  watermarkFontSize: 48,
  watermarkColor: '#ffffff',
  scanEnhanceMode: 'none',
  halftoneDotSize: 10,
  halftoneInvert: false,
};
