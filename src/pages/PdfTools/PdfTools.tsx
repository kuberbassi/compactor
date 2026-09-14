import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileUploader } from '../../components/Common/FileUploader';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { ToolHeader } from '../../components/Common/ToolHeader';
import { ToolModeSwitcher } from '../../components/Common/ToolModeSwitcher';
import { ErrorBanner } from '../../components/Common/ErrorBanner';
import { PdfEditor } from './PdfEditor';
import { MarkdownEditor } from './MarkdownEditor';
import {
  mergePdfs,
  extractPdfPages,
  imagesToPdf,
  getPdfPageCount,
  compressPdf,
  watermarkPdfAdvanced,
  addPageNumbersToPdf,
  cropPdfMargins,
  signPdfDocumentAdvanced,
  protectPdfWithPassword,
  unlockPdfWithPassword,
  checkPdfEncryptionStatus,
  extractPdfMarkdown,
  reorganizePdfPages,
  flattenPdfForm,
  flattenPdfCompletely,
  addVectorStampToPdf,
  annotateOrRedactPdf,
  removePdfMetadata
} from '../../utils/pdf';
import { hasSelectablePdfText, renderPdfThumbnails, renderPdfPagesToImages } from '../../utils/pdfRenderer';
import { createSearchableOcrPdf } from '../../utils/pdfOcr';
import type { PageOrganizeSpec } from '../../utils/pdf';
import { downloadAll, isEditableShortcutTarget, loadSetting, saveSetting } from '../../utils/batch';
import type { CompressionPreset } from '../../utils/batch';
import {
  FileText,
  ArrowLeft, ArrowRight,
  X as CloseIcon,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from '../../components/ui/select';
import { pathForTool } from '../../config/toolRoutes';

interface PdfToolsProps {
  toolId: string;
  onGoHome: () => void;
  onUploadSuccess: (amount?: number) => void;
}

interface PdfFileInfo {
  file: File;
  pageCount: number;
}

interface PageItem {
  id: string;
  originalIndex: number;
  rotation: number; // 0, 90, 180, 270
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}

import { TOOL_GROUPS, PDF_MODE_TABS, CANVAS_PDF_TOOLS, formatPageRanges, parsePageRanges } from './pdfToolsConfig';
import type { CompressionResult } from './pdfToolsConfig';
export type { CompressionResult };
import { PageOrganizer } from './components/PageOrganizer';
import { PdfSingleConfigurator } from './components/PdfSingleConfigurator';
import { MergePanel } from './components/MergePanel';
import { ImagesToPdfPanel } from './components/ImagesToPdfPanel';
import { PdfCompressPanel } from './components/PdfCompressPanel';
import { PdfResultViews } from './components/PdfResultViews';
import { createObjectUrlOwner } from '../../utils/objectUrl';
import { errorMessage as normalizePdfError } from './pdfResultTask';
import type { PdfResultTask } from './pdfResultTask';

export const PdfTools: React.FC<PdfToolsProps> = ({ toolId, onGoHome, onUploadSuccess }) => {
  const [activeTool, setActiveTool] = useState<string>(toolId || 'pdf-organize');

  // Global execution states
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [resultUrl, setResultUrlState] = useState<string | null>(null);
  const [resultName, setResultName] = useState('');
  const [resultSize, setResultSize] = useState<number>(0);
  const [compressionResults, setCompressionResultsState] = useState<CompressionResult[]>([]);
  const resultUrlOwnerRef = useRef(createObjectUrlOwner<string | null>(null, url => url ? [url] : []));
  const compressionResultsOwnerRef = useRef(createObjectUrlOwner<CompressionResult[]>([], results =>
    results.flatMap(result => result.url ? [result.url] : [])
  ));
  const [compressionPreset, setCompressionPreset] = useState<CompressionPreset>(() =>
    loadSetting('compactor_pdf_compression_preset', 'balanced')
  );
  const [removeCompressionMetadata, setRemoveCompressionMetadata] = useState(() =>
    loadSetting('compactor_pdf_remove_metadata', true)
  );

  // File states
  const [multipleFiles, setMultipleFiles] = useState<PdfFileInfo[]>([]);
  const [imageFiles, setImageFiles] = useState<PdfFileInfo[]>([]);
  const [singleFile, setSingleFile] = useState<PdfFileInfo | null>(null);
  const [draggedQueueIndex, setDraggedQueueIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    saveSetting('compactor_pdf_compression_preset', compressionPreset);
    saveSetting('compactor_pdf_remove_metadata', removeCompressionMetadata);
  }, [compressionPreset, removeCompressionMetadata]);

  // Page Organizer state
  const [pagesList, setPagesList] = useState<PageItem[]>([]);
  const [imagePreviewItems, setImagePreviewItems] = useState<PageItem[]>([]);
  const [peekPageIndex, setPeekPageIndex] = useState<number | null>(null);
  const [blankPageScan, setBlankPageScan] = useState<{ status: 'idle' | 'scanning' | 'ready' | 'none' | 'error'; indexes: number[]; inspected: number; total: number }>({ status: 'idle', indexes: [], inspected: 0, total: 0 });
  const fileLoadTokenRef = useRef(0);

  // Tool list stays available but yields space once a file is active.
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  useEffect(() => {
    if (singleFile) {
      setIsSidebarCollapsed(false);
    } else if (multipleFiles.length > 0) {
      setIsSidebarCollapsed(true);
    }
  }, [singleFile, multipleFiles.length]);

  // Tool specific configuration states
  const [pageRangeText, setPageRangeText] = useState('1-2');
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [watermarkPos, setWatermarkPos] = useState<'diagonal' | 'header' | 'footer' | 'pattern'>('diagonal');
  const [watermarkColor, setWatermarkColor] = useState<'red' | 'blue' | 'black' | 'gray'>('red');
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.35);

  const [pageNumberPosition, setPageNumberPosition] = useState<'top' | 'bottom'>('bottom');
  const [cropMarginsPct, setCropMarginsPct] = useState<number>(10);
  const [organizerAddPageNumbers, setOrganizerAddPageNumbers] = useState(false);
  const [organizerCropEnabled, setOrganizerCropEnabled] = useState(false);

  const [signatureText, setSignatureText] = useState('Authorized Signatory');
  const [signaturePos, setSignaturePos] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'center'>('bottom-right');
  const [signatureColor, setSignatureColor] = useState<'blue' | 'black' | 'red'>('blue');
  const [signatureTargetPages, setSignatureTargetPages] = useState<'last-page' | 'first-page' | 'all-pages'>('last-page');

  // Stamp Presets
  const [stampPreset, setStampPreset] = useState<'APPROVED' | 'CONFIDENTIAL' | 'FINAL DRAFT' | 'EXPIRED' | 'PAID' | 'CANCELLED'>('APPROVED');
  const [stampTargetPages, setStampTargetPages] = useState<'last-page' | 'first-page' | 'all-pages'>('last-page');
  const [stampPosition, setStampPosition] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'center'>('bottom-right');

  // Redaction / Annotator
  const [redactMode, setRedactMode] = useState<'redact' | 'text' | 'image'>('redact');
  const [redactTextContent, setRedactTextContent] = useState('CONFIDENTIAL REDACTION');

  const [securityPassword, setSecurityPassword] = useState('');
  const [pdfIsEncrypted, setPdfIsEncrypted] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState(false);

  // Image to PDF option states
  const [imgOrientation, setImgOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [imgPageSize, setImgPageSize] = useState<'fit' | 'a4' | 'letter'>('fit');
  const [imgMargin, setImgMargin] = useState<'none' | 'small' | 'big'>('none');
  const [imgFilter, setImgFilter] = useState<'original' | 'smart-scan' | 'camscanner' | 'whiteboard' | 'bw' | 'vibrant'>('smart-scan');
  const [imageRotations, setImageRotations] = useState<number[]>([]);

  // PDF to Images Extracted Output List
  const [pdfExportImgFormat, setPdfExportImgFormat] = useState<'png' | 'jpg'>('png');
  const [pdfExportMode, setPdfExportMode] = useState<'png' | 'jpg' | 'markdown'>('png');
  const [pdfTextLayerStatus, setPdfTextLayerStatus] = useState<'checking' | 'available' | 'unavailable'>('unavailable');
  const [flattenMode, setFlattenMode] = useState<'forms' | 'complete'>('complete');
  const [flattenQuality, setFlattenQuality] = useState<'standard' | 'high' | 'print'>('high');
  const [extractedImages, setExtractedImages] = useState<{ pageNumber: number; blob: Blob; url: string }[]>([]);

  // PowerToys Peek Keyboard Navigation Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (peekPageIndex === null) return;
      const previewLength = activeTool === 'pdf-jpg-to-pdf' ? imagePreviewItems.length : pagesList.length;
      if (previewLength === 0) return;
      if (e.key === 'Escape') {
        setPeekPageIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setPeekPageIndex(prev => (prev !== null && prev > 0 ? prev - 1 : previewLength - 1));
      } else if (e.key === 'ArrowRight') {
        setPeekPageIndex(prev => (prev !== null && prev < previewLength - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, imagePreviewItems.length, peekPageIndex, pagesList.length]);

  // Lock background body scroll when PowerToys Peek modal is active
  useEffect(() => {
    if (peekPageIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [peekPageIndex]);

  const replaceResultUrl = (next: string | null) => {
    resultUrlOwnerRef.current.replace(next);
    setResultUrlState(next);
  };

  const replaceCompressionResults = (
    nextOrUpdater: CompressionResult[] | ((previous: CompressionResult[]) => CompressionResult[]),
  ) => {
    const previous = compressionResultsOwnerRef.current.current();
    const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(previous) : nextOrUpdater;
    compressionResultsOwnerRef.current.replace(next);
    setCompressionResultsState(next);
  };

  useEffect(() => {
    const resultUrlOwner = resultUrlOwnerRef.current;
    const compressionResultsOwner = compressionResultsOwnerRef.current;
    return () => {
      resultUrlOwner.cleanup();
      compressionResultsOwner.cleanup();
    };
  }, []);

  const reset = () => {
    replaceResultUrl(null);
    setResultName('');
    setResultSize(0);
    setExtractedImages([]);
    setMultipleFiles([]);
    setImageFiles([]);
    setSingleFile(null);
    setPdfTextLayerStatus('unavailable');
    setPagesList([]);
    imagePreviewItems.forEach(item => { if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl); });
    setImagePreviewItems([]);
    fileLoadTokenRef.current += 1;
    setBlankPageScan({ status: 'idle', indexes: [], inspected: 0, total: 0 });
    setPeekPageIndex(null);
    setDraggedQueueIndex(null);
    setShowPassword(false);
    setPdfIsEncrypted(false);
    setSecurityPassword('');
    setProgress(0);
    setProcessing(false);
    replaceCompressionResults([]);
    setOrganizerAddPageNumbers(false);
    setOrganizerCropEnabled(false);
    setImageRotations([]);
  };

  useEffect(() => {
    if (toolId) setActiveTool(toolId);
  }, [toolId]);

  const handleMultipleFilesSelected = async (selectedFiles: File[]) => {
    const pdfFiles = selectedFiles.filter(file => file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
    if (pdfFiles.length === 0) {
      setErrorMessage('Choose PDF documents for this tool.');
      return;
    }
    setProcessing(true);
    setStatusText('Analyzing document structures...');
    const loaded: PdfFileInfo[] = [];
    const known = new Set(multipleFiles.map(({ file }) => `${file.name}:${file.size}:${file.lastModified}`));
    for (const f of pdfFiles) {
      const key = `${f.name}:${f.size}:${f.lastModified}`;
      if (known.has(key)) continue;
      try {
        loaded.push({ file: f, pageCount: await getPdfPageCount(f) });
        known.add(key);
      } catch {
        setErrorMessage(`${f.name} could not be read as a PDF.`);
      }
    }
    setMultipleFiles((prev) => [...prev, ...loaded]);
    setProcessing(false);
  };

  const handleImageFilesSelected = (selectedFiles: File[]) => {
    const images = selectedFiles.filter(file =>
      ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
      || /\.(png|jpe?g|webp)$/i.test(file.name)
    );
    if (images.length === 0) {
      setErrorMessage('Choose PNG, JPG, or WebP images for Images to PDF.');
      return;
    }
    const known = new Set(imageFiles.map(({ file }) => `${file.name}:${file.size}:${file.lastModified}`));
    const additions = images.filter(file => !known.has(`${file.name}:${file.size}:${file.lastModified}`));
    if (additions.length === 0) {
      setErrorMessage('Those images are already in the sequence.');
      return;
    }
    setErrorMessage(null);
    setImageFiles(previous => [...previous, ...additions.map(file => ({ file, pageCount: 1 }))]);
    setImageRotations(previous => [...previous, ...additions.map(() => 0)]);
  };

  const handleCompressionFilesSelected = async (selectedFiles: File[]) => {
    setProcessing(true);
    setStatusText('Validating PDF documents...');
    const existing = new Set(
      multipleFiles.map(({ file }) => `${file.name}:${file.size}:${file.lastModified}`)
    );
    const loaded: PdfFileInfo[] = [];

    for (const file of selectedFiles) {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (existing.has(key)) continue;
      try {
        const pageCount = await getPdfPageCount(file);
        loaded.push({ file, pageCount });
        existing.add(key);
      } catch (error) {
        console.error(`Could not read ${file.name}`, error);
      }
    }

    setMultipleFiles(prev => [...prev, ...loaded]);
    setProcessing(false);
    setProgress(0);
  };

  const handleSingleFileSelected = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;
    setProcessing(true);
    setStatusText('Analyzing PDF security & page structure...');
    const f = selectedFiles[0];
    const loadToken = ++fileLoadTokenRef.current;

    const secStatus = await checkPdfEncryptionStatus(f);
    setPdfIsEncrypted(secStatus.isEncrypted);
    setSecurityPassword('');

    const count = secStatus.pageCount;
    setSingleFile({ file: f, pageCount: count });
    setPdfTextLayerStatus(secStatus.isEncrypted ? 'unavailable' : 'checking');
    if (secStatus.isEncrypted) setActiveTool('pdf-unlock');
    else if (activeTool === 'pdf-protect' || activeTool === 'pdf-unlock') setActiveTool('pdf-protect');
    setPageRangeText(`1-${Math.min(count, 3)}`);

    const items: PageItem[] = [];
    for (let i = 0; i < count; i++) {
      items.push({ id: `page-${i}-${Date.now()}`, originalIndex: i, rotation: 0 });
    }
    setPagesList(items);
    if (secStatus.isEncrypted) {
      setBlankPageScan({ status: 'idle', indexes: [], inspected: 0, total: count });
      setProcessing(false);
      return;
    }

    void hasSelectablePdfText(f).then(hasText => {
      if (fileLoadTokenRef.current !== loadToken) return;
      setPdfTextLayerStatus(hasText ? 'available' : 'unavailable');
      if (!hasText) setPdfExportMode(previous => previous === 'markdown' ? 'png' : previous);
    });
    setBlankPageScan({ status: 'scanning', indexes: [], inspected: 0, total: count });
    setProcessing(false);

    const thumbnailScale = count > 150 ? 0.5 : count > 75 ? 0.75 : 1.25;
    const detectedBlankIndexes: number[] = [];
    let assessmentFailed = false;
    renderPdfThumbnails(f, count, thumbnailScale, undefined, (pageIndex, thumbnailUrl, width, height) => {
      if (fileLoadTokenRef.current !== loadToken) return;
      if (!thumbnailUrl) return;
      const pageId = items[pageIndex]?.id;
      setPagesList(previous => previous.map(item => item.id === pageId ? { ...item, thumbnailUrl, width, height } : item));
    }, (pageIndex, isBlank) => {
      if (fileLoadTokenRef.current !== loadToken) return;
      if (isBlank === null) assessmentFailed = true;
      if (isBlank) detectedBlankIndexes.push(pageIndex);
      setBlankPageScan({ status: 'scanning', indexes: [...detectedBlankIndexes], inspected: pageIndex + 1, total: count });
    }).then(thumbs => {
      if (fileLoadTokenRef.current !== loadToken) return;
      if (!thumbs || thumbs.length !== count) assessmentFailed = true;
      if (thumbs && thumbs.length > 0) {
        setPagesList(previous => previous.map(item => {
          const pageIndex = items.findIndex(source => source.id === item.id);
          return pageIndex >= 0 ? { ...item, thumbnailUrl: thumbs[pageIndex] || item.thumbnailUrl } : item;
        }));
      }
      setBlankPageScan({
        status: assessmentFailed ? 'error' : detectedBlankIndexes.length > 0 ? 'ready' : 'none',
        indexes: [...detectedBlankIndexes],
        inspected: count,
        total: count,
      });
    });
  };

  const moveQueueItem = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= multipleFiles.length) return;
    setMultipleFiles(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
  };

  const moveImageQueueItem = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= imageFiles.length) return;
    setImageFiles(previous => {
      const next = [...previous];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setImageRotations(previous => {
      const next = [...previous];
      const [rotation] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, rotation ?? 0);
      return next;
    });
  };

  const selectedPagesInSplit = singleFile ? parsePageRanges(pageRangeText, singleFile.pageCount) : [];
  const isImmersivePdfEditor = Boolean(singleFile || multipleFiles.length > 0 || activeTool === 'pdf-word-to-pdf');

  const togglePageInSplitRange = (pNum: number) => {
    let current = new Set(selectedPagesInSplit);
    if (current.has(pNum)) {
      current.delete(pNum);
    } else {
      current.add(pNum);
    }
    setPageRangeText(formatPageRanges(Array.from(current)));
  };

  const setSplitPreset = (preset: 'all' | 'none' | 'odd' | 'even') => {
    if (!singleFile) return;
    const total = singleFile.pageCount;
    if (preset === 'all') {
      setPageRangeText(`1-${total}`);
    } else if (preset === 'none') {
      setPageRangeText('');
    } else if (preset === 'odd') {
      const odds: number[] = [];
      for (let i = 1; i <= total; i += 2) odds.push(i);
      setPageRangeText(odds.join(', '));
    } else if (preset === 'even') {
      const evens: number[] = [];
      for (let i = 2; i <= total; i += 2) evens.push(i);
      setPageRangeText(evens.join(', '));
    }
  };

  // --- PAGE ORGANIZER ACTIONS ---
  const rotatePage = (idx: number, degreesDelta: number) => {
    setPagesList(prev => prev.map((item, i) => {
      if (i === idx) {
        const nextRot = (item.rotation + degreesDelta + 360) % 360;
        return { ...item, rotation: nextRot };
      }
      return item;
    }));
  };

  const movePage = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= pagesList.length) return;
    setPagesList(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
  };

  const deletePage = (idx: number) => {
    setPagesList(prev => prev.filter((_, i) => i !== idx));
  };

  const rotateAllPages = (degreesDelta: number) => {
    setPagesList(prev => prev.map(item => ({
      ...item,
      rotation: (item.rotation + degreesDelta + 360) % 360
    })));
  };



  const removeBlankPagesFromOrganizer = () => {
    if (!singleFile || blankPageScan.status !== 'ready') return;
    setErrorMessage(null);
    try {
      const blankOriginalIndexes = new Set(blankPageScan.indexes);
      const removableCount = pagesList.filter(page => blankOriginalIndexes.has(page.originalIndex)).length;
      if (removableCount === pagesList.length && removableCount > 0) {
        throw new Error('Every remaining page appears blank. No pages were removed; review the document manually.');
      }
      setPagesList(previous => previous.filter(page => !blankOriginalIndexes.has(page.originalIndex)));
      setBlankPageScan(previous => ({ ...previous, status: 'none', indexes: [] }));
      setProgress(100);
      setStatusText(removableCount === 0 ? 'No blank pages found' : `Removed ${removableCount} blank ${removableCount === 1 ? 'page' : 'pages'}`);
    } catch (error) {
      setErrorMessage(`Blank-page detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // --- RUN ACTIONS ---
  const runResultTask = async ({
    initialProgress,
    status,
    failurePrefix,
    task,
  }: {
    initialProgress: number;
    status: string;
    failurePrefix: string;
    task: () => Promise<PdfResultTask>;
  }) => {
    setProcessing(true);
    setProgress(initialProgress);
    setErrorMessage(null);
    setStatusText(status);
    try {
      const result = await task();
      setProgress(90);
      setResultSize(result.blob.size);
      replaceResultUrl(URL.createObjectURL(result.blob));
      setResultName(result.name);
      onUploadSuccess();
    } catch (error: unknown) {
      console.error(error);
      setErrorMessage(`${failurePrefix}: ${normalizePdfError(error)}`);
    } finally {
      setProgress(100);
      setProcessing(false);
    }
  };

  const runOrganize = async () => {
    if (!singleFile || pagesList.length === 0) return;
    setProcessing(true); setProgress(30);
    setErrorMessage(null);
    setStatusText('Reorganizing & compiling PDF pages...');
    try {
      const specs: PageOrganizeSpec[] = pagesList.map(item => ({
        originalIndex: item.originalIndex,
        rotation: item.rotation
      }));
      let blob = await reorganizePdfPages(singleFile.file, specs);
      if (organizerCropEnabled) {
        setStatusText('Cropping margins...');
        blob = await cropPdfMargins(new File([blob], singleFile.file.name, { type: 'application/pdf' }), cropMarginsPct);
      }
      if (organizerAddPageNumbers) {
        setStatusText('Adding page numbers...');
        blob = await addPageNumbersToPdf(new File([blob], singleFile.file.name, { type: 'application/pdf' }), pageNumberPosition);
      }
      setProgress(90);
      setResultSize(blob.size);
      replaceResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_organized.pdf`);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Page organization failed: ${e?.message || e}`);
    }
    setProgress(100); setProcessing(false);
  };

  const runMerge = async () => {
    if (multipleFiles.length < 2) return;
    await runResultTask({ initialProgress: 30, status: 'Merging PDF files into single document stream...', failurePrefix: 'Merge failed', task: async () => ({
      blob: await mergePdfs(multipleFiles.map(info => info.file)), name: 'merged_document.pdf',
    }) });
  };

  const runSplit = async () => {
    if (!singleFile) return;
    const indices = parsePageRanges(pageRangeText, singleFile.pageCount).map(p => p - 1);
    if (indices.length === 0) {
      setErrorMessage('Invalid page selection: please specify valid page numbers or ranges (e.g. 1-3, 5).');
      return;
    }
    await runResultTask({ initialProgress: 40, status: 'Extracting selected page range...', failurePrefix: 'Extraction failed', task: async () => ({
      blob: await extractPdfPages(singleFile.file, indices), name: `${singleFile.file.name.replace('.pdf', '')}_extracted.pdf`,
    }) });
  };

  const runCompress = async () => {
    if (multipleFiles.length === 0) return;
    replaceCompressionResults([]);
    setProcessing(true);

    const results: CompressionResult[] = [];
    for (let index = 0; index < multipleFiles.length; index++) {
      const { file } = multipleFiles[index];
      setProgress(Math.round((index / multipleFiles.length) * 100));
      setStatusText(`Optimizing ${index + 1} of ${multipleFiles.length}: ${file.name}`);
      const outputName = `${file.name.replace(/\.pdf$/i, '')}_compressed.pdf`;
      try {
        const blob = await compressPdf(file, {
          preset: compressionPreset,
          removeMetadata: removeCompressionMetadata,
        });
        results.push({
          sourceName: file.name,
          sourceSize: file.size,
          outputName,
          outputSize: blob.size,
          url: URL.createObjectURL(blob),
        });
      } catch (error) {
        console.error(`Compression failed for ${file.name}`, error);
        results.push({
          sourceName: file.name,
          sourceSize: file.size,
          outputName,
          outputSize: 0,
          error: error instanceof Error ? error.message : 'Unable to optimize this PDF',
        });
      }
    }
    replaceCompressionResults(results);
    setProgress(100);
    setProcessing(false);
    const successfulCount = results.filter(result => result.url).length;
    if (successfulCount > 0) onUploadSuccess(successfulCount);
  };

  const retryCompressionResult = async (resultIndex: number) => {
    const failed = compressionResults[resultIndex];
    const source = multipleFiles.find(item =>
      item.file.name === failed.sourceName && item.file.size === failed.sourceSize
    )?.file;
    if (!source) return;
    setProcessing(true);
    setProgress(35);
    setStatusText(`Retrying ${source.name}...`);
    try {
      const blob = await compressPdf(source, {
        preset: compressionPreset,
        removeMetadata: removeCompressionMetadata,
      });
      const replacement: CompressionResult = {
        ...failed,
        outputSize: blob.size,
        url: URL.createObjectURL(blob),
        error: undefined,
      };
      replaceCompressionResults(prev => prev.map((item, index) => index === resultIndex ? replacement : item));
      setProgress(100);
      onUploadSuccess();
    } catch (error) {
      replaceCompressionResults(prev => prev.map((item, index) => index === resultIndex ? {
        ...item,
        error: error instanceof Error ? error.message : 'Unable to optimize this PDF',
      } : item));
    } finally {
      setProcessing(false);
    }
  };

  const runImagesToPdf = async () => {
    if (imageFiles.length === 0) return;
    setProcessing(true); setProgress(40);
    setStatusText('Compiling raster images into vector PDF pages...');
    try {
      const files = imageFiles.map(info => info.file);
      const blob = await imagesToPdf(files, {
        orientation: imgOrientation,
        pageSize: imgPageSize,
        margin: imgMargin,
        filter: imgFilter,
        rotations: imageRotations,
      });
      setProgress(90);
      setResultSize(blob.size);
      replaceResultUrl(URL.createObjectURL(blob));
      setResultName('images_compiled.pdf');
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Conversion failed: ${e?.message || e}`);
    }
    setProgress(100); setProcessing(false);
  };

  const runStamps = async () => {
    if (!singleFile) return;
    await runResultTask({ initialProgress: 45, status: `Stamping ${stampPreset} preset badge onto pages...`, failurePrefix: 'Stamping document failed', task: async () => ({
      blob: await addVectorStampToPdf(singleFile.file, {
        preset: stampPreset,
        targetPages: stampTargetPages,
        position: stampPosition
      }), name: `${singleFile.file.name.replace('.pdf', '')}_stamped.pdf`,
    }) });
  };

  const runFlattenForms = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(45);
    setErrorMessage(null);
    setStatusText('Flattening interactive form fields into static vector elements...');
    try {
      const blob = await flattenPdfForm(singleFile.file);
      setProgress(90);
      setResultSize(blob.size);
      replaceResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace(/\.pdf$/i, '')}_forms_flattened.pdf`);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Form flattening failed: ${e?.message || e}`);
    }
    setProgress(100); setProcessing(false);
  };

  const runFlattenEntire = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(45);
    setErrorMessage(null);
    setStatusText('Rendering non-selectable PDF pages at high resolution...');
    try {
      const blob = await flattenPdfCompletely(singleFile.file, flattenQuality);
      setProgress(90);
      setResultSize(blob.size);
      replaceResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace(/\.pdf$/i, '')}_fully_flattened.pdf`);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`PDF rasterization failed: ${e?.message || e}`);
    }
    setProgress(100); setProcessing(false);
  };

  const runOcr = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(10);
    setErrorMessage(null);
    setStatusText('Initializing OCR recognition engine...');
    try {
      const blob = await createSearchableOcrPdf(singleFile.file, 'eng', (status, pct) => {
        setStatusText(status);
        setProgress(Math.round(pct));
      });
      setProgress(95);
      setResultSize(blob.size);
      replaceResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace(/\.pdf$/i, '')}_searchable_ocr.pdf`);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Searchable OCR creation failed: ${e?.message || e}`);
    }
    setProgress(100); setProcessing(false);
  };

  const runFlatten = async () => {
    if (activeTool === 'pdf-flatten-forms') {
      await runFlattenForms();
    } else if (activeTool === 'pdf-flatten-entire') {
      await runFlattenEntire();
    } else if (flattenMode === 'complete') {
      await runFlattenEntire();
    } else {
      await runFlattenForms();
    }
  };

  const runRemoveMetadata = async () => {
    if (!singleFile) return;
    await runResultTask({ initialProgress: 30, status: 'Stripping identifying PDF metadata...', failurePrefix: 'Metadata removal failed', task: async () => ({
      blob: await removePdfMetadata(singleFile.file), name: `${singleFile.file.name.replace(/\.pdf$/i, '')}_cleaned.pdf`,
    }) });
  };

  const runRedact = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(45);
    setErrorMessage(null);
    setStatusText('Applying redaction blackout & overlays...');
    try {
      const blob = await annotateOrRedactPdf(singleFile.file, {
        mode: redactMode,
        textOverlay: redactMode === 'text' ? { content: redactTextContent, xPct: 10, yPct: 50 } : undefined,
        redactBox: redactMode === 'redact' ? { xPct: 20, yPct: 20, widthPct: 60, heightPct: 20 } : undefined
      });
      setProgress(90);
      setResultSize(blob.size);
      replaceResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_redacted.pdf`);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Redaction failed: ${e?.message || e}`);
    }
    setProgress(100); setProcessing(false);
  };

  const runPdfToImages = async () => {
    if (!singleFile) return;
    if (pdfExportMode === 'markdown') {
      if (pdfTextLayerStatus !== 'available') {
        setErrorMessage('Markdown export is available only when this PDF has selectable text. Use OCR first for scanned documents.');
        return;
      }
      await runPdfToMd();
      return;
    }
    setProcessing(true); setProgress(40);
    setErrorMessage(null);
    setStatusText(`Rendering ${singleFile.pageCount} pages at 300 DPI high-resolution...`);
    try {
      const images = await renderPdfPagesToImages(singleFile.file, pdfExportMode, 2.5);
      setProgress(95);
      setExtractedImages(images);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`PDF to Image rendering failed: ${e?.message || e}`);
    }
    setProgress(100); setProcessing(false);
  };

  const runWatermark = async () => {
    if (!singleFile) return;
    await runResultTask({ initialProgress: 45, status: 'Applying watermark overlay onto document pages...', failurePrefix: 'Watermark addition failed', task: async () => ({
      blob: await watermarkPdfAdvanced(singleFile.file, {
        text: watermarkText,
        color: watermarkColor,
        position: watermarkPos,
        opacity: watermarkOpacity
      }), name: `${singleFile.file.name.replace('.pdf', '')}_watermarked.pdf`,
    }) });
  };

  const runPageNumbers = async () => {
    if (!singleFile) return;
    await runResultTask({ initialProgress: 45, status: 'Injecting page numbers into document footer/header...', failurePrefix: 'Page numbering failed', task: async () => ({
      blob: await addPageNumbersToPdf(singleFile.file, pageNumberPosition), name: `${singleFile.file.name.replace('.pdf', '')}_numbered.pdf`,
    }) });
  };

  const runCrop = async () => {
    if (!singleFile) return;
    await runResultTask({ initialProgress: 45, status: 'Cropping page margins...', failurePrefix: 'Cropping margins failed', task: async () => ({
      blob: await cropPdfMargins(singleFile.file, cropMarginsPct), name: `${singleFile.file.name.replace('.pdf', '')}_cropped.pdf`,
    }) });
  };

  const runSign = async () => {
    if (!singleFile) return;
    await runResultTask({ initialProgress: 45, status: 'Applying digital signature stamp...', failurePrefix: 'Sign document failed', task: async () => ({
      blob: await signPdfDocumentAdvanced(
        singleFile.file,
        signatureText,
        signaturePos,
        signatureColor,
        signatureTargetPages
      ), name: `${singleFile.file.name.replace('.pdf', '')}_signed.pdf`,
    }) });
  };

  const runProtect = async () => {
    if (!singleFile) return;
    await runResultTask({ initialProgress: 45, status: 'Encrypting PDF stream dictionary...', failurePrefix: 'Protection failed', task: async () => ({
      blob: await protectPdfWithPassword(singleFile.file, securityPassword), name: `${singleFile.file.name.replace('.pdf', '')}_protected.pdf`,
    }) });
  };

  const runUnlock = async () => {
    if (!singleFile) return;
    if (!pdfIsEncrypted) {
      setErrorMessage('This PDF is already unlocked.');
      return;
    }
    await runResultTask({ initialProgress: 45, status: 'Decrypting PDF stream & removing password...', failurePrefix: 'Unlock PDF failed', task: async () => ({
      blob: await unlockPdfWithPassword(singleFile.file, securityPassword), name: `${singleFile.file.name.replace('.pdf', '')}_unlocked.pdf`,
    }) });
  };

  const runPdfToMd = async () => {
    if (!singleFile) return;
    if (pdfTextLayerStatus !== 'available') {
      setErrorMessage('Markdown export is available only when this PDF has selectable text. Use OCR first for scanned documents.');
      return;
    }
    await runResultTask({ initialProgress: 40, status: 'Extracting PDF text layer & formatting Markdown structure...', failurePrefix: 'PDF to Markdown conversion failed', task: async () => {
      const mdText = await extractPdfMarkdown(singleFile.file);
      const mdBlob = new Blob([mdText], { type: 'text/markdown;charset=utf-8' });
      return { blob: mdBlob, name: `${singleFile.file.name.replace('.pdf', '')}_extracted.md` };
    } });
  };



  const getToolDesc = () => {
    if (!singleFile && multipleFiles.length === 0 && activeTool === 'pdf-organize') {
      return 'Choose a document once, then organize, optimize, secure, or convert it in one workspace';
    }
    if (activeTool === 'pdf-unlock') return 'Remove password protection from an encrypted PDF';
    if (activeTool === 'pdf-to-word') return 'Extract the structured text layer as Markdown';
    for (const group of TOOL_GROUPS) {
      const match = group.items.find(i => i.id === activeTool);
      if (match) return match.desc;
    }
    return 'Choose a PDF tool to edit, organize, protect, or convert a document locally.';
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && activeTool === 'pdf-compress' && multipleFiles.length > 0 && !processing) {
        event.preventDefault();
        runCompress();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && compressionResults.some(result => result.url)) {
        event.preventDefault();
        downloadAll(compressionResults.flatMap(result => result.url ? [{ url: result.url, name: result.outputName }] : []));
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  });

  const hasPdfSession = Boolean(singleFile || multipleFiles.length > 0 || imageFiles.length > 0 || resultUrl || compressionResults.length > 0 || extractedImages.length > 0 || processing || activeTool === 'pdf-word-to-pdf' || activeTool === 'pdf-jpg-to-pdf');
  const activePdfSection = activeTool === 'pdf-word-to-pdf'
    ? 'pdf-word-to-pdf'
    : CANVAS_PDF_TOOLS.has(activeTool) ? 'pdf-edit' : 'pdf-organize';

  const selectPdfMode = (tool: string) => {
    setErrorMessage(null);
    setPeekPageIndex(null);
    setActiveTool(tool);
    window.history.pushState(null, '', pathForTool(tool));
  };

  const selectWorkflowTool = (tool: string) => {
    setErrorMessage(null);
    setPeekPageIndex(null);
    replaceResultUrl(null);
    setResultName('');
    setResultSize(0);
    setExtractedImages([]);
    replaceCompressionResults([]);

    if ((tool === 'pdf-merge' || tool === 'pdf-compress') && singleFile) {
      setMultipleFiles(previous => previous.some(item => item.file === singleFile.file)
        ? previous
        : [{ ...singleFile }, ...previous]);
    } else if (tool !== 'pdf-jpg-to-pdf' && !singleFile && multipleFiles[0]?.file.type.includes('pdf')) {
      void handleSingleFileSelected([multipleFiles[0].file]);
    }

    const resolvedTool = pdfIsEncrypted && tool === 'pdf-protect' ? 'pdf-unlock' : tool;
    setActiveTool(resolvedTool);
    window.history.pushState(null, '', pathForTool(resolvedTool));
  };

  const workflowSelectionValue = ['pdf-unlock', 'pdf-flatten', 'pdf-flatten-forms', 'pdf-flatten-entire', 'pdf-remove-metadata', 'pdf-ocr'].includes(activeTool)
    ? 'pdf-protect'
    : activeTool === 'pdf-to-word' ? 'pdf-to-image' : activeTool;
  const activeWorkflowTool = TOOL_GROUPS.flatMap(group => group.items).find(item => item.id === workflowSelectionValue);
  const workflowPicker = activePdfSection === 'pdf-organize' && (singleFile || multipleFiles.length > 0 || imageFiles.length > 0 || activeTool === 'pdf-jpg-to-pdf') ? (
    <div className="pdf-workflow-picker">
      <Select value={workflowSelectionValue} onValueChange={value => value && selectWorkflowTool(value)}>
        <SelectTrigger aria-label="Choose PDF tool">
          <span className="pdf-workflow-picker__value">
            {activeWorkflowTool && <activeWorkflowTool.icon aria-hidden="true" />}
            <span>{activeWorkflowTool?.label || 'PDF Tool'}</span>
          </span>
        </SelectTrigger>
        <SelectContent align="end" className="pdf-workflow-picker__menu">
          {TOOL_GROUPS.map(group => (
            <SelectGroup key={group.id}>
              <SelectLabel>{group.title}</SelectLabel>
              {group.items.map(tool => (
                <SelectItem key={tool.id} value={tool.id} disabled={pdfIsEncrypted && tool.id !== 'pdf-protect'}>
                  <tool.icon aria-hidden="true" />
                  <span>{tool.label}</span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  ) : null;
  const activePreviewItems = activeTool === 'pdf-jpg-to-pdf' ? imagePreviewItems : pagesList;

  return (
    <div className={`tool-layout pdf-tool-layout ${hasPdfSession ? 'has-active-session' : 'is-empty-session'} ${isImmersivePdfEditor ? 'pdf-tool-layout--immersive' : ''} ${(singleFile || activeTool === 'pdf-jpg-to-pdf' || (['pdf-merge', 'pdf-compress'].includes(activeTool) && multipleFiles.length > 0)) ? 'pdf-tool-layout--organizer' : ''}`}>
      <ToolHeader
        title="PDF"
        description={getToolDesc()}
        icon={FileText}
        onGoHome={() => {
          if (singleFile || multipleFiles.length > 0 || imageFiles.length > 0 || resultUrl || compressionResults.length > 0 || extractedImages.length > 0 || processing) {
            reset();
          } else {
            onGoHome();
          }
        }}
        actions={!processing && !resultUrl && compressionResults.length === 0 && extractedImages.length === 0 ? (
          <div className="pdf-header-actions">
            <ToolModeSwitcher label="PDF sections" activeId={activePdfSection} options={PDF_MODE_TABS} onSelect={selectPdfMode} />
          </div>
        ) : undefined}
      />

      {processing && (
        <div className="tool-processing-stage">
          <ProgressBar progress={progress} statusText={statusText} subText="High-precision client-side PDF document engine" />
        </div>
      )}

      {!processing && !resultUrl && compressionResults.length === 0 && extractedImages.length === 0 && (
        <div className={`tool-upload-frame pdf-tool-workspace grid grid-cols-1 gap-6 items-start ${isSidebarCollapsed ? 'is-collapsed' : ''}`}>
          <div className="pdf-tool-main space-y-6 min-w-0 w-full">
            {errorMessage && (
              <ErrorBanner
                message={errorMessage}
                onDismiss={() => setErrorMessage(null)}
              />
            )}

            {/* 0. EDIT PDF & REDACT WORKSPACE */}
            {(activeTool === 'pdf-edit' || activeTool === 'pdf-redact') && (
              <div className="space-y-6">
                {!singleFile ? (
                  <FileUploader
                    accept=".pdf"
                    label={activeTool === 'pdf-redact' ? "Select PDF file to redact sensitive content" : "Select PDF file to edit"}
                    subLabel={activeTool === 'pdf-redact' ? "Draw visual blackout boxes, text censorship overlays & redact sensitive areas with 100% precision" : "Add shapes, annotations, text, lines, border & fill colors, opacity, rotation & side element layers"}
                    onFilesSelected={handleSingleFileSelected}
                    maxSizeMB={200}
                  />
                ) : (
                  <PdfEditor
                    file={singleFile.file}
                    mode={activeTool === 'pdf-redact' ? 'redact' : 'edit'}
                    onGoHome={onGoHome}
                    onSelectTool={tool => {
                      setActiveTool(tool);
                      window.history.pushState(null, '', pathForTool(tool));
                    }}
                    onSaveSuccess={() => onUploadSuccess(1)}
                  />
                )}
              </div>
            )}

            {/* MARKDOWN EDITOR WORKSPACE */}
            {activeTool === 'pdf-word-to-pdf' && (
              <MarkdownEditor
                onExportSuccess={() => onUploadSuccess(1)}
              />
            )}

            {/* 1. VISUAL PAGE ORGANIZER WORKSPACE */}
            {activeTool === 'pdf-organize' && (
              <div className="space-y-6">
                {!singleFile ? (
                  <FileUploader
                    accept=".pdf"
                    label="Choose a PDF to open the tools workspace"
                    subLabel="Upload once, then organize pages or switch to optimization, security, and conversion tools"
                    onFilesSelected={handleSingleFileSelected}
                    maxSizeMB={200}
                  />
                ) : (
                  <PageOrganizer
                    singleFile={singleFile}
                    pagesList={pagesList}
                    onRotatePage={rotatePage}
                    onRotateAll={rotateAllPages}
                    onMovePage={movePage}
                    onDeletePage={deletePage}
                    onPeekPage={setPeekPageIndex}
                    onReset={reset}
                    onRunOrganize={runOrganize}
                    onRemoveBlankPages={removeBlankPagesFromOrganizer}
                    blankPageStatus={blankPageScan.status}
                    blankPageCount={pagesList.filter(page => blankPageScan.indexes.includes(page.originalIndex)).length}
                    addPageNumbers={organizerAddPageNumbers}
                    onAddPageNumbersChange={setOrganizerAddPageNumbers}
                    pageNumberPosition={pageNumberPosition}
                    onPageNumberPositionChange={setPageNumberPosition}
                    cropEnabled={organizerCropEnabled}
                    onCropEnabledChange={setOrganizerCropEnabled}
                    cropMarginsPct={cropMarginsPct}
                    onCropMarginsChange={setCropMarginsPct}
                    toolSelector={workflowPicker}
                  />
                )}
              </div>
            )}

            {/* 2. MERGE PDF WORKSPACE */}
            {activeTool === 'pdf-merge' && (
              <div className="space-y-6">
                {multipleFiles.length === 0 ? (
                  <FileUploader
                    accept=".pdf"
                    multiple={true}
                    label="Upload PDF files to merge"
                    subLabel="Choose multiple PDF documents to compile sequentially in order"
                    onFilesSelected={handleMultipleFilesSelected}
                    maxSizeMB={150}
                  />
                ) : (
                  <MergePanel
                    multipleFiles={multipleFiles}
                    draggedQueueIndex={draggedQueueIndex}
                    onMoveQueueItem={moveQueueItem}
                    onRemoveQueueItem={(idx) => setMultipleFiles(prev => prev.filter((_, i) => i !== idx))}
                    onSetDraggedQueueIndex={setDraggedQueueIndex}
                    onAddFiles={handleMultipleFilesSelected}
                    onClearQueue={reset}
                    onRunMerge={runMerge}
                    toolSelector={workflowPicker}
                  />
                )}
              </div>
            )}

            {/* 3. IMAGES TO PDF WORKSPACE */}
            {activeTool === 'pdf-jpg-to-pdf' && (
              <div className="space-y-6">
                <ImagesToPdfPanel
                  multipleFiles={imageFiles}
                  imgFilter={imgFilter}
                  setImgFilter={setImgFilter}
                  imgOrientation={imgOrientation}
                  setImgOrientation={setImgOrientation}
                  imgPageSize={imgPageSize}
                  setImgPageSize={setImgPageSize}
                  imgMargin={imgMargin}
                  setImgMargin={setImgMargin}
                  onMoveItem={moveImageQueueItem}
                  onRemoveItem={(idx) => {
                    setImageFiles(prev => prev.filter((_, i) => i !== idx));
                    setImageRotations(prev => prev.filter((_, i) => i !== idx));
                  }}
                  onPeekImage={(idx) => {
                    imagePreviewItems.forEach(item => { if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl); });
                    const peekList = imageFiles.map((f, i) => ({
                      id: `img-${i}`,
                      originalIndex: i,
                      rotation: imageRotations[i] || 0,
                      thumbnailUrl: URL.createObjectURL(f.file)
                    }));
                    setImagePreviewItems(peekList);
                    setPeekPageIndex(idx);
                  }}
                  onAddFiles={handleImageFilesSelected}
                  onClearAll={() => {
                    imagePreviewItems.forEach(item => { if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl); });
                    setImagePreviewItems([]);
                    setImageFiles([]);
                    setImageRotations([]);
                    setPeekPageIndex(null);
                  }}
                  onRunConvert={runImagesToPdf}
                  rotations={imageRotations}
                  onRotateItem={(idx) => setImageRotations(previous => previous.map((rotation, index) => index === idx ? (rotation + 90) % 360 : rotation))}
                  toolSelector={workflowPicker}
                />
              </div>
            )}

            {/* BULK PDF COMPRESSION WORKSPACE */}
            {activeTool === 'pdf-compress' && (
              <div className="space-y-6">
                {multipleFiles.length === 0 ? (
                  <FileUploader
                    accept=".pdf,application/pdf"
                    multiple={true}
                    label="Upload PDF files to compress"
                    subLabel="Reduce file size with custom compression presets"
                    onFilesSelected={handleCompressionFilesSelected}
                    maxSizeMB={500}
                  />
                ) : (
                  <PdfCompressPanel
                    multipleFiles={multipleFiles}
                    compressionPreset={compressionPreset}
                    setCompressionPreset={setCompressionPreset}
                    removeCompressionMetadata={removeCompressionMetadata}
                    setRemoveCompressionMetadata={setRemoveCompressionMetadata}
                    draggedQueueIndex={draggedQueueIndex}
                    setDraggedQueueIndex={setDraggedQueueIndex}
                    onMoveQueueItem={moveQueueItem}
                    onRemoveQueueItem={(idx) => setMultipleFiles(prev => prev.filter((_, i) => i !== idx))}
                    onFilesSelected={handleCompressionFilesSelected}
                    onClearAll={reset}
                    onRunCompress={runCompress}
                    toolSelector={workflowPicker}
                  />
                )}
              </div>
            )}

            {/* 4. SINGLE FILE TOOL CONFIGURATOR WORKSPACE WITH REAL-TIME PREVIEW */}
            {['pdf-split', 'pdf-watermark', 'pdf-page-numbers', 'pdf-protect', 'pdf-unlock', 'pdf-remove-metadata', 'pdf-remove-blank-pages', 'pdf-rotate', 'pdf-extract-text', 'pdf-sign', 'pdf-to-word', 'pdf-crop-tool', 'pdf-stamps', 'pdf-flatten', 'pdf-flatten-forms', 'pdf-flatten-entire', 'pdf-ocr', 'pdf-to-image'].includes(activeTool) && (
              <div className="space-y-6">
                {!singleFile ? (
                  <FileUploader
                    accept=".pdf"
                    label="Upload PDF document to configure"
                    subLabel="Supports stamps, form flattening, redaction & 300 DPI exports"
                    onFilesSelected={handleSingleFileSelected}
                    maxSizeMB={200}
                  />
                ) : (
                  <PdfSingleConfigurator
                    singleFile={singleFile}
                    activeTool={activeTool}
                    onSelectTool={selectWorkflowTool}
                    pagesList={pagesList}
                    onPeekPage={setPeekPageIndex}
                    onReset={reset}
                    onRunAction={() => {
                      if (activeTool === 'pdf-split') runSplit();
                      else if (activeTool === 'pdf-watermark') runWatermark();
                      else if (activeTool === 'pdf-page-numbers') runPageNumbers();
                      else if (activeTool === 'pdf-protect') runProtect();
                      else if (activeTool === 'pdf-unlock') runUnlock();
                      else if (activeTool === 'pdf-remove-metadata') runRemoveMetadata();
                      else if (activeTool === 'pdf-sign') runSign();
                      else if (activeTool === 'pdf-to-word') runPdfToMd();
                      else if (activeTool === 'pdf-crop-tool') runCrop();
                      else if (activeTool === 'pdf-stamps') runStamps();
                      else if (activeTool === 'pdf-flatten' || activeTool === 'pdf-flatten-forms' || activeTool === 'pdf-flatten-entire') runFlatten();
                      else if (activeTool === 'pdf-ocr') runOcr();
                      else if (activeTool === 'pdf-redact') runRedact();
                      else if (activeTool === 'pdf-to-image') runPdfToImages();
                    }}
                    toolSelector={workflowPicker}
                    stampPreset={stampPreset}
                    setStampPreset={setStampPreset}
                    stampPosition={stampPosition}
                    setStampPosition={setStampPosition}
                    stampTargetPages={stampTargetPages}
                    setStampTargetPages={setStampTargetPages}
                    pageNumberPosition={pageNumberPosition}
                    setPageNumberPosition={setPageNumberPosition}
                    cropMarginsPct={cropMarginsPct}
                    setCropMarginsPct={setCropMarginsPct}
                    signatureText={signatureText}
                    setSignatureText={setSignatureText}
                    signaturePos={signaturePos}
                    setSignaturePos={setSignaturePos}
                    signatureColor={signatureColor}
                    setSignatureColor={setSignatureColor}
                    signatureTargetPages={signatureTargetPages}
                    setSignatureTargetPages={setSignatureTargetPages}
                    pdfExportMode={pdfExportMode}
                    pdfTextLayerStatus={pdfTextLayerStatus}
                    setPdfExportMode={mode => {
                      setPdfExportMode(mode);
                      if (mode !== 'markdown') setPdfExportImgFormat(mode);
                    }}
                    flattenMode={flattenMode}
                    setFlattenMode={setFlattenMode}
                    flattenQuality={flattenQuality}
                    setFlattenQuality={setFlattenQuality}
                    redactMode={redactMode}
                    setRedactMode={setRedactMode}
                    redactTextContent={redactTextContent}
                    setRedactTextContent={setRedactTextContent}
                    pageRangeText={pageRangeText}
                    setPageRangeText={setPageRangeText}
                    selectedPagesInSplit={selectedPagesInSplit}
                    togglePageInSplitRange={togglePageInSplitRange}
                    setSplitPreset={setSplitPreset}
                    watermarkText={watermarkText}
                    setWatermarkText={setWatermarkText}
                    watermarkPos={watermarkPos}
                    setWatermarkPos={setWatermarkPos}
                    watermarkColor={watermarkColor}
                    setWatermarkColor={setWatermarkColor}
                    watermarkOpacity={watermarkOpacity}
                    setWatermarkOpacity={setWatermarkOpacity}
                    securityPassword={securityPassword}
                    setSecurityPassword={setSecurityPassword}
                    showPassword={showPassword}
                    setShowPassword={setShowPassword}
                    pdfIsEncrypted={pdfIsEncrypted}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* RESULT VIEWS */}
      {!processing && (
        <PdfResultViews
          resultUrl={resultUrl}
          resultName={resultName}
          resultSize={resultSize}
          extractedImages={extractedImages}
          pdfExportImgFormat={pdfExportImgFormat}
          compressionResults={compressionResults}
          multipleFiles={multipleFiles}
          onRetryCompression={retryCompressionResult}
          onReset={reset}
        />
      )}

      {/* POWERTOYS PEEK MODAL */}
      {peekPageIndex !== null && activePreviewItems[peekPageIndex] && createPortal(
        <div
          className="pdf-peek fixed inset-0 z-[99999] bg-black/60 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 overflow-hidden select-none animate-in fade-in duration-200"
          onClick={() => setPeekPageIndex(null)}
        >
          <div
            className="pdf-peek__header w-full max-w-5xl mx-auto flex items-center justify-between bg-zinc-950/80 backdrop-blur-md border border-zinc-800/80 p-3 rounded-2xl shadow-2xl shrink-0 z-20"
            onClick={e => e.stopPropagation()}
          >
            <div className="pdf-peek__file flex items-center gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 font-bold text-xs">
                P.{peekPageIndex + 1}
              </div>
              <div className="min-w-0 flex-1">
                <span className="pdf-peek__title block text-xs font-bold text-white truncate max-w-xs sm:max-w-md">
                  Page {peekPageIndex + 1} of {activePreviewItems.length} &bull; {activeTool === 'pdf-jpg-to-pdf' ? imageFiles[peekPageIndex]?.file.name : singleFile?.file.name}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPeekPageIndex(null)}
                className="pdf-peek__close h-8 text-xs text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg px-3 flex items-center gap-1 whitespace-nowrap"
              >
                <CloseIcon className="w-4 h-4" /> Close (Esc)
              </Button>
            </div>
          </div>

          <div
            className="pdf-peek__stage flex-1 w-full max-w-5xl mx-auto flex items-center justify-center relative overflow-hidden my-3"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setPeekPageIndex(peekPageIndex > 0 ? peekPageIndex - 1 : activePreviewItems.length - 1)}
              className="pdf-peek__previous absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-zinc-900/90 border border-zinc-700 text-white flex items-center justify-center shadow-2xl hover:bg-zinc-800 hover:scale-110 active:scale-95 transition-all cursor-pointer"
              aria-label="Previous page"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>

            <div className="pdf-peek__document w-full h-full flex items-center justify-center p-2">
              <div
                className="pdf-peek__paper bg-white rounded-xl shadow-2xl border border-zinc-700 overflow-hidden flex items-center justify-center transition-transform duration-300 max-h-[78vh] max-w-[85vw]"
                style={{ transform: `rotate(${activePreviewItems[peekPageIndex].rotation}deg)` }}
              >
                {activePreviewItems[peekPageIndex].thumbnailUrl ? (
                  <img
                    src={activePreviewItems[peekPageIndex].thumbnailUrl}
                    alt={`Page ${peekPageIndex + 1}`}
                    className="pdf-peek__image max-h-[76vh] w-auto h-auto object-contain block rounded shadow-inner"
                  />
                ) : (
                  <div className="w-96 h-[60vh] flex flex-col items-center justify-center text-zinc-600">
                    <FileText className="w-12 h-12 mb-2 animate-pulse" />
                    <span className="text-xs font-bold font-mono">Rendering High-Res Page...</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setPeekPageIndex(peekPageIndex < activePreviewItems.length - 1 ? peekPageIndex + 1 : 0)}
              className="pdf-peek__next absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-zinc-900/90 border border-zinc-700 text-white flex items-center justify-center shadow-2xl hover:bg-zinc-800 hover:scale-110 active:scale-95 transition-all cursor-pointer"
              aria-label="Next page"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
