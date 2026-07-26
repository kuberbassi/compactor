import { fetchFile } from '@ffmpeg/util';
import type { TrimSegment } from '../../components/Common/TrimTimeline';
import { getFFmpeg } from './core';

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

export const getActiveIntervals = (
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
    } catch {
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
  } catch {
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
