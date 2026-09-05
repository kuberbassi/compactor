export const isGifFile = (candidate: Pick<File, 'name' | 'type'>) =>
  candidate.type.toLowerCase() === 'image/gif' || /\.gif$/i.test(candidate.name);

const MEBIBYTE = 1024 * 1024;

/** FFmpeg-WASM keeps input, decoded data, and output in browser memory. */
export const getBrowserVideoProcessingLimitBytes = (deviceMemoryGB?: number): number => {
  const memoryGB = Number.isFinite(deviceMemoryGB) ? Math.max(1, deviceMemoryGB as number) : 4;
  const limitMB = Math.min(768, Math.max(256, Math.floor(memoryGB * 128)));
  return limitMB * MEBIBYTE;
};
