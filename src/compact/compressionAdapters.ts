import { processImage } from '../utils/image';
import type { CompressionPreset } from '../utils/batch';
import type { CompactQueueAdapter } from './queue/useCompactQueue';

export interface CompactImageSettings {
  quality: number;
  format: 'preserve' | 'image/jpeg' | 'image/webp' | 'image/png';
  method: 'auto' | 'target';
  targetSizeKB: number;
  targetUnit: 'KB' | 'MB';
  resize: boolean;
  width: number;
  height: number;
  fixedRatio: boolean;
  watermarkText: string;
  watermarkOpacity: number;
}

export interface CompactPdfSettings {
  preset: CompressionPreset;
  removeMetadata: boolean;
}

export const compactImageAdapter: CompactQueueAdapter<CompactImageSettings> = {
  accepts: file => file.type.startsWith('image/'),
  process: async (file, settings) => {
    const result = await processImage(file, {
      quality: settings.quality / 100,
      format: settings.format === 'preserve' ? file.type : settings.format,
      targetSizeKB: settings.method === 'target' ? settings.targetSizeKB * (settings.targetUnit === 'MB' ? 1024 : 1) : undefined,
      maxWidth: settings.resize ? settings.width : undefined,
      maxHeight: settings.resize ? settings.height : undefined,
      watermarkText: settings.watermarkText,
      watermarkOpacity: settings.watermarkOpacity,
    });
    URL.revokeObjectURL(result.url);
    return { blob: result.blob, name: result.name, originalSize: result.originalSize, newSize: result.newSize };
  },
};

export const compactPdfAdapter: CompactQueueAdapter<CompactPdfSettings> = {
  accepts: file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'),
  process: async (file, settings) => {
    const { compressPdf } = await import('../utils/pdf');
    const blob = await compressPdf(file, settings);
    return {
      blob,
      name: `${file.name.replace(/\.pdf$/i, '')}_compressed.pdf`,
      originalSize: file.size,
      newSize: blob.size,
    };
  },
};
