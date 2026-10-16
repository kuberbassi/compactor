import exifr from 'exifr';
import piexif from 'piexifjs';
import type {
  MetadataTagEntry,
  FriendlyMetadataValues,
  MetadataTagSource,
} from './types';
import { getTagLabel } from './parser';

/**
 * Reads metadata from image files (JPEG, PNG, WebP, AVIF, HEIC, TIFF, GIF)
 * using client-side exifr.
 */
export const readImageMetadata = async (
  file: File
): Promise<{ entries: MetadataTagEntry[]; friendlyValues: FriendlyMetadataValues }> => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isJpeg = ext === 'jpg' || ext === 'jpeg' || file.type === 'image/jpeg';

  const buffer = await file.arrayBuffer();

  let parsed: Record<string, any> | undefined;
  try {
    parsed = await exifr.parse(buffer, {
      tiff: true,
      xmp: true,
      icc: true,
      iptc: true,
      jfif: true,
      exif: true,
      gps: true,
      mergeOutput: false,
    });
  } catch {
    // Fallback with simpler parse
    try {
      parsed = await exifr.parse(buffer, true);
    } catch {
      parsed = undefined;
    }
  }

  const entries: MetadataTagEntry[] = [];
  const friendlyValues: FriendlyMetadataValues = {};

  if (!parsed || Object.keys(parsed).length === 0) {
    return { entries, friendlyValues };
  }

  // Iterate over segments or properties
  const processDict = (dict: Record<string, any>, source: MetadataTagSource, groupName: string) => {
    for (const [key, val] of Object.entries(dict)) {
      if (val === undefined || val === null) continue;

      let stringVal = '';
      if (typeof val === 'object') {
        if (val instanceof Date) {
          stringVal = val.toISOString();
        } else if (Array.isArray(val)) {
          stringVal = val.join(', ');
        } else if (val instanceof Uint8Array) {
          stringVal = `[Binary Data: ${val.byteLength} bytes]`;
        } else {
          try {
            stringVal = JSON.stringify(val);
          } catch {
            stringVal = String(val);
          }
        }
      } else {
        stringVal = String(val);
      }

      if (!stringVal.trim()) continue;

      const id = `${source}:${key}`;
      const label = getTagLabel(key);

      // In Compactor, only JPEG EXIF 0th/Exif/GPS tags are editable client-side.
      // Other image formats (PNG, WebP, etc.) or complex chunks are marked read-only.
      const isEditable = isJpeg && [
        'ImageDescription',
        'Make',
        'Model',
        'Software',
        'DateTime',
        'Artist',
        'Copyright',
      ].includes(key);

      const readOnlyReason = !isEditable
        ? (isJpeg
            ? 'Camera / technical EXIF tag preserved read-only'
            : `${ext.toUpperCase()} format metadata is read-only client-side`)
        : undefined;

      entries.push({
        id,
        rawKey: key,
        label,
        value: stringVal,
        source,
        isEditable,
        readOnlyReason,
        group: groupName,
      });

      // Populate friendly values
      const lower = key.toLowerCase();
      if (lower === 'imagedescription' && !friendlyValues.imageDescription) {
        friendlyValues.imageDescription = stringVal;
      }
      if (lower === 'make' && !friendlyValues.make) {
        friendlyValues.make = stringVal;
      }
      if (lower === 'model' && !friendlyValues.model) {
        friendlyValues.model = stringVal;
      }
      if (lower === 'software' && !friendlyValues.software) {
        friendlyValues.software = stringVal;
      }
      if ((lower === 'datetime' || lower === 'modifydate' || lower === 'createdate') && !friendlyValues.dateTime) {
        friendlyValues.dateTime = stringVal;
      }
      if ((lower === 'artist' || lower === 'by-line') && !friendlyValues.artistCreator) {
        friendlyValues.artistCreator = stringVal;
      }
      if ((lower === 'copyright' || lower === 'copyrightnotice') && !friendlyValues.copyrightNotice) {
        friendlyValues.copyrightNotice = stringVal;
      }
    }
  };

  // If exifr returned segment dictionaries
  if (parsed.ifd0 || parsed.exif || parsed.gps || parsed.iptc || parsed.xmp || parsed.jfif) {
    if (parsed.jfif) processDict(parsed.jfif, 'chunk', 'JFIF HEADER');
    if (parsed.ifd0) processDict(parsed.ifd0, 'exif', 'EXIF CAMERA & IMAGE');
    if (parsed.exif) processDict(parsed.exif, 'exif', 'EXIF SHOOTING DETAILS');
    if (parsed.gps) processDict(parsed.gps, 'exif', 'GPS LOCATION DATA');
    if (parsed.iptc) processDict(parsed.iptc, 'iptc', 'IPTC METADATA');
    if (parsed.xmp) processDict(parsed.xmp, 'xmp', 'XMP METADATA');
  } else {
    // Flat dictionary
    processDict(parsed, 'exif', 'IMAGE METADATA');
  }

  return { entries, friendlyValues };
};

/**
 * Writes updated metadata to a JPEG file using piexifjs without re-compressing pixels.
 */
export const writeJpegMetadata = async (
  file: File,
  updates: FriendlyMetadataValues
): Promise<{ blob: Blob; url: string; name: string }> => {
  const arrayBuffer = await file.arrayBuffer();
  const binaryString = bufferToBinaryString(new Uint8Array(arrayBuffer));

  let exifObj: any;
  try {
    exifObj = piexif.load(binaryString);
  } catch {
    exifObj = { '0th': {}, 'Exif': {}, 'GPS': {}, 'Interop': {}, '1st': {}, 'thumbnail': null };
  }

  if (!exifObj['0th']) exifObj['0th'] = {};
  if (!exifObj['Exif']) exifObj['Exif'] = {};

  if (updates.imageDescription !== undefined) {
    if (updates.imageDescription.trim() === '') {
      delete exifObj['0th'][piexif.ImageIFD.ImageDescription];
    } else {
      exifObj['0th'][piexif.ImageIFD.ImageDescription] = updates.imageDescription;
    }
  }

  if (updates.make !== undefined) {
    if (updates.make.trim() === '') {
      delete exifObj['0th'][piexif.ImageIFD.Make];
    } else {
      exifObj['0th'][piexif.ImageIFD.Make] = updates.make;
    }
  }

  if (updates.model !== undefined) {
    if (updates.model.trim() === '') {
      delete exifObj['0th'][piexif.ImageIFD.Model];
    } else {
      exifObj['0th'][piexif.ImageIFD.Model] = updates.model;
    }
  }

  if (updates.software !== undefined) {
    if (updates.software.trim() === '') {
      delete exifObj['0th'][piexif.ImageIFD.Software];
    } else {
      exifObj['0th'][piexif.ImageIFD.Software] = updates.software;
    }
  }

  if (updates.artistCreator !== undefined) {
    if (updates.artistCreator.trim() === '') {
      delete exifObj['0th'][piexif.ImageIFD.Artist];
    } else {
      exifObj['0th'][piexif.ImageIFD.Artist] = updates.artistCreator;
    }
  }

  if (updates.copyrightNotice !== undefined) {
    if (updates.copyrightNotice.trim() === '') {
      delete exifObj['0th'][piexif.ImageIFD.Copyright];
    } else {
      exifObj['0th'][piexif.ImageIFD.Copyright] = updates.copyrightNotice;
    }
  }

  if (updates.dateTime !== undefined) {
    if (updates.dateTime.trim() === '') {
      delete exifObj['0th'][piexif.ImageIFD.DateTime];
    } else {
      // Format as "YYYY:MM:DD HH:MM:SS" if ISO date or format string
      const dateVal = formatExifDate(updates.dateTime);
      exifObj['0th'][piexif.ImageIFD.DateTime] = dateVal;
    }
  }

  const exifBytes = piexif.dump(exifObj);
  const updatedBinary = piexif.insert(exifBytes, binaryString);
  const updatedBuffer = binaryStringToBuffer(updatedBinary);

  const blob = new Blob([updatedBuffer as unknown as BlobPart], { type: 'image/jpeg' });
  const url = URL.createObjectURL(blob);
  const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
  const newName = `${originalNameWithoutExt}_tagged.jpg`;

  return { blob, url, name: newName };
};

/**
 * Strips all EXIF, GPS, and metadata APP segments from a JPEG file losslessly.
 */
export const stripJpegMetadata = async (
  file: File
): Promise<{ blob: Blob; url: string; name: string }> => {
  const arrayBuffer = await file.arrayBuffer();
  const binaryString = bufferToBinaryString(new Uint8Array(arrayBuffer));

  const strippedBinary = piexif.remove(binaryString);
  const strippedBuffer = binaryStringToBuffer(strippedBinary);

  const blob = new Blob([strippedBuffer as unknown as BlobPart], { type: 'image/jpeg' });
  const url = URL.createObjectURL(blob);
  const originalNameWithoutExt = file.name
    .substring(0, file.name.lastIndexOf('.'))
    .replace(/_tagged$/, '');
  const newName = `${originalNameWithoutExt}_clean.jpg`;

  return { blob, url, name: newName };
};

const bufferToBinaryString = (buffer: Uint8Array): string => {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return binary;
};

const binaryStringToBuffer = (str: string): Uint8Array => {
  const len = str.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
};

const formatExifDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const year = d.getFullYear();
      const month = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const hours = pad(d.getHours());
      const minutes = pad(d.getMinutes());
      const seconds = pad(d.getSeconds());
      return `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`;
    }
  } catch {
    // Fallback to original
  }
  return dateStr;
};
