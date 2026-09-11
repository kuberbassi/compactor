export const nextPreviewZoom = (current: number, wheelDelta: number) =>
  Math.min(2.5, Math.max(0.6, current * Math.exp(-wheelDelta * 0.002)));
