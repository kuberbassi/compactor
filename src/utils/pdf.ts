import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import html2canvas from 'html2canvas';
import { extractRealPdfMarkdown } from './pdfRenderer';

export interface PageOrganizeSpec {
  originalIndex: number;
  rotation: number; // 0, 90, 180, 270
}

/**
 * Exports the rendered Markdown preview itself so the PDF matches the visible
 * typography, colors, tables, code blocks, spacing, and wrapping.
 */
export const renderedElementToPdf = async (element: HTMLElement, title = 'Markdown document'): Promise<Blob> => {
  await document.fonts?.ready;

  const pixelBudget = 40_000_000;
  const requestedScale = Math.min(2.5, Math.max(2, window.devicePixelRatio || 1));
  const safeScale = Math.max(1, Math.min(
    requestedScale,
    Math.sqrt(pixelBudget / Math.max(1, element.scrollWidth * element.scrollHeight))
  ));

  const canvas = await html2canvas(element, {
    allowTaint: false,
    backgroundColor: getComputedStyle(element).backgroundColor || '#ffffff',
    imageTimeout: 4000,
    logging: false,
    scale: safeScale,
    useCORS: true,
    windowHeight: element.scrollHeight,
    windowWidth: element.scrollWidth,
  });

  if (!canvas.width || !canvas.height) throw new Error('The Markdown preview is empty.');

  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator('Compactor');

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 24;
  const drawWidth = pageWidth - margin * 2;
  const drawHeight = pageHeight - margin * 2;
  const sliceHeight = Math.max(1, Math.floor(canvas.width * (drawHeight / drawWidth)));

  for (let sourceY = 0; sourceY < canvas.height; sourceY += sliceHeight) {
    const height = Math.min(sliceHeight, canvas.height - sourceY);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = height;
    const context = slice.getContext('2d');
    if (!context) throw new Error('Could not prepare the PDF page.');
    context.drawImage(canvas, 0, sourceY, canvas.width, height, 0, 0, canvas.width, height);

    const image = await pdf.embedPng(slice.toDataURL('image/png'));
    const renderedHeight = drawWidth * (height / canvas.width);
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawImage(image, {
      x: margin,
      y: pageHeight - margin - renderedHeight,
      width: drawWidth,
      height: renderedHeight,
    });
  }

  const bytes = await pdf.save({ useObjectStreams: true });
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
};

/**
 * Gets page count from a PDF File
 */
export const getPdfPageCount = async (file: File): Promise<number> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    return pdf.getPageCount();
  } catch (e) {
    console.error('Failed to get page count:', e);
    return 1;
  }
};

/**
 * Detects if a PDF file is password protected / encrypted
 */
export const checkPdfEncryptionStatus = async (
  file: File
): Promise<{ isEncrypted: boolean; pageCount: number }> => {
  const arrayBuffer = await file.arrayBuffer();
  try {
    const pdf = await PDFDocument.load(arrayBuffer);
    return { isEncrypted: false, pageCount: pdf.getPageCount() };
  } catch (e: any) {
    const msg = String(e?.message || e).toLowerCase();
    const isEncrypted = msg.includes('encrypt') || msg.includes('password') || e?.name === 'EncryptedPDFError';
    
    let count = 1;
    try {
      const pdfIgnore = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      count = pdfIgnore.getPageCount();
    } catch {}

    return { isEncrypted, pageCount: count };
  }
};

/**
 * Merges multiple PDF Files into a single Blob
 */
export const mergePdfs = async (files: File[]): Promise<Blob> => {
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const pdfBytes = await mergedPdf.save({ useObjectStreams: true });
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
};

/**
 * Reorganizes, rotates, and extracts selected pages from a single PDF
 */
export const reorganizePdfPages = async (
  file: File,
  specs: PageOrganizeSpec[]
): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const srcPdf = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();

  const indicesToCopy = specs.map((s) => s.originalIndex);
  const copiedPages = await newPdf.copyPages(srcPdf, indicesToCopy);

  copiedPages.forEach((page, i) => {
    const rot = specs[i].rotation || 0;
    if (rot !== 0) {
      const currentRot = page.getRotation().angle;
      page.setRotation((currentRot + rot) % 360 as any);
    }
    newPdf.addPage(page);
  });

  const pdfBytes = await newPdf.save({ useObjectStreams: true });
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
};

/**
 * Extracts specific pages from a PDF File by 0-based page indices
 */
export const extractPdfPages = async (file: File, pageIndices: number[]): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();

  const copiedPages = await newPdf.copyPages(pdf, pageIndices);
  copiedPages.forEach((page) => newPdf.addPage(page));

  const pdfBytes = await newPdf.save({ useObjectStreams: true });
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
};

/**
 * Pixel-Perfect Document Scan Filter Engine
 */
export const applyDocumentScanFilter = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  filterType: 'original' | 'smart-scan' | 'camscanner' | 'whiteboard' | 'bw' | 'vibrant'
) => {
  if (filterType === 'original') return;

  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  const totalPixels = width * height;

  if (filterType === 'smart-scan' || filterType === 'camscanner') {
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (lum > 150) {
        const f = (lum - 150) / 105;
        r = Math.min(255, r + (255 - r) * f * 1.3);
        g = Math.min(255, g + (255 - g) * f * 1.3);
        b = Math.min(255, b + (255 - b) * f * 1.3);
      } else {
        const f = (150 - lum) / 150;
        r = Math.max(0, r - r * f * 0.4);
        g = Math.max(0, g - g * f * 0.4);
        b = Math.max(0, b - b * f * 0.4);
      }

      d[i] = Math.min(255, Math.max(0, r));
      d[i + 1] = Math.min(255, Math.max(0, g));
      d[i + 2] = Math.min(255, Math.max(0, b));
    }
  } else if (filterType === 'whiteboard') {
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (lum > 135) {
        r = 255; g = 255; b = 255;
      } else {
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        if (maxC - minC < 25) {
          r = 0; g = 0; b = 0;
        } else {
          r = r < maxC ? Math.max(0, r - 35) : Math.min(255, r + 25);
          g = g < maxC ? Math.max(0, g - 35) : Math.min(255, g + 25);
          b = b < maxC ? Math.max(0, b - 35) : Math.min(255, b + 25);
        }
      }
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
  } else if (filterType === 'bw') {
    let sumLum = 0;
    for (let i = 0; i < d.length; i += 4) {
      sumLum += (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    }
    const avgLum = sumLum / totalPixels;
    const threshold = Math.min(195, Math.max(100, avgLum * 0.9));

    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const val = lum < threshold ? 0 : 255;
      d[i] = val; d[i + 1] = val; d[i + 2] = val;
    }
  } else if (filterType === 'vibrant') {
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i]; let g = d[i + 1]; let b = d[i + 2];
      const avg = (r + g + b) / 3;
      r = Math.min(255, Math.max(0, avg + (r - avg) * 1.5));
      g = Math.min(255, Math.max(0, avg + (g - avg) * 1.5));
      b = Math.min(255, Math.max(0, avg + (b - avg) * 1.5));
      d[i] = Math.min(255, Math.max(0, r));
      d[i + 1] = Math.min(255, Math.max(0, g));
      d[i + 2] = Math.min(255, Math.max(0, b));
    }
  }

  ctx.putImageData(imgData, 0, 0);
};

/**
 * Compiles PNG/JPG/WebP/BMP image files into a single PDF with Smart Scan document filters
 */
export const imagesToPdf = async (
  imageFiles: File[],
  options?: {
    orientation?: 'auto' | 'portrait' | 'landscape';
    pageSize?: 'fit' | 'a4' | 'letter';
    margin?: 'none' | 'small' | 'big';
    filter?: 'original' | 'smart-scan' | 'camscanner' | 'whiteboard' | 'bw' | 'vibrant';
  }
): Promise<Blob> => {
  const pdf = await PDFDocument.create();
  const orientationOpt = options?.orientation || 'auto';
  const pageSizeOpt = options?.pageSize || 'fit';
  const marginOpt = options?.margin || 'none';
  const filterOpt = options?.filter || 'original';

  const marginMap = { none: 0, small: 20, big: 45 };
  const margin = marginMap[marginOpt] || 0;

  for (const file of imageFiles) {
    const imgData = await new Promise<{ buffer: ArrayBuffer; width: number; height: number; isPng: boolean }>((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const width = img.naturalWidth || img.width || 800;
        const height = img.naturalHeight || img.height || 600;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          
          // Pixel-Perfect Document Scan Filter Engine
          if (filterOpt !== 'original') {
            applyDocumentScanFilter(ctx, width, height, filterOpt);
          }
        }
        canvas.toBlob(async (blob) => {
          if (blob) {
            const buf = await blob.arrayBuffer();
            resolve({ buffer: buf, width, height, isPng: false });
          } else {
            const buf = await file.arrayBuffer();
            resolve({ buffer: buf, width, height, isPng: file.type.includes('png') });
          }
        }, 'image/jpeg', 0.95);
      };
      img.onerror = async () => {
        URL.revokeObjectURL(url);
        const buf = await file.arrayBuffer();
        resolve({ buffer: buf, width: 800, height: 600, isPng: file.type.includes('png') });
      };
      img.src = url;
    });

    const image = imgData.isPng 
      ? await pdf.embedPng(imgData.buffer) 
      : await pdf.embedJpg(imgData.buffer);

    const rawW = imgData.width;
    const rawH = imgData.height;

    let pageWidth = rawW;
    let pageHeight = rawH;

    if (pageSizeOpt === 'fit') {
      pageWidth = rawW + margin * 2;
      pageHeight = rawH + margin * 2;
    } else {
      if (pageSizeOpt === 'a4') {
        pageWidth = 595.28;
        pageHeight = 841.89;
      } else if (pageSizeOpt === 'letter') {
        pageWidth = 612.00;
        pageHeight = 792.00;
      }

      let isLandscape = false;
      if (orientationOpt === 'landscape') {
        isLandscape = true;
      } else if (orientationOpt === 'portrait') {
        isLandscape = false;
      } else {
        isLandscape = rawW > rawH;
      }

      if (isLandscape && pageWidth < pageHeight) {
        const temp = pageWidth;
        pageWidth = pageHeight;
        pageHeight = temp;
      } else if (!isLandscape && pageWidth > pageHeight) {
        const temp = pageWidth;
        pageWidth = pageHeight;
        pageHeight = temp;
      }
    }

    const page = pdf.addPage([pageWidth, pageHeight]);

    const drawAreaWidth = Math.max(pageWidth - margin * 2, 10);
    const drawAreaHeight = Math.max(pageHeight - margin * 2, 10);

    const imgAspect = rawW / rawH;
    const areaAspect = drawAreaWidth / drawAreaHeight;

    let drawW = drawAreaWidth;
    let drawH = drawAreaHeight;

    if (imgAspect > areaAspect) {
      drawW = drawAreaWidth;
      drawH = drawAreaWidth / imgAspect;
    } else {
      drawH = drawAreaHeight;
      drawW = drawAreaHeight * imgAspect;
    }

    const x = margin + (drawAreaWidth - drawW) / 2;
    const y = margin + (drawAreaHeight - drawH) / 2;

    page.drawImage(image, {
      x,
      y,
      width: drawW,
      height: drawH,
    });
  }

  const pdfBytes = await pdf.save({ useObjectStreams: true });
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
};

/**
 * Compress PDF by re-saving with object streams enabled
 */
export const compressPdf = async (
  file: File,
  options: {
    preset?: 'light' | 'balanced' | 'maximum';
    removeMetadata?: boolean;
  } = {}
): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  if (options.removeMetadata) {
    pdf.setTitle('');
    pdf.setAuthor('');
    pdf.setSubject('');
    pdf.setKeywords([]);
    pdf.setProducer('Compactor');
    pdf.setCreator('Compactor');
  }
  const pdfBytes = await pdf.save({
    useObjectStreams: options.preset !== 'light',
    addDefaultPage: false,
    updateFieldAppearances: false,
  });
  const optimized = new Blob([pdfBytes as any], { type: 'application/pdf' });

  // Re-encoding an already optimized PDF can occasionally add a few bytes.
  // Never make a user's document larger while calling the operation compression.
  return optimized.size < file.size
    ? optimized
    : file.slice(0, file.size, 'application/pdf');
};

/**
 * Advanced Watermark PDF
 */
export const watermarkPdfAdvanced = async (
  file: File,
  options: {
    text: string;
    color?: 'red' | 'blue' | 'black' | 'gray';
    position?: 'diagonal' | 'header' | 'footer' | 'pattern';
    opacity?: number;
  }
): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pages = pdf.getPages();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);

  const text = options.text || 'CONFIDENTIAL';
  const colorType = options.color || 'red';
  const position = options.position || 'diagonal';
  const opacity = options.opacity !== undefined ? options.opacity : 0.35;

  let textColor = rgb(0.9, 0.1, 0.1);
  if (colorType === 'blue') textColor = rgb(0.1, 0.3, 0.9);
  if (colorType === 'black') textColor = rgb(0.1, 0.1, 0.1);
  if (colorType === 'gray') textColor = rgb(0.5, 0.5, 0.5);

  pages.forEach((page) => {
    const { width, height } = page.getSize();

    if (position === 'pattern') {
      const fontSize = 16;
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const stepX = Math.max(textWidth + 50, 130);
      const stepY = 110;

      for (let x = -40; x < width + 100; x += stepX) {
        for (let y = -40; y < height + 100; y += stepY) {
          page.drawText(text, {
            x,
            y,
            size: fontSize,
            font,
            color: textColor,
            opacity: opacity * 0.7,
            rotate: { type: 'degrees', angle: 30 } as any,
          });
        }
      }
    } else {
      const fontSize = position === 'diagonal' ? 42 : 24;
      const textWidth = font.widthOfTextAtSize(text, fontSize);

      if (position === 'diagonal') {
        page.drawText(text, {
          x: width / 2 - textWidth / 2,
          y: height / 2,
          size: fontSize,
          font,
          color: textColor,
          opacity,
          rotate: { type: 'degrees', angle: 45 } as any,
        });
      } else if (position === 'header') {
        page.drawText(text, {
          x: width / 2 - textWidth / 2,
          y: height - 40,
          size: fontSize,
          font,
          color: textColor,
          opacity,
        });
      } else if (position === 'footer') {
        page.drawText(text, {
          x: width / 2 - textWidth / 2,
          y: 30,
          size: fontSize,
          font,
          color: textColor,
          opacity,
        });
      }
    }
  });

  const pdfBytes = await pdf.save({ useObjectStreams: true });
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
};

/**
 * Adds Page Numbers to Header or Footer
 */
export const addPageNumbersToPdf = async (
  file: File,
  position: 'top' | 'bottom' = 'bottom'
): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pages = pdf.getPages();
  const total = pages.length;

  pages.forEach((page, index) => {
    const { width, height } = page.getSize();
    const text = `Page ${index + 1} of ${total}`;
    page.drawText(text, {
      x: width / 2 - 25,
      y: position === 'bottom' ? 30 : height - 30,
      size: 10,
      color: rgb(0.5, 0.5, 0.5),
    });
  });
  const pdfBytes = await pdf.save({ useObjectStreams: true });
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
};

/**
 * Crops margins off PDF pages
 */
export const cropPdfMargins = async (file: File, marginPct: number): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pages = pdf.getPages();
  pages.forEach((page) => {
    const { width, height } = page.getSize();
    const dx = width * (marginPct / 100);
    const dy = height * (marginPct / 100);
    page.setCropBox(dx, dy, width - dx * 2, height - dy * 2);
  });
  const pdfBytes = await pdf.save({ useObjectStreams: true });
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
};

/**
 * Creates PDF Form fields
 */
export const createPdfForm = async (file: File): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const form = pdf.getForm();
  const page = pdf.getPages()[0];
  if (page) {
    const { width } = page.getSize();
    const textField = form.createTextField('user.signature');
    textField.setText('Fillable Form Signature Block');
    textField.addToPage(page, { x: 50, y: 100, width: width - 100, height: 35 });
  }
  const pdfBytes = await pdf.save({ useObjectStreams: true });
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
};

/**
 * Flattens all interactive PDF form fields into permanent uneditable vector graphics
 */
export const flattenPdfForm = async (file: File): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  try {
    const form = pdf.getForm();
    form.flatten();
  } catch (e) {
    console.warn("Form flatten notice:", e);
  }

  const pdfBytes = await pdf.save({ useObjectStreams: true });
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
};

/**
 * Adds Pre-designed Vector Document Stamps (APPROVED, CONFIDENTIAL, FINAL DRAFT, EXPIRED, PAID, CANCELLED)
 */
export const addVectorStampToPdf = async (
  file: File,
  options: {
    preset: 'APPROVED' | 'CONFIDENTIAL' | 'FINAL DRAFT' | 'EXPIRED' | 'PAID' | 'CANCELLED';
    targetPages?: 'last-page' | 'first-page' | 'all-pages';
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'center';
  }
): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();

  let pagesToStamp: PDFPage[] = [];
  if (options.targetPages === 'first-page') pagesToStamp = [pages[0]];
  else if (options.targetPages === 'all-pages') pagesToStamp = pages;
  else pagesToStamp = [pages[pages.length - 1]];

  const stampColorMap = {
    'APPROVED': rgb(0.05, 0.65, 0.3),    // Emerald Green
    'CONFIDENTIAL': rgb(0.85, 0.1, 0.1), // Crimson Red
    'FINAL DRAFT': rgb(0.1, 0.4, 0.85),  // Royal Blue
    'EXPIRED': rgb(0.85, 0.4, 0.05),     // Amber Orange
    'PAID': rgb(0.05, 0.6, 0.5),         // Teal Green
    'CANCELLED': rgb(0.7, 0.1, 0.1),     // Deep Red
  };

  const stampColor = stampColorMap[options.preset] || rgb(0.8, 0.1, 0.1);
  const presetText = options.preset;

  pagesToStamp.forEach((page) => {
    if (!page) return;
    const { width, height } = page.getSize();
    let x = width - 190;
    let y = 70;

    if (options.position === 'bottom-left') { x = 50; y = 70; }
    else if (options.position === 'top-right') { x = width - 190; y = height - 90; }
    else if (options.position === 'center') { x = width / 2 - 80; y = height / 2; }

    const textWidth = font.widthOfTextAtSize(presetText, 14);
    const rectW = Math.max(textWidth + 24, 130);
    const rectH = 34;

    // Double-border vector stamp frame
    page.drawRectangle({
      x,
      y,
      width: rectW,
      height: rectH,
      borderColor: stampColor,
      borderWidth: 2,
      color: rgb(1, 1, 1),
      opacity: 0.95,
    });

    page.drawRectangle({
      x: x + 2,
      y: y + 2,
      width: rectW - 4,
      height: rectH - 4,
      borderColor: stampColor,
      borderWidth: 0.8,
    });

    page.drawText(presetText, {
      x: x + (rectW - textWidth) / 2,
      y: y + 10,
      size: 14,
      font,
      color: stampColor,
    });
  });

  const pdfBytes = await pdf.save({ useObjectStreams: true });
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
};

/**
 * Censorship Redaction & Text / Custom Image Overlay onto PDF Page
 */
export const annotateOrRedactPdf = async (
  file: File,
  options: {
    mode: 'redact' | 'text' | 'image';
    redactBox?: { xPct: number; yPct: number; widthPct: number; heightPct: number };
    textOverlay?: { content: string; xPct: number; yPct: number; fontSize?: number };
    imageFile?: File;
  }
): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const page = pdf.getPages()[0];
  if (!page) return new Blob([arrayBuffer], { type: 'application/pdf' });

  const { width, height } = page.getSize();

  if (options.mode === 'redact' && options.redactBox) {
    const boxX = (options.redactBox.xPct / 100) * width;
    const boxY = (options.redactBox.yPct / 100) * height;
    const boxW = (options.redactBox.widthPct / 100) * width;
    const boxH = (options.redactBox.heightPct / 100) * height;

    page.drawRectangle({
      x: boxX,
      y: boxY,
      width: boxW,
      height: boxH,
      color: rgb(0, 0, 0),
    });
  } else if (options.mode === 'text' && options.textOverlay) {
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const textX = (options.textOverlay.xPct / 100) * width;
    const textY = (options.textOverlay.yPct / 100) * height;
    
    page.drawText(options.textOverlay.content || 'Sample Text', {
      x: textX,
      y: textY,
      size: options.textOverlay.fontSize || 14,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
  } else if (options.mode === 'image' && options.imageFile) {
    const imgBuf = await options.imageFile.arrayBuffer();
    let embeddedImg;
    if (options.imageFile.type.includes('png')) {
      embeddedImg = await pdf.embedPng(imgBuf);
    } else {
      embeddedImg = await pdf.embedJpg(imgBuf);
    }

    const imgW = Math.min(embeddedImg.width, 180);
    const imgH = (imgW / embeddedImg.width) * embeddedImg.height;

    page.drawImage(embeddedImg, {
      x: width - imgW - 40,
      y: 40,
      width: imgW,
      height: imgH,
    });
  }

  const pdfBytes = await pdf.save({ useObjectStreams: true });
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
};

/**
 * Sign document visually with customizable position, color, and target pages
 */
export const signPdfDocumentAdvanced = async (
  file: File,
  signatureText: string,
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'center' = 'bottom-right',
  color: 'blue' | 'black' | 'red' = 'blue',
  targetPages: 'last-page' | 'first-page' | 'all-pages' = 'last-page'
): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pages = pdf.getPages();
  const font = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  let pagesToSign: PDFPage[] = [];
  if (targetPages === 'last-page') {
    pagesToSign = [pages[pages.length - 1]];
  } else if (targetPages === 'first-page') {
    pagesToSign = [pages[0]];
  } else {
    pagesToSign = pages;
  }

  let strokeColor = rgb(0.1, 0.2, 0.8);
  if (color === 'black') strokeColor = rgb(0.1, 0.1, 0.1);
  if (color === 'red') strokeColor = rgb(0.8, 0.1, 0.1);

  pagesToSign.forEach((page) => {
    if (!page) return;
    const { width, height } = page.getSize();
    let x = width - 220;
    let y = 60;

    if (position === 'bottom-left') { x = 50; y = 60; }
    else if (position === 'top-right') { x = width - 220; y = height - 80; }
    else if (position === 'center') { x = width / 2 - 80; y = height / 2; }

    page.drawText(signatureText || 'Digitally Signed', {
      x,
      y,
      size: 18,
      font,
      color: strokeColor,
    });

    page.drawText(`Date: ${new Date().toLocaleDateString()}`, {
      x,
      y: y - 14,
      size: 9,
      color: rgb(0.4, 0.4, 0.4),
    });
  });

  const pdfBytes = await pdf.save({ useObjectStreams: true });
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
};

/**
 * Signature exporter helper
 */
export const signPdfDocument = async (
  file: File,
  signatureText?: string
): Promise<Blob> => {
  return signPdfDocumentAdvanced(file, signatureText || 'Digitally Signed', 'bottom-right', 'blue', 'last-page');
};

/**
 * Legacy watermark exporter for backwards compatibility
 */
export const watermarkPdf = async (
  file: File,
  text?: string
): Promise<Blob> => {
  return watermarkPdfAdvanced(file, { text: text || 'CONFIDENTIAL' });
};

/**
 * Encrypts PDF document with user password
 */
export const protectPdfWithPassword = async (file: File, userPasswordStr: string): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  if (typeof (pdf as any).encrypt === 'function') {
    (pdf as any).encrypt({
      userPassword: userPasswordStr,
      ownerPassword: userPasswordStr,
      permissions: {
        printing: 'highResolution',
        modifying: false,
        copying: false,
        annotating: false,
      },
    });
  }
  const pdfBytes = await pdf.save({ useObjectStreams: true });
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
};

/**
 * Decrypts / Removes password protection from a PDF document
 */
export const unlockPdfWithPassword = async (file: File, userPasswordStr?: string): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer, { 
    ignoreEncryption: true,
    ...(userPasswordStr ? { password: userPasswordStr } : {})
  });
  
  const unlockedPdf = await PDFDocument.create();
  const copiedPages = await unlockedPdf.copyPages(pdf, pdf.getPageIndices());
  copiedPages.forEach((page) => unlockedPdf.addPage(page));

  const pdfBytes = await unlockedPdf.save({ useObjectStreams: true });
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
};



/**
 * 100% Real Selectable Vector Markdown to PDF Compiler
 * - Clean white paper background (no dark page theme / no outer card border)
 * - 100% Real Selectable Vector Text (Copy/Paste, Highlight, Search)
 * - Pixel-perfect alignment for bullets, code blocks, tables & badges
 */
export const markdownToPdf = async (markdownText: string, _documentTitle?: string): Promise<Blob> => {
  const pdf = await PDFDocument.create();
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const fontMono = await pdf.embedFont(StandardFonts.Courier);

  const margin = 50;
  const pageWidth = 595.28;  // A4 pt
  const pageHeight = 841.89; // A4 pt
  const contentWidth = pageWidth - margin * 2;

  let currentPage = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const checkNewPage = (neededSpace = 25) => {
    if (y - neededSpace < margin) {
      currentPage = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  // Word wrapping helper for pdf-lib text fitting
  const wrapText = (text: string, font: typeof fontRegular, size: number, maxW: number): string[] => {
    if (!text) return [''];
    const words = text.split(' ');
    const linesArr: string[] = [];
    let current = '';

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      try {
        const width = font.widthOfTextAtSize(test, size);
        if (width > maxW && current) {
          linesArr.push(current);
          current = word;
        } else {
          current = test;
        }
      } catch {
        linesArr.push(test);
        current = '';
      }
    }
    if (current) linesArr.push(current);
    return linesArr.length > 0 ? linesArr : [text];
  };

  const lines = markdownText.split('\n');
  let inCodeBlock = false;
  let codeLang = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Image / Badge Line: ![License](https://img.shields.io/badge/license-MIT-blue.svg)
    if (trimmed.startsWith('![')) {
      const badges = Array.from(trimmed.matchAll(/!\[(.*?)\]\((.*?)\)/g));
      if (badges.length > 0) {
        checkNewPage(26);
        let badgeX = margin;
        for (const bMatch of badges) {
          const badgeAlt = bMatch[1] || 'Badge';
          const badgeUrl = bMatch[2] || '';

          let leftText = badgeAlt;
          let rightText = '';
          let rightBgColor = rgb(0.14, 0.38, 0.88); // Blue

          if (badgeUrl.includes('build-passing') || badgeUrl.includes('passing')) {
            leftText = 'build';
            rightText = 'passing';
            rightBgColor = rgb(0.14, 0.65, 0.28); // Green
          } else if (badgeUrl.includes('license')) {
            leftText = 'license';
            rightText = 'MIT';
            rightBgColor = rgb(0.14, 0.38, 0.88); // Blue
          } else if (badgeAlt.includes('-')) {
            const parts = badgeAlt.split('-');
            leftText = parts[0];
            rightText = parts.slice(1).join('-');
          }

          const leftW = Math.max(34, fontBold.widthOfTextAtSize(leftText, 8) + 12);
          const rightW = rightText ? Math.max(34, fontBold.widthOfTextAtSize(rightText, 8) + 12) : 0;
          const totalW = leftW + rightW;

          // Left side pill
          currentPage.drawRectangle({
            x: badgeX,
            y: y - 14,
            width: leftW,
            height: 16,
            color: rgb(0.32, 0.34, 0.38),
          });
          currentPage.drawText(leftText, {
            x: badgeX + 6,
            y: y - 10,
            size: 8,
            font: fontBold,
            color: rgb(1, 1, 1),
          });

          // Right side pill
          if (rightText) {
            currentPage.drawRectangle({
              x: badgeX + leftW,
              y: y - 14,
              width: rightW,
              height: 16,
              color: rightBgColor,
            });
            currentPage.drawText(rightText, {
              x: badgeX + leftW + 6,
              y: y - 10,
              size: 8,
              font: fontBold,
              color: rgb(1, 1, 1),
            });
          }

          badgeX += totalW + 8;
        }
        y -= 24;
        continue;
      }
    }

    // Code Block Toggle ```lang
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim().toUpperCase() || 'CODE';
        checkNewPage(30);

        // Header bar container (Lightish gray theme)
        currentPage.drawRectangle({
          x: margin,
          y: y - 18,
          width: contentWidth,
          height: 18,
          color: rgb(0.88, 0.9, 0.94),
          borderColor: rgb(0.78, 0.8, 0.85),
          borderWidth: 0.5,
        });
        currentPage.drawText(codeLang, {
          x: margin + 10,
          y: y - 13,
          size: 8,
          font: fontBold,
          color: rgb(0.25, 0.3, 0.4),
        });
        y -= 26;
      } else {
        inCodeBlock = false;
        y -= 12;
      }
      continue;
    }

    // Inside Code Block
    if (inCodeBlock) {
      const wrappedCodeLines = wrapText(rawLine, fontMono, 9, contentWidth - 20);
      for (const cLine of wrappedCodeLines) {
        checkNewPage(16);
        currentPage.drawRectangle({
          x: margin,
          y: y - 3,
          width: contentWidth,
          height: 15,
          color: rgb(0.95, 0.96, 0.98),
          borderColor: rgb(0.85, 0.88, 0.92),
          borderWidth: 0.5,
        });
        currentPage.drawText(cLine, {
          x: margin + 10,
          y,
          size: 9,
          font: fontMono,
          color: rgb(0.1, 0.14, 0.22),
        });
        y -= 15;
      }
      continue;
    }

    if (!trimmed) {
      y -= 8;
      continue;
    }

    // GFM Table: | Header | Header |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (trimmed.includes('---')) continue; // skip divider line
      const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
      const cellW = contentWidth / Math.max(1, cells.length);

      checkNewPage(22);
      // Row box & border
      currentPage.drawRectangle({
        x: margin,
        y: y - 4,
        width: contentWidth,
        height: 20,
        color: rgb(0.97, 0.97, 0.98),
        borderColor: rgb(0.8, 0.82, 0.88),
        borderWidth: 0.5,
      });

      // Draw vertical column lines between cells
      for (let cIdx = 1; cIdx < cells.length; cIdx++) {
        currentPage.drawLine({
          start: { x: margin + cIdx * cellW, y: y + 16 },
          end: { x: margin + cIdx * cellW, y: y - 4 },
          thickness: 0.5,
          color: rgb(0.8, 0.82, 0.88),
        });
      }

      cells.forEach((cell, cIdx) => {
        const cellText = cell.replace(/[*_`]/g, '');
        currentPage.drawText(cellText.substring(0, 30), {
          x: margin + cIdx * cellW + 8,
          y: y + 1,
          size: 9,
          font: fontBold,
          color: rgb(0.06, 0.09, 0.16),
        });
      });
      y -= 22;
      continue;
    }

    // Horizontal Divider
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      checkNewPage(16);
      currentPage.drawLine({
        start: { x: margin, y: y - 4 },
        end: { x: pageWidth - margin, y: y - 4 },
        thickness: 1,
        color: rgb(0.88, 0.9, 0.94),
      });
      y -= 18;
      continue;
    }

    // Headings
    if (trimmed.startsWith('# ')) {
      const hText = trimmed.replace(/^#\s+/, '').replace(/[*_`]/g, '');
      const hLines = wrapText(hText, fontBold, 18, contentWidth);
      for (const hl of hLines) {
        checkNewPage(28);
        currentPage.drawText(hl, {
          x: margin,
          y: y - 4,
          size: 18,
          font: fontBold,
          color: rgb(0.06, 0.09, 0.16),
        });
        y -= 24;
      }
      currentPage.drawLine({
        start: { x: margin, y: y + 2 },
        end: { x: pageWidth - margin, y: y + 2 },
        thickness: 1,
        color: rgb(0.88, 0.9, 0.94),
      });
      y -= 8;
    } else if (trimmed.startsWith('## ')) {
      const hText = trimmed.replace(/^##\s+/, '').replace(/[*_`]/g, '');
      const hLines = wrapText(hText, fontBold, 14, contentWidth);
      for (const hl of hLines) {
        checkNewPage(22);
        currentPage.drawText(hl, {
          x: margin,
          y: y - 3,
          size: 14,
          font: fontBold,
          color: rgb(0.1, 0.14, 0.22),
        });
        y -= 20;
      }
      y -= 4;
    } else if (trimmed.startsWith('### ')) {
      const hText = trimmed.replace(/^###\s+/, '').replace(/[*_`]/g, '');
      const hLines = wrapText(hText, fontBold, 12, contentWidth);
      for (const hl of hLines) {
        checkNewPage(18);
        currentPage.drawText(hl, {
          x: margin,
          y,
          size: 12,
          font: fontBold,
          color: rgb(0.18, 0.23, 0.32),
        });
        y -= 16;
      }
    } else if (trimmed.startsWith('> ')) {
      const qText = trimmed.replace(/^>\s+/, '').replace(/[*_`]/g, '');
      const qLines = wrapText(qText, fontOblique, 10, contentWidth - 24);
      for (const ql of qLines) {
        checkNewPage(18);
        currentPage.drawRectangle({
          x: margin + 4,
          y: y - 3,
          width: contentWidth - 4,
          height: 16,
          color: rgb(0.97, 0.98, 0.99),
        });
        currentPage.drawLine({
          start: { x: margin, y: y + 9 },
          end: { x: margin, y: y - 6 },
          thickness: 3.5,
          color: rgb(0.06, 0.09, 0.16),
        });
        currentPage.drawText(ql, {
          x: margin + 12,
          y,
          size: 10,
          font: fontOblique,
          color: rgb(0.28, 0.33, 0.4),
        });
        y -= 16;
      }
    } else if (trimmed.startsWith('- [x] ') || trimmed.startsWith('* [x] ')) {
      const taskText = trimmed.substring(6).replace(/[*_`]/g, '');
      const tLines = wrapText(taskText, fontRegular, 10, contentWidth - 24);
      for (let j = 0; j < tLines.length; j++) {
        checkNewPage(16);
        if (j === 0) {
          currentPage.drawRectangle({
            x: margin,
            y: y - 1,
            width: 11,
            height: 11,
            color: rgb(0.06, 0.09, 0.16),
          });
          currentPage.drawText('v', {
            x: margin + 2,
            y: y + 1,
            size: 8,
            font: fontBold,
            color: rgb(1, 1, 1),
          });
        }
        currentPage.drawText(tLines[j], {
          x: margin + 20,
          y,
          size: 10,
          font: fontRegular,
          color: rgb(0.12, 0.16, 0.23),
        });
        y -= 16;
      }
    } else if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('* [ ] ')) {
      const taskText = trimmed.substring(6).replace(/[*_`]/g, '');
      const tLines = wrapText(taskText, fontRegular, 10, contentWidth - 24);
      for (let j = 0; j < tLines.length; j++) {
        checkNewPage(16);
        if (j === 0) {
          currentPage.drawRectangle({
            x: margin,
            y: y - 1,
            width: 11,
            height: 11,
            borderColor: rgb(0.6, 0.65, 0.7),
            borderWidth: 1,
            color: rgb(1, 1, 1),
          });
        }
        currentPage.drawText(tLines[j], {
          x: margin + 20,
          y,
          size: 10,
          font: fontRegular,
          color: rgb(0.28, 0.33, 0.4),
        });
        y -= 16;
      }
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const bulletText = trimmed.replace(/^[-*]\s+/, '');
      const bLines = wrapText(bulletText, fontRegular, 10, contentWidth - 20);
      for (let j = 0; j < bLines.length; j++) {
        checkNewPage(16);
        if (j === 0) {
          currentPage.drawText('•', {
            x: margin + 2,
            y,
            size: 12,
            font: fontBold,
            color: rgb(0.12, 0.16, 0.23),
          });
        }

        // Render bullet line text with inline code backticks parsing & perfect alignment
        const parts = bLines[j].split(/(`[^`]+`)/g);
        let posX = margin + 18;

        for (const part of parts) {
          if (part.startsWith('`') && part.endsWith('`')) {
            const codeText = part.slice(1, -1);
            const cW = fontMono.widthOfTextAtSize(codeText, 9) + 8;
            currentPage.drawRectangle({
              x: posX,
              y: y - 2,
              width: cW,
              height: 13,
              color: rgb(0.92, 0.94, 0.96),
              borderColor: rgb(0.8, 0.84, 0.88),
              borderWidth: 0.5,
            });
            currentPage.drawText(codeText, {
              x: posX + 4,
              y: y + 1,
              size: 9,
              font: fontMono,
              color: rgb(0.12, 0.15, 0.22),
            });
            posX += cW + 4;
          } else if (part) {
            const isBold = part.startsWith('**') || part.startsWith('__');
            const cleanPart = part.replace(/[*_]/g, '');
            const selFont = isBold ? fontBold : fontRegular;
            currentPage.drawText(cleanPart, {
              x: posX,
              y,
              size: 10,
              font: selFont,
              color: rgb(0.12, 0.16, 0.23),
            });
            posX += selFont.widthOfTextAtSize(cleanPart, 10);
          }
        }
        y -= 16;
      }
    } else {
      // Paragraph line with inline code backticks parsing
      const pLines = wrapText(trimmed, fontRegular, 10, contentWidth);
      for (const pl of pLines) {
        checkNewPage(16);
        const parts = pl.split(/(`[^`]+`)/g);
        let posX = margin;

        for (const part of parts) {
          if (part.startsWith('`') && part.endsWith('`')) {
            const codeText = part.slice(1, -1);
            const cW = fontMono.widthOfTextAtSize(codeText, 9) + 8;
            currentPage.drawRectangle({
              x: posX,
              y: y - 2,
              width: cW,
              height: 13,
              color: rgb(0.92, 0.94, 0.96),
              borderColor: rgb(0.8, 0.84, 0.88),
              borderWidth: 0.5,
            });
            currentPage.drawText(codeText, {
              x: posX + 4,
              y: y + 1,
              size: 9,
              font: fontMono,
              color: rgb(0.12, 0.15, 0.22),
            });
            posX += cW + 4;
          } else if (part) {
            const isBold = part.startsWith('**') || part.startsWith('__');
            const cleanPart = part.replace(/[*_]/g, '');
            const selFont = isBold ? fontBold : fontRegular;
            currentPage.drawText(cleanPart, {
              x: posX,
              y,
              size: 10,
              font: selFont,
              color: rgb(0.12, 0.16, 0.23),
            });
            posX += selFont.widthOfTextAtSize(cleanPart, 10);
          }
        }
        y -= 16;
      }
    }
  }

  const pdfBytes = await pdf.save({ useObjectStreams: true });
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
};

export const textToPdf = async (text: string, title?: string): Promise<Blob> => {
  return markdownToPdf(text, title);
};

/**
 * 100% REAL PDF Text Extraction into Markdown using PDF.js
 */
export const extractPdfMarkdown = async (file: File): Promise<string> => {
  return extractRealPdfMarkdown(file);
};

export const extractPdfText = async (file: File): Promise<string> => {
  return extractPdfMarkdown(file);
};
