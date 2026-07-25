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
  duration?: number;  // Optional preloaded duration to skip metadata dry-run
  targetMaxMB?: number; // Strict platform size limit e.g. 9.5 for Discord, 15.5 for WhatsApp
}

export interface VideoCompressResult {
  blob: Blob;
  url: string;
  name: string;
  originalSize: number;
  newSize: number;
}

const mergeIntervals = (intervals: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> => {
  if (intervals.length <= 1) return intervals;
  
  const merged: Array<{ start: number; end: number }> = [];
  let current = { ...intervals[0] };
  
  for (let i = 1; i < intervals.length; i++) {
    const next = intervals[i];
    if (next.start <= current.end) {
      current.end = Math.max(current.end, next.end);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  return merged;
};

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
  
  const rawIntervals = segments
    .filter(seg => {
      const isKeep = seg.mode === 'keep';
      return compileMode === 'keep-selected' ? isKeep : !isKeep;
    })
    .map(seg => ({ start: seg.start, end: seg.end }))
    .sort((a, b) => a.start - b.start);

  return mergeIntervals(rawIntervals);
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

  // Determine Duration
  let duration = options.duration;
  if (duration === undefined || duration <= 0) {
    onLog("Reading video duration from stream metadata...");
    let accumulatedLogs = '';
    const tempLogListener = ({ message }: { message: string }) => {
      accumulatedLogs += message + '\n';
    };
    ffmpeg.on('log', tempLogListener);
    try {
      await ffmpeg.exec(['-i', inputName]);
    } catch (e) {
      // ffmpeg -i returns non-zero code, which is normal
    }
    ffmpeg.off('log', tempLogListener);

    const durationMatch = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(accumulatedLogs);
    if (durationMatch) {
      const hours = parseInt(durationMatch[1], 10);
      const mins = parseInt(durationMatch[2], 10);
      const secs = parseFloat(durationMatch[3]);
      duration = hours * 3600 + mins * 60 + secs;
      onLog(`Parsed video duration: ${duration.toFixed(2)}s`);
    } else {
      duration = 600; // Fallback
      onLog("Could not parse video duration, using default fallback (600s)");
    }
  } else {
    onLog(`Using pre-calculated video duration: ${duration.toFixed(2)}s`);
  }

  const activeIntervals = getActiveIntervals(duration, options.segments, options.compileMode);
  if (activeIntervals.length === 0) {
    throw new Error("No portions selected to keep. Adjust your trim settings.");
  }

  // Calculate source stream bitrate to prevent file size expansion
  const totalBitrateBps = duration > 0 ? (file.size * 8) / duration : 2000000;
  const audioBps = options.removeAudio ? 0 : 96000;
  const originalVideoBitrateKbps = Math.max(100, Math.round((totalBitrateBps - audioBps) / 1000));

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
  } else if (['mp3', 'aac', 'wav', 'm4a', 'flac', 'ogg'].includes(options.format)) {
    // Audio extraction mode (Video to Audio)
    args.push('-vn'); // Disable video stream
    if (options.format === 'mp3') {
      args.push('-acodec', 'libmp3lame', '-b:a', options.audioBitrate || '192k');
    } else if (options.format === 'aac' || options.format === 'm4a') {
      args.push('-acodec', 'aac', '-b:a', options.audioBitrate || '192k');
    } else if (options.format === 'wav') {
      args.push('-acodec', 'pcm_s16le');
    } else {
      args.push('-b:a', options.audioBitrate || '192k');
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

    // Standard codecs parameters & bitrate optimization
    if (options.frameRate) {
      args.push('-r', options.frameRate.toString());
    }

    // Determine target bitrate ratio based on quality profile
    let crfRatio = 0.55; // Balanced default (CRF ~28)
    if (options.crf <= 22) crfRatio = 0.80; // High Quality
    else if (options.crf >= 32) crfRatio = 0.35; // Eco Mode

    let targetBitrateKbps = Math.round(originalVideoBitrateKbps * crfRatio);

    if (options.videoBitrate) {
      const parsedBitrateKbps = parseInt(options.videoBitrate.replace('k', ''), 10);
      if (!isNaN(parsedBitrateKbps)) {
        targetBitrateKbps = Math.min(parsedBitrateKbps, Math.round(originalVideoBitrateKbps * 0.85));
      }
    }

    // Bound target bitrate between 150 Kbps and source bitrate
    targetBitrateKbps = Math.max(150, Math.min(targetBitrateKbps, Math.round(originalVideoBitrateKbps * 0.85)));

    onLog(`Smart Bitrate Configured: Original ~${originalVideoBitrateKbps} Kbps -> Target Max ~${targetBitrateKbps} Kbps.`);

    if (options.format === 'webm') {
      args.push(
        '-vcodec', 'libvpx-vp9',
        '-crf', options.crf.toString(),
        '-b:v', `${targetBitrateKbps}k`,
        '-maxrate', `${targetBitrateKbps}k`,
        '-bufsize', `${targetBitrateKbps * 2}k`
      );
    } else {
      // Standard H.264 MP4 / MOV / MKV / AVI
      args.push(
        '-vcodec', 'libx264',
        '-crf', options.crf.toString(),
        '-maxrate', `${targetBitrateKbps}k`,
        '-bufsize', `${targetBitrateKbps * 2}k`,
        '-preset', options.preset || 'fast',
        '-pix_fmt', 'yuv420p'
      );
      if (options.format === 'mp4') {
        args.push('-movflags', '+faststart');
      }
    }
    
    if (options.removeAudio) {
      args.push('-an');
    } else {
      args.push('-acodec', 'aac', '-b:a', options.audioBitrate || '96k');
    }
  }

  args.push(outputName);
  
  onLog(`Executing FFmpeg: ffmpeg ${args.join(' ')}`);
  await ffmpeg.exec(args);

  let data = await ffmpeg.readFile(outputName);
  const isAudio = ['mp3', 'aac', 'wav', 'm4a', 'flac', 'ogg'].includes(options.format);
  const mimeType = options.format === 'gif' 
    ? 'image/gif' 
    : isAudio 
      ? `audio/${options.format === 'mp3' ? 'mpeg' : options.format}` 
      : `video/${options.format}`;
  let blob = new Blob([data as any], { type: mimeType });

  // Safeguard against file inflation: If full video (no trim) was processed and output size is >= original size
  const totalIntervalDuration = activeIntervals.reduce((acc, curr) => acc + (curr.end - curr.start), 0);
  const isFullVideo = Math.abs(totalIntervalDuration - duration) < 1.0;
  if (isFullVideo && options.format !== 'gif' && blob.size >= file.size * 0.98) {
    onLog(`Notice: Compressed result (${(blob.size / 1024 / 1024).toFixed(2)} MB) exceeds target reduction threshold. Triggering strict bitrate fallback pass...`);

    const strictBitrateKbps = Math.max(100, Math.round(originalVideoBitrateKbps * 0.50));
    const fallbackArgs: string[] = ['-i', inputName];

    if (activeIntervals.length === 1) {
      const { start, end } = activeIntervals[0];
      fallbackArgs.push('-ss', start.toString(), '-to', end.toString());
    }
    if (options.scale && options.scale !== 'no-scale') {
      fallbackArgs.push('-vf', `scale=${options.scale}`);
    }
    fallbackArgs.push(
      '-vcodec', 'libx264',
      '-b:v', `${strictBitrateKbps}k`,
      '-maxrate', `${strictBitrateKbps}k`,
      '-bufsize', `${strictBitrateKbps * 2}k`,
      '-preset', 'fast',
      '-pix_fmt', 'yuv420p'
    );
    if (options.format === 'mp4') {
      fallbackArgs.push('-movflags', '+faststart');
    }
    if (options.removeAudio) {
      fallbackArgs.push('-an');
    } else {
      fallbackArgs.push('-acodec', 'aac', '-b:a', '96k');
    }
    fallbackArgs.push(outputName);

    onLog(`Executing Fallback FFmpeg: ffmpeg ${fallbackArgs.join(' ')}`);
    await ffmpeg.exec(fallbackArgs);

    data = await ffmpeg.readFile(outputName);
    blob = new Blob([data as any], { type: mimeType });
  }

  // Platform Target Size Enforcement (e.g. Discord ≤10MB, WhatsApp ≤16MB)
  if (options.targetMaxMB && options.format !== 'gif' && blob.size > options.targetMaxMB * 1024 * 1024) {
    const targetBytes = options.targetMaxMB * 1024 * 1024;
    onLog(`Platform limit target (${options.targetMaxMB} MB) exceeded (current: ${(blob.size / 1024 / 1024).toFixed(2)} MB). Executing strict size-clamping pass...`);

    const audioBytes = options.removeAudio ? 0 : Math.round((96000 * totalIntervalDuration) / 8);
    const availableVideoBytes = Math.max(100000, targetBytes - audioBytes);
    const targetVideoBps = Math.max(50000, Math.floor(((availableVideoBytes * 8) / totalIntervalDuration) * 0.93));
    const targetBitrateKbps = Math.floor(targetVideoBps / 1000);

    const clampArgs: string[] = ['-i', inputName];
    if (activeIntervals.length === 1) {
      const { start, end } = activeIntervals[0];
      clampArgs.push('-ss', start.toString(), '-to', end.toString());
    }
    if (options.scale && options.scale !== 'no-scale') {
      clampArgs.push('-vf', `scale=${options.scale}`);
    }
    clampArgs.push(
      '-vcodec', 'libx264',
      '-b:v', `${targetBitrateKbps}k`,
      '-maxrate', `${targetBitrateKbps}k`,
      '-bufsize', `${targetBitrateKbps * 2}k`,
      '-preset', 'fast',
      '-pix_fmt', 'yuv420p'
    );
    if (options.format === 'mp4') {
      clampArgs.push('-movflags', '+faststart');
    }
    if (options.removeAudio) {
      clampArgs.push('-an');
    } else {
      clampArgs.push('-acodec', 'aac', '-b:a', '96k');
    }
    clampArgs.push(outputName);

    onLog(`Executing Size Clamping Pass (${targetBitrateKbps} Kbps): ffmpeg ${clampArgs.join(' ')}`);
    await ffmpeg.exec(clampArgs);

    data = await ffmpeg.readFile(outputName);
    blob = new Blob([data as any], { type: mimeType });
  }

  // Rare Special Case: If after all compression passes the output is still >= original input file (and no trimming was requested)
  if (isFullVideo && options.format !== 'gif' && !options.targetMaxMB && blob.size >= file.size) {
    onLog("Special rare case: Video is already maximally compressed by source codec. Serving original file to prevent quality loss or size expansion.");
    blob = file;
  }

  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  
  const url = URL.createObjectURL(blob);
  const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
  const outExt = blob === file ? (file.name.split('.').pop() || options.format) : options.format;
  const newName = `${originalNameWithoutExt}_optimized.${outExt}`;

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
  duration?: number;  // Optional preloaded duration to skip metadata dry-run
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

  // Determine Duration
  let duration = options.duration;
  if (duration === undefined || duration <= 0) {
    onLog("Reading audio duration from stream metadata...");
    let accumulatedLogs = '';
    const tempLogListener = ({ message }: { message: string }) => {
      accumulatedLogs += message + '\n';
    };
    ffmpeg.on('log', tempLogListener);
    try {
      await ffmpeg.exec(['-i', inputName]);
    } catch (e) {
      // ffmpeg -i returns non-zero code, which is normal
    }
    ffmpeg.off('log', tempLogListener);

    const durationMatch = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(accumulatedLogs);
    if (durationMatch) {
      const hours = parseInt(durationMatch[1], 10);
      const mins = parseInt(durationMatch[2], 10);
      const secs = parseFloat(durationMatch[3]);
      duration = hours * 3600 + mins * 60 + secs;
      onLog(`Parsed audio duration: ${duration.toFixed(2)}s`);
    } else {
      duration = 600; // Fallback
      onLog("Could not parse audio duration, using default fallback (600s)");
    }
  } else {
    onLog(`Using pre-calculated audio duration: ${duration.toFixed(2)}s`);
  }

  const activeIntervals = getActiveIntervals(duration, options.segments, options.compileMode);
  if (activeIntervals.length === 0) {
    throw new Error("No portions selected to keep. Adjust your trim settings.");
  }

  const args: string[] = [];

  if (activeIntervals.length === 1) {
    const { start, end } = activeIntervals[0];
    const isTrimmed = start > 0.05 || (duration > 0 && Math.abs(end - duration) > 0.1);
    args.push('-i', inputName, '-vn');
    if (isTrimmed) {
      args.push('-ss', start.toString(), '-to', end.toString());
    }
  } else {
    args.push('-i', inputName, '-vn');
    
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
  } else if (options.format === 'flac') {
    args.push('-acodec', 'flac');
  } else {
    // wav - uncompressed pcm
    args.push('-acodec', 'pcm_s16le');
  }

  if (options.format !== 'wav' && options.format !== 'flac') {
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
  if (options.format === 'flac') mimeType = 'audio/flac';
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

/**
 * Remuxes a WebM video blob generated by native recorder to MP4 or other target formats
 */
export const remuxVideoBlob = async (
  webmBlob: Blob,
  fileName: string,
  targetFormat: string,
  onLog: (msg: string) => void,
  onProgress: (p: number) => void
): Promise<{ blob: Blob; url: string; name: string }> => {
  const ffmpeg = await getFFmpeg(onLog, onProgress);
  
  const inputName = 'input_native.webm';
  const outputName = `output_native.${targetFormat}`;
  
  await ffmpeg.writeFile(inputName, await fetchFile(webmBlob));
  
  // Build arguments: remux video stream (copy), and convert audio stream to aac (standard compatibility)
  const args = ['-i', inputName];
  
  if (targetFormat === 'mp4') {
    // Copy video and transcode audio to aac for max compatibility (Opus is unsupported in standard MP4 containers by some players)
    args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k');
  } else {
    // Standard copy for other formats (like mkv, mov, avi)
    args.push('-c', 'copy');
  }
  
  args.push(outputName);
  
  onLog(`Remuxing native WebM stream to ${targetFormat.toUpperCase()}: ffmpeg ${args.join(' ')}`);
  await ffmpeg.exec(args);
  
  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  
  let mimeType = `video/${targetFormat}`;
  if (targetFormat === 'mov') mimeType = 'video/quicktime';
  if (targetFormat === 'mkv') mimeType = 'video/x-matroska';
  
  const blob = new Blob([data as any], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const originalNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
  const newName = `${originalNameWithoutExt}_optimized.${targetFormat}`;
  
  return {
    blob,
    url,
    name: newName
  };
};

/**
 * Transcodes a video/audio file with strict quality preservation rules (no loss / best quality).
 * Attempts fast remuxing (copying streams) first, and falls back to visually lossless encoding.
 */
export const transcodeFormatLossless = async (
  file: File,
  targetFormat: string,
  onLog: (msg: string) => void,
  onProgress: (p: number) => void
): Promise<{ blob: Blob; url: string; name: string }> => {
  const ffmpeg = await getFFmpeg(onLog, onProgress);
  const inputExt = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const inputName = `input_transcode.${inputExt}`;
  const outputName = `output_transcode.${targetFormat}`;

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  // Try fast copy remux first (no quality loss, <1 second execution)
  let success = false;
  const copyArgs = ['-i', inputName];

  if (targetFormat === 'mp4') {
    // Copy video and transcode audio to aac (since standard mp4 doesn't support Opus/vorbis audio tracks natively)
    copyArgs.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k');
  } else if (targetFormat === 'mp3') {
    copyArgs.push('-vn', '-c:a', 'libmp3lame', '-q:a', '0'); // highest quality VBR mp3
  } else if (targetFormat === 'wav') {
    copyArgs.push('-vn', '-c:a', 'pcm_s16le'); // lossless WAV PCM
  } else {
    copyArgs.push('-c', 'copy');
  }
  copyArgs.push(outputName);

  try {
    onLog(`Attempting lossless copy-transcode to ${targetFormat.toUpperCase()}...`);
    await ffmpeg.exec(copyArgs);
    success = true;
  } catch (err) {
    onLog("Remux failed or container incompatible. Falling back to visually lossless re-encoding...");
  }

  if (!success) {
    // Lossless / highest quality fallback encoding arguments
    const fallbackArgs = ['-i', inputName];
    if (['mp4', 'mov', 'mkv', 'avi'].includes(targetFormat)) {
      fallbackArgs.push('-c:v', 'libx264', '-crf', '18', '-preset', 'fast', '-c:a', 'aac', '-b:a', '192k');
    } else if (targetFormat === 'webm') {
      fallbackArgs.push('-c:v', 'libvpx-vp9', '-crf', '20', '-b:v', '0', '-c:a', 'libopus');
    } else if (targetFormat === 'mp3') {
      fallbackArgs.push('-vn', '-c:a', 'libmp3lame', '-q:a', '0');
    } else if (targetFormat === 'wav') {
      fallbackArgs.push('-vn', '-c:a', 'pcm_s16le');
    } else if (targetFormat === 'aac') {
      fallbackArgs.push('-vn', '-c:a', 'aac', '-b:a', '256k');
    } else {
      // standard fallback
      fallbackArgs.push('-c', 'copy');
    }
    fallbackArgs.push(outputName);
    
    await ffmpeg.exec(fallbackArgs);
  }

  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  let mimeType = `video/${targetFormat}`;
  if (['mp3', 'wav', 'aac', 'ogg'].includes(targetFormat)) mimeType = `audio/${targetFormat}`;
  if (targetFormat === 'mov') mimeType = 'video/quicktime';
  if (targetFormat === 'mkv') mimeType = 'video/x-matroska';

  const blob = new Blob([data as any], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
  const newName = `${originalNameWithoutExt}_converted.${targetFormat}`;

  return { blob, url, name: newName };
};

export interface MetadataTags {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  comment?: string;
}

/**
 * Reads metadata tags and extracts album cover art from a media file
 */
export const readMediaMetadata = async (
  file: File,
  onLog: (msg: string) => void
): Promise<{ tags: MetadataTags; coverUrl: string | null; coverBlob: Blob | null }> => {
  const ffmpeg = await getFFmpeg(onLog);
  
  const inputExt = file.name.split('.').pop()?.toLowerCase() || 'mp3';
  const inputName = `input_meta.${inputExt}`;
  
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  
  // Dry run to collect logs containing metadata
  let accumulatedLogs = '';
  const logListener = ({ message }: { message: string }) => {
    accumulatedLogs += message + '\n';
  };
  
  ffmpeg.on('log', logListener);
  try {
    await ffmpeg.exec(['-i', inputName]);
  } catch (e) {
    // Normal dry run exit
  }
  ffmpeg.off('log', logListener);
  
  const tags: MetadataTags = {};
  
  // Parse common tags from FFmpeg output logs using regex
  // Standard format: "title           : My Title"
  const parseTag = (key: string): string | undefined => {
    const regex = new RegExp(`\\b${key}\\s*:\\s*(.+)`, 'i');
    const match = regex.exec(accumulatedLogs);
    return match ? match[1].trim() : undefined;
  };
  
  tags.title = parseTag('title');
  tags.artist = parseTag('artist') || parseTag('author') || parseTag('composer');
  tags.album = parseTag('album');
  tags.year = parseTag('date') || parseTag('year') || parseTag('creation_time');
  tags.genre = parseTag('genre');
  tags.comment = parseTag('comment') || parseTag('description');
  
  // Clean up year string if it contains timestamp like "2026-07-20T13:00:00Z"
  if (tags.year && tags.year.includes('T')) {
    tags.year = tags.year.split('T')[0];
  }

  // Attempt to extract album cover art (for audio files)
  let coverUrl: string | null = null;
  let coverBlob: Blob | null = null;
  
  const coverName = 'cover_extract.jpg';
  try {
    onLog("Checking for embedded cover art stream...");
    // Extract thumbnail/cover art from stream: copy raw mjpeg stream frames
    await ffmpeg.exec(['-i', inputName, '-an', '-vcodec', 'mjpeg', '-frames:v', '1', '-f', 'image2', coverName]);
    
    const coverData = await ffmpeg.readFile(coverName);
    coverBlob = new Blob([coverData as any], { type: 'image/jpeg' });
    coverUrl = URL.createObjectURL(coverBlob);
    onLog("Embedded cover art extracted successfully.");
    
    await ffmpeg.deleteFile(coverName);
  } catch (err) {
    onLog("No embedded cover art stream found or format unsupported.");
  }
  
  await ffmpeg.deleteFile(inputName);
  
  return { tags, coverUrl, coverBlob };
};

/**
 * Writes metadata tags and inserts/replaces cover art in a media file
 */
export const writeMediaMetadata = async (
  file: File,
  tags: MetadataTags,
  newCoverBlob: Blob | null,
  onLog: (msg: string) => void,
  onProgress: (p: number) => void
): Promise<{ blob: Blob; url: string; name: string }> => {
  const ffmpeg = await getFFmpeg(onLog, onProgress);
  
  const inputExt = file.name.split('.').pop()?.toLowerCase() || 'mp3';
  const inputName = `input_meta_write.${inputExt}`;
  const outputName = `output_meta_write.${inputExt}`;
  
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  
  const isAudio = file.type.startsWith('audio/') || ['.mp3', '.m4a', '.flac', '.wav', '.ogg', '.opus'].some(e => file.name.toLowerCase().endsWith(e));

  const args = ['-i', inputName];
  
  // Handle Cover Art injection for audio files
  let coverName = '';
  if (newCoverBlob && isAudio) {
    coverName = `new_cover_meta.jpg`;
    await ffmpeg.writeFile(coverName, await fetchFile(newCoverBlob));
    args.push('-i', coverName);
    args.push('-map', '0:a', '-map', '1:0', '-c', 'copy', '-disposition:v:0', 'attached_pic');
    if (inputExt === 'mp3') {
      args.push('-id3v2_version', '3', '-metadata:s:v', 'title=Album cover', '-metadata:s:v', 'comment=Cover (front)');
    }
  } else if (newCoverBlob === null && isAudio) {
    // Explicitly copy audio stream only to strip old cover art stream
    args.push('-map', '0:a', '-c', 'copy');
  } else {
    args.push('-map', '0', '-c', 'copy');
  }
  
  // Set or clear metadata fields
  const addMeta = (field: string, val?: string) => {
    if (val !== undefined) {
      args.push('-metadata', `${field}=${val}`);
    }
  };
  
  addMeta('title', tags.title);
  addMeta('artist', tags.artist);
  addMeta('album', tags.album);
  addMeta('date', tags.year);
  addMeta('genre', tags.genre);
  addMeta('comment', tags.comment);
  
  args.push('-y', outputName);
  
  onLog(`Writing metadata tags: ffmpeg ${args.join(' ')}`);
  await ffmpeg.exec(args);
  
  const data = await ffmpeg.readFile(outputName);
  
  // Cleanup virtual filesystem
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  if (newCoverBlob) {
    await ffmpeg.deleteFile(coverName);
  }
  
  const mimeType = file.type;
  const blob = new Blob([data as any], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
  const newName = `${originalNameWithoutExt}_tagged.${inputExt}`;
  
  return { blob, url, name: newName };
};

/**
 * Strips all metadata tags and embedded artwork from a media file for privacy protection
 */
export const stripMediaMetadata = async (
  file: File,
  onLog: (msg: string) => void,
  onProgress: (p: number) => void
): Promise<{ blob: Blob; url: string; name: string }> => {
  const ffmpeg = await getFFmpeg(onLog, onProgress);
  
  const inputExt = file.name.split('.').pop()?.toLowerCase() || 'mp3';
  const inputName = `input_meta_strip.${inputExt}`;
  const outputName = `output_meta_strip.${inputExt}`;
  
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  
  // -map_metadata -1 removes global and stream metadata tags
  const args = ['-i', inputName, '-map_metadata', '-1', '-c', 'copy', '-y', outputName];
  
  onLog(`Stripping all metadata tags: ffmpeg ${args.join(' ')}`);
  await ffmpeg.exec(args);
  
  const data = await ffmpeg.readFile(outputName);
  
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  
  const mimeType = file.type;
  const blob = new Blob([data as any], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
  const newName = `${originalNameWithoutExt}_clean.${inputExt}`;
  
  return { blob, url, name: newName };
};

export const terminateFFmpeg = async () => {
  if (ffmpegInstance) {
    const inst = ffmpegInstance;
    ffmpegInstance = null;
    isLoaded = false;
    logDelegate = null;
    progressDelegate = null;
    try {
      await inst.terminate();
    } catch (e) {
      // Intentionally suppress FFmpeg.terminate worker shutdown exception
    }
  }
};
