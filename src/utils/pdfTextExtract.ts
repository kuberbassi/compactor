import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Ensure worker is configured
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Extracts all selectable text from every page of a PDF and returns it as a
 * plain TXT blob with per-page separators.
 */
export const extractPdfTextToTxt = async (file: File): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    verbosity: 0,
  });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  const pageTexts: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();

    let lastY: number | null = null;
    const lines: string[] = [];
    let currentLine = "";

    for (const item of textContent.items as any[]) {
      if (item.str === undefined) continue;
      const y: number | null = item.transform ? Math.round(item.transform[5]) : null;

      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
        if (currentLine.trim()) lines.push(currentLine.trimEnd());
        currentLine = item.str;
      } else {
        currentLine += item.str;
      }
      lastY = y;
    }
    if (currentLine.trim()) lines.push(currentLine.trimEnd());

    pageTexts.push(`--- Page ${i} of ${numPages} ---\n${lines.join("\n")}`);
  }

  const fullText = pageTexts.join("\n\n");
  return new Blob([fullText], { type: "text/plain;charset=utf-8" });
};
