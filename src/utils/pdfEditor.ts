export interface VerticalRect {
  top: number;
  height: number;
}

export function getTargetPageIndexes(scope: 'current' | 'all', currentPage: number, pageCount: number) {
  return scope === 'all'
    ? Array.from({ length: pageCount }, (_, pageIndex) => pageIndex)
    : [currentPage];
}

export function getClosestPageIndex(viewport: VerticalRect, pages: VerticalRect[]) {
  const centerY = viewport.top + viewport.height / 2;
  let closestPage = 0;
  let closestDistance = Number.POSITIVE_INFINITY;
  pages.forEach((page, pageIndex) => {
    const distance = Math.abs(page.top + page.height / 2 - centerY);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestPage = pageIndex;
    }
  });
  return closestPage;
}

export function togglePageEffect(previous: number[], targets: number[]) {
  const removeTargets = targets.every(pageIndex => previous.includes(pageIndex));
  return removeTargets
    ? previous.filter(pageIndex => !targets.includes(pageIndex))
    : Array.from(new Set([...previous, ...targets])).sort((a, b) => a - b);
}

export function getWatermarkGrid(density: number) {
  const columns = Math.min(6, Math.max(2, Math.round(density)));
  const rows = columns + 2;
  return { columns, rows, count: columns * rows };
}

export function getWatermarkPatternPositions(density: number) {
  const columns = Math.min(6, Math.max(2, Math.round(density)));
  const rows = columns + 2;
  const positions: Array<{ x: number; y: number }> = [];

  for (let row = -1; row <= rows; row += 1) {
    const offset = Math.abs(row) % 2 === 1 ? 0.5 : 0;
    for (let column = -1; column <= columns; column += 1) {
      positions.push({
        x: ((column + 0.5 + offset) / columns) * 100,
        y: ((row + 0.5) / rows) * 100,
      });
    }
  }

  return positions;
}

function getFittedLabelFontSize(text: string, width: number, height: number, heightRatio: number, maxSize: number) {
  const normalizedText = text.trim() || 'W';
  const usableWidth = Math.max(1, width - 16);
  const usableHeight = Math.max(1, height * heightRatio);
  const widthFit = usableWidth / Math.max(1, normalizedText.length * 0.62);
  return Math.max(8, Math.min(maxSize, usableHeight, widthFit));
}

/** Fits the primary stamp label to its current box. Width and height use the same units. */
export function getAutoStampFontSize(text: string, width: number, height: number) {
  return getFittedLabelFontSize(text, width, height, 0.48, 72);
}

/** Fits the signature name while reserving vertical room for its verification line. */
export function getAutoSignatureFontSize(text: string, width: number, height: number) {
  return getFittedLabelFontSize(text, width, height, 0.34, 48);
}

export const PDF_EDITOR_PREFERENCES_KEY = 'compactor.pdf-editor.preferences.v1';

export type PdfEditorPreferences = {
  zoom: number;
  elementScope: 'current' | 'all';
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  rotation: number;
  fontSize: number;
  textColor: string;
  fontFamily: string;
  textAlign: 'left' | 'center' | 'right';
  isBold: boolean;
  isItalic: boolean;
  redactText: string;
  redactStyle: 'blackout' | 'whiteout' | 'custom-text';
  watermarkText: string;
  watermarkOpacity: number;
  watermarkRotation: number;
  watermarkDensity: number;
  watermarkFontSize: number;
  watermarkColor: string;
  patternWatermarkText: string;
  patternWatermarkOpacity: number;
  patternWatermarkRotation: number;
  patternWatermarkFontSize: number;
  patternWatermarkColor: string;
};

export const readPdfEditorPreferences = (): Partial<PdfEditorPreferences> => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = window.localStorage.getItem(PDF_EDITOR_PREFERENCES_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export function getCanvasCoords(e: { clientX: number; clientY: number }, targetRect: DOMRect) {
  const x = Math.max(0, Math.min(100, ((e.clientX - targetRect.left) / targetRect.width) * 100));
  const y = Math.max(0, Math.min(100, ((e.clientY - targetRect.top) / targetRect.height) * 100));
  return { x, y };
}

export function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  align: string
) {
  const paragraphs = text.split('\n');
  let currentY = y;

  for (const para of paragraphs) {
    if (!para.trim()) {
      currentY += lineHeight;
      continue;
    }
    const words = para.split(' ');
    let currentLine = '';

    for (let n = 0; n < words.length; n++) {
      const testLine = currentLine + (currentLine ? ' ' : '') + words[n];
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && n > 0) {
        let drawX = x;
        if (align === 'center') drawX = x + maxWidth / 2;
        else if (align === 'right') drawX = x + maxWidth;

        ctx.fillText(currentLine, drawX, currentY);
        currentLine = words[n];
        currentY += lineHeight;
      } else {
        currentLine = testLine;
      }
    }

    let drawX = x;
    if (align === 'center') drawX = x + maxWidth / 2;
    else if (align === 'right') drawX = x + maxWidth;

    ctx.fillText(currentLine, drawX, currentY);
    currentY += lineHeight;
  }
}
