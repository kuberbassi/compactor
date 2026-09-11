import React, { useRef, useEffect } from 'react';
import { Ruler as RulerIcon } from 'lucide-react';
import { HALFTONE_CELL_SIZE, renderClassicHalftone, createTransformedImageCanvas } from '../../../utils/posterEngine';

interface PosterSourcePreviewProps {
  src: string;
  styleMode: 'color' | 'bw' | 'halftone';
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
  dotSize?: number;
  invertHalftone?: boolean;
}

const PosterSourcePreview: React.FC<PosterSourcePreviewProps> = ({
  src,
  styleMode,
  rotation = 0,
  flipH = false,
  flipV = false,
  dotSize = HALFTONE_CELL_SIZE,
  invertHalftone = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cachedImgRef = useRef<HTMLImageElement | null>(null);
  const srcRef = useRef<string>('');
  const rafRef = useRef<number | null>(null);

  const renderPreview = () => {
    const canvas = canvasRef.current;
    const image = cachedImgRef.current;
    if (!canvas || !image) return;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const transformed = createTransformedImageCanvas(image, rotation, flipH, flipV);
      const targetW = Math.min(1600, Math.max(600, transformed.width));
      const targetH = Math.max(1, Math.round((targetW * transformed.height) / transformed.width));
      
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;

      if (styleMode === 'halftone') {
        context.drawImage(transformed, 0, 0, targetW, targetH);
        const mappedCellSize = Math.max(4, Math.round((dotSize / 14) * (targetW / 80)));
        renderClassicHalftone(context, targetW, targetH, mappedCellSize, 0, 0, invertHalftone);
      } else {
        if (styleMode === 'bw') {
          context.filter = 'grayscale(100%)';
        } else {
          context.filter = 'none';
        }
        context.drawImage(transformed, 0, 0, targetW, targetH);
        context.filter = 'none';
      }
    });
  };

  // Load and cache decoded image
  useEffect(() => {
    if (srcRef.current === src && cachedImgRef.current) {
      renderPreview();
      return;
    }
    srcRef.current = src;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cachedImgRef.current = img;
      renderPreview();
    };
    img.src = src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    renderPreview();
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleMode, rotation, flipH, flipV, dotSize, invertHalftone]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full pointer-events-none select-none object-cover"
      aria-label="Poster source preview"
    />
  );
};

export interface PosterPreviewStageProps {
  file: File;
  previewUrl: string;
  imageDims: { width: number; height: number } | null;
  columns: number;
  rows: number;
  pageSize: string;
  orientation: 'Portrait' | 'Landscape';
  pageMMW: number;
  pageMMH: number;
  posterMeterW: string;
  posterMeterH: string;
  posterInchW: string;
  posterInchH: string;
  styleMode: 'color' | 'bw' | 'halftone';
  posterZoom: number;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
  dotSize?: number;
  invertHalftone?: boolean;
  posterViewportRef: React.RefObject<HTMLDivElement | null>;
}

export const PosterPreviewStage: React.FC<PosterPreviewStageProps> = ({
  file: _file,
  previewUrl,
  imageDims,
  columns,
  rows,
  pageSize,
  orientation: _orientation,
  pageMMW,
  pageMMH,
  posterMeterW,
  posterMeterH,
  posterInchW,
  posterInchH,
  styleMode,
  posterZoom,
  rotation = 0,
  flipH = false,
  flipV = false,
  dotSize = HALFTONE_CELL_SIZE,
  invertHalftone = false,
  posterViewportRef,
}) => {
  const isPerp = rotation === 90 || rotation === 270;
  const rawW = imageDims?.width || 1000;
  const rawH = imageDims?.height || 600;
  const imgW = isPerp ? rawH : rawW;
  const imgH = isPerp ? rawW : rawH;
  const imgAspect = imgW / imgH;
  const gridAspect = (columns * pageMMW) / (rows * pageMMH);

  let gridStyle: React.CSSProperties = {};

  if (gridAspect > imgAspect) {
    const hPct = (imgAspect / gridAspect) * 100;
    const topPct = (100 - hPct) / 2;
    gridStyle = {
      left: '0%',
      top: `${topPct}%`,
      width: '100%',
      height: `${hPct}%`,
    };
  } else {
    const wPct = (gridAspect / imgAspect) * 100;
    const leftPct = (100 - wPct) / 2;
    gridStyle = {
      left: `${leftPct}%`,
      top: '0%',
      width: `${wPct}%`,
      height: '100%',
    };
  }

  return (
    <div ref={posterViewportRef} className="image-preview-viewport workbench-scroll-region flex-1 bg-[var(--bg-color)] relative">
      {/* Subtle checker background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%)', backgroundSize: '20px 20px' }}
      />

      <div className="image-preview-stage relative min-w-full min-h-full p-6 flex flex-col items-center justify-center gap-6">
        <div className="image-preview-zoom-layer" style={{ zoom: `${posterZoom}%` }}>
          <div
            className="relative rounded-lg overflow-hidden border border-zinc-800 shadow-2xl bg-zinc-950 select-none flex items-center justify-center transition-all duration-300"
            style={{
              aspectRatio: `${imgW} / ${imgH}`,
              maxHeight: 'calc(100vh - 16rem)',
              maxWidth: 'calc(100vw - 26rem)',
              width: `min(calc(100vw - 26rem), calc((100vh - 16rem) * ${imgAspect}))`,
            }}
          >
            <PosterSourcePreview
              src={previewUrl}
              styleMode={styleMode}
              rotation={rotation}
              flipH={flipH}
              flipV={flipV}
              dotSize={dotSize}
              invertHalftone={invertHalftone}
            />

              {/* Active printable region & tiled grid overlay */}
              <div
                className="absolute border-2 border-white rounded-sm pointer-events-none transition-all duration-300 z-10"
                style={{
                  ...gridStyle,
                  boxShadow: '0 0 0 9999px rgba(4, 6, 10, 0.70)',
                }}
              >
                <div
                  className="absolute inset-0 grid pointer-events-none z-20"
                  style={{
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                    gridTemplateRows: `repeat(${rows}, 1fr)`,
                  }}
                >
                  {Array.from({ length: columns * rows }).map((_, i) => (
                    <div
                      key={i}
                      className="border border-white/60 flex items-center justify-center relative bg-white/[0.02]"
                    >
                      <span className="text-[11px] font-mono font-black text-white/70 select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        {i + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
          </div>
        </div>

        {/* Floating dimensions badge */}
        <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/90 border border-white/10 rounded-full text-xs text-zinc-300 shadow-xl backdrop-blur-md z-30 select-none">
          <RulerIcon className="w-3.5 h-3.5 text-zinc-400" />
          <span className="font-semibold text-zinc-400">Total Poster:</span>
          <strong className="text-white font-bold">{posterMeterW}m × {posterMeterH}m</strong>
          <span className="text-zinc-500 font-medium">({posterInchW}″ × {posterInchH}″)</span>
          <span className="w-1 h-1 rounded-full bg-zinc-600" />
          <span className="text-zinc-300 font-semibold">{columns * rows} {pageSize} Sheets</span>
        </div>
      </div>
    </div>
  );
};

