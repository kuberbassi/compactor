export const SUPPORTED_SOURCE_FORMATS = [
  'pdf', 'docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls', 'txt', 'md', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml', 'rtf', 'html',
  'png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg', 'avif', 'ico', 'tiff', 'tif', 'tga',
  'mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg', 'opus', 'weba', 'wma', 'aiff', 'aif', 'alac', 'mka', 'ac3', 'dts', 'amr',
  'mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'vob', 'mpeg', 'mpg', 'ts', 'm2ts', 'wmv', 'asf', 'ogv', '3gp', '3g2', 'm4v', 'f4v',
] as const;

export const isSupportedSourceFormat = (extension: string): boolean =>
  (SUPPORTED_SOURCE_FORMATS as readonly string[]).includes(extension.toLowerCase());

/** Engine-backed conversion pairs. */
export const getSupportedTargets = (extension: string): Set<string> => {
  const source = extension.toLowerCase();
  const targets = new Set<string>();

  const VIDEO_SOURCES = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'vob', 'mpeg', 'mpg', 'ts', 'm2ts', 'wmv', 'asf', 'ogv', '3gp', '3g2', 'm4v', 'f4v'];
  const AUDIO_SOURCES = ['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg', 'opus', 'weba', 'wma', 'aiff', 'aif', 'alac', 'mka', 'ac3', 'dts', 'amr'];

  if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg', 'avif', 'ico', 'tiff', 'tif', 'tga'].includes(source)) {
    ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'ico', 'svg'].forEach(target => targets.add(target));
    if (['avif', 'svg'].includes(source)) targets.delete('svg');
    if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif'].includes(source)) targets.add('pdf');
  } else if (source === 'pdf') {
    ['docx', 'txt'].forEach(target => targets.add(target));
  } else if (['docx', 'doc'].includes(source)) {
    ['pdf', 'txt', 'html'].forEach(target => targets.add(target));
  } else if (['xlsx', 'xls'].includes(source)) {
    ['pdf', 'html', 'json', 'csv'].forEach(target => targets.add(target));
  } else if (['pptx', 'ppt'].includes(source)) {
    ['pdf', 'txt'].forEach(target => targets.add(target));
  } else if (['txt', 'md', 'rtf', 'html'].includes(source)) {
    ['pdf', 'docx', 'html', 'txt'].forEach(target => targets.add(target));
  } else if (['csv', 'tsv'].includes(source)) {
    ['json', 'html', 'pdf'].forEach(target => targets.add(target));
  } else if (['json', 'xml', 'yaml', 'yml'].includes(source)) {
    ['csv', 'pdf', 'json', 'txt'].forEach(target => targets.add(target));
  } else if (VIDEO_SOURCES.includes(source)) {
    // Video → all video containers + audio extraction
    ['mp4', 'webm', 'mov', 'mkv', 'avi', 'flv', 'mpeg', 'mpg', 'ts', 'm2ts', 'wmv', 'ogv', '3gp', 'm4v', 'gif',
     'mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg', 'opus', 'weba', 'wma', 'aiff', 'alac', 'ac3'].forEach(target => targets.add(target));
  } else if (AUDIO_SOURCES.includes(source)) {
    // Audio → audio codecs only (no video synthesis)
    ['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg', 'opus', 'weba', 'wma', 'aiff', 'alac', 'ac3'].forEach(target => targets.add(target));
  }

  if (targets.size > 1) targets.delete(source);
  return targets;
};

export const getFileExtension = (file: Pick<File, 'name'>): string =>
  file.name.split('.').pop()?.toLowerCase() || '';

const MIME_FORMAT_LABELS: Record<string, string> = {
  'audio/mpeg': 'MP3',
  'audio/mp4': 'M4A',
  'audio/x-m4a': 'M4A',
  'video/quicktime': 'MOV',
  'video/x-matroska': 'MKV',
  'image/jpeg': 'JPG',
};

/** User-facing format label. Extensions are more specific than MIME families. */
export const getFileFormatLabel = (file: Pick<File, 'name' | 'type'>): string => {
  const extension = getFileExtension(file);
  if (extension && extension !== file.name.toLowerCase()) return extension.toUpperCase();

  const mime = file.type.toLowerCase();
  return MIME_FORMAT_LABELS[mime] || mime.split('/')[1]?.replace(/^x-/, '').toUpperCase() || 'MEDIA';
};

export const getCommonSupportedTargets = (files: Array<Pick<File, 'name'>>): Set<string> => {
  if (files.length === 0) return new Set();
  const [first, ...rest] = files;
  const common = getSupportedTargets(getFileExtension(first));
  rest.forEach(file => {
    const targets = getSupportedTargets(getFileExtension(file));
    Array.from(common).forEach(target => {
      if (!targets.has(target)) common.delete(target);
    });
  });
  return common;
};
