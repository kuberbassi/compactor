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
}

export interface MetadataTags {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  comment?: string;
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
  
  const tags: MetadataTags = {};
  
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
  
  if (tags.year && tags.year.includes('T')) {
    tags.year = tags.year.split('T')[0];
  }

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
      args.push('-id3v2_version', '3', '-metadata:s:v', 'title=Album cover', '-metadata:s:v', 'comment=Cover (front)');
    }
  } else if (newCoverBlob === null && isAudio) {
    args.push('-map', '0:a', '-c', 'copy');
  } else {
    args.push('-map', '0', '-c', 'copy');
  }
  
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
