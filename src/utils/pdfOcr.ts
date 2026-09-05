import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import Tesseract from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface OcrProgressCallback {
  (status: string, percent: number): void;
}

/**
 * Performs OCR on an image canvas or PDF page and creates a searchable PDF with invisible selectable text.
 */
export const createSearchableOcrPdf = async (
  file: File,
  language: string = "eng",
  onProgress?: OcrProgressCallback
): Promise<Blob> => {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const newPdf = await PDFDocument.create();
  const font = await newPdf.embedFont(StandardFonts.Helvetica);

  if (isPdf) {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      verbosity: 0,
    });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (onProgress) {
        onProgress(`Rendering page ${pageNum} of ${numPages}...`, (pageNum / (numPages + 1)) * 30);
      }

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for sharp OCR

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) continue;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const renderTask = (page as any).render({ canvasContext: ctx, viewport, canvas } as any);
      await renderTask.promise;

      if (onProgress) {
        onProgress(`Recognizing text on page ${pageNum}...`, 30 + (pageNum / numPages) * 50);
      }

      const { data } = await Tesseract.recognize(canvas, language);

      const imgBlob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.88));
      const imgBytes = await imgBlob.arrayBuffer();
      const embeddedImg = await newPdf.embedJpg(imgBytes);

      // Create PDF page with dimensions of original viewport (scaled back to 72 DPI points)
      const pdfPageWidth = viewport.width / 2.0;
      const pdfPageHeight = viewport.height / 2.0;
      const newPage = newPdf.addPage([pdfPageWidth, pdfPageHeight]);

      // Draw background scan image
      newPage.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: pdfPageWidth,
        height: pdfPageHeight,
      });

      // Overlay invisible selectable text for each recognized word
      const words = (data as any).words || [];
      for (const w of words) {
        if (!w.text || !w.bbox) continue;
        const scaleX = pdfPageWidth / canvas.width;
        const scaleY = pdfPageHeight / canvas.height;

        const x = w.bbox.x0 * scaleX;
        const y = pdfPageHeight - (w.bbox.y1 * scaleY);
        const boxHeight = (w.bbox.y1 - w.bbox.y0) * scaleY;
        const fontSize = Math.max(6, Math.min(72, boxHeight * 0.85));

        try {
          newPage.drawText(w.text, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
            opacity: 0, // Invisible text layer
          });
        } catch {
          // Ignore font encoding issues for special characters
        }
      }
    }
  } else {
    // Single image file OCR
    if (onProgress) onProgress("Recognizing text from image...", 40);
    const { data } = await Tesseract.recognize(file, language);

    const imgBytes = await file.arrayBuffer();
    const isJpg = file.type.includes("jpeg") || file.name.toLowerCase().endsWith(".jpg");
    const embeddedImg = isJpg ? await newPdf.embedJpg(imgBytes) : await newPdf.embedPng(imgBytes);

    const { width, height } = embeddedImg;
    const newPage = newPdf.addPage([width, height]);
    newPage.drawImage(embeddedImg, { x: 0, y: 0, width, height });

    const words = (data as any).words || [];
    for (const w of words) {
      if (!w.text || !w.bbox) continue;
      const x = w.bbox.x0;
      const y = height - w.bbox.y1;
      const boxHeight = w.bbox.y1 - w.bbox.y0;
      const fontSize = Math.max(6, Math.min(72, boxHeight * 0.85));

      try {
        newPage.drawText(w.text, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
          opacity: 0,
        });
      } catch {}
    }
  }

  if (onProgress) onProgress("Finalizing searchable PDF...", 95);
  const pdfBytes = await newPdf.save({ useObjectStreams: true });
  return new Blob([pdfBytes as any], { type: "application/pdf" });
};

/**
 * Extracts pure text from a PDF or Image using OCR.
 */
export const extractTextWithOcr = async (
  file: File,
  language: string = "eng",
  onProgress?: OcrProgressCallback
): Promise<string> => {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    if (onProgress) onProgress("Running OCR on image...", 50);
    const { data } = await Tesseract.recognize(file, language);
    return data.text;
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    verbosity: 0,
  });
  const pdfDoc = await loadingTask.promise;
  const fullText: string[] = [];

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    if (onProgress) onProgress(`OCR processing page ${i} of ${pdfDoc.numPages}...`, (i / pdfDoc.numPages) * 100);
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await (page as any).render({ canvasContext: ctx, viewport, canvas } as any).promise;

    const { data } = await Tesseract.recognize(canvas, language);
    fullText.push(`--- Page ${i} ---\n${data.text}`);
  }

  return fullText.join("\n\n");
};
