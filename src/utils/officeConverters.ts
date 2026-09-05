import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { unzipSync, strFromU8 } from "fflate";
import { safeHtml2Canvas } from "./domSanitizer";

export type OfficeConversionProgress = (percent: number, status: string) => void;

/**
 * Extracts raw text and sheets from an XLSX (OpenXML Spreadsheet) file.
 */
export const parseXlsxWorkbook = async (file: File): Promise<{ sheetName: string; rows: string[][] }[]> => {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const sheets: { sheetName: string; rows: string[][] }[] = [];

  try {
    const unzipped = unzipSync(buffer);

    // 1. Parse Shared Strings
    const sharedStrings: string[] = [];
    const ssFile = unzipped["xl/sharedStrings.xml"];
    if (ssFile) {
      const ssXml = strFromU8(ssFile);
      const parser = new DOMParser();
      const doc = parser.parseFromString(ssXml, "application/xml");
      const siNodes = doc.querySelectorAll("si");
      siNodes.forEach((si) => {
        sharedStrings.push(si.textContent || "");
      });
    }

    // 2. Parse Sheets
    const sheetKeys = Object.keys(unzipped).filter((k) => k.startsWith("xl/worksheets/sheet") && k.endsWith(".xml"));

    for (let idx = 0; idx < sheetKeys.length; idx++) {
      const key = sheetKeys[idx];
      const sheetXml = strFromU8(unzipped[key]);
      const parser = new DOMParser();
      const doc = parser.parseFromString(sheetXml, "application/xml");
      const rowNodes = doc.querySelectorAll("row");
      const rows: string[][] = [];

      rowNodes.forEach((rowNode) => {
        const rowData: string[] = [];
        const cellNodes = rowNode.querySelectorAll("c");
        cellNodes.forEach((c) => {
          const type = c.getAttribute("t");
          const vNode = c.querySelector("v");
          const val = vNode?.textContent || "";

          if (type === "s" && val !== "") {
            const sIdx = parseInt(val, 10);
            rowData.push(sharedStrings[sIdx] || "");
          } else {
            rowData.push(val);
          }
        });
        if (rowData.length > 0) rows.push(rowData);
      });

      sheets.push({
        sheetName: `Sheet ${idx + 1}`,
        rows: rows.length > 0 ? rows : [["(Empty Sheet)"]],
      });
    }
  } catch {
    // Non-zip file (e.g. CSV or TSV)
  }

  if (sheets.length === 0) {
    // Fallback: treat as plain text / CSV
    const text = await file.text();
    const rows = text
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0)
      .map((l) => l.split(",").map((c) => c.trim()));
    sheets.push({ sheetName: "Sheet 1", rows });
  }

  return sheets;
};

/**
 * Converts an XLSX / CSV spreadsheet to a styled multi-page PDF document.
 */
export const xlsxToPdf = async (
  file: File,
  onProgress?: OfficeConversionProgress
): Promise<Blob> => {
  onProgress?.(15, "Parsing spreadsheet sheets & cell matrix...");
  const sheets = await parseXlsxWorkbook(file);

  onProgress?.(40, "Formatting high-fidelity spreadsheet tables...");
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "1100px",
    background: "#ffffff",
    color: "#0f172a",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: "40px",
    zIndex: "-9999",
    opacity: "1",
    pointerEvents: "none",
  });

  const pdfDoc = await PDFDocument.create();

  for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
    const sheet = sheets[sIdx];
    onProgress?.(45 + Math.round((sIdx / sheets.length) * 45), `Rendering ${sheet.sheetName}...`);

    host.innerHTML = `
      <div style="margin-bottom: 30px;">
        <h2 style="font-size: 20px; font-weight: 800; color: #1e293b; margin: 0 0 4px 0;">${file.name.replace(/\.[^/.]+$/, "")}</h2>
        <span style="font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">${sheet.sheetName}</span>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
            ${(sheet.rows[0] || []).map((col, i) => `<th style="padding: 8px 12px; font-weight: 700; color: #334155; border: 1px solid #cbd5e1;">${col || `Col ${i + 1}`}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${sheet.rows.slice(1, 100).map((row, rIdx) => `
            <tr style="background: ${rIdx % 2 === 0 ? "#ffffff" : "#f8fafc"}; border-bottom: 1px solid #e2e8f0;">
              ${row.map((cell) => `<td style="padding: 7px 12px; border: 1px solid #e2e8f0; color: #1e293b;">${cell}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    document.body.appendChild(host);
    const canvas = await safeHtml2Canvas(host, {
      scale: 2,
      backgroundColor: "#ffffff"
    });
    document.body.removeChild(host);

    const imgBlob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.94));
    const imgBytes = await imgBlob.arrayBuffer();
    const embedded = await pdfDoc.embedJpg(imgBytes);

    const pdfPageWidth = 595.28; // A4 portrait points
    const scaleFactor = pdfPageWidth / canvas.width;
    const pdfPageHeight = canvas.height * scaleFactor;

    const page = pdfDoc.addPage([pdfPageWidth, pdfPageHeight]);
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: pdfPageWidth,
      height: pdfPageHeight,
    });
  }

  onProgress?.(95, "Compiling PDF document...");
  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
  return new Blob([pdfBytes as any], { type: "application/pdf" });
};

/**
 * Converts an XLSX spreadsheet to a standalone responsive HTML table.
 */
export const xlsxToHtml = async (file: File): Promise<string> => {
  const sheets = await parseXlsxWorkbook(file);
  let html = `<!doctype html><html><head><meta charset="utf-8"><title>${file.name}</title><style>body{font-family:system-ui,-apple-system,sans-serif;padding:32px;background:#f8fafc;color:#0f172a;}h1{font-size:22px;}h2{font-size:16px;color:#475569;margin-top:28px;}table{width:100%;border-collapse:collapse;margin-bottom:32px;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);}th,td{padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;}th{background:#f1f5f9;font-weight:700;color:#1e293b;}tr:nth-child(even){background:#f8fafc;}</style></head><body><h1>${file.name}</h1>`;

  for (const sheet of sheets) {
    html += `<h2>${sheet.sheetName}</h2><table>`;
    sheet.rows.forEach((row, i) => {
      const tag = i === 0 ? "th" : "td";
      html += `<tr>${row.map((c) => `<${tag}>${c}</${tag}>`).join("")}</tr>`;
    });
    html += `</table>`;
  }

  html += `</body></html>`;
  return html;
};

const sanitizeForPdf = (text: string): string => {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2026]/g, '...')
    .replace(/[^\t\n\r -\u007E\u00A0-\u00FF]/g, ' ');
};

/**
 * Converts a PPTX presentation to a multi-page PDF presentation.
 */
export const pptxToPdf = async (
  file: File,
  onProgress?: OfficeConversionProgress
): Promise<Blob> => {
  onProgress?.(15, "Extracting presentation slide structure...");
  const buffer = new Uint8Array(await file.arrayBuffer());
  const unzipped = unzipSync(buffer);

  const slideKeys = Object.keys(unzipped)
    .filter((k) => k.startsWith("ppt/slides/slide") && k.endsWith(".xml"))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/[^0-9]/g, ""), 10) || 0;
      const numB = parseInt(b.replace(/[^0-9]/g, ""), 10) || 0;
      return numA - numB;
    });

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Widescreen 16:9 PDF dimensions in points
  const slideWidth = 960;
  const slideHeight = 540;

  for (let idx = 0; idx < slideKeys.length; idx++) {
    onProgress?.(25 + Math.round((idx / slideKeys.length) * 65), `Compiling slide ${idx + 1} of ${slideKeys.length}...`);
    const xmlStr = strFromU8(unzipped[slideKeys[idx]]);
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, "application/xml");

    // Extract all text paragraphs
    const paragraphs: string[] = [];
    const pNodes = doc.querySelectorAll("p");
    pNodes.forEach((p) => {
      const text = p.textContent?.trim();
      if (text) paragraphs.push(text);
    });

    const page = pdfDoc.addPage([slideWidth, slideHeight]);

    // Draw Slide Background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: slideWidth,
      height: slideHeight,
      color: rgb(0.98, 0.98, 0.99),
    });

    // Draw Slide Header Accent
    page.drawRectangle({
      x: 0,
      y: slideHeight - 8,
      width: slideWidth,
      height: 8,
      color: rgb(0.2, 0.4, 0.9),
    });

    // Draw Slide Number
    page.drawText(`${idx + 1}`, {
      x: slideWidth - 50,
      y: 30,
      size: 14,
      font: regularFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Draw Title
    const rawTitle = paragraphs[0] || `Slide ${idx + 1}`;
    const title = sanitizeForPdf(rawTitle).substring(0, 75);
    page.drawText(title, {
      x: 60,
      y: slideHeight - 70,
      size: 28,
      font,
      color: rgb(0.1, 0.15, 0.25),
    });

    // Draw Content Paragraphs
    let currentY = slideHeight - 130;
    const bodyParagraphs = paragraphs.slice(1);

    for (const bodyP of bodyParagraphs) {
      if (currentY < 60) break;
      const cleanBody = sanitizeForPdf(bodyP).substring(0, 100);
      page.drawText(`- ${cleanBody}`, {
        x: 80,
        y: currentY,
        size: 16,
        font: regularFont,
        color: rgb(0.2, 0.25, 0.35),
      });
      currentY -= 32;
    }
  }

  onProgress?.(95, "Finalizing presentation PDF...");
  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
  return new Blob([pdfBytes as any], { type: "application/pdf" });
};
