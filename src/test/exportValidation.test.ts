import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { assertExportLooksValid } from '../utils/exportValidation';

const blob = (bytes: number[] | string, type = 'application/octet-stream') =>
  new Blob([typeof bytes === 'string' ? bytes : new Uint8Array(bytes)], { type });

describe('export integrity validation', () => {
  it('accepts structurally valid document, image, audio, and video containers', async () => {
    await expect(assertExportLooksValid(blob('%PDF-1.7\n1 0 obj\nendobj\n%%EOF'), 'document.pdf')).resolves.toBeUndefined();
    await expect(assertExportLooksValid(blob([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image.png')).resolves.toBeUndefined();
    await expect(assertExportLooksValid(blob([...Buffer.from('RIFF0000WAVE')]), 'audio.wav')).resolves.toBeUndefined();
    await expect(assertExportLooksValid(blob([0, 0, 0, 24, ...Buffer.from('ftypisom')]), 'video.mp4')).resolves.toBeUndefined();
    const docx = zipSync({
      '[Content_Types].xml': strToU8('<Types/>'),
      'word/document.xml': strToU8('<document/>'),
    });
    await expect(assertExportLooksValid(blob([...docx]), 'bundle.docx')).resolves.toBeUndefined();
  });

  it('rejects empty, mislabeled, and truncated exports', async () => {
    await expect(assertExportLooksValid(blob([]), 'empty.pdf')).rejects.toThrow(/empty file/i);
    await expect(assertExportLooksValid(blob('not a pdf'), 'broken.pdf')).rejects.toThrow(/validation failed/i);
    await expect(assertExportLooksValid(blob('%PDF-1.7 without trailer'), 'truncated.pdf')).rejects.toThrow(/validation failed/i);
    await expect(assertExportLooksValid(blob('not audio'), 'broken.mp3')).rejects.toThrow(/validation failed/i);
    await expect(assertExportLooksValid(blob([0x50, 0x4b, 0x03, 0x04]), 'truncated.docx')).rejects.toThrow(/validation failed/i);
    const wrongOffice = zipSync({ 'notes.txt': strToU8('not a document') });
    await expect(assertExportLooksValid(blob([...wrongOffice]), 'wrong.docx')).rejects.toThrow(/validation failed/i);
  });
});
