import { Document, Packer, Paragraph, PageBreak, TextRun } from 'docx';
import mammoth from 'mammoth/mammoth.browser';

type PdfTextItem = { str: string; transform: number[]; width: number; height: number };

const assertSignature = async (file: File, expected: 'pdf' | 'zip') => {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const valid = expected === 'pdf'
    ? String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-'
    : bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!valid) throw new Error(`This file is not a valid ${expected === 'pdf' ? 'PDF' : 'DOCX'} document.`);
};

const linesFromPdfItems = (items: PdfTextItem[]) => {
  const sorted = [...items]
    .filter(item => typeof item.str === 'string' && item.str.trim())
    .sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      return Math.abs(yDiff) > 2 ? yDiff : a.transform[4] - b.transform[4];
    });

  const lines: Array<{ y: number; height: number; items: PdfTextItem[] }> = [];
  for (const item of sorted) {
    const y = item.transform[5];
    const line = lines.find(candidate => Math.abs(candidate.y - y) <= Math.max(2, item.height * 0.25));
    if (line) {
      line.items.push(item);
      line.height = Math.max(line.height, item.height);
    } else {
      lines.push({ y, height: item.height, items: [item] });
    }
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map(line => ({
      height: line.height,
      text: line.items
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((item, index, row) => {
          if (index === 0) return item.str;
          const previous = row[index - 1];
          const previousEnd = previous.transform[4] + previous.width;
          return item.transform[4] - previousEnd > Math.max(1.5, item.height * 0.12) ? ` ${item.str}` : item.str;
        })
        .join('')
        .trim(),
    }));
};

export const pdfToDocx = async (file: File): Promise<Blob> => {
  await assertSignature(file, 'pdf');
  const [pdfjsLib, pdfWorkerModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerModule.default;
  const source = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: source }).promise;
  const children: Paragraph[] = [];
  let extractedCharacters = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = linesFromPdfItems(content.items as PdfTextItem[]);
    extractedCharacters += lines.reduce((total, line) => total + line.text.length, 0);

    for (const line of lines) {
      children.push(new Paragraph({
        spacing: { after: line.text ? 80 : 140 },
        children: [new TextRun({
          text: line.text,
          size: Math.max(18, Math.min(40, Math.round(line.height * 2))),
          bold: line.height >= 16,
        })],
      }));
    }
    if (pageNumber < pdf.numPages) children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  if (extractedCharacters === 0) {
    throw new Error('This PDF has no readable text layer. Scanned PDFs need OCR, which is not available in the private browser converter yet.');
  }

  const document = new Document({
    creator: 'Compactor',
    title: file.name.replace(/\.pdf$/i, ''),
    sections: [{ properties: {}, children }],
  });
  return Packer.toBlob(document);
};

export const textToDocx = async (text: string, title: string): Promise<Blob> => {
  const paragraphs = text.split(/\r?\n/).map(line => new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun(line)],
  }));
  return Packer.toBlob(new Document({ creator: 'Compactor', title, sections: [{ children: paragraphs }] }));
};

export const docxToText = async (file: File): Promise<string> => {
  await assertSignature(file, 'zip');
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  const text = result.value.trim();
  if (!text) throw new Error('No readable document content was found in this DOCX file.');
  return text;
};

export const docxToHtml = async (file: File): Promise<string> => {
  await assertSignature(file, 'zip');
  const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  if (!result.value.trim()) throw new Error('No readable document content was found in this DOCX file.');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${file.name}</title></head><body>${result.value}</body></html>`;
};

export const docxToPdf = async (file: File): Promise<Blob> => {
  const text = await docxToText(file);
  const { textToPdf } = await import('./pdf');
  return textToPdf(text, file.name.replace(/\.docx$/i, ''));
};
