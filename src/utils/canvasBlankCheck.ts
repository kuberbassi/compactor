/**
 * Checks if a rendered canvas is essentially a blank white page.
 * Conservatively checks for visible ink after compositing transparency onto white.
 * The low default tolerance avoids deleting pages that contain a small page number,
 * faint scan, signature, rule, or other sparse but intentional content.
 */
export const isCanvasBlank = (
  canvas: HTMLCanvasElement,
  thresholdPercent: number = 0.02
): boolean => {
  const { width, height } = canvas;
  if (width === 0 || height === 0) return true;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false; // An unreadable page is not evidence of a blank page.

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = width * height;
  let nonWhitePixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 15) continue;
    const alpha = a / 255;
    const compositedR = 255 - (255 - r) * alpha;
    const compositedG = 255 - (255 - g) * alpha;
    const compositedB = 255 - (255 - b) * alpha;
    if (compositedR < 247 || compositedG < 247 || compositedB < 247) {
      nonWhitePixels++;
    }
  }

  const nonWhiteRatio = (nonWhitePixels / totalPixels) * 100;
  return nonWhiteRatio < thresholdPercent;
};
