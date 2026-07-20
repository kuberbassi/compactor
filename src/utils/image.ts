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

  // 1. Calculate Crop bounds (manual crop percentages override cropAspect preset)
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

    // Bounding safety guards
    cropX = Math.max(0, Math.min(cropX, originalWidth - 10));
    cropY = Math.max(0, Math.min(cropY, originalHeight - 10));
    cropW = Math.max(10, Math.min(cropW, originalWidth - cropX));
    cropH = Math.max(10, Math.min(cropH, originalHeight - cropY));
  } else if (options.cropAspect && options.cropAspect !== 'none') {
    const parts = options.cropAspect.split(':');
    const aspectW = parseFloat(parts[0]);
    const aspectH = parseFloat(parts[1]);
    
    if (!isNaN(aspectW) && !isNaN(aspectH)) {
      const targetAspect = aspectW / aspectH;
      const currentAspect = originalWidth / originalHeight;
      
      if (currentAspect > targetAspect) {
        // Crop width sides
        cropH = originalHeight;
        cropW = Math.round(originalHeight * targetAspect);
        cropX = Math.round((originalWidth - cropW) / 2);
      } else {
        // Crop height top/bottom
        cropW = originalWidth;
        cropH = Math.round(originalWidth / targetAspect);
        cropY = Math.round((originalHeight - cropH) / 2);
      }
    }
  }

  // 2. Calculate Rotation bounding dimensions (swapping width/height for 90 or 270 deg)
  let rotatedWidth = cropW;
  let rotatedHeight = cropH;
  const rotationAngle = options.rotation || 0;
  if (rotationAngle === 90 || rotationAngle === 270) {
    rotatedWidth = cropH;
    rotatedHeight = cropW;
  }

  // 3. Apply Resizing constraints on the rotated bounds
  let width = rotatedWidth;
  let height = rotatedHeight;

  if (options.maxWidth && width > options.maxWidth) {
    height = Math.round((height * options.maxWidth) / width);
    width = options.maxWidth;
  }
  
  if (options.maxHeight && height > options.maxHeight) {
    width = Math.round((width * options.maxHeight) / height);
    height = options.maxHeight;
  }

  // Define helper to convert canvas to blob for a given format and quality
  const getBlob = (format: string, quality: number): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mime = format === 'image/jpg' ? 'image/jpeg' : format;
      canvas.toBlob((b) => resolve(b), mime, quality);
    });
  };

  // 4. Drawing pipeline helper supporting scaling factors (for target size iteration check)
  const drawImagePipeline = (s: number) => {
    const w = Math.max(10, Math.round(width * s));
    const h = Math.max(10, Math.round(height * s));
    
    canvas.width = w;
    canvas.height = h;
    
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    
    // Filters: Grayscale
    if (options.grayscale) {
      ctx.filter = 'grayscale(100%)';
    }
    
    // Move to center for rotate & flip scale
    ctx.translate(w / 2, h / 2);
    
    // Scale flip (H/V)
    const scaleX = options.flipH ? -1 : 1;
    const scaleY = options.flipV ? -1 : 1;
    ctx.scale(scaleX, scaleY);
    
    // Rotation Angle
    if (rotationAngle !== 0) {
      ctx.rotate((rotationAngle * Math.PI) / 180);
    }
    
    // Bounding dimensions scaled
    const dstW = rotatedWidth * s;
    const dstH = rotatedHeight * s;
    ctx.drawImage(img, cropX, cropY, cropW, cropH, -dstW / 2, -dstH / 2, dstW, dstH);
    
    ctx.restore();
  };

  // Set output format, defaulting to the original type if not specified
  let outputFormat = options.format || file.type;
  if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'].includes(outputFormat)) {
    outputFormat = 'image/jpeg';
  }

  let finalBlob: Blob | null = null;
  let finalFormat = outputFormat;

  // 5. Run pipeline and compress with target size checks or simple quality settings
  if (options.targetSizeKB && options.targetSizeKB > 0) {
    const targetBytes = options.targetSizeKB * 1024;
    if (finalFormat === 'image/png') {
      finalFormat = 'image/webp';
    }

    let scale = 1.0;
    let bestBlob: Blob | null = null;
    let finalWidth = width;
    let finalHeight = height;

    for (let attempts = 0; attempts < 5; attempts++) {
      drawImagePipeline(scale);
      finalWidth = canvas.width;
      finalHeight = canvas.height;

      // Pre-check lowest quality (0.02) to see if size constraint can be satisfied at this scale.
      const minBlob = await getBlob(finalFormat, 0.02);
      if (minBlob && minBlob.size > targetBytes) {
        // Even at minimum quality it's too large; skip binary search and scale down immediately
        bestBlob = minBlob;
        scale -= 0.18;
        if (scale < 0.15) {
          break;
        }
        continue;
      }

      let low = 0.02;
      let high = 0.98;
      let localBest: Blob | null = minBlob;

      for (let iter = 0; iter < 7; iter++) {
        const q = (low + high) / 2;
        const b = await getBlob(finalFormat, q);
        if (b) {
          localBest = b;
          if (b.size > targetBytes) {
            high = q;
          } else {
            low = q;
          }
        }
      }

      if (localBest) {
        bestBlob = localBest;
        if (localBest.size <= targetBytes) {
          break;
        }
      }

      scale -= 0.18; // reduce width/height
      if (scale < 0.15) {
        break;
      }
    }

    finalBlob = bestBlob;
    width = finalWidth;
    height = finalHeight;
  } else {
    // Normal render at full size (1.0 scale)
    drawImagePipeline(1.0);
    finalBlob = await getBlob(outputFormat, options.quality);
  }

  if (!finalBlob) {
    throw new Error('Canvas serialization failed');
  }

  // 2. Smart compression fallback logic:
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
    (options.grayscale);

  if (!hasVisualMods && finalBlob.size >= file.size) {
    if (!isTargetSizeSet) {
      // Step down quality sequentially using the target output format only to preserve format
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

  // 3. Absolute fallback: If the compressed file is still larger than the original file,
  // we simply return the original file to prevent any size increase, unless visual mods were requested.
  if (!hasVisualMods && finalBlob.size >= file.size) {
    finalBlob = file;
    finalFormat = file.type;
  }

  // Generate a new download name with appropriate extension
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

