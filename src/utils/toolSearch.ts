export const TOOL_SEARCH_ALIASES: Record<string, string> = {
  'pdf-edit': 'annotate annotation add text textbox shapes rectangle circle line arrow highlight layers style border fill opacity rotate',
  'pdf-redact': 'hide remove sensitive confidential censor blackout whiteout permanent cover label',
  'pdf-stamps': 'stamp approved confidential final draft watermark',
  'pdf-watermark': 'watermark confidential repeat pattern opacity rotate',
  'pdf-sign': 'signature sign document',
  'pdf-flatten': 'make pdf uneditable remove form fields rasterize non selectable',
  'pdf-flatten-forms': 'lock form fields make inputs uneditable static vector preserve text search',
  'pdf-flatten-entire': 'rasterize pages flatten entire document image only non selectable strip text',
  'pdf-ocr': 'searchable pdf ocr extract text scanned pages recognize tesseract',
  'pdf-protect': 'pdf security lock password encrypt decrypt unlock flatten form fields rasterize uneditable non selectable ocr searchable scanned remove metadata privacy',
  'pdf-remove-metadata': 'clean strip author title timestamps xmp privacy',
  'pdf-remove-blank-pages': 'clean empty white blank pages delete remove auto scan',
  'pdf-jpg-to-pdf': 'jpg jpeg png webp photo picture images combine scan to pdf',
  'pdf-word-to-pdf': 'markdown md write document word text to pdf',
  'pdf-to-word': 'pdf markdown md extract convert text',
  'metadata-editor': 'remove exif location gps privacy id3 tags album artwork',
  'universal-converter': 'word doc docx office format change convert file',
  'image-optimizer': 'crop resize compress photo picture webp png jpg avif blur pixelate',
  'video-compressor': 'shrink reduce video mp4 whatsapp discord instagram smaller',
  'audio-optimizer': 'shrink reduce audio mp3 wav flac trim smaller',
};

type SearchableTool = { id: string; title: string; description: string; subtitle?: string; category?: string; tags?: string[] };

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const SEARCH_STOP_WORDS = new Set(['a', 'an', 'the', 'to', 'for', 'from', 'my', 'with', 'and', 'or', 'please']);

export function searchTools<T extends SearchableTool>(tools: T[], query: string): T[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return tools;
  const terms = normalizedQuery.split(/\s+/).filter(term => term && !SEARCH_STOP_WORDS.has(term));

  return tools
    .map((tool, index) => {
      const title = normalize(tool.title);
      const searchable = normalize([tool.title, tool.subtitle, tool.description, tool.category, ...(tool.tags || []), TOOL_SEARCH_ALIASES[tool.id]].filter(Boolean).join(' '));
      if (!terms.every(term => searchable.includes(term))) return null;
      let score = index / 1000;
      if (title === normalizedQuery) score -= 100;
      else if (title.startsWith(normalizedQuery)) score -= 60;
      else if (title.includes(normalizedQuery)) score -= 35;
      score -= terms.filter(term => title.includes(term)).length * 8;
      return { tool, score };
    })
    .filter((entry): entry is { tool: T; score: number } => Boolean(entry))
    .sort((a, b) => a.score - b.score)
    .map(entry => entry.tool);
}
