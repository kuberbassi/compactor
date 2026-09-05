import { describe, expect, it } from "vitest";
import { calculateSkewAngle } from "../utils/imageCleanup";

describe("imageCleanup", () => {
  it("calculates skew angle on horizontal canvas safely", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 100, 100);
      ctx.fillStyle = "#000000";
      ctx.fillRect(10, 45, 80, 10);
    }
    const angle = calculateSkewAngle(ctx as any, 100, 100, 10);
    expect(typeof angle).toBe("number");
    expect(angle).toBeGreaterThanOrEqual(-10);
    expect(angle).toBeLessThanOrEqual(10);
  });
});
