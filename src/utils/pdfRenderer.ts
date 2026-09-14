import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { isCanvasBlank } from './canvasBlankCheck';

// Bundle worker locally via Vite asset import to ensure zero network/CORS blocks
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/** Returns whether at least one page has an embedded, selectable text layer. */
export const hasSelectablePdfText = async (file: File): Promise<boolean> => {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      verbosity: 0,
    });
    const pdfDoc = await loadingTask.promise;
    for (let index = 1; index <= pdfDoc.numPages; index += 1) {
      const textContent = await (await pdfDoc.getPage(index)).getTextContent();
      if (textContent.items.some(item => 'str' in item && typeof item.str === 'string' && item.str.trim().length > 0)) {
        return true;
      }
    }
  } catch (error) {
    console.warn('Unable to inspect the PDF text layer:', error);
  }
  return false;
};

/**
 * Renders real high-resolution visual thumbnails for each page of a PDF file using pdfjs-dist
 */
export const renderPdfThumbnails = async (
  file: File,
  maxPages: number = 100,
  scale: number = 1.5,
  onProgress?: (renderedCount: number, total: number) => void,
  onThumbnail?: (pageIndex: number, thumbnailUrl: string, width: number, height: number) => void,
  onBlankPageAssessment?: (pageIndex: number, isBlank: boolean | null) => void
): Promise<string[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ 
      data: new Uint8Array(arrayBuffer),
      verbosity: 0,
    });
    const pdfDoc = await loadingTask.promise;

    const numPages = Math.min(pdfDoc.numPages, maxPages);
    const thumbnails: string[] = [];

    for (let i = 1; i <= numPages; i++) {
      let renderedWidth = 0;
      let renderedHeight = 0;
      try {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        renderedWidth = canvas.width;
        renderedHeight = canvas.height;

        const context = canvas.getContext('2d', { alpha: false });
        if (context) {
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);

          const renderContext: any = {
            canvasContext: context,
            viewport: viewport,
          };

          const renderTask = page.render(renderContext);
          await renderTask.promise;

          if (onBlankPageAssessment) {
            try {
              const textContent = await page.getTextContent();
              const hasText = textContent.items.some(item => 'str' in item && item.str.trim().length > 0);
              onBlankPageAssessment(i - 1, !hasText && isCanvasBlank(canvas));
            } catch {
              onBlankPageAssessment(i - 1, null);
            }
          }

          thumbnails.push(canvas.toDataURL('image/jpeg', 0.92));
        } else {
          thumbnails.push('');
          onBlankPageAssessment?.(i - 1, null);
        }
      } catch (pageErr) {
        console.warn(`Failed rendering high-res page ${i}:`, pageErr);
        thumbnails.push('');
        onBlankPageAssessment?.(i - 1, null);
      }

      if (onProgress) {
        onProgress(i, numPages);
      }
      if (onThumbnail) {
        onThumbnail(i - 1, thumbnails[i - 1], renderedWidth, renderedHeight);
      }
    }

    return thumbnails;
  } catch (err) {
    console.error("Failed to render PDF page thumbnails:", err);
    return [];
  }
};

/**
 * Extracts 100% REAL text layer contents from PDF pages using PDF.js and formats into Markdown
 */
export const extractRealPdfMarkdown = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ 
      data: new Uint8Array(arrayBuffer),
      verbosity: 0,
    });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    let markdown = `# ${file.name.replace('.pdf', '')}\n\n`;

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      
      markdown += `## Page ${i}\n\n`;

      let lastY: number | null = null;
      let lineText = '';

      for (const item of textContent.items as any[]) {
        if (!item.str) continue;

        const currentY = item.transform ? item.transform[5] : 0;
        if (lastY !== null && Math.abs(currentY - lastY) > 6) {
          if (lineText.trim()) {
            const trimmed = lineText.trim();
            if (trimmed.length < 45 && /^[A-Z0-9\s:_-]{3,}$/.test(trimmed)) {
              markdown += `### ${trimmed}\n\n`;
            } else if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
              markdown += `- ${trimmed.replace(/^[•-]\s*/, '')}\n`;
            } else {
              markdown += `${trimmed}\n\n`;
            }
          }
          lineText = item.str;
        } else {
          lineText += (lineText ? ' ' : '') + item.str;
        }
        lastY = currentY;
      }

      if (lineText.trim()) {
        markdown += `${lineText.trim()}\n\n`;
      }
      markdown += `---\n\n`;
    }

    return markdown;
  } catch (err) {
    console.error("Failed to extract PDF text streams:", err);
    return `# Document Extraction Notice\n\nCould not extract text layer. Document may be a scanned image or raster page.`;
  }
};

/**
 * Renders each page of a PDF file to high-resolution PNG or JPG Blobs (300 DPI)
 */
export const renderPdfPagesToImages = async (
  file: File,
  format: 'png' | 'jpg' = 'png',
  dpiScale: number = 2.5
): Promise<{ pageNumber: number; blob: Blob; url: string }[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ 
      data: new Uint8Array(arrayBuffer),
      verbosity: 0,
    });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const results: { pageNumber: number; blob: Blob; url: string }[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: dpiScale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const context = canvas.getContext('2d', { alpha: false });
    if (context) {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      const renderTask = page.render({ canvasContext: context!, viewport } as any);
      await renderTask.promise;

      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), mime, 0.95);
      });

      results.push({
        pageNumber: i,
        blob,
        url: URL.createObjectURL(blob),
      });
    }
  }

  return results;
};
