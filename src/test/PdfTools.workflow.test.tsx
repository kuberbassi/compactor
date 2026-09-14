import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PdfTools } from '../pages/PdfTools/PdfTools';
import { compressPdf, getPdfPageCount, mergePdfs } from '../utils/pdf';
import { errorMessage } from '../pages/PdfTools/pdfResultTask';

vi.mock('../utils/pdf', () => ({
  mergePdfs: vi.fn(), extractPdfPages: vi.fn(), imagesToPdf: vi.fn(),
  getPdfPageCount: vi.fn(), compressPdf: vi.fn(), watermarkPdfAdvanced: vi.fn(),
  addPageNumbersToPdf: vi.fn(), cropPdfMargins: vi.fn(), signPdfDocumentAdvanced: vi.fn(),
  protectPdfWithPassword: vi.fn(), unlockPdfWithPassword: vi.fn(), checkPdfEncryptionStatus: vi.fn(),
  extractPdfMarkdown: vi.fn(), reorganizePdfPages: vi.fn(), flattenPdfForm: vi.fn(),
  flattenPdfCompletely: vi.fn(), addVectorStampToPdf: vi.fn(), annotateOrRedactPdf: vi.fn(),
  removePdfMetadata: vi.fn(), applyDocumentScanFilter: vi.fn(),
}));

vi.mock('../utils/pdfRenderer', () => ({
  hasSelectablePdfText: vi.fn(async () => true),
  renderPdfThumbnails: vi.fn(async () => []),
  renderPdfPagesToImages: vi.fn(async () => []),
}));

vi.mock('../utils/pdfOcr', () => ({ createSearchableOcrPdf: vi.fn() }));

describe('PdfTools workflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.mocked(getPdfPageCount).mockResolvedValue(1);
    vi.mocked(compressPdf)
      .mockResolvedValueOnce(new Blob(['small'], { type: 'application/pdf' }))
      .mockRejectedValueOnce(new Error('damaged input'))
      .mockResolvedValueOnce(new Blob(['retry'], { type: 'application/pdf' }));
    let resultIndex = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:pdf-${++resultIndex}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('normalizes Error and non-Error failures', () => {
    expect(errorMessage(new Error('broken'))).toBe('broken');
    expect(errorMessage('plain failure')).toBe('plain failure');
    expect(errorMessage(new Error(''), 'Try the password again.')).toBe('Try the password again.');
    expect(errorMessage(undefined, 'Try the password again.')).toBe('Try the password again.');
  });

  it('runs and finalizes the shared single-result lifecycle on success and failure', async () => {
    vi.mocked(mergePdfs)
      .mockResolvedValueOnce(new Blob(['merged'], { type: 'application/pdf' }))
      .mockRejectedValueOnce('plain failure');
    const onUploadSuccess = vi.fn();
    const { container } = render(
      <PdfTools toolId="pdf-merge" onGoHome={vi.fn()} onUploadSuccess={onUploadSuccess} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const files = [
      new File(['a'], 'a.pdf', { type: 'application/pdf' }),
      new File(['b'], 'b.pdf', { type: 'application/pdf' }),
    ];
    fireEvent.change(input, { target: { files } });
    expect((await screen.findAllByText('a.pdf')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Merge PDF' }));
    expect(await screen.findByText('merged_document.pdf')).toBeVisible();
    expect(onUploadSuccess).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: /start again/i }));
    const resetInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(resetInput, { target: { files } });
    expect((await screen.findAllByText('a.pdf')).length).toBeGreaterThan(0);
    const mergeButton = screen.getByRole('button', { name: 'Merge PDF' });
    fireEvent.click(mergeButton);
    expect(await screen.findByText(/Merge failed: plain failure/i)).toBeVisible();
    await waitFor(() => expect(mergeButton).toBeEnabled());
  });

  it('keeps successful batch output through a partial failure, retries, and cleans reset results', async () => {
    const onUploadSuccess = vi.fn();
    const { container } = render(
      <PdfTools toolId="pdf-compress" onGoHome={vi.fn()} onUploadSuccess={onUploadSuccess} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const first = new File(['first-pdf'], 'first.pdf', { type: 'application/pdf' });
    const second = new File(['second-pdf'], 'second.pdf', { type: 'application/pdf' });

    fireEvent.change(input, { target: { files: [first, second] } });
    fireEvent.click(await screen.findByRole('button', { name: /compress 2 pdfs/i }));

    expect(await screen.findByText('PDF optimization complete')).toBeVisible();
    expect(screen.getByText(/Failed: damaged input/i)).toBeVisible();
    expect(screen.getByText('first_compressed.pdf')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Download' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /retry this file/i }));

    await waitFor(() => expect(compressPdf).toHaveBeenCalledTimes(3));
    expect(await screen.findByText('second_compressed.pdf')).toBeVisible();
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:pdf-1');
    expect(onUploadSuccess).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: /new batch/i }));
    expect(await screen.findByRole('button', { name: /upload pdf files to compress/i })).toBeVisible();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf-1');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf-2');
  });
});
