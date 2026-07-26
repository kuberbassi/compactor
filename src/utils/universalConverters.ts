/**
 * Universal Lossless Conversion Helpers for Images, Audio, Documents, and Data
 */

/**
 * Encodes an HTML5 Canvas to 24-bit uncompressed BMP Blob
 */
export const canvasToBmp = (canvas: HTMLCanvasElement): Blob => {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  
  const padding = (4 - ((width * 3) % 4)) % 4;
  const pixelArraySize = (width * 3 + padding) * height;
  const fileSize = 54 + pixelArraySize;
  
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  
  // BMP Header (14 bytes)
  view.setUint16(0, 0x424D, false); // "BM"
  view.setUint32(2, fileSize, true); // File size
  view.setUint32(6, 0, true);        // Reserved
  view.setUint32(10, 54, true);      // Pixel data offset
  
  // BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, 40, true);      // Header size
  view.setInt32(18, width, true);    // Width
  view.setInt32(22, height, true);   // Height (bottom-up)
  view.setUint16(26, 1, true);       // Planes
  view.setUint16(28, 24, true);      // 24 bits per pixel (RGB)
  view.setUint32(30, 0, true);       // Compression (0 = BI_RGB)
  view.setUint32(34, pixelArraySize, true); // Image size
  view.setInt32(38, 2835, true);     // X pixels/m (72 DPI)
  view.setInt32(42, 2835, true);     // Y pixels/m (72 DPI)
  view.setUint32(46, 0, true);       // Colors in palette
  view.setUint32(50, 0, true);       // Important colors
  
  const bytes = new Uint8Array(buffer);
  let offset = 54;
  
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      bytes[offset++] = data[i + 2]; // B
      bytes[offset++] = data[i + 1]; // G
      bytes[offset++] = data[i];     // R
    }
    for (let p = 0; p < padding; p++) {
      bytes[offset++] = 0;
    }
  }
  
  return new Blob([buffer], { type: 'image/bmp' });
};

/**
 * Encodes an HTML5 Canvas to Windows ICO Icon Blob
 */
export const canvasToIco = (canvas: HTMLCanvasElement, size = 256): Blob => {
  const icoCanvas = document.createElement('canvas');
  icoCanvas.width = size;
  icoCanvas.height = size;
  const ctx = icoCanvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  
  ctx.drawImage(canvas, 0, 0, size, size);
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  
  const width = size;
  const height = size;
  const imageSize = 40 + (width * height * 4);
  const headerSize = 6 + 16;
  const fileSize = headerSize + imageSize;
  
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  
  // ICONDIR Header (6 bytes)
  view.setUint16(0, 0, true); // Reserved
  view.setUint16(2, 1, true); // Type: 1 = ICO
  view.setUint16(4, 1, true); // Count: 1 image
  
  // ICONDIRENTRY (16 bytes)
  view.setUint8(6, width >= 256 ? 0 : width);
  view.setUint8(7, height >= 256 ? 0 : height);
  view.setUint8(8, 0); // Palette colors
  view.setUint8(9, 0); // Reserved
  view.setUint16(10, 1, true); // Color planes
  view.setUint16(12, 32, true); // Bits per pixel
  view.setUint32(14, imageSize, true); // Image data size
  view.setUint32(18, headerSize, true); // Offset of image data
  
  // BITMAPINFOHEADER (40 bytes)
  view.setUint32(22, 40, true); // Header size
  view.setInt32(26, width, true);
  view.setInt32(30, height * 2, true); // Double height for XOR + AND mask
  view.setUint16(34, 1, true); // Planes
  view.setUint16(36, 32, true); // Bits per pixel
  view.setUint32(38, 0, true); // Compression
  view.setUint32(42, width * height * 4, true); // Image size
  
  // Pixel Data (BGRA, bottom-up)
  const bytes = new Uint8Array(buffer);
  let offset = 22 + 40;
  
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      bytes[offset++] = data[i + 2]; // B
      bytes[offset++] = data[i + 1]; // G
      bytes[offset++] = data[i];     // R
      bytes[offset++] = data[i + 3]; // A
    }
  }
  
  return new Blob([buffer], { type: 'image/x-icon' });
};

/**
 * Decodes audio file to 16-bit uncompressed PCM WAV Blob using Web Audio API
 */
export const audioFileToWav = async (file: File): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  
  const numOfChan = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numOfChan * 2 + 44;
  const outBuffer = new ArrayBuffer(length);
  const view = new DataView(outBuffer);
  
  const channels: Float32Array[] = [];
  const sampleRate = audioBuffer.sampleRate;
  let offset = 0;
  let pos = 0;
  
  function writeString(str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(pos++, str.charCodeAt(i));
    }
  }
  
  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }
  
  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
  
  // RIFF chunk descriptor
  writeString('RIFF');
  setUint32(length - 8);
  writeString('WAVE');
  
  // FMT sub-chunk
  writeString('fmt ');
  setUint32(16); // Subchunk1Size (16 for PCM)
  setUint16(1);  // AudioFormat (1 for PCM)
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // ByteRate
  setUint16(numOfChan * 2);              // BlockAlign
  setUint16(16);                         // BitsPerSample
  
  // Data sub-chunk
  writeString('data');
  setUint32(length - pos - 4);
  
  for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }
  
  while (offset < audioBuffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }
  
  audioCtx.close();
  return new Blob([outBuffer], { type: 'audio/wav' });
};

/**
 * Parses CSV string to JSON formatted string
 */
export const csvToJson = (csvText: string): string => {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return JSON.stringify([], null, 2);
  
  const parseRow = (rowStr: string): string[] => {
    const result: string[] = [];
    let insideQuote = false;
    let entry = '';
    for (let i = 0; i < rowStr.length; i++) {
      const char = rowStr[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        result.push(entry.trim());
        entry = '';
      } else {
        entry += char;
      }
    }
    result.push(entry.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);
  
  const resultObjects = rows.map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h || `column_${i + 1}`] = row[i] || '';
    });
    return obj;
  });
  
  return JSON.stringify(resultObjects, null, 2);
};

/**
 * Converts JSON array or object string to CSV
 */
export const jsonToCsv = (jsonText: string): string => {
  try {
    const parsed = JSON.parse(jsonText);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    if (items.length === 0) return '';
    
    const headers = Array.from(new Set(items.flatMap(item => typeof item === 'object' && item !== null ? Object.keys(item) : [])));
    if (headers.length === 0) return jsonText;
    
    const escapeCsv = (str: any) => {
      const val = str === null || str === undefined ? '' : String(str);
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };
    
    const headerRow = headers.map(escapeCsv).join(',');
    const dataRows = items.map(item => {
      return headers.map(h => escapeCsv(item[h])).join(',');
    });
    
    return [headerRow, ...dataRows].join('\n');
  } catch {
    return jsonText;
  }
};

/**
 * Converts CSV string to a styled HTML document table
 */
export const csvToHtmlTable = (csvText: string, title = 'Converted Data'): string => {
  const jsonStr = csvToJson(csvText);
  const data = JSON.parse(jsonStr);
  if (!Array.isArray(data) || data.length === 0) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title></head><body><pre>${csvText}</pre></body></html>`;
  }
  
  const headers = Object.keys(data[0]);
  const headerHtml = headers.map(h => `<th style="border: 1px solid #27272a; padding: 10px 14px; background: #18181b; color: #f4f4f5; text-align: left; font-weight: 700;">${h}</th>`).join('');
  const rowsHtml = data.map((row, idx) => {
    const bg = idx % 2 === 0 ? '#09090b' : '#141417';
    const cells = headers.map(h => `<td style="border: 1px solid #27272a; padding: 10px 14px; color: #e4e4e7;">${row[h] || ''}</td>`).join('');
    return `<tr style="background: ${bg};">${cells}</tr>`;
  }).join('');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 32px; background: #09090b; color: #f4f4f5; }
    h2 { font-size: 20px; font-weight: 800; margin-bottom: 16px; letter-spacing: -0.02em; }
    table { width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); font-size: 13px; }
  </style>
</head>
<body>
  <h2>${title}</h2>
  <table>
    <thead><tr>${headerHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;
};

/**
 * Wraps text or markdown content into a styled HTML document string
 */
export const textToHtml = (content: string, title = 'Document'): string => {
  const paragraphs = content.split(/\n\n+/).map(p => `<p style="margin-bottom: 16px; line-height: 1.6;">${p.replace(/\n/g, '<br/>')}</p>`).join('');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 24px; background: #09090b; color: #f4f4f5; font-size: 15px; }
    h1 { font-size: 28px; font-weight: 800; border-bottom: 1px solid #27272a; padding-bottom: 16px; margin-bottom: 24px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${paragraphs}
</body>
</html>`;
};
