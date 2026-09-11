import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PDFDocument, PDFName } from 'pdf-lib';
import { codeLanguageLabel, compileMarkdownPdf, DEFAULT_MARKDOWN_PDF_SETTINGS, markdownPdfDefinition, safeMarkdownLink } from '../utils/markdownPdf';

afterEach(() => vi.unstubAllGlobals());

describe('Markdown PDF', () => {
  it('parses nested GFM formatting, tables, links and literal code without HTML injection', () => {
    const definition = markdownPdfDefinition('# Hello **world**\n\n3. First\n4. Second\n\n| A | B |\n| --- | ---: |\n| **bold** | `a_b` |\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))', 'Test');
    const content = JSON.stringify(definition.content);
    expect(content).toContain('"bold":true');
    expect(content).toContain('"headerRows":1');
    expect(content).toContain('"start":3');
    expect(content).toContain('a_b');
    expect(content).toContain('<script>'); // Literal PDF text, never inserted into the DOM.
    expect(content).not.toContain('"link":"javascript:');
    expect(safeMarkdownLink('data:text/html,bad')).toBeUndefined();
    expect(safeMarkdownLink('https://example.com')).toBe('https://example.com/');
    const tasks = JSON.stringify(markdownPdfDefinition('- [x] Complete\n- [ ] Pending', 'Tasks').content);
    expect(tasks.match(/"type":"rect"/g)).toHaveLength(2);
    expect(tasks.match(/"lineColor":"#ffffff"/g)).toHaveLength(2);
    expect(tasks).not.toContain('"ul"');
    const paragraph = markdownPdfDefinition('**bold** and *italic*', 'Styles').content as Array<{ text: Array<{ text: string; bold?: boolean; italics?: boolean }> }>;
    expect(paragraph[0].text).toContainEqual({ text: 'bold', bold: true });
    expect(paragraph[0].text).toContainEqual({ text: 'italic', italics: true });
  });

  it('uses readable language labels and polished document primitives', () => {
    expect(codeLanguageLabel('bash')).toBe('Shell');
    expect(codeLanguageLabel('typescript')).toBe('TypeScript');
    const content = JSON.stringify(markdownPdfDefinition('Use `LICENSE`.\n\n> **Note:** Follow up.\n\n```bash\nnpm run dev\n```', 'Styles').content);
    expect(content).toContain('\u00a0LICENSE\u00a0');
    expect(content).toContain('"text":"Shell"');
    expect(content).toContain('"fillColor":"#f5f6f7"');
  });

  it('creates a multi-page PDF with embedded text fonts, correct paper and metadata, without page screenshots', async () => {
    const font = readFileSync('node_modules/@fontsource/roboto-mono/files/roboto-mono-latin-400-normal.woff');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength) });
    vi.stubGlobal('fetch', fetchMock);
    const markdown = '# Searchable document\n\n' + Array.from({ length: 90 }, (_, i) => `Paragraph ${i}: **bold** and *italic*, café, résumé, an em dash — and [a link](https://example.com).\n`).join('\n') + '\n```js\n  const value = "a_b";\n```';
    const { blob } = await compileMarkdownPdf(markdown, 'PDF integration test', { ...DEFAULT_MARKDOWN_PDF_SETTINGS, pageSize: 'LETTER' });
    const pdf = await PDFDocument.load(await blob.arrayBuffer());
    expect(pdf.getTitle()).toBe('PDF integration test');
    expect(pdf.getPageCount()).toBeGreaterThan(2);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
    for (const page of pdf.getPages()) {
      const resources = page.node.Resources()!;
      expect(resources.has(PDFName.of('Font'))).toBe(true);
      expect(resources.has(PDFName.of('XObject'))).toBe(false);
    }
  }, 20000);

  it('loads linked images by default and produces a valid empty PDF when an image cannot load', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const result = await compileMarkdownPdf('![Private chart](https://example.com/private.png)');
    expect(result.warnings[0]).toContain('could not be loaded');
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/private.png', expect.objectContaining({ credentials: 'omit' }));
    const { blob } = await compileMarkdownPdf('');
    expect((await PDFDocument.load(await blob.arrayBuffer())).getPageCount()).toBe(1);
  });
});
