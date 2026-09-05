import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { removePdfMetadata } from "../utils/pdfMetadata";
import { rotatePdfAllPages, createPdfForm, getPdfFormFields, fillPdfFormFields, flattenPdfForm } from "../utils/pdf";
import { isCanvasBlank } from "../utils/canvasBlankCheck";
import { parseXlsxWorkbook } from "../utils/officeConverters";
import { getSupportedTargets, isSupportedSourceFormat } from "../utils/conversionCapabilities";
import { calculateSkewAngle } from "../utils/imageCleanup";

describe("Feature Accuracy & Reliability Verification", () => {
  describe("1. PDF Metadata Scrubber", () => {
    it("successfully creates a PDF with metadata and strips it completely", async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.setTitle("Secret Document Title");
      pdfDoc.setAuthor("John Doe");
      pdfDoc.setSubject("Confidential Subject");
      pdfDoc.addPage([400, 400]);
      const initialBytes = await pdfDoc.save();
      const initialFile = new File([initialBytes as any], "test.pdf", { type: "application/pdf" });

      const cleanedBlob = await removePdfMetadata(initialFile);
      expect(cleanedBlob.size).toBeGreaterThan(0);

      const cleanedBuffer = await cleanedBlob.arrayBuffer();
      const cleanedPdf = await PDFDocument.load(cleanedBuffer);
      expect(cleanedPdf.getTitle()).toBeFalsy();
      expect(cleanedPdf.getAuthor()).toBeFalsy();
      expect(cleanedPdf.getSubject()).toBeFalsy();
    });
  });

  describe("2. PDF Bulk Rotation", () => {
    it("rotates all pages by exactly the specified degrees", async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([500, 500]);
      pdfDoc.addPage([500, 500]);
      const initialBytes = await pdfDoc.save();
      const file = new File([initialBytes as any], "rotate_test.pdf", { type: "application/pdf" });

      const rotatedBlob = await rotatePdfAllPages(file, 90);
      const rotatedPdf = await PDFDocument.load(await rotatedBlob.arrayBuffer());
      const pages = rotatedPdf.getPages();
      expect(pages.length).toBe(2);
      expect(pages[0].getRotation().angle).toBe(90);
      expect(pages[1].getRotation().angle).toBe(90);
    });
  });

  describe("3. PDF Form Creation, Inspection & Filling", () => {
    it("creates interactive form fields, inspects them, and fills them", async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([600, 800]);
      const file = new File([await pdfDoc.save() as any], "form_test.pdf", { type: "application/pdf" });

      // Create form
      const formBlob = await createPdfForm(file);
      const formFile = new File([formBlob], "fillable.pdf", { type: "application/pdf" });

      // Inspect fields
      const fields = await getPdfFormFields(formFile);
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.some(f => f.name === "user.signature")).toBe(true);

      // Fill fields
      const filledBlob = await fillPdfFormFields(formFile, {
        "user.signature": "Jane Doe Signature",
      });
      const filledDoc = await PDFDocument.load(await filledBlob.arrayBuffer());
      const filledField = filledDoc.getForm().getTextField("user.signature");
      expect(filledField.getText()).toBe("Jane Doe Signature");

      // Flatten
      const flattenedBlob = await flattenPdfForm(new File([filledBlob], "filled.pdf", { type: "application/pdf" }));
      expect(flattenedBlob.size).toBeGreaterThan(0);
    });
  });

  describe("4. Blank Page Detection", () => {
    it("correctly identifies white canvas vs drawn canvas", () => {
      const canvas = document.createElement("canvas");
      canvas.width = 20;
      canvas.height = 20;
      const whiteData = new Uint8ClampedArray(20 * 20 * 4).fill(255);
      canvas.getContext = (() => ({
        getImageData: () => ({ data: whiteData }),
      })) as any;

      expect(isCanvasBlank(canvas)).toBe(true);

      const nonWhiteData = new Uint8ClampedArray(20 * 20 * 4);
      for (let i = 0; i < nonWhiteData.length; i += 4) {
        nonWhiteData[i] = 20;     // R
        nonWhiteData[i + 1] = 20; // G
        nonWhiteData[i + 2] = 20; // B
        nonWhiteData[i + 3] = 255;// A
      }
      canvas.getContext = (() => ({
        getImageData: () => ({ data: nonWhiteData }),
      })) as any;

      expect(isCanvasBlank(canvas)).toBe(false);
    });
  });

  describe("5. Office & Spreadsheet Parser", () => {
    it("parses structured CSV/text into valid sheet matrix with headers", async () => {
      const csv = "Product,Price,Quantity\nLaptop,999,5\nMouse,25,50\nKeyboard,75,20";
      const file = new File([csv], "sales.csv", { type: "text/csv" });

      const sheets = await parseXlsxWorkbook(file);
      expect(sheets.length).toBe(1);
      expect(sheets[0].rows.length).toBe(4);
      expect(sheets[0].rows[0]).toEqual(["Product", "Price", "Quantity"]);
      expect(sheets[0].rows[1]).toEqual(["Laptop", "999", "5"]);
    });
  });

  describe("6. Universal Format Capabilities", () => {
    it("supports extended multimedia and office formats", () => {
      // Legacy Video
      expect(isSupportedSourceFormat("vob")).toBe(true);
      expect(isSupportedSourceFormat("mpeg")).toBe(true);
      expect(isSupportedSourceFormat("wmv")).toBe(true);
      expect(isSupportedSourceFormat("flv")).toBe(true);

      // Office
      expect(isSupportedSourceFormat("xlsx")).toBe(true);
      expect(isSupportedSourceFormat("pptx")).toBe(true);
      expect(isSupportedSourceFormat("docx")).toBe(true);

      // Verify Target mappings
      expect(getSupportedTargets("vob").has("mp4")).toBe(true);
      expect(getSupportedTargets("vob").has("mp3")).toBe(true);
      expect(getSupportedTargets("mpeg").has("mp3")).toBe(true);
      expect(getSupportedTargets("xlsx").has("pdf")).toBe(true);
      expect(getSupportedTargets("pptx").has("pdf")).toBe(true);
    });
  });

  describe("7. Image Skew & Leveling Math", () => {
    it("computes skew angle reliably on horizontal text bounds", () => {
      const canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 100, 100);
        ctx.fillStyle = "#000000";
        ctx.fillRect(10, 48, 80, 4);
      }
      const angle = calculateSkewAngle(ctx as any, 100, 100, 10);
      expect(Math.abs(angle)).toBeLessThanOrEqual(10);
    });
  });
});
