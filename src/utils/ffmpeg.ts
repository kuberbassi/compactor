import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { TrimSegment } from '../components/Common/TrimTimeline';

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
    if (progressDelegate) progressDelegate(progress * 100);
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

export interface VideoCompressOptions {
  crf: number;        // Constant Rate Factor (18-35). Higher = smaller file size, lower quality.
  scale: string;      // Scale preset e.g. '1280:720', '854:480', '640:360' or 'no-scale'
  preset: string;     // ffmpeg speed preset e.g. 'ultrafast', 'fast', 'medium'
  removeAudio: boolean;
  format: string;     // 'mp4' | 'webm' | 'gif'
  segments?: TrimSegment[];
  compileMode?: 'keep-selected' | 'cut-selected';
  videoBitrate?: string;
  audioBitrate?: string;
  frameRate?: number;
}

export interface VideoCompressResult {
  blob: Blob;
  url: string;
  name: string;
  originalSize: number;
  newSize: number;
}

/**
 * Helper to compute active interval list from trim timeline segments
 */
const getActiveIntervals = (
  duration: number,
  segments?: TrimSegment[],
  compileMode?: 'keep-selected' | 'cut-selected'
): Array<{ start: number; end: number }> => {
  if (!segments || segments.length === 0 || !compileMode) {
    return [{ start: 0, end: duration }];
  }
  
  return segments
    .filter(seg => {
      const isKeep = seg.mode === 'keep';
      return compileMode === 'keep-selected' ? isKeep : !isKeep;
    })
    .map(seg => ({ start: seg.start, end: seg.end }))
    .sort((a, b) => a.start - b.start);
};

/**
 * Compress, crop or convert a video file using FFmpeg WASM
 */
export const compressVideo = async (
  file: File,
  options: VideoCompressOptions,
  onLog: (msg: string) => void,
  onProgress: (p: number) => void
): Promise<VideoCompressResult> => {
  const ffmpeg = await getFFmpeg(onLog, onProgress);
  
  const inputName = 'input_video';
  const ext = options.format === 'gif' ? 'gif' : options.format;
  const outputName = `output_video.${ext}`;

  // Write file to memory
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  // Determine Duration first
  onLog("Reading video duration...");
  await ffmpeg.exec(['-i', inputName]); // outputs metadata in log
  
  // Parse duration from logs if possible, or fallback. For safety we default to 600s if parsing fails.
  let duration = 600;
  // Look at ffmpeg log history for duration
  // Duration: 00:01:23.45 format
  const logStr = ffmpegInstance ? (ffmpegInstance as any).logHistory || '' : '';
  const durationMatch = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(logStr);
  if (durationMatch) {
    const hours = parseInt(durationMatch[1], 10);
    const mins = parseInt(durationMatch[2], 10);
    const secs = parseFloat(durationMatch[3]);
    duration = hours * 3600 + mins * 60 + secs;
    onLog(`Parsed video duration: ${duration.toFixed(2)}s`);
  }

  const activeIntervals = getActiveIntervals(duration, options.segments, options.compileMode);
  if (activeIntervals.length === 0) {
    throw new Error("No portions selected to keep. Adjust your trim settings.");
  }

  // Build command arguments
  const args: string[] = [];

  // If there is exactly one segment, optimize using simple accurate seek
  if (activeIntervals.length === 1) {
    const { start, end } = activeIntervals[0];
    args.push('-i', inputName, '-ss', start.toString(), '-to', end.toString());
  } else {
    // Multi-segment concat using filter_complex
    args.push('-i', inputName);
  }

  if (options.format === 'gif') {
    if (activeIntervals.length > 1) {
      // Build complex filter for multi-cut stitching + high quality GIF rendering
      const filterComplexParts: string[] = [];
      const concatInputs: string[] = [];
      
      activeIntervals.forEach((interval, idx) => {
        filterComplexParts.push(`[0:v]trim=start=${interval.start}:end=${interval.end},setpts=PTS-STARTPTS[v${idx}]`);
        concatInputs.push(`[v${idx}]`);
      });
      
      const scaleArg = options.scale !== 'no-scale' ? `scale=${options.scale.split(':')[0]}:-1` : 'scale=480:-1';
      filterComplexParts.push(`${concatInputs.join('')}concat=n=${activeIntervals.length}:v=1:a=0[stitchedv]`);
      filterComplexParts.push(`[stitchedv]fps=15,${scaleArg}:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`);
      
      args.push('-filter_complex', filterComplexParts.join('; '), '-loop', '0');
    } else {
      // Single segment GIF
      const scaleArg = options.scale !== 'no-scale' ? `scale=${options.scale.split(':')[0]}:-1` : 'scale=480:-1';
      args.push('-vf', `fps=15,${scaleArg}:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`, '-loop', '0');
    }
  } else {
    // Video standard encoding configurations
    if (activeIntervals.length > 1) {
      const filterComplexParts: string[] = [];
      const concatInputs: string[] = [];
      const hasAudio = !options.removeAudio;

      activeIntervals.forEach((interval, idx) => {
        // Video trim
        let videoFilter = `[0:v]trim=start=${interval.start}:end=${interval.end},setpts=PTS-STARTPTS`;
        if (options.scale && options.scale !== 'no-scale') {
          videoFilter += `,scale=${options.scale}`;
        }
        filterComplexParts.push(`${videoFilter}[v${idx}]`);
        concatInputs.push(`[v${idx}]`);

        // Audio trim
        if (hasAudio) {
          filterComplexParts.push(`[0:a]atrim=start=${interval.start}:end=${interval.end},asetpts=PTS-STARTPTS[a${idx}]`);
          concatInputs.push(`[a${idx}]`);
        }
      });

      // Concat filter
      const concatFilter = `${concatInputs.join('')}concat=n=${activeIntervals.length}:v=1:a=${hasAudio ? 1 : 0}[outv]${hasAudio ? '[outa]' : ''}`;
      filterComplexParts.push(concatFilter);

      args.push('-filter_complex', filterComplexParts.join('; '));
      args.push('-map', '[outv]');
      if (hasAudio) {
        args.push('-map', '[outa]');
      }
    } else {
      // Single segment filters
      if (options.scale && options.scale !== 'no-scale') {
        args.push('-vf', `scale=${options.scale}`);
      }
    }

    // Standard codecs parameters
    if (options.frameRate) {
      args.push('-r', options.frameRate.toString());
    }

    if (options.videoBitrate) {
      args.push('-vcodec', 'libx264', '-b:v', options.videoBitrate, '-preset', options.preset);
    } else {
      args.push('-vcodec', 'libx264', '-crf', options.crf.toString(), '-preset', options.preset);
    }
    
    if (options.removeAudio) {
      args.push('-an');
    } else {
      args.push('-acodec', 'aac', '-b:a', options.audioBitrate || '128k');
    }
  }

  args.push(outputName);
  
  onLog(`Executing FFmpeg: ffmpeg ${args.join(' ')}`);
  await ffmpeg.exec(args);

  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  const mimeType = options.format === 'gif' ? 'image/gif' : `video/${options.format}`;
  const blob = new Blob([data as any], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
  const newName = `${originalNameWithoutExt}_optimized.${options.format}`;

  return {
    blob,
    url,
    name: newName,
    originalSize: file.size,
    newSize: blob.size
  };
};

export interface AudioCompressOptions {
  bitrate: string;    // e.g. '64k', '128k', '192k', '256k'
  format: string;     // 'mp3' | 'wav' | 'ogg' | 'm4a'
  segments?: TrimSegment[];
  compileMode?: 'keep-selected' | 'cut-selected';
}

/**
 * Compress, trim or convert an audio file using FFmpeg WASM
 */
export const compressAudio = async (
  file: File,
  options: AudioCompressOptions,
  onLog: (msg: string) => void,
  onProgress: (p: number) => void
): Promise<VideoCompressResult> => {
  const ffmpeg = await getFFmpeg(onLog, onProgress);
  const inputName = 'input_audio';
  const outputName = `output_audio.${options.format}`;

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  // Determine Duration first
  await ffmpeg.exec(['-i', inputName]);
  let duration = 600;
  const logStr = ffmpegInstance ? (ffmpegInstance as any).logHistory || '' : '';
  const durationMatch = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(logStr);
  if (durationMatch) {
    const hours = parseInt(durationMatch[1], 10);
    const mins = parseInt(durationMatch[2], 10);
    const secs = parseFloat(durationMatch[3]);
    duration = hours * 3600 + mins * 60 + secs;
  }

  const activeIntervals = getActiveIntervals(duration, options.segments, options.compileMode);
  if (activeIntervals.length === 0) {
    throw new Error("No portions selected to keep. Adjust your trim settings.");
  }

  const args: string[] = [];

  if (activeIntervals.length === 1) {
    const { start, end } = activeIntervals[0];
    args.push('-i', inputName, '-ss', start.toString(), '-to', end.toString());
  } else {
    args.push('-i', inputName);
    
    // Multi-segment audio trim concat
    const filterComplexParts: string[] = [];
    const concatInputs: string[] = [];

    activeIntervals.forEach((interval, idx) => {
      filterComplexParts.push(`[0:a]atrim=start=${interval.start}:end=${interval.end},asetpts=PTS-STARTPTS[a${idx}]`);
      concatInputs.push(`[a${idx}]`);
    });

    const concatFilter = `${concatInputs.join('')}concat=n=${activeIntervals.length}:v=0:a=1[outa]`;
    filterComplexParts.push(concatFilter);

    args.push('-filter_complex', filterComplexParts.join('; '), '-map', '[outa]');
  }

  // Set encoder based on format
  if (options.format === 'mp3') {
    args.push('-acodec', 'libmp3lame');
  } else if (options.format === 'ogg') {
    args.push('-acodec', 'libvorbis');
  } else if (options.format === 'm4a') {
    args.push('-acodec', 'aac');
  } else {
    // wav - uncompressed pcm
    args.push('-acodec', 'pcm_s16le');
  }

  if (options.format !== 'wav') {
    args.push('-ab', options.bitrate);
  }

  args.push(outputName);

  onLog(`Starting Audio FFmpeg: ffmpeg ${args.join(' ')}`);
  await ffmpeg.exec(args);

  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  let mimeType = 'audio/mpeg';
  if (options.format === 'wav') mimeType = 'audio/wav';
  if (options.format === 'ogg') mimeType = 'audio/ogg';
  if (options.format === 'm4a') mimeType = 'audio/x-m4a';

  const blob = new Blob([data as any], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
  const newName = `${originalNameWithoutExt}_optimized.${options.format}`;

  return {
    blob,
    url,
    name: newName,
    originalSize: file.size,
    newSize: blob.size
  };
};
