export interface ContourBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const detectDocumentContours = (img: HTMLImageElement): ContourBounds | null => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  
  // Scale down for faster pixel scanning
  const w = 200;
  const h = Math.round((img.naturalHeight * 200) / img.naturalWidth);
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);
  
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  
  // 1. Calculate average luminance to set adaptive threshold
  let totalLum = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalLum += (0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
  }
  const avgLum = totalLum / (w * h);
  
  // 2. Scan from left, right, top, bottom to find transitions
  let left = 0, right = w - 1, top = 0, bottom = h - 1;
  const threshold = Math.max(40, avgLum * 0.85); // buffer threshold
  
  // Scan Left
  for (let x = 0; x < w; x++) {
    let columnSum = 0;
    for (let y = 0; y < h; y++) {
      const idx = (y * w + x) * 4;
      columnSum += (0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2]);
    }
    if (columnSum / h > threshold) {
      left = x;
      break;
    }
  }
  
  // Scan Right
  for (let x = w - 1; x >= 0; x--) {
    let columnSum = 0;
    for (let y = 0; y < h; y++) {
      const idx = (y * w + x) * 4;
      columnSum += (0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2]);
    }
    if (columnSum / h > threshold) {
      right = x;
      break;
    }
  }
  
  // Scan Top
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      rowSum += (0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2]);
    }
    if (rowSum / w > threshold) {
      top = y;
      break;
    }
  }
  
  // Scan Bottom
  for (let y = h - 1; y >= 0; y--) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      rowSum += (0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2]);
    }
    if (rowSum / w > threshold) {
      bottom = y;
      break;
    }
  }
  
  // 3. Return percentage bounds (clamped for margin buffer)
  const lPct = Math.max(0, Math.round((left / w) * 100));
  const tPct = Math.max(0, Math.round((top / h) * 100));
  const rPct = Math.min(100, Math.round((right / w) * 100));
  const bPct = Math.min(100, Math.round((bottom / h) * 100));
  
  const wPct = Math.max(15, rPct - lPct);
  const hPct = Math.max(15, bPct - tPct);
  
  return { left: lPct, top: tPct, width: wPct, height: hPct };
};

