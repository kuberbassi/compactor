import { FFmpeg } from '@ffmpeg/ffmpeg';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';

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

  await ffmpeg.load({
    coreURL,
    wasmURL,
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
