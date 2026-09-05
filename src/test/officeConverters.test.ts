import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { parseXlsxWorkbook, xlsxToHtml, pptxToPdf } from "../utils/officeConverters";

describe("officeConverters", () => {
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
  });
});

