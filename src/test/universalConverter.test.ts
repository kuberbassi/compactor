import { describe, expect, it } from 'vitest';
import {
  getCommonSupportedTargets,
  getFileExtension,
  getSupportedTargets,
  isSupportedSourceFormat,
  SUPPORTED_SOURCE_FORMATS,
} from '../utils/conversionCapabilities';
import { docxToText, textToDocx } from '../utils/documentConverters';

describe('universal converter capability registry', () => {
  it('only exposes implemented PDF and Word targets', () => {
    expect([...getSupportedTargets('pdf')]).toEqual(['docx', 'txt']);
    expect([...getSupportedTargets('docx')]).toEqual(['pdf', 'txt', 'html']);
    expect(getSupportedTargets('pdf').has('doc')).toBe(false);
    expect(getSupportedTargets('pptx').size).toBe(0);
  });

  it('removes formats that have no installed source conversion path', () => {
    expect(isSupportedSourceFormat('pptx')).toBe(false);
    expect(isSupportedSourceFormat('heic')).toBe(false);
    expect(isSupportedSourceFormat('zip')).toBe(false);
    expect(SUPPORTED_SOURCE_FORMATS.every(format => getSupportedTargets(format).size > 0)).toBe(true);
  });

  it('dims targets without a reliable fallback instead of enabling them', () => {
    expect(getSupportedTargets('mp4').has('flv')).toBe(false);
    expect(getSupportedTargets('mp4').has('gif')).toBe(false);
    expect(getSupportedTargets('avif').has('svg')).toBe(false);
  });

  it('finds only targets supported by every file in a mixed batch', () => {
    const markdown = new File(['# Notes'], 'notes.md', { type: 'text/markdown' });
    const text = new File(['Notes'], 'notes.txt', { type: 'text/plain' });

    expect(getFileExtension(markdown)).toBe('md');
    expect([...getCommonSupportedTargets([markdown, text])]).toEqual(['pdf', 'docx', 'html']);
  });

  it('returns no shared target for files that cannot safely share a batch', () => {
    const image = new File(['image'], 'photo.png', { type: 'image/png' });
    const document = new File(['document'], 'report.pdf', { type: 'application/pdf' });

    expect(getCommonSupportedTargets([image, document]).size).toBe(0);
    expect(getCommonSupportedTargets([]).size).toBe(0);
  });

  it('creates a real DOCX package that can be parsed back', async () => {
    const blob = await textToDocx('First line\nSecond line', 'round-trip');
    const bytes = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    expect([...bytes]).toEqual([0x50, 0x4b]);

    const file = new File([blob], 'round-trip.docx', { type: blob.type });
    await expect(docxToText(file)).resolves.toContain('First line');
    await expect(docxToText(file)).resolves.toContain('Second line');
  });
});
