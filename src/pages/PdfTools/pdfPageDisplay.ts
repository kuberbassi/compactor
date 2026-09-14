export interface PdfPageDimensions {
  width?: number;
  height?: number;
  rotation: number;
}

export const getPageAspectRatio = (page: PdfPageDimensions): number => {
  if (!page.width || !page.height) return 0.72;
  const isQuarterTurn = Math.abs(page.rotation) % 180 === 90;
  return isQuarterTurn ? page.height / page.width : page.width / page.height;
};

export const getDefaultPageZoom = (page?: PdfPageDimensions): number =>
  page && getPageAspectRatio(page) > 1 ? 100 : 50;

