import { describe, expect, it } from "vitest";
import { createComposition } from "../utils/imageLayers";

describe("imageLayers", () => {
  it("creates an empty composition and adds non-destructive layers", () => {
    const comp = createComposition(800, 600, "#ffffff");
    expect(comp.width).toBe(800);
    expect(comp.height).toBe(600);
    expect(comp.layers.length).toBe(0);

    comp.layers.push({
      id: "layer-1",
      name: "Watermark Text",
      type: "text",
      visible: true,
      opacity: 0.85,
      blendMode: "source-over",
      x: 50,
      y: 50,
      text: "Confidential",
      fontSize: 32,
      color: "#ff0000",
    });

    expect(comp.layers.length).toBe(1);
    expect(comp.layers[0].name).toBe("Watermark Text");
  });
});
