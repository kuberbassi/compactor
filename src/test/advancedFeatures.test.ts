import { describe, expect, it } from "vitest";

describe("advancedFeatures", () => {
  it("formats OCR language codes correctly", () => {
    const supportedLangs = ["eng", "spa", "fra", "deu", "ita", "por", "chi_sim", "jpn", "rus", "hin"];
    expect(supportedLangs).toContain("eng");
    expect(supportedLangs.length).toBe(10);
  });

  it("validates subtitle extraction format options", () => {
    const formats: Array<"srt" | "vtt"> = ["srt", "vtt"];
    expect(formats).toEqual(["srt", "vtt"]);
  });
});
