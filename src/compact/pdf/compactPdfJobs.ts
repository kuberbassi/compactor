import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { checkPdfEncryptionStatus, imagesToPdf, mergePdfs, protectPdfWithPassword, unlockPdfWithPassword } from '../../utils/pdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const withPdfDocument = async <T>(file: File, operation: (document: PDFDocumentProxy) => Promise<T>): Promise<T> => {
  const task = pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), verbosity: 0 });
  try {
    return await operation(await task.promise);
  } finally {
    await task.destroy();
  }
};

export type PdfImageFormat = 'png' | 'jpeg';

export const parsePageRange = (value: string, pageCount: number): number[] => {
  const trimmed = value.trim();
  if (!trimmed) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages = new Set<number>();
  for (const token of trimmed.split(',')) {
    const part = token.trim();
    if (!part) continue;
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start < 1 || end > pageCount || start > end) throw new Error(`Page range must stay between 1 and ${pageCount}.`);
      for (let page = start; page <= end; page += 1) pages.add(page);
      continue;
    }
    if (!/^\d+$/.test(part)) throw new Error('Use page numbers such as 1, 3-5.');
    const page = Number(part);
    if (page < 1 || page > pageCount) throw new Error(`Page range must stay between 1 and ${pageCount}.`);
    pages.add(page);
  }
  if (!pages.size) throw new Error('Choose at least one page.');
  return [...pages].sort((a, b) => a - b);
};

export const getCompactPdfPageCount = async (file: File): Promise<number> => {
  return withPdfDocument(file, async document => document.numPages);
};

export const renderCompactPdfPages = async (
  file: File,
  pages: number[],
  format: PdfImageFormat,
  onProgress: (progress: number) => void,
): Promise<Array<{ blob: Blob; name: string }>> => {
  return withPdfDocument(file, async pdfDocument => {
    const results: Array<{ blob: Blob; name: string }> = [];
    const base = file.name.replace(/\.pdf$/i, '');
    for (const [index, pageNumber] of pages.entries()) {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = window.document.createElement('canvas');
      try {
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('This browser could not prepare a PDF page canvas.');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport } as never).promise;
        const mime = format === 'png' ? 'image/png' : 'image/jpeg';
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value: Blob | null) => value ? resolve(value) : reject(new Error(`Could not export page ${pageNumber}.`)), mime, .92));
        results.push({ blob, name: `${base}-page-${pageNumber}.${format === 'jpeg' ? 'jpg' : 'png'}` });
      } finally {
        canvas.width = 1;
        canvas.height = 1;
        page.cleanup();
      }
      onProgress(Math.round(((index + 1) / pages.length) * 100));
    }
    return results;
  });
};

export const compactPdfJobs = {
  merge: mergePdfs,
  protect: protectPdfWithPassword,
  unlock: unlockPdfWithPassword,
  imagesToPdf,
};

export const getCompactPdfSecurityStatus = checkPdfEncryptionStatus;
