export const SUPPORTED_SOURCE_FORMATS = [
  'pdf', 'docx', 'txt', 'md', 'csv', 'json',
  'png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg', 'avif',
  'mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg', 'opus', 'weba',
  'mp4', 'webm', 'mov', 'avi', 'mkv', 'flv',
] as const;

export const isSupportedSourceFormat = (extension: string): boolean =>
  (SUPPORTED_SOURCE_FORMATS as readonly string[]).includes(extension.toLowerCase());

/** Engine-backed conversion pairs. Do not add a target without an implementation and a validity test. */
export const getSupportedTargets = (extension: string): Set<string> => {
  const source = extension.toLowerCase();
  const targets = new Set<string>();

  if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg', 'avif'].includes(source)) {
    ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'ico', 'svg'].forEach(target => targets.add(target));
    if (['avif', 'svg'].includes(source)) targets.delete('svg');
    if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(source)) targets.add('pdf');
  } else if (source === 'pdf') {
    ['docx', 'txt'].forEach(target => targets.add(target));
  } else if (source === 'docx') {
    ['pdf', 'txt', 'html'].forEach(target => targets.add(target));
  } else if (['txt', 'md'].includes(source)) {
    ['pdf', 'docx', 'html'].forEach(target => targets.add(target));
  } else if (source === 'csv') {
    ['json', 'html', 'pdf'].forEach(target => targets.add(target));
  } else if (source === 'json') {
    ['csv', 'pdf'].forEach(target => targets.add(target));
  } else if (['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg', 'opus', 'weba', 'mp4', 'webm', 'mov', 'avi', 'mkv', 'flv'].includes(source)) {
    ['mp4', 'webm', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'aac'].forEach(target => targets.add(target));
  }

  if (targets.size > 1) targets.delete(source);
  return targets;
};
