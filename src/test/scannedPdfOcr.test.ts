import { beforeEach, describe, expect, it, vi } from 'vitest';

const terminate = vi.fn(async () => ({}));
const recognize = vi.fn(async () => ({ data: { text: 'Scanned heading\nRecognized body text' } }));
const setParameters = vi.fn(async () => ({}));
const createWorker = vi.fn(async (_language, _oem, options) => {
  options?.logger?.({ status: 'recognizing text', progress: 0.5 });
  return { recognize, setParameters, terminate };
});

const page = {
  getTextContent: vi.fn(async () => ({ items: [] })),
  getViewport: vi.fn(({ scale }) => ({ width: 600 * scale, height: 800 * scale })),
  render: vi.fn(() => ({ promise: Promise.resolve() })),
  cleanup: vi.fn(),
};
const cleanup = vi.fn();

vi.mock('tesseract.js', () => ({ createWorker }));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '/pdf-worker.js' }));
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: () => ({
    promise: Promise.resolve({ numPages: 1, getPage: async () => page, cleanup }),
  }),
}));

describe('scanned PDF OCR fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillStyle: '',
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  it('OCRs an image-only page and creates an editable DOCX', async () => {
    const { docxToText, pdfToDocx } = await import('../utils/documentConverters');
    const progress: string[] = [];
    const pdf = new File(['%PDF-1.7 scanned'], 'scan.pdf', { type: 'application/pdf' });

    const output = await pdfToDocx(pdf, (_percent, status) => progress.push(status));
    const outputFile = new File([output], 'scan.docx', { type: output.type });

    await expect(docxToText(outputFile)).resolves.toContain('Recognized body text');
    expect(createWorker).toHaveBeenCalledTimes(1);
    expect(recognize).toHaveBeenCalledTimes(1);
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(progress.some(status => status.includes('OCR'))).toBe(true);
  });
});
