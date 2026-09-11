import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { zipSync, strToU8 } from "fflate";
import { parseXlsxWorkbook, xlsxToHtml, pptxToPdf, xlsxToPdf } from "../utils/officeConverters";

describe("officeConverters", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("parses fallback plain text / CSV rows into sheets correctly", async () => {
    const csvContent = "Name,Age,Role\nAlice,30,Developer\nBob,25,Designer";
    const file = new File([csvContent], "data.csv", { type: "text/csv" });

    const sheets = await parseXlsxWorkbook(file);
    expect(sheets.length).toBe(1);
    expect(sheets[0].sheetName).toBe("Sheet 1");
    expect(sheets[0].rows.length).toBe(3);
    expect(sheets[0].rows[0]).toEqual(["Name", "Age", "Role"]);
    expect(sheets[0].rows[1]).toEqual(["Alice", "30", "Developer"]);
  });

  it("converts spreadsheet rows to standalone HTML tables with xlsxToHtml", async () => {
    const csvContent = "Item,Price\nWidget,$10\nGadget,$20";
    const file = new File([csvContent], "inventory.csv", { type: "text/csv" });

    const html = await xlsxToHtml(file);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<th>Item</th><th>Price</th>");
    expect(html).toContain("<td>Widget</td><td>$10</td>");
  });

  it("converts PPTX slide structures to multi-page PDF documents", async () => {
    const font = readFileSync('node_modules/@fontsource/roboto-mono/files/roboto-mono-latin-400-normal.woff');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength) }));
    const slide1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <p:spTree>
          <p:sp>
            <p:txBody>
              <a:p><a:r><a:t>Quarterly Review “2026”</a:t></a:r></a:p>
              <a:p><a:r><a:t>• Revenue grew by 25%—strong performance</a:t></a:r></a:p>
            </p:txBody>
          </p:sp>
        </p:spTree>
      </p:sld>`;

    const zipObj: Record<string, Uint8Array> = {
      "ppt/slides/slide1.xml": strToU8(slide1Xml),
    };
    const zippedBuffer = zipSync(zipObj);
    const pptxFile = new File([zippedBuffer], "presentation.pptx", {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });

    const pdfBlob = await pptxToPdf(pptxFile);
    expect(pdfBlob).toBeInstanceOf(Blob);
    expect(pdfBlob.type).toBe("application/pdf");
    expect(pdfBlob.size).toBeGreaterThan(500);
    if (process.env.PDF_QA_OUTPUT) {
      mkdirSync('.cache/pdf-qa', { recursive: true });
      writeFileSync('.cache/pdf-qa/slides.pdf', new Uint8Array(await pdfBlob.arrayBuffer()));
    }
  });

  it('preserves missing columns and inline strings instead of shifting values', async () => {
    const bytes = zipSync({ 'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>Name</t></is></c><c r="C1"><v>42</v></c></row></sheetData></worksheet>') });
    const sheets = await parseXlsxWorkbook(new File([bytes], 'sparse.xlsx'));
    expect(sheets[0].rows[0]).toEqual(['Name', '', '42']);
  });

  it('escapes user cells and filenames in exported HTML', async () => {
    const html = await xlsxToHtml(new File(['Header\n<script>alert(1)</script>'], '<img>.csv'));
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('rejects broken workbooks instead of treating ZIP bytes as CSV', async () => {
    await expect(parseXlsxWorkbook(new File(['broken'], 'bad.xlsx'))).rejects.toThrow('Could not read');
  });

  it('paginates spreadsheets beyond 100 rows without screenshot pages', async () => {
    const csv = 'Row,Value\n' + Array.from({ length: 140 }, (_, i) => `${i},Entry ${i}`).join('\n');
    const blob = await xlsxToPdf(new File([csv], 'long.csv'));
    const pdf = await PDFDocument.load(await blob.arrayBuffer());
    expect(pdf.getPageCount()).toBeGreaterThan(2);
    expect(pdf.getPage(0).getWidth()).toBeGreaterThan(pdf.getPage(0).getHeight());
    if (process.env.PDF_QA_OUTPUT) {
      mkdirSync('.cache/pdf-qa', { recursive: true });
      writeFileSync('.cache/pdf-qa/spreadsheet.pdf', new Uint8Array(await blob.arrayBuffer()));
    }
  });
});
