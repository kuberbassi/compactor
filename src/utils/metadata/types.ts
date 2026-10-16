/**
 * Typed metadata models, capability contracts, and identifier definitions
 * for Compactor's format-aware browser-only metadata editor.
 */

export type MetadataFormatCategory = 'audio' | 'video' | 'image' | 'unsupported';

export type MetadataTagSource =
  | 'container'
  | 'stream'
  | 'id3'
  | 'vorbis'
  | 'quicktime'
  | 'matroska'
  | 'riff'
  | 'exif'
  | 'iptc'
  | 'xmp'
  | 'chunk';

export interface MetadataTagEntry {
  /** Stable identifier for lookup/diffing (e.g. 'title', 'exif:Make', 'stream:0:language') */
  id: string;
  /** Raw tag key extracted from container or metadata payload */
  rawKey: string;
  /** Human-readable display label (e.g. 'Track Title', 'Camera Make') */
  label: string;
  /** Normalized string value representation */
  value: string;
  /** Metadata source origin */
  source: MetadataTagSource;
  /** Stream index if tag is scoped to an audio/video/subtitle stream */
  streamIndex?: number;
  /** Stream codec/type descriptor if known (e.g. 'audio', 'video') */
  streamType?: string;
  /** Whether this tag can be modified in this format by browser-side writers */
  isEditable: boolean;
  /** Explanation if the tag is read-only */
  readOnlyReason?: string;
  /** Friendly category group (e.g. 'General', 'Origin & Hardware', 'Audio Stream #0') */
  group: string;
}

export interface FriendlyMetadataValues {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  comment?: string;
  copyright?: string;
  track?: string;
  // Image specific common fields
  imageDescription?: string;
  make?: string;
  model?: string;
  software?: string;
  dateTime?: string;
  artistCreator?: string;
  copyrightNotice?: string;
}

export interface FormatMetadataCapabilities {
  canRead: boolean;
  canWrite: boolean;
  canStrip: boolean;
  canEditCoverArt: boolean;
  readEngine: 'ffmpeg' | 'exifr' | 'none';
  writeEngine: 'ffmpeg' | 'piexif' | 'none';
  description: string;
  writeLimitations?: string;
  stripScope: string;
  editableTagIds: string[];
}

export interface MetadataVerificationResult {
  verified: boolean;
  persistedCount: number;
  droppedCount: number;
  normalizedCount: number;
  details: {
    retained: string[];
    dropped: string[];
    normalized: { id: string; requested: string; actual: string }[];
  };
}

export interface MetadataReadResult {
  formatCategory: MetadataFormatCategory;
  containerFormat: string;
  entries: MetadataTagEntry[];
  friendlyValues: FriendlyMetadataValues;
  coverUrl: string | null;
  coverBlob: Blob | null;
  capabilities: FormatMetadataCapabilities;
  hasMetadata: boolean;
  rawLog?: string;
}

export interface MetadataWriteOptions {
  tags: FriendlyMetadataValues;
  coverBlob?: Blob | null; // null = remove cover, undefined = leave untouched, Blob = new cover
}

export interface MetadataRemovalOptions {
  stripArtwork?: boolean;
}

/**
 * Format capability lookup registry.
 */
export const FORMAT_CAPABILITY_REGISTRY: Record<string, FormatMetadataCapabilities> = {
  // Audio Formats (via FFmpeg stream copy)
  mp3: {
    canRead: true,
    canWrite: true,
    canStrip: true,
    canEditCoverArt: true,
    readEngine: 'ffmpeg',
    writeEngine: 'ffmpeg',
    description: 'ID3v2.3 tags and embedded front cover art.',
    writeLimitations: 'Standard container & ID3 tags preserved without re-encoding audio.',
    stripScope: 'Clears all ID3v2/v1 tags, stream metadata, and attached picture streams.',
    editableTagIds: ['title', 'artist', 'album', 'year', 'genre', 'comment', 'copyright', 'track'],
  },
  m4a: {
    canRead: true,
    canWrite: true,
    canStrip: true,
    canEditCoverArt: true,
    readEngine: 'ffmpeg',
    writeEngine: 'ffmpeg',
    description: 'MP4/iTunes metadata tags and cover art.',
    writeLimitations: 'Preserves standard container atoms via stream copy.',
    stripScope: 'Clears container metadata atoms, stream tags, and attached cover stream.',
    editableTagIds: ['title', 'artist', 'album', 'year', 'genre', 'comment', 'copyright', 'track'],
  },
  flac: {
    canRead: true,
    canWrite: true,
    canStrip: true,
    canEditCoverArt: true,
    readEngine: 'ffmpeg',
    writeEngine: 'ffmpeg',
    description: 'FLAC Vorbis comments and embedded picture blocks.',
    writeLimitations: 'Preserves standard Vorbis tags via stream copy.',
    stripScope: 'Clears Vorbis comment block, stream tags, and picture blocks.',
    editableTagIds: ['title', 'artist', 'album', 'year', 'genre', 'comment', 'copyright', 'track'],
  },
  ogg: {
    canRead: true,
    canWrite: true,
    canStrip: true,
    canEditCoverArt: false,
    readEngine: 'ffmpeg',
    writeEngine: 'ffmpeg',
    description: 'Ogg Vorbis stream comments.',
    writeLimitations: 'Vorbis comments are written to the audio stream. Cover art embedding is not supported.',
    stripScope: 'Clears stream-level Vorbis comments.',
    editableTagIds: ['title', 'artist', 'album', 'year', 'genre', 'comment', 'copyright', 'track'],
  },
  opus: {
    canRead: true,
    canWrite: true,
    canStrip: true,
    canEditCoverArt: false,
    readEngine: 'ffmpeg',
    writeEngine: 'ffmpeg',
    description: 'Ogg Opus stream comments.',
    writeLimitations: 'Opus comments are written to the audio stream. Cover art embedding is not supported.',
    stripScope: 'Clears stream-level Opus comments.',
    editableTagIds: ['title', 'artist', 'album', 'year', 'genre', 'comment', 'copyright', 'track'],
  },
  wav: {
    canRead: true,
    canWrite: true,
    canStrip: true,
    canEditCoverArt: false,
    readEngine: 'ffmpeg',
    writeEngine: 'ffmpeg',
    description: 'RIFF INFO chunk tags.',
    writeLimitations: 'Writes standard RIFF INFO chunks (INAM, IART, ICRD, etc). Attached art is not supported.',
    stripScope: 'Clears RIFF INFO chunks.',
    editableTagIds: ['title', 'artist', 'album', 'year', 'genre', 'comment', 'copyright', 'track'],
  },

  // Video Formats (via FFmpeg stream copy)
  mp4: {
    canRead: true,
    canWrite: true,
    canStrip: true,
    canEditCoverArt: false,
    readEngine: 'ffmpeg',
    writeEngine: 'ffmpeg',
    description: 'MP4 container metadata.',
    writeLimitations: 'Updates container tags via stream copy without re-encoding video or audio streams.',
    stripScope: 'Clears container metadata, stream tags, location tags, and chapter information.',
    editableTagIds: ['title', 'artist', 'album', 'year', 'genre', 'comment', 'copyright', 'track'],
  },
  mov: {
    canRead: true,
    canWrite: true,
    canStrip: true,
    canEditCoverArt: false,
    readEngine: 'ffmpeg',
    writeEngine: 'ffmpeg',
    description: 'QuickTime MOV container metadata.',
    writeLimitations: 'Updates container tags via stream copy without re-encoding video tracks.',
    stripScope: 'Clears container metadata and stream tags.',
    editableTagIds: ['title', 'artist', 'album', 'year', 'genre', 'comment', 'copyright'],
  },
  mkv: {
    canRead: true,
    canWrite: true,
    canStrip: true,
    canEditCoverArt: false,
    readEngine: 'ffmpeg',
    writeEngine: 'ffmpeg',
    description: 'Matroska container tags.',
    writeLimitations: 'Preserves arbitrary Matroska tags via stream copy.',
    stripScope: 'Clears Matroska container tags, stream tags, and chapter names.',
    editableTagIds: ['title', 'artist', 'album', 'year', 'genre', 'comment', 'copyright', 'track'],
  },
  webm: {
    canRead: true,
    canWrite: true,
    canStrip: true,
    canEditCoverArt: false,
    readEngine: 'ffmpeg',
    writeEngine: 'ffmpeg',
    description: 'WebM container tags.',
    writeLimitations: 'Preserves WebM container tags via stream copy.',
    stripScope: 'Clears WebM container tags and stream tags.',
    editableTagIds: ['title', 'artist', 'album', 'year', 'genre', 'comment', 'copyright', 'track'],
  },
  avi: {
    canRead: true,
    canWrite: true,
    canStrip: true,
    canEditCoverArt: false,
    readEngine: 'ffmpeg',
    writeEngine: 'ffmpeg',
    description: 'AVI RIFF INFO metadata.',
    writeLimitations: 'Preserves RIFF tags via stream copy.',
    stripScope: 'Clears RIFF INFO chunks.',
    editableTagIds: ['title', 'artist', 'album', 'year', 'genre', 'comment', 'copyright', 'track'],
  },

  // Image Formats
  jpg: {
    canRead: true,
    canWrite: true,
    canStrip: true,
    canEditCoverArt: false,
    readEngine: 'exifr',
    writeEngine: 'piexif',
    description: 'JPEG EXIF, IPTC, and XMP metadata.',
    writeLimitations: 'EXIF 0th/Exif/GPS tags editable lossless in-browser without JPEG re-compression.',
    stripScope: 'Losslessly strips all APP1 EXIF, GPS location, and metadata segments without re-encoding pixels.',
    editableTagIds: ['imageDescription', 'make', 'model', 'software', 'artistCreator', 'copyrightNotice', 'dateTime'],
  },
  jpeg: {
    canRead: true,
    canWrite: true,
    canStrip: true,
    canEditCoverArt: false,
    readEngine: 'exifr',
    writeEngine: 'piexif',
    description: 'JPEG EXIF, IPTC, and XMP metadata.',
    writeLimitations: 'EXIF 0th/Exif/GPS tags editable lossless in-browser without JPEG re-compression.',
    stripScope: 'Losslessly strips all APP1 EXIF, GPS location, and metadata segments without re-encoding pixels.',
    editableTagIds: ['imageDescription', 'make', 'model', 'software', 'artistCreator', 'copyrightNotice', 'dateTime'],
  },
  png: {
    canRead: true,
    canWrite: false,
    canStrip: false,
    canEditCoverArt: false,
    readEngine: 'exifr',
    writeEngine: 'none',
    description: 'PNG text chunks, EXIF, and ICC profile.',
    writeLimitations: 'PNG metadata modification is not safely supported client-side without re-encoding. Discovered chunks are displayed read-only.',
    stripScope: 'PNG chunk editing is not supported client-side.',
    editableTagIds: [],
  },
  webp: {
    canRead: true,
    canWrite: false,
    canStrip: false,
    canEditCoverArt: false,
    readEngine: 'exifr',
    writeEngine: 'none',
    description: 'WebP EXIF and XMP chunks.',
    writeLimitations: 'WebP metadata writing is not safely supported client-side. Discovered tags are displayed read-only.',
    stripScope: 'WebP chunk editing is not supported client-side.',
    editableTagIds: [],
  },
  gif: {
    canRead: true,
    canWrite: false,
    canStrip: false,
    canEditCoverArt: false,
    readEngine: 'exifr',
    writeEngine: 'none',
    description: 'GIF comment and metadata blocks.',
    writeLimitations: 'GIF metadata writing is not supported client-side. Discovered tags are displayed read-only.',
    stripScope: 'GIF metadata editing is not supported client-side.',
    editableTagIds: [],
  },
  avif: {
    canRead: true,
    canWrite: false,
    canStrip: false,
    canEditCoverArt: false,
    readEngine: 'exifr',
    writeEngine: 'none',
    description: 'AVIF EXIF and XMP boxes.',
    writeLimitations: 'AVIF metadata writing is not supported client-side. Discovered tags are displayed read-only.',
    stripScope: 'AVIF metadata editing is not supported client-side.',
    editableTagIds: [],
  },
  heic: {
    canRead: true,
    canWrite: false,
    canStrip: false,
    canEditCoverArt: false,
    readEngine: 'exifr',
    writeEngine: 'none',
    description: 'HEIC/HEIF EXIF and XMP boxes.',
    writeLimitations: 'HEIC metadata writing is not supported client-side. Discovered tags are displayed read-only.',
    stripScope: 'HEIC metadata editing is not supported client-side.',
    editableTagIds: [],
  },
  tiff: {
    canRead: true,
    canWrite: false,
    canStrip: false,
    canEditCoverArt: false,
    readEngine: 'exifr',
    writeEngine: 'none',
    description: 'TIFF tags.',
    writeLimitations: 'TIFF metadata writing is not supported client-side. Discovered tags are displayed read-only.',
    stripScope: 'TIFF metadata editing is not supported client-side.',
    editableTagIds: [],
  },
};

/**
 * Normalizes file extension to format key.
 */
export const getFormatKey = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'jpeg') return 'jpg';
  return ext;
};

/**
 * Returns capability info for a given file or format extension.
 */
export const getCapabilitiesForFile = (filename: string): FormatMetadataCapabilities => {
  const key = getFormatKey(filename);
  if (FORMAT_CAPABILITY_REGISTRY[key]) {
    return FORMAT_CAPABILITY_REGISTRY[key];
  }
  // Fallback for unknown extensions
  return {
    canRead: false,
    canWrite: false,
    canStrip: false,
    canEditCoverArt: false,
    readEngine: 'none',
    writeEngine: 'none',
    description: 'Unsupported file format for client-side metadata operations.',
    writeLimitations: 'This format cannot be inspected or edited client-side.',
    stripScope: 'None',
    editableTagIds: [],
  };
};

/**
 * Determines file category from filename and MIME type.
 */
export const getMetadataFormatCategory = (file: File): MetadataFormatCategory => {
  const mime = file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (
    mime.startsWith('audio/') ||
    ['mp3', 'm4a', 'flac', 'wav', 'ogg', 'opus', 'aac', 'wma', 'alac', 'aiff'].includes(ext)
  ) {
    return 'audio';
  }
  if (
    mime.startsWith('video/') ||
    ['mp4', 'mkv', 'mov', 'webm', 'avi', 'wmv', 'flv', 'm4v', '3gp'].includes(ext)
  ) {
    return 'video';
  }
  if (
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic', 'heif', 'tiff', 'tif', 'bmp'].includes(ext)
  ) {
    return 'image';
  }
  return 'unsupported';
};

