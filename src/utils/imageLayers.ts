/**
 * Non-destructive layer-based image composition engine.
 * Allows stacking image layers, text overlays, shape masks, and adjustment layers with blend modes and opacity.
 */

export interface ImageLayer {
  id: string;
  name: string;
  type: "image" | "text" | "adjustment";
  visible: boolean;
  opacity: number; // 0.0 to 1.0
  blendMode: GlobalCompositeOperation;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number; // degrees
  // Image type properties
  imageElement?: HTMLImageElement | ImageBitmap;
  // Text type properties
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  // Adjustment properties
  brightness?: number; // 100 default
  contrast?: number;   // 100 default
  saturation?: number; // 100 default
}

export interface LayerCompositionState {
  width: number;
  height: number;
  backgroundColor: string;
  layers: ImageLayer[];
}

/**
 * Creates an empty composition state based on base dimensions
 */
export const createComposition = (width: number, height: number, backgroundColor = "transparent"): LayerCompositionState => ({
  width,
  height,
  backgroundColor,
  layers: [],
});

/**
 * Renders all visible layers onto an HTML5 Canvas non-destructively
 */
export const renderCompositionToCanvas = (
  composition: LayerCompositionState,
  targetCanvas?: HTMLCanvasElement
): HTMLCanvasElement => {
  const canvas = targetCanvas || document.createElement("canvas");
  canvas.width = composition.width;
  canvas.height = composition.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire 2D canvas context for layer rendering.");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (composition.backgroundColor && composition.backgroundColor !== "transparent") {
    ctx.fillStyle = composition.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  for (const layer of composition.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
    ctx.globalCompositeOperation = layer.blendMode || "source-over";

    const posX = layer.x || 0;
    const posY = layer.y || 0;
    const w = layer.width || composition.width;
    const h = layer.height || composition.height;

    if (layer.rotation) {
      ctx.translate(posX + w / 2, posY + h / 2);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.translate(-(posX + w / 2), -(posY + h / 2));
    }

    if (layer.type === "image" && layer.imageElement) {
      if (layer.brightness !== undefined || layer.contrast !== undefined || layer.saturation !== undefined) {
        const b = layer.brightness ?? 100;
        const c = layer.contrast ?? 100;
        const s = layer.saturation ?? 100;
        ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
      }
      ctx.drawImage(layer.imageElement, posX, posY, w, h);
    } else if (layer.type === "text" && layer.text) {
      ctx.font = `${layer.fontSize || 24}px ${layer.fontFamily || "sans-serif"}`;
      ctx.fillStyle = layer.color || "#ffffff";
      ctx.fillText(layer.text, posX, posY + (layer.fontSize || 24));
    }

    ctx.restore();
  }

  return canvas;
};

/**
 * Exports composition as a Blob
 */
export const exportCompositionAsBlob = (
  composition: LayerCompositionState,
  format: "image/png" | "image/jpeg" | "image/webp" = "image/png",
  quality = 0.92
): Promise<Blob> => {
  const canvas = renderCompositionToCanvas(composition);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to export layer composition to blob."));
      },
      format,
      quality
    );
  });
};
