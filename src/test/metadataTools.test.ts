import { describe, it, expect } from 'vitest';

describe('Metadata & PDF Utilities', () => {
  it('page range parser correctly expands dash and comma ranges', () => {
    const rangeInput = '1-3, 5, 8-10';
    const pages: number[] = [];

    const parts = rangeInput.split(',').map((p) => p.trim());
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        for (let i = start; i <= end; i++) pages.push(i);
      } else if (!isNaN(Number(part)) && part.length > 0) {
        pages.push(Number(part));
      }
    }

    expect(pages).toEqual([1, 2, 3, 5, 8, 9, 10]);
  });

  it('PDF page rotation angle normalizes within 0, 90, 180, 270 degrees', () => {
    const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360;

    expect(normalizeAngle(90)).toBe(90);
    expect(normalizeAngle(450)).toBe(90);
    expect(normalizeAngle(-90)).toBe(270);
  });

  it('metadata field sanitizer strips private EXIF GPS location data', () => {
    const mockEXIF = {
      make: 'Camera Brand',
      model: 'Model X',
      gpsLatitude: '37.7749 N',
      gpsLongitude: '122.4194 W',
    };

    const sanitizeMetadata = (exif: Record<string, any>) => {
      const copy = { ...exif };
      delete copy.gpsLatitude;
      delete copy.gpsLongitude;
      return copy;
    };

    const sanitized = sanitizeMetadata(mockEXIF);
    expect(sanitized.make).toBe('Camera Brand');
    expect(sanitized.gpsLatitude).toBeUndefined();
    expect(sanitized.gpsLongitude).toBeUndefined();
  });
});
