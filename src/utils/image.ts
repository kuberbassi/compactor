/**
 * Utility helper for image compression, resizing, and format conversion
 */

export interface ImageProcessOptions {
  quality: number; // 0.1 to 1.0
  maxWidth?: number;
  maxHeight?: number;
  format?: string; // 'image/jpeg' | 'image/png' | 'image/webp'
  targetSizeKB?: number;
  rotation?: number; // 0, 90, 180, 270
  flipH?: boolean;
  flipV?: boolean;
  cropAspect?: string; // 'none', '1:1', '16:9', '4:3', '9:16'
  grayscale?: boolean;
  cropLeftPct?: number;
  cropTopPct?: number;
  cropWidthPct?: number;
  cropHeightPct?: number;
  pixelateBox?: { leftPct: number; topPct: number; widthPct: number; heightPct: number; pixelSize?: number };
}

export interface ImageProcessResult {
  blob: Blob;
  url: string;
  name: string;
  originalSize: number;
  newSize: number;
  width: number;
  height: number;
}

/**
 * Loads a file as an HTMLImageElement
 */
export const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    
    img.src = url;
  });
};

/**
 * Utility to format byte sizes into readable strings
 */
export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Compresses and/or resizes an image file in-browser using HTML5 Canvas
 */
export const processImage = async (
  file: File,
  options: ImageProcessOptions
): Promise<ImageProcessResult> => {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get 2D context from canvas');
  }

  let originalWidth = img.naturalWidth;
  let originalHeight = img.naturalHeight;

  // 1. Calculate Crop bounds
  let cropX = 0;
  let cropY = 0;
  let cropW = originalWidth;
  let cropH = originalHeight;

  const hasManualCrop = 
    options.cropLeftPct !== undefined &&
    options.cropTopPct !== undefined &&
    options.cropWidthPct !== undefined &&
    options.cropHeightPct !== undefined &&
    (options.cropLeftPct > 0 || options.cropTopPct > 0 || options.cropWidthPct < 100 || options.cropHeightPct < 100);

  if (hasManualCrop) {
    const left = options.cropLeftPct || 0;
    const top = options.cropTopPct || 0;
    const wPct = options.cropWidthPct || 100;
    const hPct = options.cropHeightPct || 100;

    cropX = Math.round((left / 100) * originalWidth);
    cropY = Math.round((top / 100) * originalHeight);
    cropW = Math.round((wPct / 100) * originalWidth);
    cropH = Math.round((hPct / 100) * originalHeight);
  } else if (options.cropAspect && options.cropAspect !== 'none') {
    let targetRatio = 1;
    if (options.cropAspect === '1:1') targetRatio = 1;
    else if (options.cropAspect === '16:9') targetRatio = 16 / 9;
    else if (options.cropAspect === '4:3') targetRatio = 4 / 3;
    else if (options.cropAspect === '9:16') targetRatio = 9 / 16;

    const currentRatio = originalWidth / originalHeight;

    if (currentRatio > targetRatio) {
      cropW = originalHeight * targetRatio;
      cropH = originalHeight;
      cropX = (originalWidth - cropW) / 2;
      cropY = 0;
    } else {
      cropW = originalWidth;
      cropH = originalWidth / targetRatio;
      cropX = 0;
      cropY = (originalHeight - cropH) / 2;
    }
  }

  // 2. Calculate scaling based on max dimensions
  let width = cropW;
  let height = cropH;

  if (options.maxWidth && width > options.maxWidth) {
    height = Math.round((height * options.maxWidth) / width);
    width = options.maxWidth;
  }

  if (options.maxHeight && height > options.maxHeight) {
    width = Math.round((width * options.maxHeight) / height);
    height = options.maxHeight;
  }

  const rotation = options.rotation || 0;
  const isRotated90or270 = rotation === 90 || rotation === 270;

  if (isRotated90or270) {
    canvas.width = height;
    canvas.height = width;
  } else {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.save();

  if (isRotated90or270) {
    ctx.translate(height / 2, width / 2);
  } else {
    ctx.translate(width / 2, height / 2);
  }

  if (rotation !== 0) {
    ctx.rotate((rotation * Math.PI) / 180);
  }

  const scaleX = options.flipH ? -1 : 1;
  const scaleY = options.flipV ? -1 : 1;
  ctx.scale(scaleX, scaleY);

  if (options.grayscale) {
    ctx.filter = 'grayscale(100%)';
  }

  ctx.drawImage(
    img,
    cropX, cropY, cropW, cropH,
    -width / 2, -height / 2, width, height
  );

  ctx.restore();

  // 3. Pixelating Blur Censorship Brush Overlay
  if (options.pixelateBox && options.pixelateBox.widthPct > 0 && options.pixelateBox.heightPct > 0) {
    const pxSize = options.pixelateBox.pixelSize || 14;
    const pxLeft = (options.pixelateBox.leftPct / 100) * canvas.width;
    const pxTop = (options.pixelateBox.topPct / 100) * canvas.height;
    const pxWidth = (options.pixelateBox.widthPct / 100) * canvas.width;
    const pxHeight = (options.pixelateBox.heightPct / 100) * canvas.height;

    for (let x = pxLeft; x < pxLeft + pxWidth; x += pxSize) {
      for (let y = pxTop; y < pxTop + pxHeight; y += pxSize) {
        const w = Math.min(pxSize, pxLeft + pxWidth - x);
        const h = Math.min(pxSize, pxTop + pxHeight - y);
        const data = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
        ctx.fillStyle = `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
        ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
      }
    }
  }

  let finalFormat = options.format || file.type || 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(finalFormat)) {
    finalFormat = 'image/jpeg';
  }

  const outputFormat = finalFormat;

  const getBlob = (fmt: string, q: number): Promise<Blob | null> => {
    return new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), fmt, q);
    });
  };

  let finalBlob = await getBlob(outputFormat, options.quality);

  if (options.targetSizeKB && options.targetSizeKB > 0) {
    const targetBytes = options.targetSizeKB * 1024;
    
    if (finalBlob && finalBlob.size > targetBytes) {
      let minQ = 0.05;
      let maxQ = options.quality;
      let bestBlob = finalBlob;
      
      for (let i = 0; i < 6; i++) {
        const midQ = (minQ + maxQ) / 2;
        const testBlob = await getBlob(outputFormat, midQ);
        if (testBlob) {
          if (testBlob.size <= targetBytes) {
            bestBlob = testBlob;
            minQ = midQ;
          } else {
            maxQ = midQ;
          }
        }
      }
      finalBlob = bestBlob;
    }
  }

  if (!finalBlob) {
    throw new Error('Canvas serialization failed');
  }

  const isTargetSizeSet = !!(options.targetSizeKB && options.targetSizeKB > 0);
  const hasVisualMods = 
    (options.maxWidth && img.naturalWidth > options.maxWidth) ||
    (options.maxHeight && img.naturalHeight > options.maxHeight) ||
    (options.rotation && options.rotation !== 0) ||
    (options.flipH) ||
    (options.flipV) ||
    (options.cropLeftPct !== undefined && options.cropLeftPct > 0) ||
    (options.cropTopPct !== undefined && options.cropTopPct > 0) ||
    (options.cropWidthPct !== undefined && options.cropWidthPct < 100) ||
    (options.cropHeightPct !== undefined && options.cropHeightPct < 100) ||
    (options.cropAspect && options.cropAspect !== 'none') ||
    (options.grayscale) ||
    (options.pixelateBox && options.pixelateBox.widthPct > 0);

  if (!hasVisualMods && finalBlob.size >= file.size) {
    if (!isTargetSizeSet) {
      const stepQualities = [0.72, 0.64, 0.54, 0.45, 0.35];
      for (const q of stepQualities) {
        const lowerBlob = await getBlob(outputFormat, q);
        if (lowerBlob && lowerBlob.size < file.size) {
          finalBlob = lowerBlob;
          break;
        }
      }
    }
  }

  if (!hasVisualMods && finalBlob.size >= file.size) {
    finalBlob = file;
    finalFormat = file.type;
  }

  const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
  const ext = finalFormat.split('/')[1] || 'png';
  const newName = `${originalNameWithoutExt}_optimized.${ext}`;
  const url = URL.createObjectURL(finalBlob);

  return {
    blob: finalBlob,
    url,
    name: newName,
    originalSize: file.size,
    newSize: finalBlob.size,
    width,
    height
  };
};
