import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { renderAsync } from 'docx-preview';
import html2canvas from 'html2canvas';
import { docxToPdf } from '../utils/documentConverters';

vi.mock('docx-preview', () => ({
  renderAsync: vi.fn(),
}));

vi.mock('html2canvas', () => ({
  default: vi.fn(),
}));

const onePixelJpeg = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==';

describe('visual Word to PDF conversion', () => {
  it('renders each DOCX page visually instead of rebuilding plain text', async () => {
    vi.mocked(renderAsync).mockImplementation(async (_file, host) => {
      for (let index = 0; index < 2; index += 1) {
        const page = document.createElement('section');
        page.className = 'docx';
        Object.defineProperties(page, {
          scrollWidth: { value: 794 },
          offsetWidth: { value: 794 },
          scrollHeight: { value: 1123 },
          offsetHeight: { value: 1123 },
        });
        host.appendChild(page);
      }
      return {
        documentPart: {
          body: {
            props: {
              pageBorders: {
                top: { type: 'double', color: 'auto', size: '1.50pt' },
                right: { type: 'double', color: 'auto', size: '1.50pt' },
                bottom: { type: 'double', color: 'auto', size: '1.50pt' },
                left: { type: 'double', color: 'auto', size: '1.50pt' },
              },
            },
          },
        },
      };
    });
    vi.mocked(html2canvas).mockResolvedValue({
      width: 1588,
      height: 2246,
      toBlob: (callback: BlobCallback) => callback(new Blob([
        Uint8Array.from(atob(onePixelJpeg), character => character.charCodeAt(0)),
      ], { type: 'image/jpeg' })),
    } as HTMLCanvasElement);

    const file = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'cover.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const output = await docxToPdf(file);
    const pdf = await PDFDocument.load(await output.arrayBuffer());

    expect(renderAsync).toHaveBeenCalledOnce();
    expect(html2canvas).toHaveBeenCalledTimes(2);
    const firstRenderedPage = vi.mocked(html2canvas).mock.calls[0][0] as HTMLElement;
    expect(firstRenderedPage.style.borderTopStyle).toBe('double');
    expect(firstRenderedPage.style.borderLeftColor).toBe('rgb(0, 0, 0)');
    expect(pdf.getPageCount()).toBe(2);
    expect(document.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
  });
});
