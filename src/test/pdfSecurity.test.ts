import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { checkPdfEncryptionStatus, protectPdfWithPassword, unlockPdfWithPassword } from '../utils/pdf';

describe('PDF password protection', () => {
  it('exports a PDF that is genuinely encrypted', async () => {
    const source = await PDFDocument.create();
    source.addPage([300, 200]);
    const sourceBytes = await source.save();
    const input = new File([sourceBytes as any], 'source.pdf', { type: 'application/pdf' });

    const protectedBlob = await protectPdfWithPassword(input, 'correct-horse-battery-staple');
    const protectedFile = new File([protectedBlob], 'protected.pdf', { type: 'application/pdf' });
    const status = await checkPdfEncryptionStatus(protectedFile);

    expect(status.isEncrypted).toBe(true);
    await expect(PDFDocument.load(await protectedBlob.arrayBuffer())).rejects.toThrow();

    const unlockedBlob = await unlockPdfWithPassword(protectedFile, 'correct-horse-battery-staple');
    const unlocked = await PDFDocument.load(await unlockedBlob.arrayBuffer());
    expect(unlocked.getPageCount()).toBe(1);
    expect((await checkPdfEncryptionStatus(new File([unlockedBlob], 'unlocked.pdf', { type: 'application/pdf' }))).isEncrypted).toBe(false);
  }, 15_000);

  it('rejects empty passwords instead of exporting an unlocked copy', async () => {
    const source = await PDFDocument.create();
    source.addPage();
    const input = new File([await source.save() as any], 'source.pdf', { type: 'application/pdf' });

    await expect(protectPdfWithPassword(input, '   ')).rejects.toThrow(/enter a password/i);
  });
});
