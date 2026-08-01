import ImageTracer from 'imagetracerjs';

export interface SvgTraceOptions {
  /** Maximum palette size. Higher values preserve more color detail but create larger SVGs. */
  colors?: number;
  /** Curve fitting tolerance in pixels. Lower values follow edges more precisely. */
  curveTolerance?: number;
  /** Discard paths shorter than this many nodes. */
  minimumPathLength?: number;
  /** Maximum decoded pixels, protecting the browser from excessive tracing work. */
  maximumPixels?: number;
}

export const traceImageDataToSvg = (
  imageData: ImageData,
  sourceWidth: number,
  sourceHeight: number,
  options: SvgTraceOptions = {},
): string => {
  const tolerance = Math.max(0.05, options.curveTolerance ?? 0.35);
  const svg = ImageTracer.imagedataToSVG(imageData, {
    ltres: tolerance,
    qtres: tolerance,
    pathomit: Math.max(0, options.minimumPathLength ?? 1),
    rightangleenhance: true,
    colorsampling: 2,
    numberofcolors: Math.max(2, Math.min(128, options.colors ?? 48)),
    mincolorratio: 0,
    colorquantcycles: 5,
    layering: 0,
    strokewidth: 0,
    linefilter: false,
    scale: 1,
    roundcoords: 2,
    viewbox: true,
    desc: false,
    blurradius: 0,
    blurdelta: 20,
  });

  if (!svg.includes('<path')) throw new Error('No vector paths could be extracted from this image.');
  return svg.replace(
    /<svg\s+([^>]*)>/i,
    `<svg $1 width="${sourceWidth}" height="${sourceHeight}" preserveAspectRatio="xMidYMid meet">`,
  );
};

const loadBitmap = (imageFile: File): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  const url = URL.createObjectURL(imageFile);
  image.onload = () => {
    URL.revokeObjectURL(url);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('The browser could not decode this image for vector tracing.'));
  };
  image.src = url;
});

/**
 * Converts raster pixels into real multi-color SVG paths using ImageTracer's
 * color quantization, edge layering, line fitting, and quadratic spline fitting.
 */
export const traceImageToSvg = async (
  imageFile: File,
  options: SvgTraceOptions = {},
): Promise<string> => {
  const image = await loadBitmap(imageFile);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (!sourceWidth || !sourceHeight) throw new Error('The image has invalid dimensions.');

  const maximumPixels = Math.max(1_000_000, options.maximumPixels ?? 8_000_000);
  const scale = Math.min(1, Math.sqrt(maximumPixels / (sourceWidth * sourceHeight)));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not initialize the image tracing canvas.');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  return traceImageDataToSvg(imageData, sourceWidth, sourceHeight, options);
};
