import { describe, expect, it } from 'vitest';
import { traceImageDataToSvg } from '../utils/svgTracer';

describe('SVG tracing engine', () => {
  it('creates real vector paths with preserved source dimensions', () => {
    const width = 8;
    const height = 8;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        data[offset] = x < 4 ? 230 : 20;
        data[offset + 1] = y < 4 ? 30 : 190;
        data[offset + 2] = x < 4 ? 40 : 220;
        data[offset + 3] = 255;
      }
    }

    const svg = traceImageDataToSvg({ width, height, data } as ImageData, 800, 600, {
      colors: 8,
      minimumPathLength: 0,
    });

    expect(svg).toContain('<path');
    expect(svg).toContain('viewBox=');
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="600"');
    expect(svg).not.toContain('<image');
  });
});
