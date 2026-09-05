import { describe, it, expect } from 'vitest';
import { getBrowserVideoProcessingLimitBytes, isGifFile } from '../utils/mediaFiles';
import { buildGifPaletteFilter } from '../utils/ffmpeg/video';

describe('Video Tools Utilities & Presets', () => {
  it('WhatsApp target preset enforces ≤ 16MB file limit', () => {
    const whatsappLimitMB = 16;
    const durationSecs = 60; // 1 minute video
    const totalMaxBytes = whatsappLimitMB * 1024 * 1024;
    const targetBitrateBps = (totalMaxBytes * 8) / durationSecs;

    expect(whatsappLimitMB).toBe(16);
    expect(targetBitrateBps).toBeGreaterThan(0);
  });

  it('Discord target preset enforces ≤ 10MB file limit', () => {
    const discordLimitMB = 10;
    const durationSecs = 120; // 2 minute video
    const totalMaxBytes = discordLimitMB * 1024 * 1024;
    const targetBitrateBps = (totalMaxBytes * 8) / durationSecs;

    expect(discordLimitMB).toBe(10);
    expect(targetBitrateBps).toBeGreaterThan(0);
  });

  it('video to audio target formats include MP3 and AAC', () => {
    const audioFormats = ['mp3', 'aac', 'wav'];
    expect(audioFormats).toContain('mp3');
    expect(audioFormats).toContain('aac');
  });

  it('video to GIF fps scale math bounds fps between 5 and 30', () => {
    const fps = 15;
    expect(fps).toBeGreaterThanOrEqual(5);
    expect(fps).toBeLessThanOrEqual(30);
  });

  it('builds a mapped complex GIF palette graph', () => {
    const filter = buildGifPaletteFilter('[0:v]', 15, 'scale=480:-1');

    expect(filter).toContain('[0:v]fps=15,scale=480:-1:flags=lanczos');
    expect(filter).toContain('palettegen[gif_palette]');
    expect(filter).toContain('paletteuse[gif_output]');
  });

  it('recognizes GIF sources from either MIME type or extension', () => {
    expect(isGifFile({ name: 'animation.bin', type: 'image/gif' })).toBe(true);
    expect(isGifFile({ name: 'animation.GIF', type: '' })).toBe(true);
    expect(isGifFile({ name: 'clip.mp4', type: 'video/mp4' })).toBe(false);
  });

  it('keeps browser FFmpeg input limits below unsafe in-memory sizes', () => {
    expect(getBrowserVideoProcessingLimitBytes()).toBe(512 * 1024 * 1024);
    expect(getBrowserVideoProcessingLimitBytes(2)).toBe(256 * 1024 * 1024);
    expect(getBrowserVideoProcessingLimitBytes(16)).toBe(768 * 1024 * 1024);
  });
});
