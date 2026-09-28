const decoder = new TextDecoder('latin1');

const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((value, index) => bytes[index] === value);
const asciiAt = (bytes: Uint8Array, offset: number, value: string) =>
  decoder.decode(bytes.slice(offset, offset + value.length)) === value;

const requiredZipEntries: Record<string, string[]> = {
  docx: ['[Content_Types].xml', 'word/document.xml'],
  xlsx: ['[Content_Types].xml', 'xl/workbook.xml'],
  pptx: ['[Content_Types].xml', 'ppt/presentation.xml'],
  odt: ['mimetype', 'content.xml'],
  ods: ['mimetype', 'content.xml'],
  odp: ['mimetype', 'content.xml'],
};

/**
 * Rejects empty or structurally impossible exports before they reach a result
 * screen. This is intentionally a fast container/signature check; codecs and
 * document engines remain responsible for semantic encoding correctness.
 */
export async function assertExportLooksValid(blob: Blob, name: string): Promise<void> {
  if (!(blob instanceof Blob) || blob.size === 0) throw new Error('Export produced an empty file. Please retry.');
  if (!name.trim()) throw new Error('Export produced a file without a name. Please retry.');

  const extension = extensionOf(name);
  const head = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
  const invalid = () => new Error(`Export validation failed for ${name}. The generated file was not offered for download.`);

  if (extension === 'pdf') {
    const tail = decoder.decode(await blob.slice(Math.max(0, blob.size - 2048)).arrayBuffer());
    if (!asciiAt(head, 0, '%PDF-') || !tail.includes('%%EOF')) throw invalid();
    return;
  }

  if (extension === 'png' && !startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) throw invalid();
  else if (['jpg', 'jpeg'].includes(extension) && !startsWith(head, [0xff, 0xd8, 0xff])) throw invalid();
  else if (extension === 'gif' && !(asciiAt(head, 0, 'GIF87a') || asciiAt(head, 0, 'GIF89a'))) throw invalid();
  else if (extension === 'webp' && !(asciiAt(head, 0, 'RIFF') && asciiAt(head, 8, 'WEBP'))) throw invalid();
  else if (extension === 'bmp' && !asciiAt(head, 0, 'BM')) throw invalid();
  else if (extension === 'ico' && !startsWith(head, [0x00, 0x00, 0x01, 0x00])) throw invalid();
  else if (['zip', ...Object.keys(requiredZipEntries)].includes(extension)) {
    if (!startsWith(head, [0x50, 0x4b])) throw invalid();
    try {
      const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()));
      const required = requiredZipEntries[extension] ?? [];
      if (required.some((entry) => !(entry in entries))) throw invalid();
    } catch {
      throw invalid();
    }
  }
  else if (extension === 'wav' && !(asciiAt(head, 0, 'RIFF') && asciiAt(head, 8, 'WAVE'))) throw invalid();
  else if (extension === 'flac' && !asciiAt(head, 0, 'fLaC')) throw invalid();
  else if (['ogg', 'opus'].includes(extension) && !asciiAt(head, 0, 'OggS')) throw invalid();
  else if (extension === 'mp3' && !(asciiAt(head, 0, 'ID3') || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0))) throw invalid();
  else if (['mp4', 'm4a', 'mov'].includes(extension) && !asciiAt(head, 4, 'ftyp')) throw invalid();
  else if (['webm', 'mkv'].includes(extension) && !startsWith(head, [0x1a, 0x45, 0xdf, 0xa3])) throw invalid();
  else if (extension === 'svg') {
    const text = await blob.slice(0, 4096).text();
    if (!/<svg[\s>]/i.test(text)) throw invalid();
  } else if (extension === 'json') {
    try { JSON.parse(await blob.text()); } catch { throw invalid(); }
  }
}
import { unzipSync } from 'fflate';
