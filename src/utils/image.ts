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
  scanEnhanceMode?: 'none' | 'smart-contrast' | 'crisp-bw' | 'deskew';
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

  let finalFormat = options.format === 'preserve' || options.format === 'original'
    ? file.type
    : options.format || file.type || 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(finalFormat)) {
    finalFormat = 'image/jpeg';
  }

  const outputFormat = finalFormat;
  const isLossy = outputFormat === 'image/jpeg' || outputFormat === 'image/webp';

  const createScaledCanvas = (scaleFactor: number) => {
    const cvs = document.createElement('canvas');
    const cCtx = cvs.getContext('2d');
    if (!cCtx) throw new Error('Could not get 2D context from canvas');

    const scaledW = Math.max(1, Math.round(width * scaleFactor));
    const scaledH = Math.max(1, Math.round(height * scaleFactor));

    if (isRotated90or270) {
      cvs.width = scaledH;
      cvs.height = scaledW;
    } else {
      cvs.width = scaledW;
      cvs.height = scaledH;
    }

    cCtx.save();

    if (isRotated90or270) {
      cCtx.translate(scaledH / 2, scaledW / 2);
    } else {
      cCtx.translate(scaledW / 2, scaledH / 2);
    }

    if (rotation !== 0) {
      cCtx.rotate((rotation * Math.PI) / 180);
    }

    cCtx.scale(scaleX, scaleY);

    if (options.grayscale) {
      cCtx.filter = 'grayscale(100%)';
    }

    cCtx.drawImage(
      img,
      cropX, cropY, cropW, cropH,
      -scaledW / 2, -scaledH / 2, scaledW, scaledH
    );

    cCtx.restore();

    if (options.pixelateBox && options.pixelateBox.widthPct > 0 && options.pixelateBox.heightPct > 0) {
      const pxSize = options.pixelateBox.pixelSize || 14;
      const pxLeft = (options.pixelateBox.leftPct / 100) * cvs.width;
      const pxTop = (options.pixelateBox.topPct / 100) * cvs.height;
      const pxWidth = (options.pixelateBox.widthPct / 100) * cvs.width;
      const pxHeight = (options.pixelateBox.heightPct / 100) * cvs.height;

      for (let x = pxLeft; x < pxLeft + pxWidth; x += pxSize) {
        for (let y = pxTop; y < pxTop + pxHeight; y += pxSize) {
          const w = Math.min(pxSize, pxLeft + pxWidth - x);
          const h = Math.min(pxSize, pxTop + pxHeight - y);
          const data = cCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
          cCtx.fillStyle = `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
          cCtx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
        }
      }
    }

    return { cvs, scaledW, scaledH };
  };

  const getBlobFromCanvas = (cvs: HTMLCanvasElement, fmt: string, q: number): Promise<Blob | null> => {
    return new Promise((resolve) => {
      cvs.toBlob((b) => resolve(b), fmt, q);
    });
  };

  let finalWidth = width;
  let finalHeight = height;
  let finalBlob: Blob | null = null;

  const isTargetSizeSet = !!(options.targetSizeKB && options.targetSizeKB > 0);

  if (isTargetSizeSet) {
    const targetBytes = options.targetSizeKB! * 1024;
    const initialCanvasObj = createScaledCanvas(1.0);
    const initialBlob = await getBlobFromCanvas(initialCanvasObj.cvs, outputFormat, options.quality);

    if (initialBlob && initialBlob.size <= targetBytes) {
      finalBlob = initialBlob;
      if (isLossy && initialBlob.size < targetBytes) {
        // Try increasing quality up to 1.0 to get optimal visual fidelity within target limit
        let minQ = options.quality;
        let maxQ = 1.0;
        for (let i = 0; i < 5; i++) {
          const midQ = (minQ + maxQ) / 2;
          const testBlob = await getBlobFromCanvas(initialCanvasObj.cvs, outputFormat, midQ);
          if (testBlob && testBlob.size <= targetBytes) {
            finalBlob = testBlob;
            minQ = midQ;
          } else {
            maxQ = midQ;
          }
        }
      }
    } else {
      // Step 1: If lossy, binary search quality first at 1.0 scale
      if (isLossy) {
        let minQ = 0.05;
        let maxQ = options.quality;
        let bestQBlob: Blob | null = null;

        for (let i = 0; i < 7; i++) {
          const midQ = (minQ + maxQ) / 2;
          const testBlob = await getBlobFromCanvas(initialCanvasObj.cvs, outputFormat, midQ);
          if (testBlob) {
            if (testBlob.size <= targetBytes) {
              bestQBlob = testBlob;
              minQ = midQ;
            } else {
              maxQ = midQ;
            }
          }
        }
        if (bestQBlob) {
          finalBlob = bestQBlob;
        }
      }

      // Step 2: If quality search was insufficient or format is PNG (quality ignored), binary search scale factor
      if (!finalBlob) {
        let minScale = 0.05;
        let maxScale = 1.0;
        let bestScaleBlob: Blob | null = null;
        let bestScaleW = width;
        let bestScaleH = height;

        for (let i = 0; i < 8; i++) {
          const midScale = (minScale + maxScale) / 2;
          const { cvs: candidateCvs, scaledW: candidateW, scaledH: candidateH } = createScaledCanvas(midScale);
          const candidateQ = isLossy ? Math.min(options.quality, 0.75) : options.quality;
          const candidateBlob = await getBlobFromCanvas(candidateCvs, outputFormat, candidateQ);

          if (candidateBlob) {
            if (candidateBlob.size <= targetBytes) {
              bestScaleBlob = candidateBlob;
              bestScaleW = candidateW;
              bestScaleH = candidateH;
              minScale = midScale;
            } else {
              maxScale = midScale;
            }
          }
        }

        if (bestScaleBlob) {
          finalBlob = bestScaleBlob;
          finalWidth = bestScaleW;
          finalHeight = bestScaleH;
        } else {
          // Fallback: render at minimum scale (0.05) if target size is extremely small
          const { cvs: minCvs, scaledW: minW, scaledH: minH } = createScaledCanvas(0.05);
          finalBlob = await getBlobFromCanvas(minCvs, outputFormat, 0.1);
          finalWidth = minW;
          finalHeight = minH;
        }
      }
    }
  } else {
    // Automatic Compression Mode
    let initialScale = 1.0;
    if (outputFormat === 'image/png' && options.quality < 0.99) {
      initialScale = Math.min(1.0, Math.sqrt(options.quality));
    }

    const { cvs: autoCvs, scaledW: autoW, scaledH: autoH } = createScaledCanvas(initialScale);
    finalWidth = autoW;
    finalHeight = autoH;
    finalBlob = await getBlobFromCanvas(autoCvs, outputFormat, options.quality);

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

    // If result is >= original file size, force compression by stepping down quality / scale
    if (finalBlob && finalBlob.size >= file.size) {
      let reducedBlob: Blob | null = null;

      if (isLossy) {
        const stepQualities = [options.quality * 0.85, options.quality * 0.7, 0.5, 0.35, 0.2];
        for (const q of stepQualities) {
          const lowerBlob = await getBlobFromCanvas(autoCvs, outputFormat, q);
          if (lowerBlob && lowerBlob.size < file.size) {
            reducedBlob = lowerBlob;
            break;
          }
        }
      }

      if (!reducedBlob) {
        const stepScales = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4];
        for (const s of stepScales) {
          const { cvs: stepCvs, scaledW: stepW, scaledH: stepH } = createScaledCanvas(s * initialScale);
          const stepBlob = await getBlobFromCanvas(stepCvs, outputFormat, isLossy ? options.quality * 0.8 : options.quality);
          if (stepBlob && stepBlob.size < file.size) {
            reducedBlob = stepBlob;
            finalWidth = stepW;
            finalHeight = stepH;
            break;
          }
        }
      }

      if (reducedBlob) {
        finalBlob = reducedBlob;
      } else if (!hasVisualMods) {
        finalBlob = file;
        finalFormat = file.type;
        finalWidth = img.naturalWidth;
        finalHeight = img.naturalHeight;
      }
    }
  }

  if (!finalBlob) {
    throw new Error('Canvas serialization failed');
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
    width: finalWidth,
    height: finalHeight
  };
};

export interface WatermarkOptions {
  text: string;
  position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'pattern';
  opacity: number;
  fontSize: number;
  color: string;
}

/**
 * Draws a text watermark onto an image and returns the result as a Blob.
 */
export const watermarkImage = async (
  file: File,
  options: WatermarkOptions
): Promise<ImageProcessResult> => {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  ctx.drawImage(img, 0, 0);

  const fontSize = Math.max(12, options.fontSize);
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.globalAlpha = Math.max(0, Math.min(1, options.opacity));
  ctx.fillStyle = options.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textW = ctx.measureText(options.text).width;
  const padding = 24;
  const w = canvas.width;
  const h = canvas.height;

  if (options.position === 'pattern') {
    const angle = (-30 * Math.PI) / 180;
    const stepX = Math.max(textW + 64, fontSize * 3.5);
    const stepY = Math.max(fontSize * 3, 60);
    const diag = Math.sqrt(w * w + h * h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(angle);

    for (let py = -diag; py < diag; py += stepY) {
      const rowOffset = (Math.round(py / stepY) % 2) * (stepX / 2);
      for (let px = -diag; px < diag; px += stepX) {
        ctx.fillText(options.text, px + rowOffset, py);
      }
    }
    ctx.restore();
  } else {
    let x: number;
    let y: number;

    switch (options.position) {
      case 'top-left':    x = textW / 2 + padding; y = fontSize / 2 + padding; break;
      case 'top-right':   x = w - textW / 2 - padding; y = fontSize / 2 + padding; break;
      case 'bottom-left': x = textW / 2 + padding; y = h - fontSize / 2 - padding; break;
      case 'bottom-right':x = w - textW / 2 - padding; y = h - fontSize / 2 - padding; break;
      default:            x = w / 2; y = h / 2; // center
    }

    ctx.fillText(options.text, x, y);
  }

  ctx.globalAlpha = 1;

  const mimeType = file.type || 'image/jpeg';
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), mimeType, 0.92);
  });

  const ext = mimeType.split('/')[1] || 'jpg';
  const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
  const url = URL.createObjectURL(blob);

  return {
    blob,
    url,
    name: `${baseName}_watermarked.${ext}`,
    originalSize: file.size,
    newSize: blob.size,
    width: canvas.width,
    height: canvas.height,
  };
};
