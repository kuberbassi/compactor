import { useState } from 'react';
import { PDFDocument, rgb } from 'pdf-lib';
import { FileUploader } from '../../components/Common/FileUploader';
import { ToolHeader } from '../../components/Common/ToolHeader';
import { ProgressBar } from '../../components/Common/ProgressBar';
import {
  RefreshCw,
  CheckCircle, Download,
  Printer as PrinterIcon, Ruler as RulerIcon,
  Grid3X3 as GridIcon
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardTitle, CardDescription } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';

interface RasterbatorProps {
  onGoHome: () => void;
  onUploadSuccess: () => void;
}

const PAGE_SIZES = {
  A4: { width: 595.28, height: 841.89, label: 'A4 (210 × 297 mm)', mmW: 210, mmH: 297 },
  A3: { width: 841.89, height: 1190.55, label: 'A3 (297 × 420 mm)', mmW: 297, mmH: 420 },
  A2: { width: 1190.55, height: 1683.78, label: 'A2 (420 × 594 mm)', mmW: 420, mmH: 594 },
  Letter: { width: 612.00, height: 792.00, label: 'Letter (8.5 × 11 in)', mmW: 215.9, mmH: 279.4 },
  Legal: { width: 612.00, height: 1008.00, label: 'Legal (8.5 × 14 in)', mmW: 215.9, mmH: 355.6 },
  Tabloid: { width: 792.00, height: 1224.00, label: 'Tabloid (11 × 17 in)', mmW: 279.4, mmH: 431.8 }
};

export const Rasterbator: React.FC<RasterbatorProps> = ({ onGoHome, onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<{ width: number; height: number } | null>(null);

  // Page & Print settings
  const [pageSize, setPageSize] = useState<keyof typeof PAGE_SIZES>('A4');
  const [orientation, setOrientation] = useState<'Portrait' | 'Landscape'>('Portrait');
  const [columns, setColumns] = useState<number>(5);
  const [rows, setRows] = useState<number>(3);
  const [styleMode, setStyleMode] = useState<'color' | 'bw' | 'halftone'>('color');
  const [lockAspect, setLockAspect] = useState<boolean>(true);
  const [showCropMarks, setShowCropMarks] = useState<boolean>(true);

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState('');

  const getPaperLabel = (key: keyof typeof PAGE_SIZES, orient: 'Portrait' | 'Landscape') => {
    const p = PAGE_SIZES[key];
    const mmW = orient === 'Portrait' ? p.mmW : p.mmH;
    const mmH = orient === 'Portrait' ? p.mmH : p.mmW;
    if (key === 'Letter') {
      return orient === 'Portrait' ? 'Letter (8.5 × 11 in)' : 'Letter (11 × 8.5 in)';
    }
    if (key === 'Legal') {
      return orient === 'Portrait' ? 'Legal (8.5 × 14 in)' : 'Legal (14 × 8.5 in)';
    }
    if (key === 'Tabloid') {
      return orient === 'Portrait' ? 'Tabloid (11 × 17 in)' : 'Tabloid (17 × 11 in)';
    }
    return `${key} (${mmW} × ${mmH} mm)`;
  };

  const handleFileSelected = (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;
    const f = selectedFiles[0];
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);

    const img = new Image();
    img.onload = () => {
      setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
      if (lockAspect) {
        recalcRows(columns, img.naturalWidth, img.naturalHeight, pageSize, orientation);
      }
    };
    img.src = url;
  };

  const recalcRows = (cols: number, imgW: number, imgH: number, sizeKey: keyof typeof PAGE_SIZES, orient: 'Portrait' | 'Landscape') => {
    const p = PAGE_SIZES[sizeKey];
    const pW = orient === 'Portrait' ? p.mmW : p.mmH;
    const pH = orient === 'Portrait' ? p.mmH : p.mmW;
    const imgAspect = imgW / imgH;
    const calculated = Math.max(1, Math.round((cols * pW) / (imgAspect * pH)));
    setRows(calculated);
  };

  const handleColumnsChange = (newCols: number) => {
    const cols = Math.max(1, newCols);
    setColumns(cols);
    if (lockAspect && imageDims) {
      recalcRows(cols, imageDims.width, imageDims.height, pageSize, orientation);
    }
  };

  const handlePageSizeChange = (newSize: keyof typeof PAGE_SIZES) => {
    setPageSize(newSize);
    if (lockAspect && imageDims) {
      recalcRows(columns, imageDims.width, imageDims.height, newSize, orientation);
    }
  };

  const handleOrientationChange = (newOrient: 'Portrait' | 'Landscape') => {
    setOrientation(newOrient);
    if (lockAspect && imageDims) {
      recalcRows(columns, imageDims.width, imageDims.height, pageSize, newOrient);
    }
  };

  const reset = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setImageDims(null);
    setResultUrl(null);
    setResultName('');
    setProgress(0);
    setProcessing(false);
  };

  // Physical Poster Total Dimensions
  const p = PAGE_SIZES[pageSize];
  const pageMMW = orientation === 'Portrait' ? p.mmW : p.mmH;
  const pageMMH = orientation === 'Portrait' ? p.mmH : p.mmW;
  const totalMMW = columns * pageMMW;
  const totalMMH = rows * pageMMH;
  const posterMeterW = (totalMMW / 1000).toFixed(2);
  const posterMeterH = (totalMMH / 1000).toFixed(2);
  const posterInchW = (totalMMW / 25.4).toFixed(1);
  const posterInchH = (totalMMH / 25.4).toFixed(1);

  const generatePoster = async () => {
    if (!file || !previewUrl) return;
    setProcessing(true);
    setProgress(5);
    setStatusText('Initializing high-precision poster engine...');

    try {
      const img = new Image();
      img.src = previewUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const pdfDoc = await PDFDocument.create();
      const dims = PAGE_SIZES[pageSize];

      const pageWidth = orientation === 'Portrait' ? dims.width : dims.height;
      const pageHeight = orientation === 'Portrait' ? dims.height : dims.width;

      const tileWidthPx = 1200;
      const tileHeightPx = Math.round(1200 * (pageHeight / pageWidth));

      const masterW = columns * tileWidthPx;
      const masterH = rows * tileHeightPx;

      const masterAspect = masterW / masterH;
      const imgAspect = img.naturalWidth / img.naturalHeight;

      let drawW = masterW;
      let drawH = masterH;
      let drawX = 0;
      let drawY = 0;

      if (imgAspect > masterAspect) {
        drawW = masterH * imgAspect;
        drawX = (masterW - drawW) / 2;
      } else {
        drawH = masterW / imgAspect;
        drawY = (masterH - drawH) / 2;
      }

      const scaleX = img.naturalWidth / drawW;
      const scaleY = img.naturalHeight / drawH;

      const tileCanvas = document.createElement('canvas');
      tileCanvas.width = tileWidthPx;
      tileCanvas.height = tileHeightPx;
      const tCtx = tileCanvas.getContext('2d');
      if (!tCtx) throw new Error('Could not instantiate tile canvas context');

      const totalPages = columns * rows;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
          const idx = r * columns + c + 1;
          setStatusText(`Processing sheet ${idx} of ${totalPages} (Row ${r + 1}, Col ${c + 1})...`);
          setProgress(Math.round(10 + (idx / totalPages) * 75));

          tCtx.fillStyle = '#ffffff';
          tCtx.fillRect(0, 0, tileWidthPx, tileHeightPx);

          const tileX = c * tileWidthPx;
          const tileY = r * tileHeightPx;

          const rawSrcX = (tileX - drawX) * scaleX;
          const rawSrcY = (tileY - drawY) * scaleY;
          const rawSrcW = tileWidthPx * scaleX;
          const rawSrcH = tileHeightPx * scaleY;

          const srcX = Math.max(0, rawSrcX);
          const srcY = Math.max(0, rawSrcY);
          const srcRight = Math.min(img.naturalWidth, rawSrcX + rawSrcW);
          const srcBottom = Math.min(img.naturalHeight, rawSrcY + rawSrcH);

          const srcW = Math.max(0, srcRight - srcX);
          const srcH = Math.max(0, srcBottom - srcY);

          if (srcW > 0 && srcH > 0) {
            const dstX = (srcX - rawSrcX) / scaleX;
            const dstY = (srcY - rawSrcY) / scaleY;
            const dstW = srcW / scaleX;
            const dstH = srcH / scaleY;

            tCtx.drawImage(img, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
          }

          if (styleMode === 'bw') {
            const tileImgData = tCtx.getImageData(0, 0, tileWidthPx, tileHeightPx);
            const d = tileImgData.data;
            for (let i = 0; i < d.length; i += 4) {
              const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
              d[i] = d[i + 1] = d[i + 2] = lum;
            }
            tCtx.putImageData(tileImgData, 0, 0);
          } else if (styleMode === 'halftone') {
            const tileImgData = tCtx.getImageData(0, 0, tileWidthPx, tileHeightPx);
            const d = tileImgData.data;

            tCtx.fillStyle = '#ffffff';
            tCtx.fillRect(0, 0, tileWidthPx, tileHeightPx);
            tCtx.fillStyle = '#000000';

            const dotSize = 14;
            for (let y = 0; y < tileHeightPx; y += dotSize) {
              for (let x = 0; x < tileWidthPx; x += dotSize) {
                const sampleY = Math.min(y + Math.floor(dotSize / 2), tileHeightPx - 1);
                const sampleX = Math.min(x + Math.floor(dotSize / 2), tileWidthPx - 1);
                const i = (sampleY * tileWidthPx + sampleX) * 4;
                const lum = 1 - (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
                const radius = lum * (dotSize / 2) * 0.95;
                if (radius > 0.5) {
                  tCtx.beginPath();
                  tCtx.arc(x + dotSize / 2, y + dotSize / 2, radius, 0, Math.PI * 2);
                  tCtx.fill();
                }
              }
            }
          }

          const dataUrl = tileCanvas.toDataURL('image/jpeg', 0.94);
          const base64Data = dataUrl.split(',')[1];
          const binaryData = atob(base64Data);
          const bytes = new Uint8Array(binaryData.length);
          for (let i = 0; i < binaryData.length; i++) {
            bytes[i] = binaryData.charCodeAt(i);
          }

          const embeddedJpg = await pdfDoc.embedJpg(bytes);
          const page = pdfDoc.addPage([pageWidth, pageHeight]);
          page.drawImage(embeddedJpg, {
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight
          });

          // Draw Crop Marks and Coordinates
          if (showCropMarks) {
            const m = 18; // 18pt (~6mm margin)
            const len = 10;
            const strokeColor = rgb(0.5, 0.5, 0.5);

            // Top-Left
            page.drawLine({ start: { x: m, y: pageHeight - m - len }, end: { x: m, y: pageHeight - m + len }, thickness: 0.5, color: strokeColor });
            page.drawLine({ start: { x: m - len, y: pageHeight - m }, end: { x: m + len, y: pageHeight - m }, thickness: 0.5, color: strokeColor });
            // Top-Right
            page.drawLine({ start: { x: pageWidth - m, y: pageHeight - m - len }, end: { x: pageWidth - m, y: pageHeight - m + len }, thickness: 0.5, color: strokeColor });
            page.drawLine({ start: { x: pageWidth - m - len, y: pageHeight - m }, end: { x: pageWidth - m + len, y: pageHeight - m }, thickness: 0.5, color: strokeColor });
            // Bottom-Left
            page.drawLine({ start: { x: m, y: m - len }, end: { x: m, y: m + len }, thickness: 0.5, color: strokeColor });
            page.drawLine({ start: { x: m - len, y: m }, end: { x: m + len, y: m }, thickness: 0.5, color: strokeColor });
            // Bottom-Right
            page.drawLine({ start: { x: pageWidth - m, y: m - len }, end: { x: pageWidth - m, y: m + len }, thickness: 0.5, color: strokeColor });
            page.drawLine({ start: { x: pageWidth - m - len, y: m }, end: { x: pageWidth - m + len, y: m }, thickness: 0.5, color: strokeColor });

            // Tile label
            page.drawText(`Tile R${r + 1}-C${c + 1} (${idx}/${totalPages}) • ${pageSize} (${orientation})`, {
              x: m + 15,
              y: m / 2,
              size: 7,
              color: rgb(0.5, 0.5, 0.5)
            });
          }

          await new Promise(res => setTimeout(res, 10));
        }
      }

      setStatusText('Compiling precision PDF poster document...');
      setProgress(92);

      const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
      const pdfBlob = new Blob([pdfBytes as any], { type: 'application/pdf' });

      setResultUrl(URL.createObjectURL(pdfBlob));
      setResultName(file.name.replace(/\.[^/.]+$/, "") + '_tiled_poster.pdf');
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      alert('Tiled poster printing failed: ' + (e.message || e));
    }

    setProgress(100);
    setProcessing(false);
  };

  return (
    <div className="tool-layout">
      <ToolHeader
        title="Tiled Poster Printer"
        description="Turn any image into a multi-page printable wall poster with precision cut guides."
        icon={PrinterIcon}
        onGoHome={() => {
          if (file || resultUrl || processing) {
            reset();
          } else {
            onGoHome();
          }
        }}
      />

      {processing && (
        <div className="max-w-2xl mx-auto py-12">
          <ProgressBar progress={progress} statusText={statusText} subText="Generating ultra high-resolution tiled vector PDF sheets" />
        </div>
      )}

      {!processing && !resultUrl && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Visualizer Area */}
          <div className="lg:col-span-8 space-y-6">
            {!file ? (
              <FileUploader
                accept="image/*"
                label="Select your image for poster printing"
                subLabel="Drag & drop high-resolution JPEG, PNG, or WebP images"
                onFilesSelected={handleFileSelected}
                maxSizeMB={500}
              />
            ) : (
              <Card className="border-[var(--border-color)] bg-[var(--surface-color)] shadow-sm p-6 space-y-5">
                <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
                  <div className="flex items-center gap-2">
                    <GridIcon className="w-4 h-4 text-zinc-400" />
                    <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">Poster Layout Preview</span>
                  </div>
                  <Button variant="ghost" onClick={reset} className="text-rose-500 hover:text-rose-600 text-xs h-7 px-2">Change Image</Button>
                </div>

                {/* Full Source Image Preview with Brightened Active Printable Region & Dimmed Crop Margins */}
                {(() => {
                  const imgW = imageDims?.width || 1000;
                  const imgH = imageDims?.height || 600;
                  const imgAspect = imgW / imgH;
                  const gridAspect = (columns * pageMMW) / (rows * pageMMH);

                  // Compute active printable grid box position inside full image container
                  let gridStyle: React.CSSProperties = {};

                  if (gridAspect > imgAspect) {
                    // Grid is wider than image -> width = 100%, height = (imgAspect / gridAspect) * 100%
                    const hPct = (imgAspect / gridAspect) * 100;
                    const topPct = (100 - hPct) / 2;
                    gridStyle = {
                      left: '0%',
                      top: `${topPct}%`,
                      width: '100%',
                      height: `${hPct}%`
                    };
                  } else {
                    // Grid is taller than image -> height = 100%, width = (gridAspect / imgAspect) * 100%
                    const wPct = (gridAspect / imgAspect) * 100;
                    const leftPct = (100 - wPct) / 2;
                    gridStyle = {
                      left: `${leftPct}%`,
                      top: '0%',
                      width: `${wPct}%`,
                      height: '100%'
                    };
                  }

                  return (
                    <div className="w-full flex flex-col items-center bg-zinc-950/80 p-5 border border-zinc-900 rounded-xl overflow-hidden shadow-inner space-y-4">
                      {/* Outer Wrapper Box to strictly constrain height & center aspect-ratio box */}
                      <div className="w-full max-h-[420px] flex items-center justify-center">
                        {/* Inner Box matching Full Source Image Aspect Ratio */}
                        <div
                          className="relative rounded-lg overflow-hidden border border-zinc-800 shadow-2xl bg-zinc-950 select-none flex items-center justify-center"
                          style={{
                            aspectRatio: `${imgW} / ${imgH}`,
                            maxHeight: '420px',
                            maxWidth: '100%',
                            width: `min(100%, calc(420px * ${imgAspect}))`
                          }}
                        >
                          {/* 1. Single Master Source Image - Always 100% aligned */}
                          <img
                            src={previewUrl!}
                            alt="Source poster"
                            onLoad={(e) => {
                              const target = e.currentTarget;
                              if (target.naturalWidth > 0 && target.naturalHeight > 0) {
                                if (!imageDims || imageDims.width !== target.naturalWidth || imageDims.height !== target.naturalHeight) {
                                  setImageDims({ width: target.naturalWidth, height: target.naturalHeight });
                                  if (lockAspect) {
                                    recalcRows(columns, target.naturalWidth, target.naturalHeight, pageSize, orientation);
                                  }
                                }
                              }
                            }}
                            className="w-full h-full object-cover select-none pointer-events-none"
                          />

                          {/* 2. Active Printable Sheet Grid (100% Bright, 70% Dark Box Shadow outside) */}
                          <div
                            className="absolute border-2 border-white rounded-sm pointer-events-none transition-all duration-300 z-10"
                            style={{
                              ...gridStyle,
                              boxShadow: '0 0 0 9999px rgba(4, 6, 10, 0.70)'
                            }}
                          >
                            {/* Grid Overlay with Sheet Numbers & A4/A3 Badges */}
                            <div
                              className="absolute inset-0 grid pointer-events-none z-20"
                              style={{
                                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                                gridTemplateRows: `repeat(${rows}, 1fr)`
                              }}
                            >
                              {[...Array(columns * rows)].map((_, i) => (
                                <div key={i} className="border border-dashed border-white/70 bg-white/5 flex flex-col items-center justify-center p-1">
                                  <span className="text-[10px] font-mono text-zinc-950 font-black bg-zinc-100 px-1.5 py-0.5 rounded shadow-md select-none">{i + 1}</span>
                                  <span className="text-[8px] font-mono text-zinc-300 font-bold mt-1 bg-black/80 px-1 rounded select-none uppercase tracking-wider border border-white/10">
                                    {pageSize} &bull; {orientation} ({pageMMW}×{pageMMH}mm)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Legend & Quick Tips Bar */}
                      <div className="w-full flex flex-col sm:flex-row items-center justify-between px-1 gap-3 text-xs">
                        <div className="flex items-center gap-5 text-zinc-400">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded bg-white border border-zinc-200 shadow-sm inline-block" />
                            <span className="font-bold text-zinc-200">Printable Area</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded bg-zinc-900 border border-zinc-700 opacity-60 inline-block" />
                            <span className="font-medium text-zinc-400">Cropped Overflow</span>
                          </div>
                        </div>
                        {Math.abs(gridAspect - imgAspect) > 0.05 && (
                          <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 rounded-lg text-zinc-300">
                            <span className="text-[11px] font-medium">
                              💡 <strong className="text-zinc-100">Tip:</strong> Turn on <span className="text-white font-bold underline decoration-zinc-500">Auto Aspect Ratio</span> to cover 100% of the image.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Physical Dimension Banner */}
                <div className="p-3.5 bg-zinc-950/40 border border-[var(--border-color)] rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <RulerIcon className="w-4 h-4 text-zinc-300" />
                    <span className="font-bold">Total Poster Dimensions:</span>
                    <span className="text-zinc-100 font-extrabold">{posterMeterW}m × {posterMeterH}m</span>
                    <span className="text-zinc-500 font-medium">({posterInchW}″ × {posterInchH}″)</span>
                  </div>
                  <div className="text-[11px] text-zinc-300 font-bold bg-zinc-900 px-3 py-1 rounded-md border border-zinc-800">
                    {columns * rows} Total {pageSize} Pages ({columns} cols × {rows} rows) &bull; {orientation} ({pageMMW}×{pageMMH}mm / sheet)
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Controls Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {file && (
              <Card className="border-[var(--border-color)] bg-[var(--surface-color)] shadow-sm p-5 space-y-5">
                <CardTitle className="text-sm font-bold text-[var(--text-primary)]">Poster Configuration</CardTitle>

                {/* Tile Dimensions */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Paper Size & Orientation</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={pageSize} onValueChange={(v) => handlePageSizeChange(v as any)}>
                      <SelectTrigger className="h-9 text-xs bg-transparent border-[var(--border-color)]">
                        <SelectValue placeholder="Paper Size">{getPaperLabel(pageSize, orientation)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(PAGE_SIZES).map((key) => (
                          <SelectItem key={key} value={key}>
                            {getPaperLabel(key as keyof typeof PAGE_SIZES, orientation)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={orientation} onValueChange={(v) => handleOrientationChange(v as any)}>
                      <SelectTrigger className="h-9 text-xs bg-transparent border-[var(--border-color)]">
                        <SelectValue placeholder="Orientation">{orientation}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Portrait">Portrait</SelectItem>
                        <SelectItem value="Landscape">Landscape</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Columns & Rows Grid */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Poster Grid Count</label>
                    <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 cursor-pointer">
                      <Switch
                        checked={lockAspect}
                        onCheckedChange={(val) => {
                          setLockAspect(val);
                          if (val && imageDims) recalcRows(columns, imageDims.width, imageDims.height, pageSize, orientation);
                        }}
                      />
                      <span>Auto Aspect Ratio</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">Columns</span>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={columns}
                        onChange={e => handleColumnsChange(parseInt(e.target.value) || 1)}
                        className="h-9 text-xs bg-transparent border-[var(--border-color)] text-[var(--text-primary)] font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">Rows</span>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={rows}
                        disabled={lockAspect}
                        onChange={e => setRows(Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-9 text-xs bg-transparent border-[var(--border-color)] text-[var(--text-primary)] font-bold disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Print Style Mode */}
                <div className="space-y-1.5 border-t border-[var(--border-color)]/40 pt-4">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Print Style Mode</label>
                  <Select value={styleMode} onValueChange={(v) => setStyleMode(v as any)}>
                    <SelectTrigger className="h-9 text-xs bg-transparent border-[var(--border-color)]">
                      <SelectValue placeholder="Style">
                        {styleMode === 'color' ? 'Full Color HD Photo' : styleMode === 'bw' ? 'Monochrome Black & White' : 'Classic Halftone Dots'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="color">Full Color HD Photo</SelectItem>
                      <SelectItem value="bw">Monochrome Black & White</SelectItem>
                      <SelectItem value="halftone">Classic Halftone Dot Art</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Precision Crop Marks Toggle */}
                <div className="flex items-center justify-between border-t border-[var(--border-color)]/40 pt-4">
                  <div>
                    <span className="text-xs font-bold text-[var(--text-primary)] block">Corner Crop Marks</span>
                    <span className="text-[10px] text-[var(--text-secondary)] block">Print alignment crosshairs on sheets</span>
                  </div>
                  <Switch
                    checked={showCropMarks}
                    onCheckedChange={setShowCropMarks}
                  />
                </div>

                <div className="border-t border-[var(--border-color)]/40 pt-4">
                  <Button
                    onClick={generatePoster}
                    className="w-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold rounded-full h-11 text-xs shadow-sm cursor-pointer"
                  >
                    Generate Printable PDF ({columns * rows} Pages)
                  </Button>
                </div>
              </Card>
            )}

            <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-4 space-y-2.5">
              <CardTitle className="text-xs font-bold text-[var(--text-primary)]">Printing & Assembly Instructions</CardTitle>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Print PDF pages at <strong>100% Scale</strong> (Actual Size, no shrink to fit). Use the corner crosshair crop marks and tile coordinates (R1-C1) to trim white borders and align sheets seamlessly.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* RESULT PAGE */}
      {resultUrl && !processing && (
        <div className="max-w-xl mx-auto space-y-6">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] shadow-sm text-center p-6 space-y-5">
            <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 rounded-full flex items-center justify-center mx-auto shadow-inner border border-[var(--border-color)]">
              <CheckCircle className="w-7 h-7" />
            </div>

            <div>
              <CardTitle className="text-xl font-black text-[var(--text-primary)]">Poster Package Ready!</CardTitle>
              <CardDescription className="text-xs text-[var(--text-secondary)] mt-1">Multi-page vector PDF compiled with precision crop guides.</CardDescription>
            </div>

            <div className="flex items-center gap-3 p-4 bg-zinc-950/20 border border-[var(--border-color)] rounded-xl text-left">
              <div className="p-2.5 bg-zinc-900/10 dark:bg-white/5 border border-[var(--border-color)] rounded-lg">
                <PrinterIcon className="w-6 h-6 text-[var(--text-primary)]" />
              </div>
              <div className="truncate flex-1 min-w-0">
                <span className="block text-xs font-bold truncate text-[var(--text-primary)]">{resultName}</span>
                <span className="text-[10px] text-[var(--text-secondary)] uppercase mt-0.5 block font-semibold">
                  {columns}×{rows} Grid Poster ({columns * rows} {pageSize} Sheets) &bull; {posterMeterW}m × {posterMeterH}m
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
              <a
                href={resultUrl}
                download={resultName}
                className="inline-flex items-center justify-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold px-6 py-3 rounded-full text-xs shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download Poster PDF
              </a>
              <Button variant="outline" onClick={reset} className="rounded-full h-10 text-xs border-[var(--border-color)]">
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Create Another Poster
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

