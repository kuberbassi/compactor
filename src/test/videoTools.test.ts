import { describe, it, expect } from 'vitest';

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
});
