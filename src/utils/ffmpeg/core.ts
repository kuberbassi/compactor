import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let isLoaded = false;

// Global delegates to handle callbacks on the singleton instance dynamically
let logDelegate: ((message: string) => void) | null = null;
let progressDelegate: ((progress: number) => void) | null = null;

/**
 * Gets or initializes the singleton FFmpeg instance.
 * Loads the WebAssembly binaries dynamically from CDN.
 */
export const getFFmpeg = async (
  onLog?: (message: string) => void,
  onProgress?: (progress: number) => void
): Promise<FFmpeg> => {
  if (onLog) logDelegate = onLog;
  if (onProgress) progressDelegate = onProgress;

  if (ffmpegInstance) {
    return ffmpegInstance;
  }

  const ffmpeg = new FFmpeg();
  
  ffmpeg.on('log', ({ message }) => {
    if (logDelegate) logDelegate(message);
  });
  
  ffmpeg.on('progress', ({ progress }) => {
    if (progressDelegate) {
      const normalizedPct = progress > 1 ? Math.min(100, Math.max(0, progress)) : Math.min(100, Math.max(0, progress * 100));
      progressDelegate(normalizedPct);
    }
  });

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegInstance = ffmpeg;
  isLoaded = true;
  return ffmpeg;
};

/**
 * Checks if FFmpeg is loaded
 */
export const isFFmpegLoaded = () => isLoaded;

export const terminateFFmpeg = async () => {
  if (ffmpegInstance) {
    const inst = ffmpegInstance;
    ffmpegInstance = null;
    isLoaded = false;
    logDelegate = null;
    progressDelegate = null;
    try {
      await inst.terminate();
    } catch {
      // Intentionally suppress FFmpeg.terminate worker shutdown exception
    }
  }
};
