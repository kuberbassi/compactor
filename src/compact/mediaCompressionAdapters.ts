import type { CompactQueueAdapter } from './queue/useCompactQueue';

export interface CompactAudioSettings {
  format: 'mp3' | 'm4a' | 'ogg' | 'wav';
  bitrate: '64k' | '96k' | '128k' | '192k';
  removeMetadata: boolean;
  normalizeAudio: boolean;
  channels: 'original' | 'mono' | 'stereo';
  removeSilence: boolean;
  noiseReduction: boolean;
  bassBoost: boolean;
}

export interface CompactVideoSettings {
  format: 'mp4' | 'webm';
  quality: 'smaller' | 'balanced' | 'higher';
  scale: 'no-scale' | '1280:720' | '854:480' | '640:360';
  removeAudio: boolean;
  removeMetadata: boolean;
  target: 'general' | 'whatsapp' | 'discord' | 'instagram' | 'tiktok';
  watermarkText: string;
  watermarkOpacity: number;
}

const cancelFfmpeg = async () => {
  const { terminateFFmpeg } = await import('../utils/ffmpeg');
  await terminateFFmpeg();
};

export const compactAudioAdapter: CompactQueueAdapter<CompactAudioSettings> = {
  accepts: file => file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name),
  process: async (file, settings, onProgress) => {
    const { compressAudio } = await import('../utils/ffmpeg');
    const result = await compressAudio(file, settings, () => undefined, onProgress);
    URL.revokeObjectURL(result.url);
    return { blob: result.blob, name: result.name, originalSize: result.originalSize, newSize: result.newSize };
  },
  cancelActive: cancelFfmpeg,
};

export const compactVideoAdapter: CompactQueueAdapter<CompactVideoSettings> = {
  accepts: file => file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(file.name),
  process: async (file, settings, onProgress) => {
    const { compressVideo } = await import('../utils/ffmpeg');
    const crf = settings.quality === 'smaller' ? 31 : settings.quality === 'higher' ? 23 : 27;
    let watermark: Blob | undefined;
    if (settings.watermarkText.trim()) {
      const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 120;
      const context = canvas.getContext('2d');
      if (context) {
        context.font = '700 44px sans-serif'; context.textAlign = 'right'; context.textBaseline = 'middle'; context.fillStyle = `rgba(255,255,255,${settings.watermarkOpacity})`; context.strokeStyle = `rgba(0,0,0,${Math.min(1, settings.watermarkOpacity + .3)})`; context.lineWidth = 4;
        context.strokeText(settings.watermarkText.trim(), 700, 60, 680); context.fillText(settings.watermarkText.trim(), 700, 60, 680);
        watermark = await new Promise<Blob | undefined>(resolve => canvas.toBlob(blob => resolve(blob ?? undefined), 'image/png'));
      }
    }
    const result = await compressVideo(file, {
      crf,
      scale: settings.scale,
      preset: 'fast',
      removeAudio: settings.removeAudio,
      format: settings.format,
      removeMetadata: settings.removeMetadata,
      targetMaxMB: settings.target === 'whatsapp' ? 15.2 : settings.target === 'discord' ? 9.3 : settings.target === 'instagram' ? 92 : settings.target === 'tiktok' ? 68 : undefined,
      watermark,
    }, () => undefined, onProgress);
    URL.revokeObjectURL(result.url);
    return { blob: result.blob, name: result.name, originalSize: result.originalSize, newSize: result.newSize };
  },
  cancelActive: cancelFfmpeg,
};
