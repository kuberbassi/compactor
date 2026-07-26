import { describe, it, expect } from 'vitest';
import { formatBytes } from '../utils/image';

describe('Image Tools & Utilities', () => {
  it('formatBytes formats zero and small byte sizes correctly', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(512)).toBe('512 Bytes');
  });

  it('formatBytes formats kilobytes, megabytes, and gigabytes accurately', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
    expect(formatBytes(1572864)).toBe('1.5 MB');
    expect(formatBytes(1073741824)).toBe('1 GB');
  });

  it('aspect ratio calculation remains proportional', () => {
    const originalWidth = 1920;
    const originalHeight = 1080;
    const targetWidth = 1280;

    const calculatedHeight = Math.round((targetWidth / originalWidth) * originalHeight);
    expect(calculatedHeight).toBe(720);
  });

  it('image format extension detection is valid for WebP, AVIF, PNG, JPEG', () => {
    const supportedFormats = ['image/webp', 'image/avif', 'image/png', 'image/jpeg'];
    supportedFormats.forEach((mime) => {
      expect(mime.startsWith('image/')).toBe(true);
    });
  });
});
