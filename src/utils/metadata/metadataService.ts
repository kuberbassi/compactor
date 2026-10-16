import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg } from '../ffmpeg/core';
import type {
  MetadataReadResult,
  FriendlyMetadataValues,
  MetadataVerificationResult,
} from './types';
import {
  getCapabilitiesForFile,
  getMetadataFormatCategory,
  getFormatKey,
} from './types';
import { parseAllFFmpegTags, buildMediaTagEntries } from './parser';
import {
  readImageMetadata,
  writeJpegMetadata,
  stripJpegMetadata,
} from './imageMetadata';

let metadataJobSequence = 0;
const createJobName = (prefix: string, ext: string) => {
  metadataJobSequence += 1;
  return `${prefix}_${Date.now().toString(36)}_${metadataJobSequence}.${ext}`;
};

const safeDelete = async (ffmpeg: any, name: string) => {
  if (!name) return;
  await ffmpeg.deleteFile(name).catch(() => undefined);
};

/**
 * Universal client-side metadata reader for Audio, Video, and Image files.
 */
export const readAnyMetadata = async (
  file: File,
  onLog: (msg: string) => void = () => {}
): Promise<MetadataReadResult> => {
  const category = getMetadataFormatCategory(file);
  const capabilities = getCapabilitiesForFile(file.name);
  const containerFormat = getFormatKey(file.name);

  // If it's an image file handled by exifr
  if (category === 'image' && capabilities.readEngine === 'exifr') {
    onLog('Reading image metadata client-side via exifr...');
    const { entries, friendlyValues } = await readImageMetadata(file);
    return {
      formatCategory: 'image',
      containerFormat,
      entries,
      friendlyValues,
      coverUrl: null,
      coverBlob: null,
      capabilities,
      hasMetadata: entries.length > 0,
    };
  }

  // Audio / Video media probed via FFmpeg
  if (capabilities.readEngine === 'ffmpeg') {
    onLog('Initializing media container probe...');
    const ffmpeg = await getFFmpeg(onLog);
    const inputExt = containerFormat || 'mp3';
    const inputName = createJobName('meta_probe_in', inputExt);
    const coverName = createJobName('meta_cover_extract', 'jpg');

    let accumulatedLogs = '';
    const logListener = ({ message }: { message: string }) => {
      accumulatedLogs += message + '\n';
    };

    ffmpeg.on('log', logListener);

    try {
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      try {
        await ffmpeg.exec(['-i', inputName]);
      } catch {
        // -i exit code is non-zero when no output is specified; this is normal
      }

      const rawTags = parseAllFFmpegTags(accumulatedLogs);
      const { entries, friendlyValues } = buildMediaTagEntries(
        rawTags,
        containerFormat,
        capabilities.canWrite
      );

      let coverUrl: string | null = null;
      let coverBlob: Blob | null = null;

      // Extract cover art if audio format with potential artwork
      if (capabilities.canEditCoverArt) {
        try {
          onLog('Inspecting file for embedded album artwork...');
          const exitCode = await ffmpeg.exec([
            '-i',
            inputName,
            '-an',
            '-vcodec',
            'mjpeg',
            '-frames:v',
            '1',
            '-f',
            'image2',
            '-y',
            coverName,
          ]);
          if (exitCode === 0) {
            const data = await ffmpeg.readFile(coverName);
            if (data instanceof Uint8Array && data.byteLength > 0) {
              coverBlob = new Blob([data as BlobPart], { type: 'image/jpeg' });
              coverUrl = URL.createObjectURL(coverBlob);
              onLog('Cover art detected and loaded.');
            }
          }
        } catch {
          // No attached picture
        }
      }

      return {
        formatCategory: category,
        containerFormat,
        entries,
        friendlyValues,
        coverUrl,
        coverBlob,
        capabilities,
        hasMetadata: entries.length > 0,
        rawLog: accumulatedLogs,
      };
    } finally {
      ffmpeg.off('log', logListener);
      await safeDelete(ffmpeg, inputName);
      await safeDelete(ffmpeg, coverName);
    }
  }

  // Fallback for unsupported formats
  return {
    formatCategory: 'unsupported',
    containerFormat,
    entries: [],
    friendlyValues: {},
    coverUrl: null,
    coverBlob: null,
    capabilities,
    hasMetadata: false,
  };
};

/**
 * Universal client-side metadata writer.
 */
export const writeAnyMetadata = async (
  file: File,
  updates: FriendlyMetadataValues,
  newCoverBlob: Blob | null | undefined, // undefined = unchanged, null = remove, Blob = set
  onLog: (msg: string) => void = () => {},
  onProgress: (p: number) => void = () => {}
): Promise<{ blob: Blob; url: string; name: string }> => {
  const capabilities = getCapabilitiesForFile(file.name);
  if (!capabilities.canWrite) {
    throw new Error(
      `Writing metadata for ${file.name} is not supported client-side.`
    );
  }

  // JPEG via piexif
  if (capabilities.writeEngine === 'piexif') {
    onLog('Writing JPEG EXIF metadata losslessly...');
    return await writeJpegMetadata(file, updates);
  }

  // Audio / Video via FFmpeg
  if (capabilities.writeEngine === 'ffmpeg') {
    const ffmpeg = await getFFmpeg(onLog, onProgress);
    const containerFormat = getFormatKey(file.name);
    const inputName = createJobName('meta_write_in', containerFormat);
    const outputName = createJobName('meta_write_out', containerFormat);
    let coverName = '';

    try {
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      const args = ['-i', inputName];

      if (capabilities.canEditCoverArt && newCoverBlob instanceof Blob) {
        coverName = createJobName('meta_write_cover', 'jpg');
        await ffmpeg.writeFile(coverName, await fetchFile(newCoverBlob));
        args.push('-i', coverName);
        args.push(
          '-map',
          '0:a',
          '-map',
          '1:0',
          '-c',
          'copy',
          '-disposition:v:0',
          'attached_pic'
        );
        if (containerFormat === 'mp3') {
          args.push(
            '-metadata:s:v',
            'title=Album cover',
            '-metadata:s:v',
            'comment=Cover (front)'
          );
        }
      } else if (capabilities.canEditCoverArt && newCoverBlob === null) {
        // Strip attached cover stream while preserving audio
        args.push('-map', '0:a', '-c', 'copy');
      } else {
        // Keep all streams
        args.push('-map', '0', '-c', 'copy');
      }

      // Authoritative tag mapping
      const addMeta = (field: string, val?: string) => {
        if (val !== undefined) {
          args.push('-metadata', `${field}=${val}`);
          // Also set stream-level metadata for OGG/OPUS where container tags get discarded
          if (['ogg', 'opus'].includes(containerFormat)) {
            args.push(`-metadata:s:a:0`, `${field}=${val}`);
          }
        }
      };

      if (updates.title !== undefined) addMeta('title', updates.title);
      if (updates.artist !== undefined) {
        addMeta('artist', updates.artist);
        addMeta('author', updates.artist);
      }
      if (updates.album !== undefined) addMeta('album', updates.album);
      if (updates.year !== undefined) {
        addMeta('date', updates.year);
        addMeta('year', updates.year);
      }
      if (updates.genre !== undefined) addMeta('genre', updates.genre);
      if (updates.comment !== undefined) {
        addMeta('comment', updates.comment);
        addMeta('description', updates.comment);
      }
      if (updates.copyright !== undefined) addMeta('copyright', updates.copyright);
      if (updates.track !== undefined) addMeta('track', updates.track);

      if (containerFormat === 'mp3') {
        args.push('-id3v2_version', '3', '-write_id3v1', '1');
      }

      args.push('-y', outputName);

      onLog(`Writing metadata tags via FFmpeg stream copy...`);
      const exitCode = await ffmpeg.exec(args);
      if (exitCode !== 0) {
        throw new Error(`FFmpeg metadata write failed (exit code ${exitCode})`);
      }

      const data = await ffmpeg.readFile(outputName);
      if (!(data instanceof Uint8Array) || data.byteLength === 0) {
        throw new Error('Metadata update produced an empty output file.');
      }

      const blob = new Blob([data as any], { type: file.type });
      const url = URL.createObjectURL(blob);
      const originalNameWithoutExt = file.name.substring(
        0,
        file.name.lastIndexOf('.')
      );
      const newName = `${originalNameWithoutExt}_tagged.${containerFormat}`;

      return { blob, url, name: newName };
    } finally {
      await safeDelete(ffmpeg, inputName);
      await safeDelete(ffmpeg, outputName);
      if (coverName) await safeDelete(ffmpeg, coverName);
    }
  }

  throw new Error(`No metadata engine found for ${file.name}`);
};

/**
 * Universal metadata stripper with explicit format-verified removal scopes.
 */
export const stripAnyMetadata = async (
  file: File,
  onLog: (msg: string) => void = () => {},
  onProgress: (p: number) => void = () => {}
): Promise<{ blob: Blob; url: string; name: string }> => {
  const capabilities = getCapabilitiesForFile(file.name);
  if (!capabilities.canStrip) {
    throw new Error(
      `Metadata removal is not supported for ${file.name}.`
    );
  }

  // JPEG via piexif
  if (capabilities.writeEngine === 'piexif') {
    onLog('Losslessly stripping EXIF/GPS metadata from JPEG...');
    return await stripJpegMetadata(file);
  }

  // Audio / Video via FFmpeg
  if (capabilities.writeEngine === 'ffmpeg') {
    const ffmpeg = await getFFmpeg(onLog, onProgress);
    const containerFormat = getFormatKey(file.name);
    const inputName = createJobName('meta_strip_in', containerFormat);
    const outputName = createJobName('meta_strip_out', containerFormat);

    try {
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      const args = ['-i', inputName];

      if (capabilities.canEditCoverArt) {
        // Strip attached cover stream while preserving audio streams
        args.push('-map', '0:a');
      } else {
        // Keep streams without cover drops
        args.push('-map', '0');
      }

      // Strip global tags, stream tags, chapters, and bitexact flags
      args.push(
        '-map_metadata',
        '-1',
        '-map_metadata:s',
        '-1',
        '-map_chapters',
        '-1',
        '-fflags',
        '+bitexact',
        '-c',
        'copy',
        '-y',
        outputName
      );

      onLog(`Stripping all container & stream metadata tags...`);
      const exitCode = await ffmpeg.exec(args);
      if (exitCode !== 0) {
        throw new Error(`FFmpeg metadata strip failed (exit code ${exitCode})`);
      }

      const data = await ffmpeg.readFile(outputName);
      if (!(data instanceof Uint8Array) || data.byteLength === 0) {
        throw new Error('Metadata removal produced an empty file.');
      }

      const blob = new Blob([data as any], { type: file.type });
      const url = URL.createObjectURL(blob);
      const originalNameWithoutExt = file.name.substring(
        0,
        file.name.lastIndexOf('.')
      );
      const newName = `${originalNameWithoutExt}_clean.${containerFormat}`;

      return { blob, url, name: newName };
    } finally {
      await safeDelete(ffmpeg, inputName);
      await safeDelete(ffmpeg, outputName);
    }
  }

  throw new Error(`No metadata engine found for ${file.name}`);
};

/**
 * Re-reads the generated file to verify whether the requested metadata changes
 * were actually retained, dropped, or normalized by the container.
 */
export const verifySavedMetadata = async (
  savedFile: File,
  requestedTags: FriendlyMetadataValues
): Promise<MetadataVerificationResult> => {
  const readBack = await readAnyMetadata(savedFile);
  const retained: string[] = [];
  const dropped: string[] = [];
  const normalized: { id: string; requested: string; actual: string }[] = [];

  const checkField = (
    fieldId: string,
    reqVal: string | undefined,
    actualVal: string | undefined
  ) => {
    if (reqVal === undefined || reqVal.trim() === '') return;

    if (!actualVal || actualVal.trim() === '') {
      dropped.push(fieldId);
    } else if (actualVal.trim() === reqVal.trim()) {
      retained.push(fieldId);
    } else {
      // Value might have been normalized (e.g. date format or whitespace)
      normalized.push({
        id: fieldId,
        requested: reqVal.trim(),
        actual: actualVal.trim(),
      });
    }
  };

  checkField('title', requestedTags.title, readBack.friendlyValues.title);
  checkField('artist', requestedTags.artist, readBack.friendlyValues.artist);
  checkField('album', requestedTags.album, readBack.friendlyValues.album);
  checkField('year', requestedTags.year, readBack.friendlyValues.year);
  checkField('genre', requestedTags.genre, readBack.friendlyValues.genre);
  checkField('comment', requestedTags.comment, readBack.friendlyValues.comment);
  checkField('copyright', requestedTags.copyright, readBack.friendlyValues.copyright);
  checkField('track', requestedTags.track, readBack.friendlyValues.track);

  // Check image fields
  checkField(
    'imageDescription',
    requestedTags.imageDescription,
    readBack.friendlyValues.imageDescription
  );
  checkField('make', requestedTags.make, readBack.friendlyValues.make);
  checkField('model', requestedTags.model, readBack.friendlyValues.model);
  checkField('software', requestedTags.software, readBack.friendlyValues.software);
  checkField(
    'artistCreator',
    requestedTags.artistCreator,
    readBack.friendlyValues.artistCreator
  );
  checkField(
    'copyrightNotice',
    requestedTags.copyrightNotice,
    readBack.friendlyValues.copyrightNotice
  );

  return {
    verified: dropped.length === 0,
    persistedCount: retained.length,
    droppedCount: dropped.length,
    normalizedCount: normalized.length,
    details: {
      retained,
      dropped,
      normalized,
    },
  };
};
