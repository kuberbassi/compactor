import type { Content } from "pdfmake/interfaces";
import { createStructuredPdf } from "./markdownPdf";
import { escapeHtml } from "./htmlText";
import { unzipSync, strFromU8 } from "fflate";

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
          const val = type === 'inlineStr' ? c.querySelector('is')?.textContent || '' : vNode?.textContent || '';
          const columnLetters = c.getAttribute('r')?.match(/^[A-Z]+/i)?.[0].toUpperCase();
          const column = columnLetters ? Array.from(columnLetters).reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1 : rowData.length;
          if (column > 16383) throw new Error('Spreadsheet column is outside the XLSX limit.');
          while (rowData.length < column) rowData.push('');

          if (type === "s" && val !== "") {
            const sIdx = parseInt(val, 10);
            rowData[column] = sharedStrings[sIdx] || "";
          } else {
            rowData[column] = val;
          }
        });
        if (rowData.length > 0) rows.push(rowData);
      });

      sheets.push({
        sheetName: `Sheet ${idx + 1}`,
        rows: rows.length > 0 ? rows : [["(Empty Sheet)"]],
      });
    }
  } catch (error) {
    if (/\.xlsx$/i.test(file.name)) throw new Error('Could not read this XLSX workbook.', { cause: error });
  }

  if (sheets.length === 0) {
    if (/\.xlsx$/i.test(file.name)) throw new Error('No readable worksheets found in this XLSX workbook.');
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
export const xlsxToPdf = async (file: File, onProgress?: OfficeConversionProgress): Promise<Blob> => {
  onProgress?.(15, "Parsing spreadsheet cells...");
  const sheets = await parseXlsxWorkbook(file);
  const content: Content[] = [];
  sheets.forEach((sheet, index) => {
    content.push({ text: sheet.sheetName, fontSize: 18, bold: true, margin: [0, 0, 0, 12], ...(index ? { pageBreak: 'before' as const } : {}) });
    const columns = Math.max(1, ...sheet.rows.map(row => row.length));
    content.push({ table: { headerRows: 1, widths: Array(columns).fill('*'), body: sheet.rows.map((row, i) => Array.from({ length: columns }, (_, col) => ({ text: row[col] || '', bold: i === 0, fillColor: i === 0 ? '#e8edf4' : '#ffffff', margin: [2, 4, 2, 4] }))) }, layout: 'lightHorizontalLines' });
  });
  onProgress?.(70, "Paginating spreadsheet tables...");
  return createStructuredPdf({ info: { title: file.name }, pageSize: 'A4', pageOrientation: 'landscape', pageMargins: 36, defaultStyle: { font: 'Roboto', fontSize: 9 }, content });
};

/**
 * Converts an XLSX spreadsheet to a standalone responsive HTML table.
 */
export const xlsxToHtml = async (file: File): Promise<string> => {
  const sheets = await parseXlsxWorkbook(file);
  let html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(file.name)}</title><style>body{font-family:system-ui,-apple-system,sans-serif;padding:32px;background:#f8fafc;color:#0f172a;}h1{font-size:22px;}h2{font-size:16px;color:#475569;margin-top:28px;}table{width:100%;border-collapse:collapse;margin-bottom:32px;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);}th,td{padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;}th{background:#f1f5f9;font-weight:700;color:#1e293b;}tr:nth-child(even){background:#f8fafc;}</style></head><body><h1>${escapeHtml(file.name)}</h1>`;

  for (const sheet of sheets) {
    html += `<h2>${escapeHtml(sheet.sheetName)}</h2><table>`;
    sheet.rows.forEach((row, i) => {
      const tag = i === 0 ? "th" : "td";
      html += `<tr>${row.map((c) => `<${tag}>${escapeHtml(c)}</${tag}>`).join("")}</tr>`;
    });
    html += `</table>`;
  }

  html += `</body></html>`;
  return html;
};

/** Extract slide text into readable pages; original slide artwork is not reproduced. */
export const pptxToPdf = async (file: File, onProgress?: OfficeConversionProgress): Promise<Blob> => {
  onProgress?.(15, 'Extracting slide text...');
  const unzipped = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const keys = Object.keys(unzipped).filter(key => /^ppt\/slides\/slide\d+\.xml$/.test(key))
    .sort((a, b) => Number(a.match(/slide(\d+)/)?.[1]) - Number(b.match(/slide(\d+)/)?.[1]));
  if (!keys.length) throw new Error('No readable slides found in this PPTX file.');
  const content: Content[] = [];
  keys.forEach((key, index) => {
    const xml = new DOMParser().parseFromString(strFromU8(unzipped[key]), 'application/xml');
    const paragraphs = Array.from(xml.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'p'))
      .map(p => Array.from(p.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 't')).map(t => t.textContent || '').join(''));
    content.push({ text: `Slide ${index + 1}`, fontSize: 10, color: '#64748b', margin: [0, 0, 0, 10], ...(index ? { pageBreak: 'before' as const } : {}) });
    paragraphs.forEach((text, i) => content.push({ text, bold: i === 0, fontSize: i === 0 ? 24 : 14, margin: [0, 0, 0, 12] }));
  });
  onProgress?.(70, 'Paginating slide text...');
  return createStructuredPdf({ info: { title: file.name }, pageSize: { width: 960, height: 540 }, pageMargins: 48, defaultStyle: { font: 'Roboto', fontSize: 14 }, content });
};
