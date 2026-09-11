// Only individual image assets are rasterized; document text remains PDF text.
export interface MarkdownImage { data: string; width: number; height: number }

const imageCache = new Map<string, Promise<MarkdownImage>>();

async function fetchMarkdownImage(url: string): Promise<MarkdownImage> {
  const parsed = new URL(url);
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Unsupported image URL');
  const response = await fetch(parsed.href, { signal: AbortSignal.timeout(5000), credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error('Image request failed');
  if (Number(response.headers.get('content-length')) > 5_000_000) throw new Error('Image is too large');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Image response is empty');
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 5_000_000) throw new Error('Image is too large');
      chunks.push(new Uint8Array(value));
    }
  } finally { await reader.cancel(); }
  const blob = new Blob(chunks, { type: response.headers.get('content-type') || '' });
  if (blob.size > 5_000_000 || !blob.type.startsWith('image/')) throw new Error('Unsupported image');
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = objectUrl;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('Empty image');
    const maxDimension = Math.max(img.naturalWidth, img.naturalHeight);
    const isVector = blob.type === 'image/svg+xml' || /\.svg(?:$|[?#])/i.test(parsed.pathname);
    // Small SVG badges otherwise render at their tiny intrinsic bitmap size and
    // become soft when the PDF preview scales them for a high-DPI display.
    const scale = Math.min(isVector ? 4 : 1, 1600 / maxDimension);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image rendering unavailable');
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL('image/png'), width: img.naturalWidth, height: img.naturalHeight };
  } finally { URL.revokeObjectURL(objectUrl); }
}

export function loadMarkdownImage(url: string): Promise<MarkdownImage> {
  const cached = imageCache.get(url);
  if (cached) return cached;

  const pending = fetchMarkdownImage(url).catch(error => {
    imageCache.delete(url);
    throw error;
  });
  imageCache.set(url, pending);

  // Markdown editing repeatedly recompiles the same document. Keep a small,
  // bounded cache so unchanged linked images are not downloaded on every edit.
  if (imageCache.size > 40) imageCache.delete(imageCache.keys().next().value!);
  return pending;
}
