import { marked, type Token, type Tokens } from 'marked';
import type { Content, ContentText, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { MarkdownImage } from './markdownPdfImages';

export interface MarkdownPdfSettings {
  pageSize: 'A4' | 'LETTER';
  margin: number;
  fontSize: number;
}

export const DEFAULT_MARKDOWN_PDF_SETTINGS: MarkdownPdfSettings = {
  pageSize: 'A4', margin: 54, fontSize: 10.5,
};

export const safeMarkdownLink = (href: string): string | undefined => {
  try {
    const url = new URL(href);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
};

type Images = Map<string, MarkdownImage>;

const PDF_COLORS = {
  text: '#303236',
  muted: '#667085',
  link: '#1d4f91',
  rule: '#d7dbe0',
  codeBackground: '#f6f4f2',
  codeBorder: '#c9c9c9',
} as const;

const CODE_LANGUAGE_LABELS: Record<string, string> = {
  bash: 'Shell', sh: 'Shell', shell: 'Shell',
  js: 'JavaScript', javascript: 'JavaScript',
  ts: 'TypeScript', typescript: 'TypeScript',
  py: 'Python', python: 'Python',
  html: 'HTML', css: 'CSS', json: 'JSON', yaml: 'YAML', yml: 'YAML',
};

export function codeLanguageLabel(language?: string): string {
  if (!language) return 'Code';
  const normalized = language.trim().toLowerCase();
  return CODE_LANGUAGE_LABELS[normalized] || normalized.replace(/(^|[-_])\w/g, value => value.replace(/[-_]/, '').toUpperCase());
}

function inline(tokens: Token[], style: Omit<ContentText, 'text'> = {}): ContentText[] {
  return tokens.flatMap((token): ContentText[] => {
    switch (token.type) {
      case 'strong': return inline((token as Tokens.Strong).tokens, { ...style, bold: true });
      case 'em': return inline((token as Tokens.Em).tokens, { ...style, italics: true });
      case 'del': return inline((token as Tokens.Del).tokens, { ...style, decoration: 'lineThrough' });
      case 'codespan': return [{ ...style, text: `\u00a0${token.text}\u00a0`, font: 'Mono', color: '#1f2937', background: '#edf0f3' }];
      case 'br': return [{ ...style, text: '\n' }];
      case 'link': {
        const link = safeMarkdownLink(token.href);
        return inline((token as Tokens.Link).tokens, link ? { ...style, link, color: PDF_COLORS.link, decoration: 'underline' } : style);
      }
      case 'image': return [{ ...style, text: `[Image: ${token.text || 'image'}]`, color: PDF_COLORS.muted, italics: true }];
      default: return 'tokens' in token && token.tokens ? inline(token.tokens, style) : [{ ...style, text: 'text' in token ? token.text : token.raw }];
    }
  });
}

function blocks(tokens: Token[], settings: MarkdownPdfSettings, images: Images): Content[] {
  const width = (settings.pageSize === 'A4' ? 595.28 : 612) - settings.margin * 2;
  const result: Content[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'space': case 'def': case 'checkbox': break;
      case 'heading': {
        const heading = token as Tokens.Heading;
        result.push({
          stack: [
            {
              text: inline(heading.tokens),
              fontSize: settings.fontSize * [2.35, 1.55, 1.22, 1.08, 1, 1][heading.depth - 1],
              bold: true,
              color: PDF_COLORS.text,
              margin: [0, 0, 0, heading.depth <= 2 ? 5 : 3],
            },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 0.55, lineColor: PDF_COLORS.rule }] },
          ],
          margin: [0, heading.depth === 1 ? 13 : 15, 0, heading.depth === 1 ? 13 : 9],
          headlineLevel: heading.depth,
          unbreakable: true,
        });
        break;
      }
      case 'paragraph': case 'text': {
        const children: Token[] = token.tokens || [{ type: 'text', raw: token.text, text: token.text }];
        // PDF images are block nodes. Keep adjacent prose in order around each image.
        let run: Token[] = [];
        let imageRun: MarkdownImage[] = [];
        const flush = () => { if (run.length) result.push({ text: inline(run), margin: [0, 0, 0, 7] }); run = []; };
        const flushImages = () => {
          if (!imageRun.length) return;
          const badges = imageRun.length > 1 && imageRun.every(image => image.width <= 320 && image.height <= 120);
          if (badges) {
            result.push({
              columns: imageRun.map(image => ({ image: image.data, width: Math.min(80, image.width * 0.58), margin: [0, 0, 5, 0] })),
              columnGap: 4,
              margin: [0, 3, 0, 9],
            });
          } else {
            imageRun.forEach(image => result.push({
              image: image.data,
              fit: [Math.min(width, image.width * 0.75), Math.min(320, image.height * 0.75)],
              alignment: 'center',
              margin: [0, 5, 0, 12],
            }));
          }
          imageRun = [];
        };
        for (const child of children) {
          if (child.type === 'image' && images.has(child.href)) {
            flush();
            imageRun.push(images.get(child.href)!);
          } else if (imageRun.length && child.type === 'text' && !child.text.trim()) {
            continue;
          } else {
            flushImages();
            run.push(child);
          }
        }
        flush();
        flushImages();
        break;
      }
      case 'code':
        result.push({ text: codeLanguageLabel(token.lang), fontSize: 7.5, bold: true, color: PDF_COLORS.muted, characterSpacing: 0.25, margin: [0, 7, 0, 4] });
        result.push({
          table: { widths: ['*'], body: [[{ text: token.text.replace(/\t/g, '    '), font: 'Mono', fontSize: settings.fontSize * 0.78, lineHeight: 1.25, color: '#202124', fillColor: PDF_COLORS.codeBackground, preserveLeadingSpaces: true, margin: [9, 8, 9, 8] }]] },
          layout: { hLineWidth: () => 0.6, vLineWidth: () => 0.6, hLineColor: () => PDF_COLORS.codeBorder, vLineColor: () => PDF_COLORS.codeBorder, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
          margin: [0, 0, 0, 11],
          unbreakable: token.text.split('\n').length <= 18,
        });
        break;
      case 'blockquote':
        result.push({
          table: { widths: [4, '*'], body: [[{ text: '', fillColor: '#aeb7c4' }, { stack: blocks((token as Tokens.Blockquote).tokens, settings, images), fillColor: '#f5f6f7', color: '#475467', italics: true, margin: [10, 8, 10, 2] }]] },
          layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
          margin: [0, 5, 0, 11],
        });
        break;
      case 'list': {
        const list = token as Tokens.List;
        const items = list.items.map(item => ({ stack: blocks(item.tokens, settings, images) || [{ text: ' ' }] }));
        if (list.items.some(item => item.task)) {
          result.push({
            stack: list.items.map((item, index) => ({
              columns: [
                item.task ? {
                  width: 14,
                  canvas: [
                    { type: 'rect', x: 0.5, y: 2, w: 8, h: 8, r: 1, lineWidth: 0.75, lineColor: '#667085', color: item.checked ? '#475467' : undefined },
                    ...(item.checked ? [
                      { type: 'line' as const, x1: 2.2, y1: 6, x2: 4.1, y2: 7.8, lineWidth: 1, lineColor: '#ffffff' },
                      { type: 'line' as const, x1: 4.1, y1: 7.8, x2: 7.3, y2: 3.7, lineWidth: 1, lineColor: '#ffffff' },
                    ] : []),
                  ],
                } : { width: 14, text: '•', color: PDF_COLORS.text },
                { width: '*', stack: items[index].stack },
              ],
              columnGap: 1,
              margin: [0, 0, 0, 1],
            })),
            margin: [0, 2, 0, 8],
          });
          break;
        }
        const listContent = list.ordered
          ? { ol: items, start: Number(list.start) || 1, margin: [0, 2, 0, 8] }
          : { ul: items, margin: [0, 2, 0, 8] };
        result.push(listContent as Content);
        break;
      }
      case 'table': {
        const table = token as Tokens.Table;
        result.push({
          table: {
            headerRows: 1, widths: table.header.map(() => '*'),
            body: [table.header, ...table.rows].map((row, rowIndex) => row.map((cell, col) => ({
              text: inline(cell.tokens), bold: rowIndex === 0,
              fillColor: rowIndex === 0 ? '#e8edf4' : rowIndex % 2 === 0 ? '#f6f7f8' : '#ffffff',
              color: rowIndex === 0 ? '#1f2937' : PDF_COLORS.text,
              alignment: table.align[col] || 'left', margin: [6, 6, 6, 6],
            }))),
          },
          layout: {
            hLineWidth: (index: number) => index === 1 ? 1.25 : 0.45,
            vLineWidth: () => 0,
            hLineColor: (index: number) => index === 1 ? '#667085' : '#d6d9de',
            paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
          },
          fontSize: settings.fontSize * 0.9, margin: [0, 5, 0, 13],
        });
        break;
      }
      case 'hr': result.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 0.6, lineColor: '#cbd5e1' }], margin: [0, 10, 0, 10] }); break;
      default: result.push({ text: token.raw, margin: [0, 0, 0, 8] });
    }
  }
  return result;
}

export function markdownPdfDefinition(markdown: string, title: string, settings = DEFAULT_MARKDOWN_PDF_SETTINGS, images: Images = new Map()): TDocumentDefinitions {
  const content = blocks(marked.lexer(markdown, { gfm: true }), settings, images);
  const documentTitle = title.trim() || 'Document';
  return {
    info: { title: documentTitle, subject: 'Markdown document', creator: 'Compactor', producer: 'Compactor Markdown PDF' }, pageSize: settings.pageSize,
    pageMargins: [settings.margin, settings.margin, settings.margin, settings.margin],
    defaultStyle: { font: 'Roboto', fontSize: settings.fontSize, lineHeight: 1.28, color: PDF_COLORS.text },
    content: content.length ? content : [{ text: ' ' }],
    pageBreakBefore: (node, container) => Boolean(node.headlineLevel && container.getFollowingNodesOnPage().length === 0),
  };
}

let enginePromise: Promise<typeof import('pdfmake/build/pdfmake')> | undefined;
async function engine() {
  enginePromise ??= (async () => {
    const [{ default: pdfMake }, { default: fonts }, { default: monoUrl }] = await Promise.all([
      import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts'),
      import('@fontsource/roboto-mono/files/roboto-mono-latin-400-normal.woff?url'),
    ]);
    pdfMake.addVirtualFileSystem(fonts);
    const fontResponse = await fetch(monoUrl, { signal: AbortSignal.timeout(10000) });
    if (!fontResponse.ok) throw new Error('Could not load the bundled PDF font. Please retry.');
    const fontBytes = new Uint8Array(await fontResponse.arrayBuffer());
    pdfMake.addVirtualFileSystem({ 'Mono.woff': btoa(Array.from(fontBytes, byte => String.fromCharCode(byte)).join('')) });
    pdfMake.addFonts({ Mono: { normal: 'Mono.woff', bold: 'Mono.woff', italics: 'Mono.woff', bolditalics: 'Mono.woff' } });
    return pdfMake;
  })().catch(error => { enginePromise = undefined; throw error; });
  return enginePromise;
}

export async function compileMarkdownPdf(markdown: string, title = 'Document', settings = DEFAULT_MARKDOWN_PDF_SETTINGS) {
  const images: Images = new Map();
  const warnings: string[] = [];
  const urls = new Set<string>();
  marked.walkTokens(marked.lexer(markdown, { gfm: true }), token => { if (token.type === 'image') urls.add(token.href); });
  if (urls.size) {
    const { loadMarkdownImage } = await import('./markdownPdfImages');
    const pending = [...urls].slice(0, 20);
    if (urls.size > 20) warnings.push('Only the first 20 images are loaded; remaining images use alt text.');
    await Promise.all(Array.from({ length: Math.min(4, pending.length) }, async () => {
      for (;;) {
        const url = pending.shift();
        if (!url) return;
        try { images.set(url, await loadMarkdownImage(url)); }
        catch { warnings.push('An image could not be loaded; its alt text is included instead.'); }
      }
    }));
  }
  const pdfMake = await engine();
  const blob = await pdfMake.createPdf(markdownPdfDefinition(markdown, title, settings, images)).getBlob();
  return { blob, warnings: [...new Set(warnings)] };
}

export async function compilePlainTextPdf(text: string, title = 'Document'): Promise<Blob> {
  const pdfMake = await engine();
  const definition = markdownPdfDefinition('', title);
  definition.content = { text: text || ' ', font: 'Mono', fontSize: 10, preserveLeadingSpaces: true };
  return pdfMake.createPdf(definition).getBlob();
}

export async function createStructuredPdf(definition: TDocumentDefinitions): Promise<Blob> {
  const pdfMake = await engine();
  return pdfMake.createPdf(definition).getBlob();
}
