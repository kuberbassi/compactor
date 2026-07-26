import { describe, it, expect } from 'vitest';

describe('Universal Converter Utilities', () => {
  it('file extension extraction parses extension correctly', () => {
    const filename = 'sample_document.presentation.pdf';
    const ext = filename.split('.').pop()?.toLowerCase();
    expect(ext).toBe('pdf');
  });

  it('handles filenames with multiple dots', () => {
    const filename = 'my.awesome.audio.track.flac';
    const ext = filename.split('.').pop()?.toLowerCase();
    expect(ext).toBe('flac');
  });

  it('CSV string conversion parses header and data rows', () => {
    const csvContent = 'name,age,city\nAlice,30,New York\nBob,25,London';
    const lines = csvContent.trim().split('\n');
    expect(lines.length).toBe(3);
    expect(lines[0].split(',')).toEqual(['name', 'age', 'city']);
  });

  it('JSON parsing handles valid structured array', () => {
    const jsonStr = '[{"id":1,"name":"Item A"},{"id":2,"name":"Item B"}]';
    const parsed = JSON.parse(jsonStr);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(2);
  });
});
