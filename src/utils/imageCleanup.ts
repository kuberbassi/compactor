import { loadImage } from "./image";
import type { ImageProcessResult } from "./image";
import { renderClassicHalftone } from "./posterEngine";

export interface ScanEnhanceOptions {
  mode: "none" | "smart-contrast" | "crisp-bw" | "halftone" | "deskew" | "remove-bg-white" | "remove-bg-transparent";
  tolerance?: number; // 0-100 for background removal
  halftoneDotSize?: number;
  halftoneInvert?: boolean;
}

/**
 * Calculates skew angle of text/document using projection variance across candidate angles.
 */
export const calculateSkewAngle = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  maxAngle: number = 10
): number => {
  const sampleW = 200;
  const sampleH = Math.round((height / width) * 200);
  const smallCanvas = document.createElement("canvas");
  smallCanvas.width = sampleW;
  smallCanvas.height = sampleH;
  const sCtx = smallCanvas.getContext("2d", { willReadFrequently: true });
  if (!sCtx) return 0;

  sCtx.drawImage(ctx.canvas, 0, 0, sampleW, sampleH);
  const imgData = sCtx.getImageData(0, 0, sampleW, sampleH);
  const data = imgData.data;

  // Convert to grayscale binary
  const binary = new Uint8Array(sampleW * sampleH);
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    binary[i / 4] = lum < 160 ? 1 : 0;
  }

  let bestAngle = 0;
  let maxVariance = -1;

  for (let a = -maxAngle; a <= maxAngle; a += 0.5) {
    const rad = (a * Math.PI) / 180;
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);

    const proj = new Float64Array(sampleH);
    const midX = sampleW / 2;
    const midY = sampleH / 2;

    for (let y = 0; y < sampleH; y++) {
      for (let x = 0; x < sampleW; x++) {
        if (binary[y * sampleW + x] === 1) {
          const rotY = Math.round((x - midX) * sin + (y - midY) * cos + midY);
          if (rotY >= 0 && rotY < sampleH) {
            proj[rotY]++;
          }
        }
      }
    }

    // Compute variance of projection profile
    let sum = 0;
    for (let i = 0; i < sampleH; i++) sum += proj[i];
    const mean = sum / sampleH;
    let variance = 0;
    for (let i = 0; i < sampleH; i++) {
      const diff = proj[i] - mean;
      variance += diff * diff;
    }

    if (variance > maxVariance) {
      maxVariance = variance;
      bestAngle = a;
    }
  }

  return bestAngle;
};

/**
 * Enhances, deskews, or removes background from a document scan image.
 */
export const enhanceScanImage = async (
  file: File,
  options: ScanEnhanceOptions
): Promise<ImageProcessResult> => {
  const img = await loadImage(file);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not create 2D canvas context");

  ctx.drawImage(img, 0, 0);

  if (options.mode === "deskew") {
    const angle = calculateSkewAngle(ctx, w, h);
    if (Math.abs(angle) > 0.3) {
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate((-angle * Math.PI) / 180);
      ctx.drawImage(img, -w / 2, -h / 2);
      ctx.restore();
    }
  } else if (options.mode === "smart-contrast") {
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (lum > 140) {
        const factor = (lum - 140) / 115;
        d[i] = Math.min(255, d[i] + (255 - d[i]) * factor * 1.4);
        d[i + 1] = Math.min(255, d[i + 1] + (255 - d[i + 1]) * factor * 1.4);
        d[i + 2] = Math.min(255, d[i + 2] + (255 - d[i + 2]) * factor * 1.4);
      } else {
        const factor = (140 - lum) / 140;
        d[i] = Math.max(0, d[i] - d[i] * factor * 0.45);
        d[i + 1] = Math.max(0, d[i + 1] - d[i + 1] * factor * 0.45);
        d[i + 2] = Math.max(0, d[i + 2] - d[i + 2] * factor * 0.45);
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } else if (options.mode === "crisp-bw") {
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    let sumLum = 0;
    const totalPixels = w * h;
    for (let i = 0; i < d.length; i += 4) {
      sumLum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    }
    const avgLum = sumLum / totalPixels;
    const threshold = Math.min(200, Math.max(90, avgLum * 0.88));

    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const val = lum < threshold ? 0 : 255;
      d[i] = val;
      d[i + 1] = val;
      d[i + 2] = val;
    }
    ctx.putImageData(imgData, 0, 0);
  } else if (options.mode === "halftone") {
    const dotSize = options.halftoneDotSize || 10;
    const invert = options.halftoneInvert || false;
    renderClassicHalftone(ctx, w, h, dotSize, 0, 0, invert);
  }

  const mimeType = file.type || "image/jpeg";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), mimeType, 0.92);
  });

  const ext = mimeType.split("/")[1] || "png";
  const baseName = file.name.substring(0, file.name.lastIndexOf("."));
  const url = URL.createObjectURL(blob);

  return {
    blob,
    url,
    name: `${baseName}_enhanced.${ext}`,
    originalSize: file.size,
    newSize: blob.size,
    width: w,
    height: h,
  };
};
