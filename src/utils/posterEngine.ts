import { PDFDocument, rgb } from 'pdf-lib';

export interface PageSizeDefinition {
  width: number; // PDF points
  height: number; // PDF points
  label: string;
  mmW: number;
  mmH: number;
}

export const PAGE_SIZES: Record<string, PageSizeDefinition> = {
  A4: { width: 595.28, height: 841.89, label: 'A4 (210 × 297 mm)', mmW: 210, mmH: 297 },
  A3: { width: 841.89, height: 1190.55, label: 'A3 (297 × 420 mm)', mmW: 297, mmH: 420 },
  A2: { width: 1190.55, height: 1683.78, label: 'A2 (420 × 594 mm)', mmW: 420, mmH: 594 },
  Letter: { width: 612.00, height: 792.00, label: 'Letter (8.5 × 11 in)', mmW: 215.9, mmH: 279.4 },
  Legal: { width: 612.00, height: 1008.00, label: 'Legal (8.5 × 14 in)', mmW: 215.9, mmH: 355.6 },
  Tabloid: { width: 792.00, height: 1224.00, label: 'Tabloid (11 × 17 in)', mmW: 279.4, mmH: 431.8 }
};

export const HALFTONE_CELL_SIZE = 14;

export const HALFTONE_SAMPLE_POINTS = [
  [0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75],
] as const;

export interface PosterPlanConfig {
  imageWidth: number;
  imageHeight: number;
  pageSize: keyof typeof PAGE_SIZES;
  orientation: 'Portrait' | 'Landscape';
  columns: number;
  rows: number;
  styleMode: 'color' | 'bw' | 'halftone';
  showCropMarks: boolean;
  showSheetNumbers?: boolean;
  rotation?: number; // 0, 90, 180, 270
  flipH?: boolean;
  flipV?: boolean;
  dotSize?: number;
  invertHalftone?: boolean;
  maxSheetsCap?: number;
}

export interface PosterPlan {
  columns: number;
  rows: number;
  totalPages: number;
  pagePdfWidth: number;
  pagePdfHeight: number;
  tileWidthPx: number;
  tileHeightPx: number;
  masterWidthPx: number;
  masterHeightPx: number;
  drawX: number;
  drawY: number;
  drawW: number;
  drawH: number;
  scaleX: number;
  scaleY: number;
  totalMMW: number;
  totalMMH: number;
}

export function createTransformedImageCanvas(
  sourceImage: HTMLImageElement | ImageBitmap | HTMLCanvasElement,
  rotation = 0,
  flipH = false,
  flipV = false
): HTMLCanvasElement {
  const origW = 'naturalWidth' in sourceImage ? sourceImage.naturalWidth : sourceImage.width;
  const origH = 'naturalHeight' in sourceImage ? sourceImage.naturalHeight : sourceImage.height;

  const normalizedRot = ((rotation % 360) + 360) % 360;
  const isPerp = normalizedRot === 90 || normalizedRot === 270;
  const outW = isPerp ? origH : origW;
  const outH = isPerp ? origW : origH;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, outW);
  canvas.height = Math.max(1, outH);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((normalizedRot * Math.PI) / 180);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(sourceImage, -origW / 2, -origH / 2, origW, origH);

  return canvas;
}

export function calculatePosterPlan(config: PosterPlanConfig): PosterPlan {
  const { imageWidth, imageHeight, pageSize, orientation, columns, rows, maxSheetsCap = 100 } = config;

  const boundedCols = Math.max(1, Math.min(20, columns));
  const boundedRows = Math.max(1, Math.min(20, rows));
  const totalPages = boundedCols * boundedRows;

  if (totalPages > maxSheetsCap) {
    throw new Error(`Total sheets (${totalPages}) exceeds the safety limit of ${maxSheetsCap} pages.`);
  }

  const pDef = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;
  const pagePdfWidth = orientation === 'Portrait' ? pDef.width : pDef.height;
  const pagePdfHeight = orientation === 'Portrait' ? pDef.height : pDef.width;

  const pageMMW = orientation === 'Portrait' ? pDef.mmW : pDef.mmH;
  const pageMMH = orientation === 'Portrait' ? pDef.mmH : pDef.mmW;
  const totalMMW = boundedCols * pageMMW;
  const totalMMH = boundedRows * pageMMH;

  const tileWidthPx = 1200;
  const tileHeightPx = Math.round(1200 * (pagePdfHeight / pagePdfWidth));

  const masterWidthPx = boundedCols * tileWidthPx;
  const masterHeightPx = boundedRows * tileHeightPx;

  const masterAspect = masterWidthPx / masterHeightPx;
  const imgAspect = (imageWidth && imageHeight) ? imageWidth / imageHeight : 1;

  let drawW = masterWidthPx;
  let drawH = masterHeightPx;
  let drawX = 0;
  let drawY = 0;

  if (imgAspect > masterAspect) {
    drawW = masterHeightPx * imgAspect;
    drawX = (masterWidthPx - drawW) / 2;
  } else {
    drawH = masterWidthPx / imgAspect;
    drawY = (masterHeightPx - drawH) / 2;
  }

  const scaleX = (imageWidth && drawW) ? imageWidth / drawW : 1;
  const scaleY = (imageHeight && drawH) ? imageHeight / drawH : 1;

  return {
    columns: boundedCols,
    rows: boundedRows,
    totalPages,
    pagePdfWidth,
    pagePdfHeight,
    tileWidthPx,
    tileHeightPx,
    masterWidthPx,
    masterHeightPx,
    drawX,
    drawY,
    drawW,
    drawH,
    scaleX,
    scaleY,
    totalMMW,
    totalMMH,
  };
}

export function renderClassicHalftone(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  cellSize = HALFTONE_CELL_SIZE,
  globalOffsetX = 0,
  globalOffsetY = 0,
  invert = false
) {
  const source = context.getImageData(0, 0, width, height).data;
  context.fillStyle = invert ? '#000000' : '#ffffff';
  context.fillRect(0, 0, width, height);
  context.fillStyle = invert ? '#ffffff' : '#000000';

  const safeCellSize = Math.max(4, Math.min(50, cellSize));

  // Compute grid alignment offset so dot phase stays synchronized across page seams
  const startX = -((globalOffsetX % safeCellSize + safeCellSize) % safeCellSize);
  const startY = -((globalOffsetY % safeCellSize + safeCellSize) % safeCellSize);

  const halfCell = safeCellSize / 2;
  const halfCellRadius = halfCell * 0.95;

  for (let y = startY; y < height; y += safeCellSize) {
    for (let x = startX; x < width; x += safeCellSize) {
      let luminance = 0;
      let validSamples = 0;

      // 5-point sampling inlined for maximum performance
      const centerX = Math.floor(x + halfCell);
      const centerY = Math.floor(y + halfCell);
      const leftX = Math.floor(x + safeCellSize * 0.25);
      const rightX = Math.floor(x + safeCellSize * 0.75);
      const topY = Math.floor(y + safeCellSize * 0.25);
      const botY = Math.floor(y + safeCellSize * 0.75);

      if (centerX >= 0 && centerX < width && centerY >= 0 && centerY < height) {
        const o = (centerY * width + centerX) * 4;
        luminance += 0.299 * source[o] + 0.587 * source[o + 1] + 0.114 * source[o + 2];
        validSamples++;
      }
      if (leftX >= 0 && leftX < width && topY >= 0 && topY < height) {
        const o = (topY * width + leftX) * 4;
        luminance += 0.299 * source[o] + 0.587 * source[o + 1] + 0.114 * source[o + 2];
        validSamples++;
      }
      if (rightX >= 0 && rightX < width && topY >= 0 && topY < height) {
        const o = (topY * width + rightX) * 4;
        luminance += 0.299 * source[o] + 0.587 * source[o + 1] + 0.114 * source[o + 2];
        validSamples++;
      }
      if (leftX >= 0 && leftX < width && botY >= 0 && botY < height) {
        const o = (botY * width + leftX) * 4;
        luminance += 0.299 * source[o] + 0.587 * source[o + 1] + 0.114 * source[o + 2];
        validSamples++;
      }
      if (rightX >= 0 && rightX < width && botY >= 0 && botY < height) {
        const o = (botY * width + rightX) * 4;
        luminance += 0.299 * source[o] + 0.587 * source[o + 1] + 0.114 * source[o + 2];
        validSamples++;
      }

      if (validSamples === 0) continue;

      let inkCoverage = 1 - luminance / (255 * validSamples);
      if (invert) {
        inkCoverage = 1 - inkCoverage;
      }
      const radius = Math.sqrt(Math.max(0, inkCoverage)) * halfCellRadius;
      if (radius <= 0.35) continue;

      context.beginPath();
      context.arc(x + halfCell, y + halfCell, radius, 0, Math.PI * 2);
      context.fill();
    }
  }
}

export async function generatePosterPdfBlob(
  sourceImage: HTMLImageElement | ImageBitmap,
  config: PosterPlanConfig,
  onProgress?: (progressPct: number, statusText: string) => void,
  cancellationRef?: { cancelled: boolean }
): Promise<Blob> {
  const transformedCanvas = (config.rotation || config.flipH || config.flipV)
    ? createTransformedImageCanvas(sourceImage, config.rotation || 0, !!config.flipH, !!config.flipV)
    : sourceImage;

  const effWidth = 'naturalWidth' in transformedCanvas
    ? transformedCanvas.naturalWidth
    : transformedCanvas.width;
  const effHeight = 'naturalHeight' in transformedCanvas
    ? transformedCanvas.naturalHeight
    : transformedCanvas.height;

  const planConfig: PosterPlanConfig = {
    ...config,
    imageWidth: effWidth,
    imageHeight: effHeight,
  };

  const plan = calculatePosterPlan(planConfig);
  const pdfDoc = await PDFDocument.create();

  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = plan.tileWidthPx;
  tileCanvas.height = plan.tileHeightPx;
  const tCtx = tileCanvas.getContext('2d');
  if (!tCtx) throw new Error('Could not instantiate tile canvas context');

  for (let r = 0; r < plan.rows; r++) {
    for (let c = 0; c < plan.columns; c++) {
      if (cancellationRef?.cancelled) {
        throw new Error('Poster generation cancelled by user.');
      }

      const idx = r * plan.columns + c + 1;
      const status = `Processing sheet ${idx} of ${plan.totalPages} (Row ${r + 1}, Col ${c + 1})...`;
      const progress = Math.round(10 + (idx / plan.totalPages) * 75);
      onProgress?.(progress, status);

      tCtx.fillStyle = '#ffffff';
      tCtx.fillRect(0, 0, plan.tileWidthPx, plan.tileHeightPx);

      const tileX = c * plan.tileWidthPx;
      const tileY = r * plan.tileHeightPx;

      const rawSrcX = (tileX - plan.drawX) * plan.scaleX;
      const rawSrcY = (tileY - plan.drawY) * plan.scaleY;
      const rawSrcW = plan.tileWidthPx * plan.scaleX;
      const rawSrcH = plan.tileHeightPx * plan.scaleY;

      const srcX = Math.max(0, rawSrcX);
      const srcY = Math.max(0, rawSrcY);
      const srcRight = Math.min(effWidth, rawSrcX + rawSrcW);
      const srcBottom = Math.min(effHeight, rawSrcY + rawSrcH);

      const srcW = Math.max(0, srcRight - srcX);
      const srcH = Math.max(0, srcBottom - srcY);

      if (srcW > 0 && srcH > 0) {
        const dstX = (srcX - rawSrcX) / plan.scaleX;
        const dstY = (srcY - rawSrcY) / plan.scaleY;
        const dstW = srcW / plan.scaleX;
        const dstH = srcH / plan.scaleY;

        tCtx.drawImage(transformedCanvas, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
      }

      if (config.styleMode === 'bw') {
        const tileImgData = tCtx.getImageData(0, 0, plan.tileWidthPx, plan.tileHeightPx);
        const d = tileImgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          d[i] = d[i + 1] = d[i + 2] = lum;
        }
        tCtx.putImageData(tileImgData, 0, 0);
      } else if (config.styleMode === 'halftone') {
        const dotSize = config.dotSize || HALFTONE_CELL_SIZE;
        renderClassicHalftone(tCtx, plan.tileWidthPx, plan.tileHeightPx, dotSize, tileX, tileY, !!config.invertHalftone);
      }

      // Lossless PNG for hard dot and monochrome edges; high-quality JPEG for color
      const useLosslessTile = config.styleMode !== 'color';
      const mimeType = useLosslessTile ? 'image/png' : 'image/jpeg';
      const quality = useLosslessTile ? undefined : 0.94;

      const tileBlob = await new Promise<Blob | null>((resolve) => {
        tileCanvas.toBlob(resolve, mimeType, quality);
      });
      if (!tileBlob) throw new Error('Failed to generate tile image blob');

      const arrayBuffer = await tileBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      const embeddedImage = useLosslessTile
        ? await pdfDoc.embedPng(bytes)
        : await pdfDoc.embedJpg(bytes);

      const page = pdfDoc.addPage([plan.pagePdfWidth, plan.pagePdfHeight]);

      page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: plan.pagePdfWidth,
        height: plan.pagePdfHeight,
      });

      // Sheet crop marks
      if (config.showCropMarks) {
        const markLen = 14;
        const markColor = rgb(0.55, 0.55, 0.55);
        const strokeW = 0.65;

        // Bottom Left
        page.drawLine({ start: { x: 0, y: 0 }, end: { x: markLen, y: 0 }, thickness: strokeW, color: markColor });
        page.drawLine({ start: { x: 0, y: 0 }, end: { x: 0, y: markLen }, thickness: strokeW, color: markColor });

        // Bottom Right
        page.drawLine({ start: { x: plan.pagePdfWidth, y: 0 }, end: { x: plan.pagePdfWidth - markLen, y: 0 }, thickness: strokeW, color: markColor });
        page.drawLine({ start: { x: plan.pagePdfWidth, y: 0 }, end: { x: plan.pagePdfWidth, y: markLen }, thickness: strokeW, color: markColor });

        // Top Left
        page.drawLine({ start: { x: 0, y: plan.pagePdfHeight }, end: { x: markLen, y: plan.pagePdfHeight }, thickness: strokeW, color: markColor });
        page.drawLine({ start: { x: 0, y: plan.pagePdfHeight }, end: { x: 0, y: plan.pagePdfHeight - markLen }, thickness: strokeW, color: markColor });

        // Top Right
        page.drawLine({ start: { x: plan.pagePdfWidth, y: plan.pagePdfHeight }, end: { x: plan.pagePdfWidth - markLen, y: plan.pagePdfHeight }, thickness: strokeW, color: markColor });
        page.drawLine({ start: { x: plan.pagePdfWidth, y: plan.pagePdfHeight }, end: { x: plan.pagePdfWidth, y: markLen }, thickness: strokeW, color: markColor });
      }
    }
  }

  onProgress?.(95, 'Assembling final PDF document streams...');
  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
}

