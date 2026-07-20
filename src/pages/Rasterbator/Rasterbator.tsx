import { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileUploader } from '../../components/Common/FileUploader';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { formatBytes } from '../../utils/image';
import { 
  PiFileLight as FileIcon, PiArrowsClockwiseLight as RefreshCw, 
  PiCheckCircleLight as CheckCircle, PiDownloadLight as Download,
  PiPrinterLight as PrinterIcon
} from 'react-icons/pi';
import { Button } from '../../components/ui/button';
import { Card, CardTitle, CardDescription } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../../components/ui/select';

interface RasterbatorProps {
  onGoHome: () => void;
  onUploadSuccess: () => void;
}

const PAGE_SIZES = {
  A4: { width: 595.28, height: 841.89, label: 'A4 (210 x 297 mm)' },
  A3: { width: 841.89, height: 1190.55, label: 'A3 (297 x 420 mm)' },
  Letter: { width: 612.00, height: 792.00, label: 'Letter (8.5 x 11 in)' },
  Legal: { width: 612.00, height: 1008.00, label: 'Legal (8.5 x 14 in)' }
};

export const Rasterbator: React.FC<RasterbatorProps> = ({ onGoHome, onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Page settings
  const [pageSize, setPageSize] = useState<keyof typeof PAGE_SIZES>('A4');
  const [orientation, setOrientation] = useState<'Portrait' | 'Landscape'>('Portrait');
  const [columns, setColumns] = useState<number>(7);
  const [rows, setRows] = useState<number>(3);
  
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState('');

  const imageRef = useRef<HTMLImageElement | null>(null);

  const handleFileSelected = (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;
    const f = selectedFiles[0];
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const reset = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResultUrl(null);
    setResultName('');
    setProgress(0);
    setProcessing(false);
  };

  const generatePoster = async () => {
    if (!file || !previewUrl) return;
    setProcessing(true);
    setProgress(10);
    setStatusText('Preparing canvas segments...');

    try {
      // 1. Create a helper image element
      const img = new Image();
      img.src = previewUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // 2. Initialize pdf-lib document
      const pdfDoc = await PDFDocument.create();
      const dims = PAGE_SIZES[pageSize];
      
      const pageWidth = orientation === 'Portrait' ? dims.width : dims.height;
      const pageHeight = orientation === 'Portrait' ? dims.height : dims.width;

      const sliceW = img.naturalWidth / columns;
      const sliceH = img.naturalHeight / rows;

      // Temporary canvas to process each segment slice
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not instantiate canvas context');
      
      // High-res canvas matching target page aspect ratio
      canvas.width = 1200;
      canvas.height = Math.round(1200 * (pageHeight / pageWidth));

      const totalPages = columns * rows;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
          const idx = r * columns + c + 1;
          setStatusText(`Rendering poster segment ${idx} of ${totalPages}...`);
          setProgress(Math.round(10 + (idx / totalPages) * 75));

          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw the specific image section stretched/fitted to fill the entire canvas
          ctx.drawImage(
            img,
            c * sliceW, r * sliceH, sliceW, sliceH, // source coords
            0, 0, canvas.width, canvas.height // destination coords
          );

          // Convert canvas segment to JPEG
          const imgDataUrl = canvas.toDataURL('image/jpeg', 0.92);
          const response = await fetch(imgDataUrl);
          const arrayBuffer = await response.arrayBuffer();

          // Embed page and draw image
          const embeddedJpg = await pdfDoc.embedJpg(arrayBuffer);
          const page = pdfDoc.addPage([pageWidth, pageHeight]);
          page.drawImage(embeddedJpg, {
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight
          });

          // Wait a short tick for UI thread breathing room
          await new Promise(r => setTimeout(r, 20));
        }
      }

      setStatusText('Assembling PDF package layout...');
      setProgress(90);

      const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
      const pdfBlob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      
      setResultUrl(URL.createObjectURL(pdfBlob));
      setResultName(file.name.replace(/\.[^/.]+$/, "") + '_poster.pdf');
      onUploadSuccess();
    } catch (e) {
      console.error(e);
      alert('Tiled poster printing failed.');
    }

    setProgress(100);
    setProcessing(false);
  };

  return (
    <div className="tool-layout">
      <div className="tool-layout__header">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <PrinterIcon className="w-6 h-6 text-zinc-400" /> Tiled Poster Printer
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Turn one image into printable pages for a larger poster.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onGoHome} className="h-9">
          All tools
        </Button>
      </div>

      {processing && (
        <div className="max-w-2xl mx-auto py-12">
          <ProgressBar progress={progress} statusText={statusText} />
        </div>
      )}

      {!processing && !resultUrl && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-6">
            {!file ? (
              <FileUploader 
                accept="image/*"
                label="Select your image"
                subLabel="Drag & drop high-resolution JPEG, PNG, or WebP images here"
                onFilesSelected={handleFileSelected}
                maxSizeMB={500}
              />
            ) : (
              <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Image Preview</span>
                  <Button variant="ghost" onClick={reset} className="text-rose-500 text-xs h-7 px-2">Change Image</Button>
                </div>

                {/* Scaled Preview Grid overlay */}
                <div className="relative max-w-full flex justify-center bg-zinc-950/40 p-4 border border-zinc-900 rounded-xl overflow-hidden">
                  <img 
                    ref={imageRef}
                    src={previewUrl!}
                    alt="Source poster"
                    className="max-h-[360px] object-contain rounded-lg opacity-85 select-none"
                  />
                  {/* Grid overlay */}
                  <div className="absolute inset-4 grid pointer-events-none"
                    style={{
                      gridTemplateColumns: `repeat(${columns}, 1fr)`,
                      gridTemplateRows: `repeat(${rows}, 1fr)`
                    }}
                  >
                    {[...Array(columns * rows)].map((_, i) => (
                      <div key={i} className="border border-dashed border-zinc-500/40 bg-zinc-950/20 flex items-center justify-center">
                        <span className="text-[10px] font-mono text-zinc-300 font-bold opacity-60">{i + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-[10px] text-zinc-500 font-medium">
                  File: {file.name} | Size: {formatBytes(file.size)}
                </div>
              </Card>
            )}
          </div>

          <div className="lg:col-span-4 space-y-6">
            {file && (
              <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-5">
                <CardTitle className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Page Setup</CardTitle>
                <p className="text-xs text-zinc-400 leading-normal">
                  Choose the target page dimensions and orient your tiles. Image will scale to fill pages.
                </p>

                {/* Page Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tile Dimensions</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={pageSize} onValueChange={(v) => setPageSize(v as any)}>
                      <SelectTrigger className="h-9">
                        <span>{pageSize}</span>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(PAGE_SIZES).map(key => (
                          <SelectItem key={key} value={key}>{key}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={orientation} onValueChange={(v) => setOrientation(v as any)}>
                      <SelectTrigger className="h-9">
                        <span>{orientation}</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Portrait">Portrait</SelectItem>
                        <SelectItem value="Landscape">Landscape</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Grid Slicing count */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tile Grid Count</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[9px] text-zinc-500 uppercase">Columns</span>
                      <Input 
                        type="number" 
                        min={1} 
                        max={30} 
                        value={columns}
                        onChange={e => setColumns(Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] text-zinc-500 uppercase">Rows</span>
                      <Input 
                        type="number" 
                        min={1} 
                        max={30} 
                        value={rows}
                        onChange={e => setRows(Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-zinc-900 pt-4">
                  <Button 
                    onClick={generatePoster}
                    className="w-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold"
                  >
                    Generate Poster ({columns * rows} Pages)
                  </Button>
                </div>
              </Card>
            )}

            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3">
              <CardTitle className="text-xs font-bold text-zinc-800 dark:text-zinc-200">How to Print</CardTitle>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Open the compiled PDF file, print all sheets at 100% scale (no fit-to-page margins), and trim white margins off the sheet joints to glue pages seamlessly.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* RESULT PAGE */}
      {resultUrl && !processing && (
        <div className="max-w-xl mx-auto space-y-6">
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-center p-6 space-y-5">
            <div className="w-14 h-14 bg-green-50 dark:bg-green-950/40 text-green-500 dark:text-green-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7" />
            </div>

            <div>
              <CardTitle className="text-xl font-black">Poster Created!</CardTitle>
              <CardDescription className="text-xs mt-1">Multi-page layout compiled successfully.</CardDescription>
            </div>

            <div className="flex items-center gap-3 p-3.5 bg-zinc-50/50 dark:bg-zinc-900/10 border rounded-xl text-left">
              <FileIcon className="w-10 h-10 text-sky-500 flex-shrink-0" />
              <div className="truncate">
                <span className="block text-xs font-bold truncate">{resultName}</span>
                <span className="text-[10px] text-zinc-400 uppercase mt-0.5">{columns}x{rows} Grid Poster PDF</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <a 
                href={resultUrl} 
                download={resultName}
                className="inline-flex items-center justify-center gap-2 bg-zinc-50 hover:bg-zinc-200 text-zinc-950 font-bold px-6 py-2.5 rounded-full text-xs shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download PDF
              </a>
              <Button variant="outline" onClick={reset} className="rounded-full h-9 text-xs">
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Create Another Poster
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
