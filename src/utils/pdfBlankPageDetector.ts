import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument } from "pdf-lib";
import { isCanvasBlank } from "./canvasBlankCheck";

export { isCanvasBlank } from "./canvasBlankCheck";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface BlankPageDetectionResult {
  blankPageNumbers: number[];     // 1-indexed
  nonBlankPageNumbers: number[];  // 1-indexed
  totalPages: number;
}

/**
 * Detects which pages in a PDF file are blank by checking both text layer & visual pixels.
 */
export const detectBlankPdfPages = async (
  file: File,
  thresholdPercent: number = 0.02,
  onProgress?: (inspectedPages: number, totalPages: number) => void
): Promise<BlankPageDetectionResult> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    verbosity: 0,
  });
  try {
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  const blankPageNumbers: number[] = [];
  const nonBlankPageNumbers: number[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const hasText = textContent.items.some(
      (item: any) => typeof item.str === "string" && item.str.trim().length > 0
    );

    if (hasText) {
      nonBlankPageNumbers.push(i);
      onProgress?.(i, totalPages);
      page.cleanup();
      continue;
    }

    // Render a lightweight thumbnail (scale 0.5) to check for visual graphics/scans
    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (!ctx) {
      throw new Error('Could not inspect PDF pages. No pages have been removed.');
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport } as any).promise;

    if (isCanvasBlank(canvas, thresholdPercent)) {
      blankPageNumbers.push(i);
    } else {
      nonBlankPageNumbers.push(i);
    }
    onProgress?.(i, totalPages);
    page.cleanup();
  }

  return {
    blankPageNumbers,
    nonBlankPageNumbers,
    totalPages,
  };
  } finally { await loadingTask.destroy(); }
};

/**
 * Strips all blank pages from a PDF and returns the new PDF Blob.
 */
export const removeBlankPdfPages = async (
  file: File,
  thresholdPercent: number = 0.5
): Promise<{ blob: Blob; removedCount: number; remainingCount: number }> => {
  const { blankPageNumbers, nonBlankPageNumbers, totalPages } = await detectBlankPdfPages(
    file,
    thresholdPercent
  );

  if (blankPageNumbers.length === 0) {
    return {
      blob: new Blob([await file.arrayBuffer()], { type: "application/pdf" }),
      removedCount: 0,
      remainingCount: totalPages,
    };
  }

  if (nonBlankPageNumbers.length === 0) {
    throw new Error("All pages in this PDF were detected as blank.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const srcPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const newPdf = await PDFDocument.create();

  // Convert 1-indexed to 0-indexed page indices
  const pageIndices = nonBlankPageNumbers.map((p) => p - 1);
  const copiedPages = await newPdf.copyPages(srcPdf, pageIndices);
  copiedPages.forEach((page) => newPdf.addPage(page));

  const pdfBytes = await newPdf.save({ useObjectStreams: true });
  const blob = new Blob([pdfBytes as any], { type: "application/pdf" });

  return {
    blob,
    removedCount: blankPageNumbers.length,
    remainingCount: nonBlankPageNumbers.length,
  };
};
