import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkdownEditor } from '../pages/PdfTools/MarkdownEditor';
import { nextPreviewZoom } from '../utils/markdownPreviewZoom';
import { compileMarkdownPdf } from '../utils/markdownPdf';

vi.mock('../utils/markdownPdf', () => ({ compileMarkdownPdf: vi.fn() }));
vi.mock('../pages/PdfTools/components/MarkdownPdfPreview', async importOriginal => {
  const actual = await importOriginal<typeof import('../pages/PdfTools/components/MarkdownPdfPreview')>();
  return { ...actual, MarkdownPdfPreview: ({ blob }: { blob: Blob }) => <output data-testid="pdf-preview">{blob.size}</output> };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Markdown editor workflow', () => {
  it('keeps wheel zoom within 60% and 250%', () => {
    expect(nextPreviewZoom(1, 100_000)).toBe(0.6);
    expect(nextPreviewZoom(1, -100_000)).toBe(2.5);
    expect(nextPreviewZoom(1, -100)).toBeGreaterThan(1);
    expect(nextPreviewZoom(1, 100)).toBeLessThan(1);
  });

  it('previews and downloads the exact compiled PDF blob from the button and shortcut', async () => {
    const pdfBlob = new Blob(['real-pdf-bytes'], { type: 'application/pdf' });
    vi.mocked(compileMarkdownPdf).mockResolvedValue({ blob: pdfBlob, warnings: [] });
    const createObjectURL = vi.fn(() => 'blob:compiled-pdf');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<MarkdownEditor initialContent="# Verified" onGoHome={vi.fn()} />);
    expect(await screen.findByTestId('pdf-preview')).toHaveTextContent(String(pdfBlob.size));

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByRole('button', { name: 'Reset zoom to 100%, current zoom 110%' })).toHaveTextContent('110%');

    const download = screen.getByRole('button', { name: 'Download PDF' });
    await waitFor(() => expect(download).toBeEnabled());
    fireEvent.click(download);
    expect(createObjectURL).toHaveBeenLastCalledWith(pdfBlob);

    screen.getByRole('textbox', { name: 'Markdown source' }).focus();
    fireEvent.keyDown(window, { key: 'p', ctrlKey: true });
    expect(createObjectURL).toHaveBeenLastCalledWith(pdfBlob);
    expect(anchorClick).toHaveBeenCalledTimes(2);
  });
});
