import type {
  MetadataTagEntry,
  FriendlyMetadataValues,
  MetadataTagSource,
} from './types';

/**
 * Normalizes alias keys (e.g. date -> year, author -> artist)
 */
export const TAG_ALIASES: Record<string, string> = {
  date: 'year',
  creation_time: 'year',
  year: 'year',
  author: 'artist',
  composer: 'artist',
  artist: 'artist',
  album_artist: 'album_artist',
  title: 'title',
  song: 'title',
  track_name: 'title',
  album: 'album',
  genre: 'genre',
  comment: 'comment',
  description: 'comment',
  copyright: 'copyright',
  track: 'track',
  tracknumber: 'track',
  // Common EXIF aliases
  imagedescription: 'imageDescription',
  make: 'make',
  model: 'model',
  software: 'software',
  datetime: 'dateTime',
  modifydate: 'dateTime',
  createdate: 'dateTime',
  artistcreator: 'artistCreator',
  by_line: 'artistCreator',
  copyrightnotice: 'copyrightNotice',
};

/**
 * Human-friendly labels for tag keys
 */
export const TAG_LABELS: Record<string, string> = {
  title: 'Title',
  artist: 'Artist / Author',
  album_artist: 'Album Artist',
  album: 'Album',
  year: 'Release Date / Year',
  genre: 'Genre',
  comment: 'Comment / Notes',
  description: 'Description',
  copyright: 'Copyright',
  track: 'Track Number',
  encoder: 'Encoder / Software',
  major_brand: 'Container Format (Brand)',
  minor_version: 'Minor Version',
  compatible_brands: 'Compatible Brands',
  handler_name: 'Stream Handler',
  vendor_id: 'Vendor ID',
  duration: 'Duration',
  location: 'GPS Location Coordinates',
  language: 'Stream Language',
  // Image labels
  imageDescription: 'Image Description',
  make: 'Camera Make',
  model: 'Camera Model',
  software: 'Editing Software',
  dateTime: 'Date / Time',
  artistCreator: 'Artist / Photographer',
  copyrightNotice: 'Copyright Notice',
  lensModel: 'Lens Model',
  focalLength: 'Focal Length',
  exposureTime: 'Exposure Time',
  fNumber: 'Aperture (F-Stop)',
  iso: 'ISO Sensitivity',
  gpsLatitude: 'GPS Latitude',
  gpsLongitude: 'GPS Longitude',
  gpsAltitude: 'GPS Altitude',
  latitude: 'GPS Latitude',
  longitude: 'GPS Longitude',
  colorSpace: 'Color Space',
  orientation: 'Orientation',
  JFIFVersion: 'JFIF Format Version',
  ResolutionUnit: 'Resolution Unit',
  XResolution: 'Horizontal Resolution',
  YResolution: 'Vertical Resolution',
  ThumbnailWidth: 'Embedded Thumbnail Width',
  ThumbnailHeight: 'Embedded Thumbnail Height',
  ExifImageWidth: 'EXIF Image Width',
  ExifImageHeight: 'EXIF Image Height',
  DateTimeOriginal: 'Original Capture Date',
  CreateDate: 'Creation Date',
  ModifyDate: 'Modified Date',
};

/**
 * Helper to safely sanitize a string key so it can be used in Regex or lookups
 */
export const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Returns human-friendly label for any raw or normalized tag identifier.
 */
export const getTagLabel = (key: string): string => {
  const normalizedKey = TAG_ALIASES[key.toLowerCase()] || key;
  if (TAG_LABELS[normalizedKey]) return TAG_LABELS[normalizedKey];
  if (TAG_LABELS[key]) return TAG_LABELS[key];

  // Beautify camelCase, PascalCase with acronyms (e.g. JFIFVersion -> JFIF Version), or snake_case
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
};

export interface RawParsedTag {
  key: string;
  value: string;
  streamIndex?: number;
  streamType?: string;
  isStreamLevel?: boolean;
}

/**
 * Robustly parses FFmpeg input log banner to extract all global and stream-level metadata tags.
 * Preserves raw identifiers, handles multiline values safely without catastrophic backtracking,
 * and maintains stream indexes.
 */
export const parseAllFFmpegTags = (log: string): RawParsedTag[] => {
  const results: RawParsedTag[] = [];

  // Match Input #0 block until Output #0, Stream mapping, or end of log
  const inputMatch = log.match(/Input #0[\s\S]*?(?=(?:Output #0|Stream mapping:|$))/i);
  const inputSection = inputMatch ? inputMatch[0] : log;

  // Split into lines for safe, streaming line-by-line parsing
  const lines = inputSection.split(/\r?\n/);

  let currentContext: 'none' | 'container' | 'stream' | 'chapters' = 'none';
  let currentStreamIndex: number | undefined = undefined;
  let currentStreamType: string | undefined = undefined;
  let currentTag: RawParsedTag | null = null;

  const commitCurrentTag = () => {
    if (currentTag && currentTag.key && currentTag.value !== undefined) {
      // Trim and clean trailing carriage returns
      currentTag.value = currentTag.value.trim();
      results.push({ ...currentTag });
      currentTag = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for Stream header e.g. "  Stream #0:0[0x1](und): Video: h264..."
    const streamHeaderMatch = line.match(/^\s*Stream #0:(\d+)(?:\[0x[0-9a-fA-F]+\])?(?:\([^)]*\))?:\s*([A-Za-z]+)/);
    if (streamHeaderMatch) {
      commitCurrentTag();
      currentContext = 'stream';
      currentStreamIndex = parseInt(streamHeaderMatch[1], 10);
      currentStreamType = streamHeaderMatch[2].toLowerCase();
      continue;
    }

    // Check for Chapters header
    if (/^\s*Chapters:/i.test(line) || /^\s*Chapter #0:/i.test(line)) {
      commitCurrentTag();
      currentContext = 'chapters';
      continue;
    }

    // Check for Metadata: section header
    if (/^\s*Metadata:\s*$/i.test(line)) {
      commitCurrentTag();
      // If we haven't hit a Stream header, this is container metadata
      if (currentContext !== 'stream' && currentContext !== 'chapters') {
        currentContext = 'container';
      }
      continue;
    }

    // Check for other top-level headers that end container metadata (e.g. Duration:, Program, etc)
    if (/^\s*(?:Duration:|Program\b|At least one output)/i.test(line)) {
      commitCurrentTag();
      if (currentContext === 'container') {
        currentContext = 'none';
      }
      continue;
    }

    // If we are inside container or stream metadata:
    if (currentContext === 'container' || currentContext === 'stream') {
      // Check for tag line e.g. "    title           : My Track Name"
      const tagMatch = line.match(/^\s{4,8}([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
      if (tagMatch) {
        commitCurrentTag();
        const key = tagMatch[1].trim();
        const value = tagMatch[2];
        currentTag = {
          key,
          value,
          streamIndex: currentContext === 'stream' ? currentStreamIndex : undefined,
          streamType: currentContext === 'stream' ? currentStreamType : undefined,
          isStreamLevel: currentContext === 'stream',
        };
        continue;
      }

      // Check for continuation of multiline value: "                    : Line two" or indented line
      if (currentTag) {
        const continuationMatch = line.match(/^\s{10,24}:\s*(.*)$/);
        if (continuationMatch) {
          currentTag.value += '\n' + continuationMatch[1];
          continue;
        } else if (/^\s{6,}/.test(line) && !line.includes(':')) {
          currentTag.value += '\n' + line.trim();
          continue;
        } else {
          // Some other line ends current tag
          commitCurrentTag();
        }
      }
    }
  }

  commitCurrentTag();
  return results;
};

/**
 * Builds rich, typed metadata entries and extracts friendly fields from raw parsed tags.
 */
export const buildMediaTagEntries = (
  rawTags: RawParsedTag[],
  containerFormat: string,
  isEditableContainer: boolean
): { entries: MetadataTagEntry[]; friendlyValues: FriendlyMetadataValues } => {
  const entries: MetadataTagEntry[] = [];
  const friendly: FriendlyMetadataValues = {};

  const sourceForFormat = (fmt: string): MetadataTagSource => {
    switch (fmt) {
      case 'mp3':
        return 'id3';
      case 'ogg':
      case 'opus':
      case 'flac':
        return 'vorbis';
      case 'mp4':
      case 'm4a':
      case 'mov':
        return 'quicktime';
      case 'mkv':
      case 'webm':
        return 'matroska';
      case 'wav':
      case 'avi':
        return 'riff';
      default:
        return 'container';
    }
  };

  const defaultSource = sourceForFormat(containerFormat);

  for (const tag of rawTags) {
    const isStream = tag.isStreamLevel;
    const streamIdx = tag.streamIndex;
    const streamType = tag.streamType;
    const lowerKey = tag.key.toLowerCase();

    const id = isStream
      ? `stream:${streamIdx}:${tag.key}`
      : (TAG_ALIASES[lowerKey] || tag.key);

    const label = isStream
      ? `${getTagLabel(tag.key)} (${streamType || 'Stream'} #${streamIdx})`
      : getTagLabel(tag.key);

    const group = isStream
      ? `${(streamType || 'Stream').toUpperCase()} STREAM #${streamIdx}`
      : 'CONTAINER METADATA';

    // In Compactor, friendly global container fields are editable for supported containers.
    // Stream-scoped tags (like handler_name or individual stream titles in multi-stream files) are preserved read-only
    // unless mapped directly.
    const isEditable = !isStream && isEditableContainer && [
      'title', 'artist', 'album', 'year', 'genre', 'comment', 'copyright', 'track'
    ].includes(TAG_ALIASES[lowerKey] || lowerKey);

    const readOnlyReason = !isEditable
      ? (isStream ? 'Stream-scoped attribute preserved read-only' : 'Container-preserved tag')
      : undefined;

    entries.push({
      id,
      rawKey: tag.key,
      label,
      value: tag.value,
      source: isStream ? 'stream' : defaultSource,
      streamIndex: streamIdx,
      streamType,
      isEditable,
      readOnlyReason,
      group,
    });

    // Populate friendly values from global container tags first
    if (!isStream) {
      const alias = TAG_ALIASES[lowerKey] || lowerKey;
      if (alias === 'title' && !friendly.title) friendly.title = tag.value;
      if (alias === 'artist' && !friendly.artist) friendly.artist = tag.value;
      if (alias === 'album' && !friendly.album) friendly.album = tag.value;
      if (alias === 'genre' && !friendly.genre) friendly.genre = tag.value;
      if (alias === 'comment' && !friendly.comment) friendly.comment = tag.value;
      if (alias === 'copyright' && !friendly.copyright) friendly.copyright = tag.value;
      if (alias === 'track' && !friendly.track) friendly.track = tag.value;
      if (alias === 'year' && !friendly.year) {
        // Normalize ISO dates e.g. 2026-10-10T12:00:00 -> 2026-10-10 or 2026
        friendly.year = tag.value.includes('T') ? tag.value.split('T')[0] : tag.value;
      }
    } else {
      // Fallback for OGG/OPUS where FFmpeg stores vorbis comments at the stream level
      if (['ogg', 'opus'].includes(containerFormat)) {
        const alias = TAG_ALIASES[lowerKey] || lowerKey;
        if (alias === 'title' && !friendly.title) friendly.title = tag.value;
        if (alias === 'artist' && !friendly.artist) friendly.artist = tag.value;
        if (alias === 'album' && !friendly.album) friendly.album = tag.value;
        if (alias === 'genre' && !friendly.genre) friendly.genre = tag.value;
        if (alias === 'comment' && !friendly.comment) friendly.comment = tag.value;
        if (alias === 'year' && !friendly.year) friendly.year = tag.value;
      }
    }
  }

  return { entries, friendlyValues: friendly };
};
