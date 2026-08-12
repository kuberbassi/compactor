import { Document, ImageRun, Packer, Paragraph, PageBreak, TextRun } from 'docx';
import { renderAsync } from 'docx-preview';
import html2canvas from 'html2canvas';
import mammoth from 'mammoth/mammoth.browser';
import { PDFDocument } from 'pdf-lib';
import type { Worker as TesseractWorker } from 'tesseract.js';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

type PdfTextItem = { str: string; transform: number[]; width: number; height: number };
export type ConversionProgress = (percent: number, status: string) => void;
export type PdfDocxMode = 'editable' | 'preserve-layout';

const assertSignature = async (file: File, expected: 'pdf' | 'zip') => {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const valid = expected === 'pdf'
    ? String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-'
    : bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!valid) throw new Error(`This file is not a valid ${expected === 'pdf' ? 'PDF' : 'DOCX'} document.`);
};

type DocxBorder = { type?: string; color?: string; size?: string; offset?: string };

const applyDocxPageBorders = (pages: HTMLElement[], documentModel: any) => {
  const borders = documentModel?.documentPart?.body?.props?.pageBorders as Record<string, DocxBorder> | undefined;
  if (!borders) return;

  const cssBorderStyle = (type?: string): string => {
    if (type === 'double') return 'double';
    if (type === 'dotted') return 'dotted';
    if (type === 'dashed' || type === 'dashSmallGap' || type === 'dotDash' || type === 'dotDotDash') return 'dashed';
    if (type === 'none' || type === 'nil') return 'none';
    return 'solid';
  };

  pages.forEach(page => {
    (['top', 'right', 'bottom', 'left'] as const).forEach(side => {
      const border = borders[side];
      if (!border || cssBorderStyle(border.type) === 'none') return;
      const style = cssBorderStyle(border.type);
      const width = border.type === 'double' ? `max(3px, ${border.size || '1.5pt'})` : border.size || '1pt';
      const color = !border.color || border.color === 'auto' ? '#000000' : `#${border.color}`;
      page.style.setProperty(`border-${side}-style`, style);
      page.style.setProperty(`border-${side}-width`, width);
      page.style.setProperty(`border-${side}-color`, color);
    });
    page.style.boxSizing = 'border-box';
  });
};

const linesFromPdfItems = (items: PdfTextItem[]) => {
  const sorted = [...items]
    .filter(item => typeof item.str === 'string' && item.str.trim())
    .sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      return Math.abs(yDiff) > 2 ? yDiff : a.transform[4] - b.transform[4];
    });

  const lines: Array<{ y: number; height: number; items: PdfTextItem[] }> = [];
  for (const item of sorted) {
    const y = item.transform[5];
    const line = lines.find(candidate => Math.abs(candidate.y - y) <= Math.max(2, item.height * 0.25));
    if (line) {
      line.items.push(item);
      line.height = Math.max(line.height, item.height);
    } else {
      lines.push({ y, height: item.height, items: [item] });
    }
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map(line => ({
      height: line.height,
      text: line.items
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((item, index, row) => {
          if (index === 0) return item.str;
          const previous = row[index - 1];
          const previousEnd = previous.transform[4] + previous.width;
          return item.transform[4] - previousEnd > Math.max(1.5, item.height * 0.12) ? ` ${item.str}` : item.str;
        })
        .join('')
        .trim(),
    }));
};

const extractPdfPages = async (file: File, onProgress?: ConversionProgress) => {
  await assertSignature(file, 'pdf');
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  const source = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: source }).promise;
  const pages: Array<Array<{ text: string; height: number }>> = [];
  let ocrWorker: TesseractWorker | null = null;
  let activePage = 1;

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      activePage = pageNumber;
      onProgress?.(
        Math.round(((pageNumber - 1) / pdf.numPages) * 100),
        `Reading page ${pageNumber} of ${pdf.numPages}...`,
      );
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let lines = linesFromPdfItems(content.items as PdfTextItem[]);
      const textCharacters = lines.reduce((total, line) => total + line.text.trim().length, 0);

      if (textCharacters < 3) {
        const { createWorker } = await import('tesseract.js');
        if (!ocrWorker) {
          onProgress?.(
            Math.round(((pageNumber - 1) / pdf.numPages) * 100),
            'Loading the private OCR language model...',
          );
          ocrWorker = await createWorker('eng', undefined, {
            logger: message => {
              if (message.status !== 'recognizing text') return;
              const pageBase = (activePage - 1) / pdf.numPages;
              const pageShare = message.progress / pdf.numPages;
              onProgress?.(
                Math.min(99, Math.round((pageBase + pageShare) * 100)),
                `OCR scanning page ${activePage} of ${pdf.numPages}...`,
              );
            },
          });
          await ocrWorker.setParameters({ preserve_interword_spaces: '1', user_defined_dpi: '220' });
        }

        const baseViewport = page.getViewport({ scale: 1 });
        const maximumPixels = 6_000_000;
        const renderScale = Math.min(2.75, Math.sqrt(maximumPixels / (baseViewport.width * baseViewport.height)));
        const viewport = page.getViewport({ scale: Math.max(1.5, renderScale) });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error(`Could not prepare page ${pageNumber} for OCR.`);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport } as never).promise;

        const recognition = await ocrWorker.recognize(canvas);
        lines = recognition.data.text
          .split(/\r?\n/)
          .map(text => ({ text: text.trim(), height: 11 }))
          .filter(line => line.text.length > 0);
        canvas.width = 1;
        canvas.height = 1;
      }

      if (lines.length === 0) {
        throw new Error(`No readable text could be detected on page ${pageNumber}, even after OCR.`);
      }
      pages.push(lines);
      onProgress?.(
        Math.round((pageNumber / pdf.numPages) * 100),
        `Finished page ${pageNumber} of ${pdf.numPages}.`,
      );
      page.cleanup();
    }
  } finally {
    if (ocrWorker) await ocrWorker.terminate();
    pdf.cleanup();
  }

  return pages;
};

const canvasToPng = (canvas: HTMLCanvasElement) => new Promise<Uint8Array>((resolve, reject) => {
  canvas.toBlob(async blob => {
    if (!blob) return reject(new Error('Could not render a PDF page image.'));
    resolve(new Uint8Array(await blob.arrayBuffer()));
  }, 'image/png');
});

const canvasToJpeg = (canvas: HTMLCanvasElement, quality = 0.92) => new Promise<Uint8Array>((resolve, reject) => {
  canvas.toBlob(async blob => {
    if (!blob) return reject(new Error('Could not render a Word page image.'));
    resolve(new Uint8Array(await blob.arrayBuffer()));
  }, 'image/jpeg', quality);
});

const pdfToLayoutDocx = async (file: File, onProgress?: ConversionProgress): Promise<Blob> => {
  await assertSignature(file, 'pdf');
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const children: Paragraph[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      onProgress?.(
        Math.round(((pageNumber - 1) / pdf.numPages) * 100),
        `Preserving page ${pageNumber} of ${pdf.numPages}, including images and formatting...`,
      );
      const page = await pdf.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const maximumPixels = 10_000_000;
      const scale = Math.max(1.5, Math.min(2.5, Math.sqrt(maximumPixels / (base.width * base.height))));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error(`Could not prepare page ${pageNumber} for layout conversion.`);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport } as never).promise;

      const availableWidth = 624;
      const availableHeight = 864;
      const fit = Math.min(availableWidth / base.width, availableHeight / base.height);
      children.push(new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new ImageRun({
          data: await canvasToPng(canvas),
          type: 'png',
          transformation: {
            width: Math.max(1, Math.round(base.width * fit)),
            height: Math.max(1, Math.round(base.height * fit)),
          },
          altText: {
            title: `PDF page ${pageNumber}`,
            description: `Visual rendering of page ${pageNumber} from ${file.name}`,
            name: `Page ${pageNumber}`,
          },
        })],
      }));
      if (pageNumber < pdf.numPages) children.push(new Paragraph({ children: [new PageBreak()] }));
      canvas.width = 1;
      canvas.height = 1;
      page.cleanup();
      onProgress?.(Math.round((pageNumber / pdf.numPages) * 100), `Preserved page ${pageNumber} of ${pdf.numPages}.`);
    }
  } finally {
    pdf.cleanup();
  }

  return Packer.toBlob(new Document({
    creator: 'Compactor',
    title: file.name.replace(/\.pdf$/i, ''),
    sections: [{
      properties: { page: { margin: { top: 360, right: 360, bottom: 360, left: 360 } } },
      children,
    }],
  }));
};

export const pdfToDocx = async (
  file: File,
  onProgress?: ConversionProgress,
  mode: PdfDocxMode = 'editable',
): Promise<Blob> => {
  if (mode === 'preserve-layout') return pdfToLayoutDocx(file, onProgress);
  const pages = await extractPdfPages(file, onProgress);
  const children: Paragraph[] = [];

  pages.forEach((lines, pageIndex) => {
    for (const line of lines) {
      children.push(new Paragraph({
        spacing: { after: line.text ? 80 : 140 },
        children: [new TextRun({
          text: line.text,
          size: Math.max(18, Math.min(40, Math.round(line.height * 2))),
          bold: line.height >= 16,
        })],
      }));
    }
    if (pageIndex < pages.length - 1) children.push(new Paragraph({ children: [new PageBreak()] }));
  });

  const document = new Document({
    creator: 'Compactor',
    title: file.name.replace(/\.pdf$/i, ''),
    sections: [{ properties: {}, children }],
  });
  return Packer.toBlob(document);
};

export const pdfToText = async (file: File, onProgress?: ConversionProgress): Promise<string> => {
  const pages = await extractPdfPages(file, onProgress);
  return pages.map(lines => lines.map(line => line.text).join('\n')).join('\n\n');
};

export const textToDocx = async (text: string, title: string): Promise<Blob> => {
  const paragraphs = text.split(/\r?\n/).map(line => new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun(line)],
  }));
  return Packer.toBlob(new Document({ creator: 'Compactor', title, sections: [{ children: paragraphs }] }));
};

export const docxToText = async (file: File): Promise<string> => {
  await assertSignature(file, 'zip');
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  const text = result.value.trim();
  if (!text) throw new Error('No readable document content was found in this DOCX file.');
  return text;
};

export const docxToHtml = async (file: File): Promise<string> => {
  await assertSignature(file, 'zip');
  const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  if (!result.value.trim()) throw new Error('No readable document content was found in this DOCX file.');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${file.name}</title></head><body>${result.value}</body></html>`;
};

export const docxToPdf = async (file: File, onProgress?: ConversionProgress): Promise<Blob> => {
  await assertSignature(file, 'zip');
  onProgress?.(10, 'Reading Word document layout...');

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: 'max-content',
    background: '#ffffff',
    pointerEvents: 'none',
    zIndex: '2147483646',
  });
  document.body.appendChild(host);

  try {
    const documentModel = await renderAsync(file, host, host, {
      breakPages: true,
      experimental: true,
      ignoreFonts: false,
      ignoreHeight: false,
      ignoreLastRenderedPageBreak: false,
      ignoreWidth: false,
      inWrapper: true,
      renderAltChunks: true,
      renderChanges: false,
      renderComments: false,
      renderEndnotes: true,
      renderFooters: true,
      renderFootnotes: true,
      renderHeaders: true,
      useBase64URL: true,
    });
    onProgress?.(25, 'Preparing fonts and embedded images...');

    await document.fonts?.ready;
    await Promise.all(Array.from(host.querySelectorAll('img')).map(async image => {
      if (image.complete) return;
      try {
        await image.decode();
      } catch {
        // A broken embedded image should not block the rest of the document.
      }
    }));

    const pages = Array.from(host.querySelectorAll<HTMLElement>('section.docx'));
    if (pages.length === 0) throw new Error('The DOCX renderer did not produce any printable pages.');
    applyDocxPageBorders(pages, documentModel);

    const pdf = await PDFDocument.create();
    pdf.setTitle(file.name.replace(/\.docx$/i, ''));
    pdf.setCreator('Compactor');

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const pageElement = pages[pageIndex];
      onProgress?.(
        30 + Math.round((pageIndex / pages.length) * 60),
        `Rendering Word page ${pageIndex + 1} of ${pages.length}...`,
      );
      const width = Math.max(1, pageElement.scrollWidth, pageElement.offsetWidth);
      const height = Math.max(1, pageElement.scrollHeight, pageElement.offsetHeight);
      const pixelBudget = 12_000_000;
      const requestedScale = Math.min(1.75, Math.max(1.25, window.devicePixelRatio || 1));
      const scale = Math.max(1, Math.min(requestedScale, Math.sqrt(pixelBudget / (width * height))));
      const canvas = await html2canvas(pageElement, {
        allowTaint: false,
        backgroundColor: '#ffffff',
        foreignObjectRendering: false,
        imageTimeout: 8000,
        logging: false,
        scale,
        useCORS: true,
        windowHeight: height,
        windowWidth: width,
      });
      if (!canvas.width || !canvas.height) throw new Error('A rendered Word page was empty.');

      const pageWidth = width * 0.75;
      const pageHeight = height * 0.75;
      const image = await pdf.embedJpg(await canvasToJpeg(canvas));
      const page = pdf.addPage([pageWidth, pageHeight]);
      page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
      canvas.width = 1;
      canvas.height = 1;
    }

    onProgress?.(95, 'Finalizing visual PDF pages...');
    const bytes = await pdf.save({ objectsPerTick: Number.POSITIVE_INFINITY, useObjectStreams: false });
    return new Blob([bytes as BlobPart], { type: 'application/pdf' });
  } finally {
    host.remove();
  }
};
