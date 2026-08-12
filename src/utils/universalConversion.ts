import { traceImageToSvg } from './svgTracer';
import { imagesToPdf, textToPdf } from './pdf';
import { getFFmpeg, transcodeFormatLossless } from './ffmpeg';
import { loadImage } from './image';
import {
  audioFileToWav,
  canvasToBmp,
  canvasToIco,
  csvToHtmlTable,
  csvToJson,
  jsonToCsv,
  textToHtml,
} from './universalConverters';
import {
  docxToHtml,
  docxToPdf,
  docxToText,
  pdfToDocx,
  pdfToText,
  textToDocx,
} from './documentConverters';
import type { PdfDocxMode } from './documentConverters';

export interface UniversalConversionResult {
  blob: Blob;
  name: string;
}

export type ConversionProgress = (percent: number, status: string) => void;

const outputName = (file: File, extension: string): string =>
  `${file.name.replace(/\.[^/.]+$/, '')}.${extension}`;

const canvasBlob = (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error(`${type} conversion failed`)),
      type,
      quality,
    );
  });

export const convertUniversalFile = async (
  file: File,
  targetFormat: string,
  pdfDocxMode: PdfDocxMode,
  onProgress: ConversionProgress,
): Promise<UniversalConversionResult> => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const target = targetFormat.toLowerCase();

  onProgress(10, 'Analyzing file format headers...');

  if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'ico'].includes(target)
    && ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg', 'avif'].includes(ext)) {
    onProgress(30, 'Loading image into the conversion pipeline...');
    const image = await loadImage(file);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create a 2D image context.');

    if (['jpg', 'jpeg', 'bmp'].includes(target)) {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0);
    onProgress(70, `Encoding ${target.toUpperCase()}...`);

    let blob: Blob;
    if (target === 'png') blob = await canvasBlob(canvas, 'image/png');
    else if (target === 'webp') blob = await canvasBlob(canvas, 'image/webp', 1);
    else if (target === 'jpg' || target === 'jpeg') blob = await canvasBlob(canvas, 'image/jpeg', 0.98);
    else if (target === 'bmp') blob = canvasToBmp(canvas);
    else blob = canvasToIco(canvas, 256);
    return { blob, name: outputName(file, target) };
  }

  if (target === 'svg' && ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'].includes(ext)) {
    onProgress(40, 'Tracing image contours into SVG paths...');
    const svg = await traceImageToSvg(file);
    return { blob: new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), name: outputName(file, 'svg') };
  }

  if (target === 'pdf' && ['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext)) {
    onProgress(45, 'Compiling image into a PDF page...');
    return { blob: await imagesToPdf([file]), name: outputName(file, 'pdf') };
  }

  if (ext === 'pdf' && target === 'docx') {
    const blob = await pdfToDocx(file, (percent, status) => {
      onProgress(20 + Math.round(percent * 0.7), status);
    }, pdfDocxMode);
    return { blob, name: outputName(file, 'docx') };
  }

  if (ext === 'docx' && target === 'pdf') {
    onProgress(30, 'Parsing Word content and building a PDF...');
    return { blob: await docxToPdf(file), name: outputName(file, 'pdf') };
  }

  if (ext === 'docx' && (target === 'txt' || target === 'html')) {
    onProgress(35, `Parsing Word content into ${target.toUpperCase()}...`);
    const content = target === 'txt' ? await docxToText(file) : await docxToHtml(file);
    return {
      blob: new Blob([content], { type: target === 'txt' ? 'text/plain;charset=utf-8' : 'text/html;charset=utf-8' }),
      name: outputName(file, target),
    };
  }

  if (target === 'docx' && ['txt', 'md'].includes(ext)) {
    onProgress(40, 'Building an editable Word document...');
    return { blob: await textToDocx(await file.text(), file.name), name: outputName(file, 'docx') };
  }

  if (ext === 'pdf' && target === 'txt') {
    const text = await pdfToText(file, (percent, status) => {
      onProgress(20 + Math.round(percent * 0.7), status);
    });
    return { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), name: outputName(file, 'txt') };
  }

  if (target === 'pdf' && ['txt', 'md', 'html', 'json', 'csv'].includes(ext)) {
    onProgress(40, 'Compiling document content into PDF...');
    return { blob: await textToPdf(await file.text(), file.name), name: outputName(file, 'pdf') };
  }

  if (target === 'wav' && ['mp3', 'aac', 'm4a', 'flac', 'ogg', 'opus', 'weba', 'wav'].includes(ext)) {
    onProgress(40, 'Decoding audio samples into WAV...');
    return { blob: await audioFileToWav(file), name: outputName(file, 'wav') };
  }

  if (target === 'json' && (ext === 'csv' || ext === 'txt')) {
    onProgress(45, 'Parsing rows into JSON objects...');
    return { blob: new Blob([csvToJson(await file.text())], { type: 'application/json' }), name: outputName(file, 'json') };
  }

  if (target === 'csv' && (ext === 'json' || ext === 'txt')) {
    onProgress(45, 'Structuring data into CSV rows...');
    return { blob: new Blob([jsonToCsv(await file.text())], { type: 'text/csv' }), name: outputName(file, 'csv') };
  }

  if (target === 'html' && (ext === 'csv' || ext === 'txt' || ext === 'md')) {
    onProgress(45, 'Formatting content into a semantic HTML document...');
    const text = await file.text();
    const html = ext === 'csv' ? csvToHtmlTable(text, file.name) : textToHtml(text, file.name);
    return { blob: new Blob([html], { type: 'text/html' }), name: outputName(file, 'html') };
  }

  if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'gif'].includes(target)
    && ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'mp3', 'wav', 'aac', 'm4a', 'ogg', 'opus', 'weba', 'flac'].includes(ext)) {
    onProgress(20, 'Initializing the FFmpeg media engine...');
    await getFFmpeg(() => {}, percent => onProgress(percent, 'Initializing the FFmpeg media engine...'));
    const result = await transcodeFormatLossless(
      file,
      target,
      () => {},
      percent => onProgress(percent, `Transcoding ${ext.toUpperCase()} to ${target.toUpperCase()}...`),
    );
    URL.revokeObjectURL(result.url);
    return { blob: result.blob, name: result.name };
  }

  throw new Error(`${ext.toUpperCase()} to ${target.toUpperCase()} is not supported by an installed conversion engine.`);
};
