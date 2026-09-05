import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileUploader } from '../../components/Common/FileUploader';
import { ProgressBar } from '../../components/Common/ProgressBar';
import { ToolHeader } from '../../components/Common/ToolHeader';
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
import { renderPdfThumbnails, renderPdfPagesToImages } from '../../utils/pdfRenderer';
import { createSearchableOcrPdf } from '../../utils/pdfOcr';
import type { PageOrganizeSpec } from '../../utils/pdf';
import { formatBytes } from '../../utils/image';
import { downloadAll, isEditableShortcutTarget, loadSetting, saveSetting } from '../../utils/batch';
import type { CompressionPreset } from '../../utils/batch';
import { 
  FileText,
  ArrowLeft, ArrowRight,
  X as CloseIcon,
  PanelLeft, PanelLeftClose
} from 'lucide-react';
import { WorkspaceShell } from '../../components/Workspace/WorkspaceShell';
import { Button } from '../../components/ui/button';
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
}

import { TOOL_GROUPS, PDF_MODE_TABS, CANVAS_PDF_TOOLS, WORKFLOW_CATEGORIES, parsePageRanges } from './pdfToolsConfig';
import type { WorkflowCategoryId, CompressionResult } from './pdfToolsConfig';
export type { CompressionResult };
import { LivePdfPreview } from './components/LivePdfPreview';
import { PageOrganizer } from './components/PageOrganizer';
import { MergePanel } from './components/MergePanel';
import { ImagesToPdfPanel } from './components/ImagesToPdfPanel';
import { PdfInspectorPanel } from './components/PdfInspectorPanel';
import { PdfCompressPanel } from './components/PdfCompressPanel';
import { PdfResultViews } from './components/PdfResultViews';

export const PdfTools: React.FC<PdfToolsProps> = ({ toolId, onGoHome, onUploadSuccess }) => {
  const [activeTool, setActiveTool] = useState<string>(toolId || 'pdf-organize');
  const [selectedWorkflowCategory, setSelectedWorkflowCategory] = useState<WorkflowCategoryId>('all');

  // Global execution states
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState('');
  const [resultSize, setResultSize] = useState<number>(0);
  const [compressionResults, setCompressionResults] = useState<CompressionResult[]>([]);
  const [compressionPreset, setCompressionPreset] = useState<CompressionPreset>(() =>
    loadSetting('compactor_pdf_compression_preset', 'balanced')
  );
  const [removeCompressionMetadata, setRemoveCompressionMetadata] = useState(() =>
    loadSetting('compactor_pdf_remove_metadata', true)
  );

  // File states
  const [multipleFiles, setMultipleFiles] = useState<PdfFileInfo[]>([]);
  const [singleFile, setSingleFile] = useState<PdfFileInfo | null>(null);
  const [draggedQueueIndex, setDraggedQueueIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    saveSetting('compactor_pdf_compression_preset', compressionPreset);
    saveSetting('compactor_pdf_remove_metadata', removeCompressionMetadata);
  }, [compressionPreset, removeCompressionMetadata]);

  // Page Organizer state
  const [pagesList, setPagesList] = useState<PageItem[]>([]);
  const [peekPageIndex, setPeekPageIndex] = useState<number | null>(null);

  // Tool list stays available but yields space once a file is active.
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  useEffect(() => {
    if (singleFile || multipleFiles.length > 0) {
      setIsSidebarCollapsed(true);
    }
  }, [singleFile, multipleFiles]);

  // Tool specific configuration states
  const [pageRangeText, setPageRangeText] = useState('1-2');
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [watermarkPos, setWatermarkPos] = useState<'diagonal' | 'header' | 'footer' | 'pattern'>('diagonal');
  const [watermarkColor, setWatermarkColor] = useState<'red' | 'blue' | 'black' | 'gray'>('red');
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.35);

  const [pageNumberPosition, setPageNumberPosition] = useState<'top' | 'bottom'>('bottom');
  const [cropMarginsPct, setCropMarginsPct] = useState<number>(10);
  
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

  // PDF to Images Extracted Output List
  const [pdfExportImgFormat, setPdfExportImgFormat] = useState<'png' | 'jpg'>('png');
  const [flattenMode, setFlattenMode] = useState<'forms' | 'complete'>('complete');
  const [flattenQuality, setFlattenQuality] = useState<'standard' | 'high' | 'print'>('high');
  const [extractedImages, setExtractedImages] = useState<{ pageNumber: number; blob: Blob; url: string }[]>([]);

  // PowerToys Peek Keyboard Navigation Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (peekPageIndex === null) return;
      if (e.key === 'Escape') {
        setPeekPageIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setPeekPageIndex(prev => (prev !== null && prev > 0 ? prev - 1 : pagesList.length - 1));
      } else if (e.key === 'ArrowRight') {
        setPeekPageIndex(prev => (prev !== null && prev < pagesList.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [peekPageIndex, pagesList.length]);

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

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      compressionResults.forEach(result => {
        if (result.url) URL.revokeObjectURL(result.url);
      });
    };
  }, [resultUrl, compressionResults]);

  const reset = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    compressionResults.forEach(result => {
      if (result.url) URL.revokeObjectURL(result.url);
    });
    setResultUrl(null);
    setResultName('');
    setResultSize(0);
    setExtractedImages([]);
    setMultipleFiles([]);
    setSingleFile(null);
    setPagesList([]);
    setPeekPageIndex(null);
    setDraggedQueueIndex(null);
    setShowPassword(false);
    setPdfIsEncrypted(false);
    setSecurityPassword('');
    setProgress(0);
    setProcessing(false);
    setCompressionResults([]);
  };

  useEffect(() => {
    if (toolId) setActiveTool(toolId);
    reset();
    // Reset intentionally runs only when navigation selects another PDF tool.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolId]);

  const handleMultipleFilesSelected = async (selectedFiles: File[]) => {
    setProcessing(true);
    setStatusText('Analyzing document structures...');
    const loaded: PdfFileInfo[] = [];
    for (const f of selectedFiles) {
      const count = f.type.includes('pdf') ? await getPdfPageCount(f) : 1;
      loaded.push({ file: f, pageCount: count });
    }
    setMultipleFiles((prev) => [...prev, ...loaded]);
    setProcessing(false);
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

    const secStatus = await checkPdfEncryptionStatus(f);
    setPdfIsEncrypted(secStatus.isEncrypted);
    setSecurityPassword('');

    const count = secStatus.pageCount;
    setSingleFile({ file: f, pageCount: count });
    setPageRangeText(`1-${Math.min(count, 3)}`);

    const items: PageItem[] = [];
    for (let i = 0; i < count; i++) {
      items.push({ id: `page-${i}-${Date.now()}`, originalIndex: i, rotation: 0 });
    }
    setPagesList(items);
    setProcessing(false);

    renderPdfThumbnails(f, Math.min(count, 100), 1.5).then(thumbs => {
      if (thumbs && thumbs.length > 0) {
        setPagesList(prev => prev.map((item, idx) => ({
          ...item,
          thumbnailUrl: thumbs[idx] || undefined
        })));
      }
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

  const selectedPagesInSplit = singleFile ? parsePageRanges(pageRangeText, singleFile.pageCount) : [];
  const isImmersivePdfEditor = Boolean((singleFile && (activeTool === 'pdf-edit' || activeTool === 'pdf-redact')) || activeTool === 'pdf-word-to-pdf');

  const togglePageInSplitRange = (pNum: number) => {
    let current = new Set(selectedPagesInSplit);
    if (current.has(pNum)) {
      current.delete(pNum);
    } else {
      current.add(pNum);
    }
    const arr = Array.from(current).sort((a, b) => a - b);
    if (arr.length === 0) {
      setPageRangeText('1');
      return;
    }
    
    let str = '';
    let start = arr[0];
    let prev = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] === prev + 1) {
        prev = arr[i];
      } else {
        if (start === prev) str += `${start}, `;
        else str += `${start}-${prev}, `;
        start = arr[0];
        prev = arr[i];
      }
    }
    if (start === prev) str += `${start}`;
    else str += `${start}-${prev}`;

    setPageRangeText(str);
  };

  const setSplitPreset = (preset: 'all' | 'none' | 'odd' | 'even') => {
    if (!singleFile) return;
    const total = singleFile.pageCount;
    if (preset === 'all') {
      setPageRangeText(`1-${total}`);
    } else if (preset === 'none') {
      setPageRangeText('1');
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

  // --- RUN ACTIONS ---
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
      const blob = await reorganizePdfPages(singleFile.file, specs);
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
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
    setProcessing(true); setProgress(30);
    setErrorMessage(null);
    setStatusText('Merging PDF files into single document stream...');
    try {
      const files = multipleFiles.map(info => info.file);
      const blob = await mergePdfs(files);
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName('merged_document.pdf');
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Merge failed: ${e?.message || e}`);
    }
    setProgress(100); setProcessing(false);
  };

  const runSplit = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(40);
    setErrorMessage(null);
    setStatusText('Extracting selected page range...');
    try {
      const indices = parsePageRanges(pageRangeText, singleFile.pageCount).map(p => p - 1);
      if (indices.length === 0) {
        setErrorMessage('Invalid page selection: please specify valid page numbers or ranges (e.g. 1-3, 5).');
        setProcessing(false); return;
      }
      const blob = await extractPdfPages(singleFile.file, indices);
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_extracted.pdf`);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Extraction failed: ${e?.message || e}`);
    }
    setProgress(100); setProcessing(false);
  };

  const runCompress = async () => {
    if (multipleFiles.length === 0) return;
    compressionResults.forEach(result => {
      if (result.url) URL.revokeObjectURL(result.url);
    });
    setCompressionResults([]);
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
    setCompressionResults(results);
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
      setCompressionResults(prev => prev.map((item, index) => index === resultIndex ? replacement : item));
      setProgress(100);
      onUploadSuccess();
    } catch (error) {
      setCompressionResults(prev => prev.map((item, index) => index === resultIndex ? {
        ...item,
        error: error instanceof Error ? error.message : 'Unable to optimize this PDF',
      } : item));
    } finally {
      setProcessing(false);
    }
  };

  const runImagesToPdf = async () => {
    if (multipleFiles.length === 0) return;
    setProcessing(true); setProgress(40);
    setStatusText('Compiling raster images into vector PDF pages...');
    try {
      const files = multipleFiles.map(info => info.file);
      const blob = await imagesToPdf(files, {
        orientation: imgOrientation,
        pageSize: imgPageSize,
        margin: imgMargin,
        filter: imgFilter
      });
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
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
    setProcessing(true); setProgress(45);
    setErrorMessage(null);
    setStatusText(`Stamping ${stampPreset} preset badge onto pages...`);
    try {
      const blob = await addVectorStampToPdf(singleFile.file, {
        preset: stampPreset,
        targetPages: stampTargetPages,
        position: stampPosition
      });
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_stamped.pdf`);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Stamping document failed: ${e?.message || e}`);
    }
    setProgress(100); setProcessing(false);
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
      setResultUrl(URL.createObjectURL(blob));
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
      setResultUrl(URL.createObjectURL(blob));
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
      setResultUrl(URL.createObjectURL(blob));
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
    setProcessing(true); setProgress(30);
    setErrorMessage(null);
    setStatusText('Stripping identifying PDF metadata...');
    try {
      const blob = await removePdfMetadata(singleFile.file);
      setProgress(90);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace(/\.pdf$/i, '')}_cleaned.pdf`);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Metadata removal failed: ${e?.message || e}`);
    }
    setProgress(100); setProcessing(false);
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
      setResultUrl(URL.createObjectURL(blob));
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
    setProcessing(true); setProgress(40);
    setErrorMessage(null);
    setStatusText(`Rendering ${singleFile.pageCount} pages at 300 DPI high-resolution...`);
    try {
      const images = await renderPdfPagesToImages(singleFile.file, pdfExportImgFormat, 2.5);
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
    setProcessing(true); setProgress(45);
    setErrorMessage(null);
    setStatusText('Applying watermark overlay onto document pages...');
    try {
      const blob = await watermarkPdfAdvanced(singleFile.file, {
        text: watermarkText,
        color: watermarkColor,
        position: watermarkPos,
        opacity: watermarkOpacity
      });
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_watermarked.pdf`);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Watermark addition failed: ${e?.message || e}`);
    }
    setProgress(100); setProcessing(false);
  };

  const runPageNumbers = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(45);
    setErrorMessage(null);
    setStatusText('Injecting page numbers into document footer/header...');
    try {
      const blob = await addPageNumbersToPdf(singleFile.file, pageNumberPosition);
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_numbered.pdf`);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Page numbering failed: ${e?.message || e}`);
    }
    setProgress(100); setProcessing(false);
  };

  const runCrop = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(45);
    setErrorMessage(null);
    setStatusText('Cropping page margins...');
    try {
      const blob = await cropPdfMargins(singleFile.file, cropMarginsPct);
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_cropped.pdf`);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Cropping margins failed: ${e?.message || e}`);
    }
    setProgress(100); setProcessing(false);
  };

  const runSign = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(45);
    setErrorMessage(null);
    setStatusText('Applying digital signature stamp...');
    try {
      const blob = await signPdfDocumentAdvanced(
        singleFile.file, 
        signatureText, 
        signaturePos, 
        signatureColor,
        signatureTargetPages
      );
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_signed.pdf`);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Sign document failed: ${e?.message || e}`);
    }
    setProgress(100); setProcessing(false);
  };

  const runProtect = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(45);
    setErrorMessage(null);
    setStatusText('Encrypting PDF stream dictionary...');
    try {
      const blob = await protectPdfWithPassword(singleFile.file, securityPassword);
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_protected.pdf`);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Protection failed: ${e?.message || e}`);
    }
    setProgress(100); setProcessing(false);
  };

  const runUnlock = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(45);
    setErrorMessage(null);
    setStatusText('Decrypting PDF stream & removing password...');
    try {
      const blob = await unlockPdfWithPassword(singleFile.file, securityPassword);
      setProgress(90);
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_unlocked.pdf`);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Unlock PDF failed: ${e?.message || 'Please verify the current password.'}`);
    }
    setProgress(100); setProcessing(false);
  };

  const runPdfToMd = async () => {
    if (!singleFile) return;
    setProcessing(true); setProgress(40);
    setErrorMessage(null);
    setStatusText('Extracting PDF text layer & formatting Markdown structure...');
    try {
      const mdText = await extractPdfMarkdown(singleFile.file);
      setProgress(90);
      const mdBlob = new Blob([mdText], { type: 'text/markdown;charset=utf-8' });
      setResultSize(mdBlob.size);
      setResultUrl(URL.createObjectURL(mdBlob));
      setResultName(`${singleFile.file.name.replace('.pdf', '')}_extracted.md`);
      onUploadSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`PDF to Markdown conversion failed: ${e?.message || e}`);
    }
    setProgress(100); setProcessing(false);
  };

  const getToolTitle = () => {
    for (const group of TOOL_GROUPS) {
      const match = group.items.find(i => i.id === activeTool);
      if (match) return match.label;
    }
    return 'PDF Tools';
  };

  const getToolDesc = () => {
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

  const hasPdfSession = Boolean(singleFile || multipleFiles.length > 0 || resultUrl || compressionResults.length > 0 || extractedImages.length > 0 || processing || activeTool === 'pdf-word-to-pdf');

  const selectPdfMode = (tool: string) => {
    reset();
    setActiveTool(tool);
    window.history.pushState(null, '', pathForTool(tool));
  };

  return (
    <div className={`tool-layout pdf-tool-layout ${hasPdfSession ? 'has-active-session' : 'is-empty-session'} ${isImmersivePdfEditor ? 'pdf-tool-layout--immersive' : ''}`}>
      <ToolHeader 
        title={getToolTitle()} 
        description={getToolDesc()} 
        icon={FileText} 
        onGoHome={() => {
          if (singleFile || multipleFiles.length > 0 || resultUrl || compressionResults.length > 0 || extractedImages.length > 0 || processing) {
            reset();
          } else {
            onGoHome();
          }
        }}
        actions={!processing && !resultUrl && compressionResults.length === 0 && extractedImages.length === 0 ? (
          <div className="pdf-mode-switcher" aria-label="PDF workflow modes">
            {PDF_MODE_TABS.map(modeTab => (
              <button
                key={modeTab.id}
                type="button"
                aria-pressed={
                  modeTab.id === 'pdf-word-to-pdf'
                    ? activeTool === 'pdf-word-to-pdf'
                    : modeTab.id === 'pdf-edit'
                    ? CANVAS_PDF_TOOLS.has(activeTool)
                    : !CANVAS_PDF_TOOLS.has(activeTool) && activeTool !== 'pdf-word-to-pdf'
                }
                onClick={() => selectPdfMode(modeTab.id)}
              >
                {modeTab.label}
              </button>
            ))}
          </div>
        ) : undefined}
      />

      {processing && (
        <div className="max-w-2xl mx-auto py-12">
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

            {/* Workflow Category Navigation & Quick Tool Strip */}
            {!CANVAS_PDF_TOOLS.has(activeTool) && activeTool !== 'pdf-word-to-pdf' && (
              <div className="pdf-workflows-nav space-y-3 bg-zinc-950/60 p-3 sm:p-4 rounded-2xl border border-[var(--border-color)]">
                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Workflow Categories">
                  {WORKFLOW_CATEGORIES.map(cat => {
                    const isSelected = selectedWorkflowCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        onClick={() => setSelectedWorkflowCategory(cat.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                          isSelected
                            ? 'bg-white text-zinc-950 shadow-sm border border-white'
                            : 'bg-zinc-900/70 text-zinc-400 hover:text-white hover:bg-zinc-800/80 border border-zinc-800/60'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>

                {/* Workflow Tools Grid / Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {TOOL_GROUPS
                    .filter(group => selectedWorkflowCategory === 'all' || group.id === selectedWorkflowCategory)
                    .flatMap(group => group.items)
                    .map(item => {
                      const isActive = activeTool === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setActiveTool(item.id);
                            window.history.pushState(null, '', pathForTool(item.id));
                            reset();
                          }}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                            isActive
                              ? 'bg-white text-zinc-950 border-white shadow-md font-bold'
                              : 'bg-zinc-900/50 hover:bg-zinc-800/60 text-zinc-300 hover:text-white border-zinc-800/80'
                          }`}
                        >
                          <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-zinc-950' : 'text-zinc-400'}`} />
                          <div className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold truncate">{item.label}</span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
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
                    label="Select PDF file to organize pages"
                    subLabel="Visual thumbnail organizer for page reordering, rotation & deletion"
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
                  />
                )}
              </div>
            )}

            {/* 3. IMAGES TO PDF WORKSPACE */}
            {activeTool === 'pdf-jpg-to-pdf' && (
              <div className="space-y-6">
                {multipleFiles.length === 0 ? (
                  <FileUploader 
                    accept="image/png,image/jpeg,image/webp"
                    multiple={true}
                    label="Upload PNG, JPG, or WebP images to convert"
                    subLabel="Compile high-resolution image cards into a unified multi-page PDF with CamScanner Mobile Scan filters"
                    onFilesSelected={handleMultipleFilesSelected}
                    maxSizeMB={150}
                  />
                ) : (
                  <ImagesToPdfPanel 
                    multipleFiles={multipleFiles}
                    imgFilter={imgFilter}
                    setImgFilter={setImgFilter}
                    imgOrientation={imgOrientation}
                    setImgOrientation={setImgOrientation}
                    imgPageSize={imgPageSize}
                    setImgPageSize={setImgPageSize}
                    imgMargin={imgMargin}
                    setImgMargin={setImgMargin}
                    onMoveItem={moveQueueItem}
                    onRemoveItem={(idx) => setMultipleFiles(prev => prev.filter((_, i) => i !== idx))}
                    onPeekImage={(idx) => {
                      const peekList = multipleFiles.map((f, i) => ({
                        id: `img-${i}`,
                        originalIndex: i,
                        rotation: 0,
                        thumbnailUrl: URL.createObjectURL(f.file)
                      }));
                      setPagesList(peekList);
                      setPeekPageIndex(idx);
                    }}
                    onAddFiles={handleMultipleFilesSelected}
                    onClearAll={reset}
                    onRunConvert={runImagesToPdf}
                  />
                )}
              </div>
            )}

            {/* BULK PDF COMPRESSION WORKSPACE */}
            {activeTool === 'pdf-compress' && (
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
              />
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
                  <WorkspaceShell
                    title={getToolTitle()}
                    fileName={singleFile.file.name}
                    fileMeta={`${singleFile.pageCount} pages · ${formatBytes(singleFile.file.size)}`}
                    onExit={reset}
                    actions={
                      <button
                        type="button"
                        onClick={() => {
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
                        className="image-queue-action-btn cursor-pointer"
                      >
                        <span>Apply & Export</span>
                        <span className="font-black text-sm">→</span>
                      </button>
                    }
                  >
                    <div className={`image-workbench ${isSidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
                      {/* ── LEFT SIDEBAR ── */}
                      <aside className={`image-workbench__sidebar ${isSidebarCollapsed ? 'is-collapsed' : ''}`}>
                        {isSidebarCollapsed ? (
                          <div className="h-full flex flex-col items-center py-3 bg-[#18191e] justify-between w-full select-none">
                            <button
                              type="button"
                              onClick={() => setIsSidebarCollapsed(false)}
                              className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer mb-1"
                              title="Expand sidebar"
                            >
                              <PanelLeft className="w-4 h-4" />
                            </button>
                            <div className="pt-2 border-t border-white/10 w-full flex justify-center px-2">
                              <button
                                type="button"
                                onClick={() => {
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
                                title="Apply & Export Document"
                                className="w-9 h-9 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 flex items-center justify-center shadow-md cursor-pointer transition-all hover:scale-105 active:scale-95 group relative font-bold"
                              >
                                <span className="text-sm leading-none font-black">→</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col min-h-0 bg-[#18191e]">
                            <div className="h-10 px-3.5 border-b border-white/10 flex items-center justify-between bg-transparent shrink-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">PDF Controls</span>
                                <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-semibold text-zinc-400">
                                  {singleFile.pageCount}p
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsSidebarCollapsed(true)}
                                className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                                title="Collapse to icon rail"
                              >
                                <PanelLeftClose className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                              <PdfInspectorPanel 
                                activeTool={activeTool}
                                pagesList={pagesList}
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
                                pdfExportImgFormat={pdfExportImgFormat}
                                setPdfExportImgFormat={setPdfExportImgFormat}
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
                                setPeekPageIndex={setPeekPageIndex}
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
                            </div>

                            <div className="p-3 border-t border-white/10 bg-[#18191e] shrink-0">
                              <button
                                type="button"
                                onClick={() => {
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
                                className="w-full h-10 bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                              >
                                <span>Apply & Export Document</span>
                                <span className="text-sm">→</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </aside>

                      {/* ── RIGHT MAIN PREVIEW STAGE ── */}
                      <div className="image-workbench__main flex flex-col h-full overflow-hidden bg-[#111216]">
                        <div className="image-filebar h-10 border-b border-white/10 bg-[#18191e] flex items-center px-4 gap-3 text-xs text-zinc-400 shrink-0 justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-semibold text-white truncate max-w-[220px]">{singleFile.file.name}</span>
                            <span className="text-zinc-500">{formatBytes(singleFile.file.size)}</span>
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-semibold text-zinc-300 font-mono">
                              {singleFile.pageCount} Pages
                            </span>
                          </div>
                          <Button variant="ghost" onClick={reset} className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 text-xs h-7 px-2 font-semibold">
                            Change File
                          </Button>
                        </div>

                        <div className="image-preview-viewport flex-1 bg-[#111216] relative overflow-auto p-4 sm:p-6 flex items-center justify-center">
                          <LivePdfPreview 
                            activeTool={activeTool}
                            singleFile={singleFile}
                            firstPageThumbnail={pagesList[0]?.thumbnailUrl}
                            pageRangeText={pageRangeText}
                            setPageRangeText={setPageRangeText}
                            watermarkText={watermarkText}
                            watermarkPos={watermarkPos}
                            watermarkColor={watermarkColor}
                            watermarkOpacity={watermarkOpacity}
                            pageNumberPosition={pageNumberPosition}
                            cropMarginsPct={cropMarginsPct}
                            signatureText={signatureText}
                            signaturePos={signaturePos}
                            signatureColor={signatureColor}
                            signatureTargetPages={signatureTargetPages}
                            pdfIsEncrypted={pdfIsEncrypted}
                            stampPreset={stampPreset}
                            stampPosition={stampPosition}
                            stampTargetPages={stampTargetPages}
                            redactMode={redactMode}
                            redactTextContent={redactTextContent}
                          />
                        </div>
                      </div>
                    </div>
                  </WorkspaceShell>
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
      {peekPageIndex !== null && pagesList[peekPageIndex] && createPortal(
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
                  Page {peekPageIndex + 1} of {pagesList.length} &bull; {singleFile?.file.name || multipleFiles[peekPageIndex]?.file.name}
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
              onClick={() => setPeekPageIndex(peekPageIndex > 0 ? peekPageIndex - 1 : pagesList.length - 1)}
              className="pdf-peek__previous absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-zinc-900/90 border border-zinc-700 text-white flex items-center justify-center shadow-2xl hover:bg-zinc-800 hover:scale-110 active:scale-95 transition-all cursor-pointer"
              aria-label="Previous page"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>

            <div className="pdf-peek__document w-full h-full flex items-center justify-center p-2">
              <div 
                className="pdf-peek__paper bg-white rounded-xl shadow-2xl border border-zinc-700 overflow-hidden flex items-center justify-center transition-transform duration-300 max-h-[78vh] max-w-[85vw]"
                style={{ transform: `rotate(${pagesList[peekPageIndex].rotation}deg)` }}
              >
                {pagesList[peekPageIndex].thumbnailUrl ? (
                  <img 
                    src={pagesList[peekPageIndex].thumbnailUrl} 
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
              onClick={() => setPeekPageIndex(peekPageIndex < pagesList.length - 1 ? peekPageIndex + 1 : 0)}
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
