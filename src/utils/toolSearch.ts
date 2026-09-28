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
  'pdf-word-to-pdf': 'markdown md write document text to pdf',
  'pdf-to-word': 'pdf markdown md extract convert text',
  'convert-word-to-pdf': 'word to pdf docx document convert converter office',
  'metadata-editor': 'remove exif location gps privacy id3 tags album artwork',
  'universal-converter': 'word doc docx office format change convert file',
  'image-optimizer': 'image compressor optimizer crop resize compress photo picture webp png jpg avif blur pixelate',
  'video-compressor': 'shrink reduce video mp4 whatsapp discord instagram smaller',
  'audio-optimizer': 'shrink reduce audio mp3 wav flac trim smaller',
};

type SearchableTool = { id: string; title: string; description: string; subtitle?: string; category?: string; tags?: string[] };

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const SEARCH_STOP_WORDS = new Set(['a', 'an', 'the', 'to', 'for', 'from', 'my', 'with', 'and', 'or', 'please']);

const searchTextForTool = (tool: SearchableTool) => normalize([
  tool.title,
  tool.subtitle,
  tool.description,
  tool.category,
  ...(tool.tags || []),
  TOOL_SEARCH_ALIASES[tool.id],
].filter(Boolean).join(' '));

const editDistance = (left: string, right: string): number => {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
};

const termMatchDistance = (term: string, searchable: string): number | null => {
  if (searchable.includes(term)) return 0;
  const threshold = term.length <= 3 ? 1 : 2;
  const words = searchable.split(' ');
  let closest = Number.POSITIVE_INFINITY;
  words.forEach(word => {
    if (Math.abs(word.length - term.length) <= threshold) closest = Math.min(closest, editDistance(term, word));
  });
  return closest <= threshold ? closest : null;
};

const FORMAT_TERMS = ['pdf', 'word', 'docx', 'image', 'video', 'audio', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'csv', 'json', 'html', 'markdown'];
const canonicalFormat = (term: string): string | null => {
  const singular = term.endsWith('s') ? term.slice(0, -1) : term;
  if (singular === 'doc' || singular === 'docx') return 'word';
  const match = FORMAT_TERMS.find(format => editDistance(singular, format) <= (format.length >= 4 ? 2 : 1));
  return match === 'docx' ? 'word' : match || null;
};

const conversionIntent = (query: string): [string, string] | null => {
  const words = query.split(' ');
  const separator = words.indexOf('to');
  if (separator <= 0 || separator >= words.length - 1) return null;
  const source = [...words.slice(0, separator)].reverse().map(canonicalFormat).find((format): format is string => Boolean(format));
  const target = words.slice(separator + 1).map(canonicalFormat).find((format): format is string => Boolean(format));
  return source && target ? [source, target] : null;
};

export const isDirectToolSearchMatch = (tool: SearchableTool, query: string): boolean => {
  const terms = normalize(query).split(/\s+/).filter(term => term && !SEARCH_STOP_WORDS.has(term));
  const searchable = searchTextForTool(tool);
  return terms.length > 0 && terms.every(term => searchable.includes(term));
};

export function searchTools<T extends SearchableTool>(tools: T[], query: string): T[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return tools;
  const terms = normalizedQuery.split(/\s+/).filter(term => term && !SEARCH_STOP_WORDS.has(term));
  const intent = conversionIntent(normalizedQuery);

  return tools
    .map((tool, index) => {
      const title = normalize(tool.title);
      const searchable = searchTextForTool(tool);
      if (intent && !searchable.includes(`${intent[0]} to ${intent[1]}`)) return null;
      const distances = terms.map(term => termMatchDistance(term, searchable));
      if (distances.some(distance => distance === null)) return null;
      let score = index / 1000;
      if (title === normalizedQuery) score -= 100;
      else if (title.startsWith(normalizedQuery)) score -= 60;
      else if (title.includes(normalizedQuery)) score -= 35;
      const comparableTitle = title.slice(0, normalizedQuery.length);
      const titleDistance = editDistance(normalizedQuery, comparableTitle);
      if (titleDistance <= 3) score -= 50 - titleDistance * 5;
      score -= terms.filter(term => title.includes(term)).length * 8;
      score += distances.reduce<number>((total, distance) => total + (distance || 0) * 12, 0);
      return { tool, score };
    })
    .filter((entry): entry is { tool: T; score: number } => Boolean(entry))
    .sort((a, b) => a.score - b.score)
    .map(entry => entry.tool);
}
