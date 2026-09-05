/**
 * Checks if a rendered canvas is essentially a blank white page.
 * Samples RGB channels: pixels with R>240, G>240, B>240 are considered "white/blank".
 */
export const isCanvasBlank = (
  canvas: HTMLCanvasElement,
  thresholdPercent: number = 0.5 // Default: < 0.5% non-white pixels = blank
): boolean => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return true;

  const { width, height } = canvas;
  if (width === 0 || height === 0) return true;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = width * height;
  let nonWhitePixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Transparent or pure/near-white is considered blank
    if (a < 15) continue;
    if (r < 240 || g < 240 || b < 240) {
      nonWhitePixels++;
    }
  }

  const nonWhiteRatio = (nonWhitePixels / totalPixels) * 100;
  return nonWhiteRatio < thresholdPercent;
};
