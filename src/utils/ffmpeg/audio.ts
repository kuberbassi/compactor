import { fetchFile } from '@ffmpeg/util';
import type { TrimSegment } from '../../components/Common/TrimTimeline';
import { getFFmpeg } from './core';
import { getActiveIntervals, type VideoCompressResult } from './video';

export interface AudioCompressOptions {
  bitrate: string;    // e.g. '64k', '128k', '192k', '256k'
  format: string;     // 'mp3' | 'wav' | 'ogg' | 'm4a'
  segments?: TrimSegment[];
  compileMode?: 'keep-selected' | 'cut-selected';
  duration?: number;  // Optional preloaded duration to skip metadata dry-run
  removeMetadata?: boolean;
  normalizeAudio?: boolean;
  fadeInDuration?: number;  // Fade-in duration in seconds
  fadeOutDuration?: number; // Fade-out duration in seconds
  channels?: 'original' | 'mono' | 'stereo';
  removeSilence?: boolean;
  noiseReduction?: boolean;
  bassBoost?: boolean;
}

export interface MetadataTags {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  comment?: string;
}

export const parseMediaTagsFromFFmpegLog = (log: string): MetadataTags => {
  const inputSection = log.match(/Input #0[\s\S]*?(?=Duration:|Stream #0:)/i)?.[0] || log;
  const metadataSection = inputSection.match(/Metadata:\s*([\s\S]*)/i)?.[1] || '';

  const parseTag = (keys: string[]): string | undefined => {
    for (const key of keys) {
      const match = metadataSection.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, 'im'));
      if (match) return match[1].trim();
    }
    return undefined;
  };

  const year = parseTag(['date', 'year', 'creation_time']);
  return {
    title: parseTag(['title']),
    artist: parseTag(['artist', 'author', 'composer']),
    album: parseTag(['album']),
    year: year?.includes('T') ? year.split('T')[0] : year,
    genre: parseTag(['genre']),
    comment: parseTag(['comment', 'description']),
  };
};

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

  const effectiveDuration = activeIntervals.reduce((acc, curr) => acc + (curr.end - curr.start), 0);
  const audioFilters: string[] = [];
  if (options.normalizeAudio) {
    audioFilters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
  }
  if (options.fadeInDuration && options.fadeInDuration > 0) {
    audioFilters.push(`afade=t=in:ss=0:d=${options.fadeInDuration}`);
  }
  if (options.fadeOutDuration && options.fadeOutDuration > 0 && effectiveDuration > options.fadeOutDuration) {
    const fadeStart = Math.max(0, effectiveDuration - options.fadeOutDuration);
    audioFilters.push(`afade=t=out:st=${fadeStart.toFixed(2)}:d=${options.fadeOutDuration}`);
  }
  if (options.removeSilence) {
    audioFilters.push('silenceremove=stop_periods=-1:stop_duration=0.8:stop_threshold=-40dB');
  }
  if (options.noiseReduction) {
    audioFilters.push('highpass=f=75,lowpass=f=12000');
  }
  if (options.bassBoost) {
    audioFilters.push('bass=g=5:f=110:w=0.6');
  }
  if (options.channels === 'mono') {
    audioFilters.push('aformat=channel_layouts=mono');
  } else if (options.channels === 'stereo') {
    audioFilters.push('aformat=channel_layouts=stereo');
  }

  const args: string[] = [];

  if (activeIntervals.length === 1) {
    const { start, end } = activeIntervals[0];
    const isTrimmed = start > 0.05 || (duration > 0 && Math.abs(end - duration) > 0.1);
    args.push('-i', inputName, '-vn');
    if (isTrimmed) {
      args.push('-ss', start.toString(), '-to', end.toString(), '-avoid_negative_ts', 'make_zero');
    }
    if (audioFilters.length > 0) {
      args.push('-af', audioFilters.join(','));
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

    if (audioFilters.length > 0) {
      const chained = `${concatInputs.join('')}concat=n=${activeIntervals.length}:v=0:a=1[c_out];[c_out]${audioFilters.join(',')}[outa]`;
      filterComplexParts.push(chained);
    } else {
      const concatFilter = `${concatInputs.join('')}concat=n=${activeIntervals.length}:v=0:a=1[outa]`;
      filterComplexParts.push(concatFilter);
    }

    args.push('-filter_complex', filterComplexParts.join('; '), '-map', '[outa]');
  }

  // Set encoder based on format
  if (options.format === 'mp3') {
    args.push('-acodec', 'libmp3lame', '-ar', '44100');
  } else if (options.format === 'ogg') {
    args.push('-acodec', 'libvorbis', '-ar', '44100');
  } else if (options.format === 'm4a') {
    args.push('-acodec', 'aac', '-ar', '44100');
  } else if (options.format === 'flac') {
    args.push('-acodec', 'flac');
  } else {
    // wav - uncompressed pcm
    args.push('-acodec', 'pcm_s16le', '-ar', '44100');
  }

  if (options.format !== 'wav' && options.format !== 'flac') {
    args.push('-ab', options.bitrate);
  }
  if (options.channels === 'mono') {
    args.push('-ac', '1');
  } else if (options.channels === 'stereo') {
    args.push('-ac', '2');
  }
  if (options.removeMetadata) args.push('-map_metadata', '-1');

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
  } catch {
    // Normal dry run exit
  }
  ffmpeg.off('log', logListener);
  
  const tags = parseMediaTagsFromFFmpegLog(accumulatedLogs);

  let coverUrl: string | null = null;
  let coverBlob: Blob | null = null;
  
  const coverName = 'cover_extract.jpg';
  try {
    onLog("Checking for embedded cover art stream...");
    await ffmpeg.exec(['-i', inputName, '-an', '-vcodec', 'mjpeg', '-frames:v', '1', '-f', 'image2', coverName]);
    
    const coverData = await ffmpeg.readFile(coverName);
    coverBlob = new Blob([coverData as any], { type: 'image/jpeg' });
    coverUrl = URL.createObjectURL(coverBlob);
    onLog("Embedded cover art extracted successfully.");
    
    await ffmpeg.deleteFile(coverName);
  } catch {
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
  
  let coverName = '';
  if (newCoverBlob && isAudio) {
    coverName = `new_cover_meta.jpg`;
    await ffmpeg.writeFile(coverName, await fetchFile(newCoverBlob));
    args.push('-i', coverName);
    args.push('-map', '0:a', '-map', '1:0', '-c', 'copy', '-disposition:v:0', 'attached_pic');
    if (inputExt === 'mp3') {
      args.push('-metadata:s:v', 'title=Album cover', '-metadata:s:v', 'comment=Cover (front)');
    }
  } else if (newCoverBlob === null && isAudio) {
    args.push('-map', '0:a', '-c', 'copy');
  } else {
    args.push('-map', '0', '-c', 'copy');
  }

  // The editor form is authoritative. Do not retain stale or duplicate source tags.
  args.push('-map_metadata', '-1');
  
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

  if (inputExt === 'mp3') {
    args.push('-id3v2_version', '3', '-write_id3v1', '1');
  }
  
  args.push('-y', outputName);
  
  onLog(`Writing metadata tags: ffmpeg ${args.join(' ')}`);
  await ffmpeg.exec(args);
  
  const data = await ffmpeg.readFile(outputName);
  
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
