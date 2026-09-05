import { describe, expect, it, vi } from "vitest";
import { isCanvasBlank } from "../utils/canvasBlankCheck";

describe("pdfBlankPageDetector", () => {
  it("detects completely white canvas as blank", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;
    const whiteData = new Uint8ClampedArray(10 * 10 * 4).fill(255);
    canvas.getContext = vi.fn().mockReturnValue({
      getImageData: () => ({ data: whiteData }),
    }) as any;

    expect(isCanvasBlank(canvas)).toBe(true);
  });

  it("detects canvas with high-density content as non-blank", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;
    const blackData = new Uint8ClampedArray(10 * 10 * 4); // All zeros = pure black with a=0 (transparent)
    // Fill with black opaque pixels
    for (let i = 0; i < blackData.length; i += 4) {
      blackData[i] = 0;     // R
      blackData[i + 1] = 0; // G
      blackData[i + 2] = 0; // B
      blackData[i + 3] = 255; // A (opaque)
    }
    canvas.getContext = vi.fn().mockReturnValue({
      getImageData: () => ({ data: blackData }),
    }) as any;

    expect(isCanvasBlank(canvas)).toBe(false);
  });

  it("treats empty zero-dimension canvas as blank safely", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 0;
    canvas.height = 0;
    expect(isCanvasBlank(canvas)).toBe(true);
  });
});
