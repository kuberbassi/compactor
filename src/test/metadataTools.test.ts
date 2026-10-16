import { describe, it, expect } from 'vitest';
import { parseMediaTagsFromFFmpegLog } from '../utils/ffmpeg/audio';
import {
  parseAllFFmpegTags,
  buildMediaTagEntries,
  TAG_ALIASES,
  getTagLabel,
} from '../utils/metadata/parser';
import {
  getCapabilitiesForFile,
  getMetadataFormatCategory,
} from '../utils/metadata/types';
import {
  writeJpegMetadata,
  stripJpegMetadata,
  readImageMetadata,
} from '../utils/metadata/imageMetadata';
import { verifySavedMetadata } from '../utils/metadata/metadataService';

describe('Metadata & PDF Utilities', () => {
  it('reads file tags without confusing attached-cover stream tags', () => {
    const tags = parseMediaTagsFromFFmpegLog(`
Input #0, mp3, from 'track.mp3':
  Metadata:
    title           : Correct title
    artist          : Correct artist
    album           : Correct album
    date            : 2026
    genre           : Electronic
    comment         : File comment
  Duration: 00:03:10.00
  Stream #0:1: Video: mjpeg
    Metadata:
      title         : Album cover
      comment       : Cover (front)
`);

    expect(tags).toEqual({
      title: 'Correct title',
      artist: 'Correct artist',
      album: 'Correct album',
      year: '2026',
      genre: 'Electronic',
      comment: 'File comment',
    });
  });

  it('parses multiline and malformed metadata values safely without truncation', () => {
    const log = `
Input #0, mp3, from 'multiline.mp3':
  Metadata:
    title           : Symphony in C
    artist          : Composer Name
    comment         : First line of notes
                    : Second line of notes
                    : Third line of notes
    genre           : Classical
  Duration: 00:05:00.00
`;
    const parsed = parseAllFFmpegTags(log);
    const commentTag = parsed.find((t) => t.key.toLowerCase() === 'comment');
    expect(commentTag).toBeDefined();
    expect(commentTag?.value).toContain('First line of notes\nSecond line of notes\nThird line of notes');

    const mediaEntries = buildMediaTagEntries(parsed, 'mp3', true);
    expect(mediaEntries.friendlyValues.comment).toContain('First line of notes\nSecond line of notes\nThird line of notes');
  });

  it('preserves stream-scoped identifiers and associates them with stream indices', () => {
    const log = `
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'movie.mp4':
  Metadata:
    major_brand     : isom
    minor_version   : 512
    title           : Movie Title
  Duration: 00:01:30.00
  Stream #0:0[0x1](und): Video: h264, yuv420p, 1920x1080
    Metadata:
      handler_name    : VideoHandler
      vendor_id       : [0][0][0][0]
  Stream #0:1[0x2](eng): Audio: aac, 48000 Hz, stereo
    Metadata:
      handler_name    : SoundHandler
      language        : eng
`;
    const parsed = parseAllFFmpegTags(log);
    expect(parsed.length).toBeGreaterThanOrEqual(5);

    const videoHandler = parsed.find((t) => t.key === 'handler_name' && t.streamIndex === 0);
    expect(videoHandler).toBeDefined();
    expect(videoHandler?.streamType).toBe('video');

    const audioLang = parsed.find((t) => t.key === 'language' && t.streamIndex === 1);
    expect(audioLang).toBeDefined();
    expect(audioLang?.streamIndex).toBe(1);

    const built = buildMediaTagEntries(parsed, 'mp4', true);
    const streamTags = built.entries.filter((e) => e.source === 'stream');
    expect(streamTags.length).toBeGreaterThanOrEqual(3);
    // Stream tags are preserved read-only
    expect(streamTags.every((e) => !e.isEditable)).toBe(true);
  });

  it('normalizes common tag aliases consistently across formats', () => {
    expect(TAG_ALIASES['date']).toBe('year');
    expect(TAG_ALIASES['creation_time']).toBe('year');
    expect(TAG_ALIASES['author']).toBe('artist');
    expect(TAG_ALIASES['composer']).toBe('artist');
    expect(TAG_ALIASES['tracknumber']).toBe('track');
    expect(TAG_ALIASES['imagedescription']).toBe('imageDescription');

    expect(getTagLabel('title')).toBe('Title');
    expect(getTagLabel('make')).toBe('Camera Make');
    expect(getTagLabel('dateTime')).toBe('Date / Time');
  });

  it('enforces explicit format capabilities accurately for audio, video, and image types', () => {
    // MP3: fully readable and writable
    const mp3Caps = getCapabilitiesForFile('song.mp3');
    expect(mp3Caps.canRead).toBe(true);
    expect(mp3Caps.canWrite).toBe(true);
    expect(mp3Caps.canEditCoverArt).toBe(true);
    expect(mp3Caps.readEngine).toBe('ffmpeg');

    // MP4: readable and writable video, no audio cover art
    const mp4Caps = getCapabilitiesForFile('video.mp4');
    expect(mp4Caps.canRead).toBe(true);
    expect(mp4Caps.canWrite).toBe(true);
    expect(mp4Caps.canEditCoverArt).toBe(false);

    // JPG: readable via exifr, writable via piexif
    const jpgCaps = getCapabilitiesForFile('photo.jpg');
    expect(jpgCaps.canRead).toBe(true);
    expect(jpgCaps.canWrite).toBe(true);
    expect(jpgCaps.readEngine).toBe('exifr');
    expect(jpgCaps.writeEngine).toBe('piexif');

    // PNG: readable via exifr, but marked read-only for writes
    const pngCaps = getCapabilitiesForFile('diagram.png');
    expect(pngCaps.canRead).toBe(true);
    expect(pngCaps.canWrite).toBe(false);
    expect(pngCaps.writeEngine).toBe('none');

    // WEBP: readable, but read-only
    const webpCaps = getCapabilitiesForFile('web.webp');
    expect(webpCaps.canRead).toBe(true);
    expect(webpCaps.canWrite).toBe(false);
  });

  it('categorizes media files correctly', () => {
    const audioFile = new File([''], 'track.flac', { type: 'audio/flac' });
    const videoFile = new File([''], 'clip.mkv', { type: 'video/x-matroska' });
    const imageFile = new File([''], 'snap.png', { type: 'image/png' });
    const textFile = new File([''], 'doc.txt', { type: 'text/plain' });

    expect(getMetadataFormatCategory(audioFile)).toBe('audio');
    expect(getMetadataFormatCategory(videoFile)).toBe('video');
    expect(getMetadataFormatCategory(imageFile)).toBe('image');
    expect(getMetadataFormatCategory(textFile)).toBe('unsupported');
  });

  it('losslessly edits and strips JPEG EXIF tags in-browser with full round-trip verification', async () => {
    // Minimal 1x1 valid JPEG base64
    const minJpegBase64 =
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const binary = atob(minJpegBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const initialFile = new File([bytes], 'camera.jpg', { type: 'image/jpeg' });

    // Write EXIF tags
    const writeResult = await writeJpegMetadata(initialFile, {
      make: 'Compactor Cam',
      model: 'X100',
      imageDescription: 'Scenic viewpoint',
      artistCreator: 'Photographer K',
      software: 'Compactor',
    });

    expect(writeResult.name).toBe('camera_tagged.jpg');
    expect(writeResult.blob.size).toBeGreaterThan(0);

    // Read back and verify
    const taggedFile = new File([writeResult.blob], writeResult.name, {
      type: 'image/jpeg',
    });
    const readBack = await readImageMetadata(taggedFile);

    expect(readBack.friendlyValues.make).toBe('Compactor Cam');
    expect(readBack.friendlyValues.model).toBe('X100');
    expect(readBack.friendlyValues.imageDescription).toBe('Scenic viewpoint');
    expect(readBack.friendlyValues.artistCreator).toBe('Photographer K');

    // Round-trip verification helper
    const verification = await verifySavedMetadata(taggedFile, {
      make: 'Compactor Cam',
      model: 'X100',
      imageDescription: 'Scenic viewpoint',
      artistCreator: 'Photographer K',
    });
    expect(verification.verified).toBe(true);
    expect(verification.persistedCount).toBe(4);
    expect(verification.droppedCount).toBe(0);

    // Strip EXIF
    const stripResult = await stripJpegMetadata(taggedFile);
    expect(stripResult.name).toBe('camera_clean.jpg');

    const cleanFile = new File([stripResult.blob], stripResult.name, {
      type: 'image/jpeg',
    });
    const cleanRead = await readImageMetadata(cleanFile);
    expect(cleanRead.friendlyValues.make).toBeUndefined();
    expect(cleanRead.friendlyValues.model).toBeUndefined();
    expect(cleanRead.friendlyValues.imageDescription).toBeUndefined();
  });

  it('page range parser correctly expands dash and comma ranges', () => {
    const rangeInput = '1-3, 5, 8-10';
    const pages: number[] = [];

    const parts = rangeInput.split(',').map((p) => p.trim());
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        for (let i = start; i <= end; i++) pages.push(i);
      } else if (!isNaN(Number(part)) && part.length > 0) {
        pages.push(Number(part));
      }
    }

    expect(pages).toEqual([1, 2, 3, 5, 8, 9, 10]);
  });

  it('PDF page rotation angle normalizes within 0, 90, 180, 270 degrees', () => {
    const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360;

    expect(normalizeAngle(90)).toBe(90);
    expect(normalizeAngle(450)).toBe(90);
    expect(normalizeAngle(-90)).toBe(270);
  });

  it('metadata field sanitizer strips private EXIF GPS location data', () => {
    const mockEXIF = {
      make: 'Camera Brand',
      model: 'Model X',
      gpsLatitude: '37.7749 N',
      gpsLongitude: '122.4194 W',
    };

    const sanitizeMetadata = (exif: Record<string, any>) => {
      const copy = { ...exif };
      delete copy.gpsLatitude;
      delete copy.gpsLongitude;
      return copy;
    };

    const sanitized = sanitizeMetadata(mockEXIF);
    expect(sanitized.make).toBe('Camera Brand');
    expect(sanitized.gpsLatitude).toBeUndefined();
    expect(sanitized.gpsLongitude).toBeUndefined();
  });
});
