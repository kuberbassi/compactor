import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import {
  MousePointer, Type, Square, Circle, Minus, ArrowRight,
  Trash2, RotateCw, Eye, EyeOff, ArrowUp, ArrowDown,
  ShieldAlert, RefreshCw, Layers, Pipette,
  Shield, AlignLeft, AlignCenter, AlignRight, Bold, Italic, AlertTriangle, FileText,
  PanelLeftClose, PanelLeft,
  Stamp, Signature, Highlighter, CheckCircle
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { WorkspaceZoomControls } from '../../components/Workspace/WorkspaceControls';
import { EditorCommandBar, EditorSidebar, EditorSidebarHeader } from '../../components/Workspace/EditorChrome';
import { ErrorBanner } from '../../components/Common/ErrorBanner';
import { getAutoSignatureFontSize, getAutoStampFontSize, getClosestPageIndex, getTargetPageIndexes, getWatermarkPatternPositions, togglePageEffect } from '../../utils/pdfEditor';
import type { TextContent } from 'pdfjs-dist/types/src/display/api';
import type { PageViewport } from 'pdfjs-dist/types/src/display/page_viewport';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function SelectablePdfTextLayer({ textContent, viewport }: { textContent: TextContent; viewport: PageViewport }) {
  const layerRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = layerRef.current;
    if (!container) return;
    container.replaceChildren();
    const textLayer = new pdfjsLib.TextLayer({ textContentSource: textContent, container, viewport });
    void textLayer.render().catch(error => {
      if (error?.name !== 'AbortException') console.error('Could not render selectable PDF text:', error);
    });
    return () => textLayer.cancel();
  }, [textContent, viewport]);
  return <div ref={layerRef} className="pdf-editor__text-layer textLayer" aria-label="Selectable PDF text" />;
}

export interface AnnotationItem {
  id: string;
  pageIndex: number; // 0-indexed
  type: 'rectangle' | 'circle' | 'line' | 'arrow' | 'text' | 'redact' | 'stamp' | 'signature' | 'highlight';
  name: string;
  x: number; // relative percentage (0 to 100)
  y: number; // relative percentage (0 to 100)
  width: number; // relative percentage (0 to 100)
  height: number; // relative percentage (0 to 100)
  strokeColor: string; // hex or 'transparent'
  fillColor: string; // hex or 'transparent'
  lastStrokeColor?: string;
  lastFillColor?: string;
  strokeWidth: number; // px
  opacity: number; // 0.0 to 1.0
  rotation: number; // 0 to 360 deg
  text?: string;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  isBold?: boolean;
  isItalic?: boolean;
  textColor?: string;
  fontFamily?: string;
  points?: { x: number; y: number }[];
  isVisible: boolean;
  redactStyle?: 'blackout' | 'whiteout' | 'custom-text';
  stampType?: string;
  signerName?: string;
  signDate?: string;
}

interface PdfEditorProps {
  file: File;
  mode?: 'edit' | 'redact';
  onGoHome?: () => void;
  onSaveSuccess?: () => void;
  onSelectTool?: (toolId: string) => void;
}

export const PdfEditor: React.FC<PdfEditorProps> = ({ file, mode = 'edit', onSaveSuccess, onSelectTool }) => {
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(0); // 0-indexed
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }[]>([]);
  const [pageTextContents, setPageTextContents] = useState<TextContent[]>([]);
  const [pageViewports, setPageViewports] = useState<PageViewport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Default PDF zoom set to 75% for optimal page fitting & accuracy
  const [zoom, setZoom] = useState<number>(85);
  const [showToolDrawer, setShowToolDrawer] = useState(true);
  const [elementScope, setElementScope] = useState<'current' | 'all'>('current');
  const [watermarkPages, setWatermarkPages] = useState<number[]>([]);
  const [patternWatermarkPages, setPatternWatermarkPages] = useState<number[]>([]);
  const [activeDocumentEffect, setActiveDocumentEffect] = useState<'watermark' | 'pattern' | null>(null);
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [watermarkOpacity, setWatermarkOpacity] = useState(18);
  const [watermarkRotation, setWatermarkRotation] = useState(-30);
  const [watermarkDensity, setWatermarkDensity] = useState(3);
  const [watermarkFontSize, setWatermarkFontSize] = useState(48);
  const [patternWatermarkFontSize, setPatternWatermarkFontSize] = useState(11);
  const [watermarkColor, setWatermarkColor] = useState('#dc2626');
  const [patternWatermarkText, setPatternWatermarkText] = useState('CONFIDENTIAL');
  const [patternWatermarkOpacity, setPatternWatermarkOpacity] = useState(18);
  const [patternWatermarkRotation, setPatternWatermarkRotation] = useState(-30);
  const [patternWatermarkColor, setPatternWatermarkColor] = useState('#dc2626');
  const [activeTool, setActiveTool] = useState<
    'select' | 'text' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'redact' | 'highlight'
  >(mode === 'redact' ? 'redact' : 'select');

  // Stamp / Watermark / Signature Quick Options
  const STAMP_PRESETS = [
    { label: 'APPROVED', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)' },
    { label: 'CONFIDENTIAL', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)' },
    { label: 'FINAL DRAFT', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' },
    { label: 'CANCELLED', color: '#991b1b', bg: 'rgba(153, 27, 27, 0.1)' },
    { label: 'COMPLETED', color: '#059669', bg: 'rgba(5, 150, 105, 0.1)' },
    { label: 'VOID', color: '#d97706', bg: 'rgba(217, 119, 6, 0.1)' },
  ];

  const targetPageIndexes = () => getTargetPageIndexes(elementScope, currentPage, numPages);

  const togglePatternWatermark = () => {
    const targets = targetPageIndexes();
    const removing = targets.every(pageIndex => patternWatermarkPages.includes(pageIndex));
    setPatternWatermarkPages(previous => togglePageEffect(previous, targets));
    setActiveDocumentEffect(removing ? null : 'pattern');
    setSelectedId(null);
    setEditingTextId(null);
  };

  const toggleWatermark = () => {
    const targets = targetPageIndexes();
    const removing = targets.every(pageIndex => watermarkPages.includes(pageIndex));
    setWatermarkPages(previous => togglePageEffect(previous, targets));
    setActiveDocumentEffect(removing ? null : 'watermark');
    setSelectedId(null);
    setEditingTextId(null);
  };

  const addStampItem = (preset: { label: string; color: string; bg: string }) => {
    const stampId = `stamp_${Date.now()}`;
    const newAnnotations: AnnotationItem[] = targetPageIndexes().map(pageIndex => ({
      id: `${stampId}_${pageIndex}_${Math.random().toString(36).slice(2, 6)}`,
      pageIndex,
      type: 'stamp',
      name: `Stamp (${preset.label})`,
      x: 35,
      y: 40,
      width: 30,
      height: 10,
      strokeColor: preset.color,
      fillColor: preset.bg,
      strokeWidth: 3,
      opacity: 0.95,
      rotation: -12,
      text: preset.label,
      stampType: preset.label,
      isVisible: true,
    }));
    setAnnotations(prev => [...prev, ...newAnnotations]);
    setSelectedId(newAnnotations.find(item => item.pageIndex === currentPage)?.id || newAnnotations[0].id);
    setActiveTool('select');
  };

  const addSignatureItem = (signerName: string = 'Verified Signature') => {
    const signatureId = `sig_${Date.now()}`;
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const newAnnotations: AnnotationItem[] = targetPageIndexes().map(pageIndex => ({
      id: `${signatureId}_${pageIndex}_${Math.random().toString(36).slice(2, 6)}`,
      pageIndex,
      type: 'signature',
      name: `Signature (${signerName})`,
      x: 55,
      y: 75,
      width: 35,
      height: 14,
      strokeColor: '#3b82f6',
      fillColor: 'rgba(59, 130, 246, 0.05)',
      strokeWidth: 1.5,
      opacity: 1,
      rotation: 0,
      signerName,
      signDate: dateStr,
      isVisible: true,
    }));
    setAnnotations(prev => [...prev, ...newAnnotations]);
    setSelectedId(newAnnotations.find(item => item.pageIndex === currentPage)?.id || newAnnotations[0].id);
    setActiveTool('select');
  };

  // Annotation state
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  useEffect(() => {
    setActiveDocumentEffect(null);
  }, [activeTool]);

  useEffect(() => {
    if (selectedId) setActiveDocumentEffect(null);
  }, [selectedId]);

  // Modal dialog states
  const [showRemoveAllConfirm, setShowRemoveAllConfirm] = useState(false);
  const [showNoAnnotsWarning, setShowNoAnnotsWarning] = useState(false);

  useEffect(() => {
    if (!showRemoveAllConfirm && !showNoAnnotsWarning) return;
    const previousOverflow = document.body.style.overflow;
    const closeDialog = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setShowRemoveAllConfirm(false);
      setShowNoAnnotsWarning(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeDialog);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeDialog);
    };
  }, [showNoAnnotsWarning, showRemoveAllConfirm]);

  // Active Mouse Drag State (Move / Resize / Rotate)
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize' | 'rotate';
    itemId: string;
    handle?: 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'bm' | 'ml' | 'mr';
    startMouseX: number;
    startMouseY: number;
    initialX: number;
    initialY: number;
    initialW: number;
    initialH: number;
    pageRect: DOMRect;
  } | null>(null);

  // Drawing creation state
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [draftBox, setDraftBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Styling defaults for new items
  const [strokeColor, setStrokeColor] = useState<string>(mode === 'redact' ? '#000000' : '#ffffff');
  const [fillColor, setFillColor] = useState<string>(mode === 'redact' ? '#000000' : 'transparent');
  const [strokeWidth, setStrokeWidth] = useState<number>(mode === 'redact' ? 0 : 2);
  const [opacity, setOpacity] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [fontSize, setFontSize] = useState<number>(18);
  const [textColor, setTextColor] = useState<string>('#000000');
  const [fontFamily, setFontFamily] = useState<string>('sans-serif');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [isBold, setIsBold] = useState<boolean>(false);
  const [isItalic, setIsItalic] = useState<boolean>(false);
  const [redactText, setRedactText] = useState<string>('[REDACTED]');
  const [redactStyle, setRedactStyle] = useState<'blackout' | 'whiteout' | 'custom-text'>('blackout');

  // Eyedropper API check
  const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

  // Ref for canvas viewport container
  const viewportRef = React.useRef<HTMLDivElement>(null);

  // Keep the active page aligned with the page nearest the viewport center.
  // This updates the page counter and placement target without requiring a click.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || loading || pageImages.length === 0) return;
    let frame = 0;
    const updateCurrentPage = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const viewportRect = viewport.getBoundingClientRect();
        const pages = Array.from(viewport.querySelectorAll<HTMLElement>('[data-pdf-page-index]'));
        const closestPage = getClosestPageIndex(
          { top: viewportRect.top, height: viewport.clientHeight },
          pages.map(page => {
            const rect = page.getBoundingClientRect();
            return { top: rect.top, height: rect.height };
          }),
        );
        setCurrentPage(previous => previous === closestPage ? previous : closestPage);
      });
    };
    updateCurrentPage();
    viewport.addEventListener('scroll', updateCurrentPage, { passive: true });
    const resizeObserver = new ResizeObserver(updateCurrentPage);
    resizeObserver.observe(viewport);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('scroll', updateCurrentPage);
      resizeObserver.disconnect();
    };
  }, [loading, pageImages.length, zoom]);

  // Cursor-anchored Ctrl/Cmd + wheel zoom. Keep ordinary wheel movement for page scrolling.
  useEffect(() => {
    const elem = viewportRef.current;
    if (!elem) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      const rect = elem.getBoundingClientRect();
      const cursorX = e.clientX - rect.left + elem.scrollLeft;
      const cursorY = e.clientY - rect.top + elem.scrollTop;
      const direction = e.deltaY < 0 ? 1 : -1;

      setZoom(currentZoom => {
        const nextZoom = Math.max(40, Math.min(200, currentZoom + direction * 5));
        if (nextZoom === currentZoom) return currentZoom;

        const ratio = nextZoom / currentZoom;
        requestAnimationFrame(() => {
          elem.scrollLeft = cursorX * ratio - (e.clientX - rect.left);
          elem.scrollTop = cursorY * ratio - (e.clientY - rect.top);
        });
        return nextZoom;
      });
    };

    elem.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      elem.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Keybindings (Delete / Backspace key to remove selected element)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        selectedId &&
        (e.key === 'Delete' || e.key === 'Backspace') &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setAnnotations(prev => prev.filter(item => item.id !== selectedId));
        setSelectedId(null);
        if (editingTextId === selectedId) setEditingTextId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingTextId, selectedId]);

  // Render PDF Pages to high-res image URLs using PDF.js
  useEffect(() => {
    let isMounted = true;
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;
    const loadPdf = async () => {
      setLoading(true);
      setPageImages([]);
      setPageDimensions([]);
      setPageTextContents([]);
      setPageViewports([]);
      try {
        const buffer = await file.arrayBuffer();
        loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer), verbosity: 0 });
        const pdf = await loadingTask.promise;
        const total = pdf.numPages;
        setNumPages(total);
        const renderDensity = total > 40 ? 1.25 : total > 12 ? 1.5 : Math.min(window.devicePixelRatio || 1, 2);

        const imgs: string[] = [];
        const dims: { width: number; height: number }[] = [];
        const textContents: TextContent[] = [];
        const textViewports: PageViewport[] = [];

        for (let i = 1; i <= total; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.6 });
          const renderScale = 1.6 * renderDensity;
          const renderViewport = page.getViewport({ scale: renderScale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(renderViewport.width);
          canvas.height = Math.ceil(renderViewport.height);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await (page.render as any)({ canvasContext: ctx, viewport: renderViewport, canvas }).promise;
            imgs.push(canvas.toDataURL('image/jpeg', 0.98));
            dims.push({ width: viewport.width, height: viewport.height });
            textContents.push(await page.getTextContent());
            textViewports.push(viewport);
          }
        }

        if (isMounted) {
          setPageImages(imgs);
          setPageDimensions(dims);
          setPageTextContents(textContents);
          setPageViewports(textViewports);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error rendering PDF pages:', err);
        if (isMounted) setLoading(false);
      }
    };
    loadPdf();
    return () => {
      isMounted = false;
      void loadingTask?.destroy();
    };
  }, [file]);

  const selectedItem = annotations.find(a => a.id === selectedId);
  const hasDocumentChanges = annotations.length > 0 || watermarkPages.length > 0 || patternWatermarkPages.length > 0;

  // Pick color using browser EyeDropper API
  const pickColorFromPage = async (target: 'stroke' | 'fill' | 'text') => {
    if (hasEyeDropper) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result.sRGBHex) {
          if (target === 'stroke') {
            setStrokeColor(result.sRGBHex);
            if (selectedId) updateSelectedItem({ strokeColor: result.sRGBHex });
          } else if (target === 'fill') {
            setFillColor(result.sRGBHex);
            if (selectedId) updateSelectedItem({ fillColor: result.sRGBHex });
          } else if (target === 'text') {
            setTextColor(result.sRGBHex);
            if (selectedId) updateSelectedItem({ textColor: result.sRGBHex });
          }
        }
      } catch (e) {
        console.log('Eyedropper cancelled', e);
      }
    }
  };

  // Update selected item properties and sync state defaults
  const updateSelectedItem = (updates: Partial<AnnotationItem>) => {
    const targetId = selectedId || editingTextId;

    if (updates.strokeColor !== undefined) setStrokeColor(updates.strokeColor);
    if (updates.fillColor !== undefined) setFillColor(updates.fillColor);
    if (updates.strokeWidth !== undefined) setStrokeWidth(updates.strokeWidth);
    if (updates.opacity !== undefined) setOpacity(updates.opacity);
    if (updates.rotation !== undefined) setRotation(updates.rotation);
    if (updates.fontSize !== undefined) setFontSize(updates.fontSize);
    if (updates.textColor !== undefined) setTextColor(updates.textColor);
    if (updates.fontFamily !== undefined) setFontFamily(updates.fontFamily);
    if (updates.textAlign !== undefined) setTextAlign(updates.textAlign);
    if (updates.isBold !== undefined) setIsBold(updates.isBold);
    if (updates.isItalic !== undefined) setIsItalic(updates.isItalic);

    if (!targetId) return;
    setAnnotations(prev => prev.map(item => item.id === targetId ? { ...item, ...updates } : item));
  };

  // Sync toolbar controls with active element values when selection/editing changes
  useEffect(() => {
    const targetId = selectedId || editingTextId;
    if (!targetId) return;
    const item = annotations.find(a => a.id === targetId);
    if (item) {
      if (item.strokeColor) setStrokeColor(item.strokeColor);
      if (item.fillColor) setFillColor(item.fillColor);
      if (item.strokeWidth !== undefined) setStrokeWidth(item.strokeWidth);
      if (item.opacity !== undefined) setOpacity(item.opacity);
      if (item.rotation !== undefined) setRotation(item.rotation);
      if (item.fontSize !== undefined) setFontSize(item.fontSize);
      if (item.textColor) setTextColor(item.textColor);
      if (item.fontFamily) setFontFamily(item.fontFamily);
      if (item.textAlign) setTextAlign(item.textAlign);
      if (item.isBold !== undefined) setIsBold(item.isBold);
      if (item.isItalic !== undefined) setIsItalic(item.isItalic);
    }
  }, [annotations, selectedId, editingTextId]);

  // Canvas Mouse Coordinates Helper (in percentage 0..100)
  const getCanvasCoords = (e: React.MouseEvent<HTMLDivElement> | MouseEvent, targetRect: DOMRect) => {
    const x = Math.max(0, Math.min(100, ((e.clientX - targetRect.left) / targetRect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - targetRect.top) / targetRect.height) * 100));
    return { x, y };
  };

  // Global Drag Motion Listener (Handles Move, Resize, Rotate)
  useEffect(() => {
    if (!dragState) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const { type, itemId, handle, startMouseX, startMouseY, initialX, initialY, initialW, initialH, pageRect } = dragState;
      
      const deltaXPercent = ((e.clientX - startMouseX) / pageRect.width) * 100;
      const deltaYPercent = ((e.clientY - startMouseY) / pageRect.height) * 100;

      if (type === 'move') {
        const newX = Math.max(0, Math.min(100 - initialW, initialX + deltaXPercent));
        const newY = Math.max(0, Math.min(100 - initialH, initialY + deltaYPercent));
        setAnnotations(prev => prev.map(item => item.id === itemId ? { ...item, x: newX, y: newY } : item));
      } else if (type === 'resize' && handle) {
        let newX = initialX;
        let newY = initialY;
        let newW = initialW;
        let newH = initialH;

        if (handle.includes('r')) newW = Math.max(3, initialW + deltaXPercent);
        if (handle.includes('b')) newH = Math.max(2, initialH + deltaYPercent);
        if (handle.includes('l')) {
          const maxDeltaX = initialW - 3;
          const actualDeltaX = Math.min(deltaXPercent, maxDeltaX);
          newX = initialX + actualDeltaX;
          newW = initialW - actualDeltaX;
        }
        if (handle.includes('t')) {
          const maxDeltaY = initialH - 2;
          const actualDeltaY = Math.min(deltaYPercent, maxDeltaY);
          newY = initialY + actualDeltaY;
          newH = initialH - actualDeltaY;
        }

        setAnnotations(prev => prev.map(item => item.id === itemId ? { ...item, x: newX, y: newY, width: newW, height: newH } : item));
      } else if (type === 'rotate') {
        const centerX = pageRect.left + (initialX + initialW / 2) * (pageRect.width / 100);
        const centerY = pageRect.top + (initialY + initialH / 2) * (pageRect.height / 100);
        const rad = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        let deg = Math.round((rad * 180) / Math.PI) + 90;
        if (deg < 0) deg += 360;
        deg = deg % 360;

        setAnnotations(prev => prev.map(item => item.id === itemId ? { ...item, rotation: deg } : item));
      }
    };

    const handleWindowMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [dragState]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, pageIndex: number) => {
    setCurrentPage(pageIndex);
    if (activeTool === 'select') {
      // If clicking directly on empty page canvas, deselect current selection
      if (e.target === e.currentTarget) {
        setSelectedId(null);
        setEditingTextId(null);
      }
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const coords = getCanvasCoords(e, rect);
    setIsDrawing(true);
    setDrawStart(coords);
    setDraftBox({ x: coords.x, y: coords.y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const coords = getCanvasCoords(e, rect);

    const x = Math.min(drawStart.x, coords.x);
    const y = Math.min(drawStart.y, coords.y);
    const w = Math.abs(coords.x - drawStart.x);
    const h = Math.abs(coords.y - drawStart.y);
    setDraftBox({ x, y, w, h });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>, pageIndex: number) => {
    if (!isDrawing || !drawStart) return;
    setIsDrawing(false);

    const rect = e.currentTarget.getBoundingClientRect();
    const coords = getCanvasCoords(e, rect);
    const id = `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    if (activeTool === 'redact') {
      const x = Math.min(drawStart.x, coords.x);
      const y = Math.min(drawStart.y, coords.y);
      const w = Math.max(3, Math.abs(coords.x - drawStart.x));
      const h = Math.max(2, Math.abs(coords.y - drawStart.y));

      const newAnnot: AnnotationItem = {
        id,
        pageIndex,
        type: 'redact',
        name: `Redaction Area #${annotations.filter(a => a.type === 'redact').length + 1}`,
        x,
        y,
        width: w,
        height: h,
        strokeColor,
        fillColor: redactStyle === 'whiteout' ? '#ffffff' : '#000000',
        strokeWidth,
        opacity: 1,
        rotation: 0,
        text: redactStyle === 'custom-text' ? redactText : (redactStyle === 'whiteout' ? '' : '[REDACTED]'),
        fontSize: 14,
        redactStyle,
        isVisible: true,
      };
      setAnnotations(prev => [...prev, newAnnot]);
      setSelectedId(id);
    } else if (activeTool === 'text') {
      const w = Math.max(15, Math.abs(coords.x - drawStart.x) || 25);
      const h = Math.max(4, Math.abs(coords.y - drawStart.y) || 6);

      const newAnnot: AnnotationItem = {
        id,
        pageIndex,
        type: 'text',
        name: `Text Box`,
        x: Math.min(drawStart.x, coords.x),
        y: Math.min(drawStart.y, coords.y),
        width: w,
        height: h,
        strokeColor: 'transparent',
        fillColor: fillColor || 'transparent',
        strokeWidth: 0,
        opacity,
        rotation: 0,
        text: '',
        fontSize,
        textColor: textColor || '#000000',
        fontFamily: fontFamily || 'sans-serif',
        textAlign,
        isBold,
        isItalic,
        isVisible: true,
      };
      setAnnotations(prev => [...prev, newAnnot]);
      setSelectedId(id);
      setEditingTextId(id);
    } else if (activeTool === 'highlight') {
      const x = Math.min(drawStart.x, coords.x);
      const y = Math.min(drawStart.y, coords.y);
      const w = Math.max(3, Math.abs(coords.x - drawStart.x));
      const h = Math.max(1.5, Math.abs(coords.y - drawStart.y));

      const newAnnot: AnnotationItem = {
        id,
        pageIndex,
        type: 'highlight',
        name: `Highlight`,
        x,
        y,
        width: w,
        height: h,
        strokeColor: 'transparent',
        fillColor: '#facc15', // Vibrant yellow highlight
        strokeWidth: 0,
        opacity: 0.45,
        rotation: 0,
        isVisible: true,
      };
      setAnnotations(prev => [...prev, newAnnot]);
      setSelectedId(id);
    } else if (activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'line' || activeTool === 'arrow') {
      const x = Math.min(drawStart.x, coords.x);
      const y = Math.min(drawStart.y, coords.y);
      const w = Math.max(2, Math.abs(coords.x - drawStart.x));
      const h = Math.max(2, Math.abs(coords.y - drawStart.y));

      const typeName = activeTool.charAt(0).toUpperCase() + activeTool.slice(1);
      const newAnnot: AnnotationItem = {
        id,
        pageIndex,
        type: activeTool,
        name: `New ${typeName}`,
        x,
        y,
        width: w,
        height: h,
        strokeColor: strokeColor === 'transparent' ? '#ef4444' : strokeColor,
        fillColor: activeTool === 'line' || activeTool === 'arrow' ? 'transparent' : fillColor,
        strokeWidth: strokeWidth || 2,
        opacity,
        rotation: rotation || 0,
        points: [drawStart, coords],
        isVisible: true,
      };
      setAnnotations(prev => [...prev, newAnnot]);
      setSelectedId(id);
    }

    setDrawStart(null);
    setDraftBox(null);
    if (activeTool !== 'redact') setActiveTool('select');
  };

  // Initiate item Move drag
  const startMoveDrag = (e: React.MouseEvent, item: AnnotationItem, pageRect: DOMRect) => {
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
    if (editingTextId === item.id) return;
    e.stopPropagation();
    setCurrentPage(item.pageIndex);
    setSelectedId(item.id);

    if (activeTool !== 'select') return;

    setDragState({
      type: 'move',
      itemId: item.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      initialX: item.x,
      initialY: item.y,
      initialW: item.width,
      initialH: item.height,
      pageRect,
    });
  };

  // Initiate item Resize drag
  const startResizeDrag = (e: React.MouseEvent, item: AnnotationItem, handle: 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'bm' | 'ml' | 'mr', pageRect: DOMRect) => {
    e.stopPropagation();
    setDragState({
      type: 'resize',
      itemId: item.id,
      handle,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      initialX: item.x,
      initialY: item.y,
      initialW: item.width,
      initialH: item.height,
      pageRect,
    });
  };

  // Initiate item Rotate drag
  const startRotateDrag = (e: React.MouseEvent, item: AnnotationItem, pageRect: DOMRect) => {
    e.stopPropagation();
    setDragState({
      type: 'rotate',
      itemId: item.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      initialX: item.x,
      initialY: item.y,
      initialW: item.width,
      initialH: item.height,
      pageRect,
    });
  };

  // Reorder items in layer panel
  const moveLayer = (id: string, direction: 'up' | 'down') => {
    setAnnotations(prev => {
      const index = prev.findIndex(a => a.id === id);
      if (index < 0) return prev;
      const targetIndex = direction === 'up' ? index + 1 : index - 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const newArr = [...prev];
      const temp = newArr[index];
      newArr[index] = newArr[targetIndex];
      newArr[targetIndex] = temp;
      return newArr;
    });
  };

  const deleteAnnotation = (id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editingTextId === id) setEditingTextId(null);
  };

  const removeAllAnnotations = () => {
    setShowRemoveAllConfirm(true);
  };

  // Helper to render multi-line and word-wrapped text on HTML5 canvas accurately matching CSS layout
  const drawWrappedText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    align: 'left' | 'center' | 'right'
  ) => {
    const paragraphs = text.split('\n');
    let currentY = y;

    for (const para of paragraphs) {
      if (!para.trim()) {
        currentY += lineHeight;
        continue;
      }
      const words = para.split(' ');
      let currentLine = '';

      for (let n = 0; n < words.length; n++) {
        const testLine = currentLine + (currentLine ? ' ' : '') + words[n];
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;

        if (testWidth > maxWidth && n > 0) {
          let drawX = x;
          if (align === 'center') drawX = x + maxWidth / 2;
          else if (align === 'right') drawX = x + maxWidth;

          ctx.fillText(currentLine, drawX, currentY);
          currentLine = words[n];
          currentY += lineHeight;
        } else {
          currentLine = testLine;
        }
      }

      let drawX = x;
      if (align === 'center') drawX = x + maxWidth / 2;
      else if (align === 'right') drawX = x + maxWidth;

      ctx.fillText(currentLine, drawX, currentY);
      currentY += lineHeight;
    }
  };

  // Save changes & download edited/redacted PDF
  const handleSaveChanges = async () => {
    if (!hasDocumentChanges) {
      setShowNoAnnotsWarning(true);
      return;
    }

    setSaving(true);
    try {
      await document.fonts?.ready;
      const origBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(origBuffer);
      const pages = pdfDoc.getPages();
      const secureRedaction = mode === 'redact';
      const outputPdf = secureRedaction ? await PDFDocument.create() : pdfDoc;
      const sourceLoadingTask = secureRedaction
        ? pdfjsLib.getDocument({ data: new Uint8Array(origBuffer.slice(0)), verbosity: 0 })
        : null;
      const sourcePdf = sourceLoadingTask ? await sourceLoadingTask.promise : null;

      for (let pIdx = 0; pIdx < pages.length; pIdx++) {
        const pageAnnots = annotations.filter(a => a.pageIndex === pIdx && a.isVisible);
        const hasWatermark = watermarkPages.includes(pIdx);
        const hasPatternWatermark = patternWatermarkPages.includes(pIdx);
        if (pageAnnots.length === 0 && !hasWatermark && !hasPatternWatermark && !secureRedaction) continue;

        const page = pages[pIdx];
        const { width: pWidth, height: pHeight } = page.getSize();

        // Calculate exact scale factor between Preview Canvas display pixels and PDF points
        const displayWidth = (pageDimensions[pIdx] && pageDimensions[pIdx].width) ? pageDimensions[pIdx].width : (pWidth * 1.6);
        const scaleFactor = pWidth / displayWidth;

        const scale = 3;
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(pWidth * scale);
        canvas.height = Math.floor(pHeight * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        // Redaction exports are flattened page images. This permanently removes
        // covered source text and objects instead of leaving them extractable.
        if (sourcePdf) {
          const sourcePage = await sourcePdf.getPage(pIdx + 1);
          const sourceViewport = sourcePage.getViewport({ scale });
          const sourceCanvas = document.createElement('canvas');
          sourceCanvas.width = Math.floor(sourceViewport.width);
          sourceCanvas.height = Math.floor(sourceViewport.height);
          const sourceContext = sourceCanvas.getContext('2d');
          if (!sourceContext) throw new Error('Could not render a source PDF page.');
          await (sourcePage.render as any)({ canvasContext: sourceContext, viewport: sourceViewport, canvas: sourceCanvas }).promise;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
        }

        ctx.scale(scale, scale);

        if (hasWatermark) {
          ctx.save();
          ctx.globalAlpha = watermarkOpacity / 100;
          ctx.fillStyle = watermarkColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `bold ${watermarkFontSize}px sans-serif`;
          ctx.translate(pWidth / 2, pHeight / 2);
          ctx.rotate((watermarkRotation * Math.PI) / 180);
          ctx.fillText(watermarkText || 'WATERMARK', 0, 0, pWidth * 0.8);
          ctx.restore();
        }

        if (hasPatternWatermark) {
          ctx.save();
          ctx.globalAlpha = patternWatermarkOpacity / 100;
          ctx.fillStyle = patternWatermarkColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `bold ${patternWatermarkFontSize}px sans-serif`;
          for (const position of getWatermarkPatternPositions(watermarkDensity)) {
            ctx.save();
            ctx.translate(pWidth * position.x / 100, pHeight * position.y / 100);
            ctx.rotate((patternWatermarkRotation * Math.PI) / 180);
            ctx.fillText(patternWatermarkText || 'WATERMARK', 0, 0, pWidth / watermarkDensity * 0.9);
            ctx.restore();
          }
          ctx.restore();
        }

        for (const item of pageAnnots) {
          ctx.save();
          ctx.globalAlpha = item.opacity;

          const cx = (item.x / 100) * pWidth + ((item.width / 100) * pWidth) / 2;
          const cy = (item.y / 100) * pHeight + ((item.height / 100) * pHeight) / 2;

          if (item.rotation !== 0) {
            ctx.translate(cx, cy);
            ctx.rotate((item.rotation * Math.PI) / 180);
            ctx.translate(-cx, -cy);
          }

          const rx = (item.x / 100) * pWidth;
          const ry = (item.y / 100) * pHeight;
          const rw = (item.width / 100) * pWidth;
          const rh = (item.height / 100) * pHeight;
          const scaledStrokeWidth = Math.max(1, item.strokeWidth * scaleFactor);

          const hasStroke = Boolean(
            item.strokeColor &&
            item.strokeColor !== 'transparent' &&
            item.strokeColor !== 'none' &&
            item.strokeWidth > 0
          );
          const hasFill = Boolean(
            item.fillColor &&
            item.fillColor !== 'transparent' &&
            item.fillColor !== 'none'
          );

          if (item.type === 'redact') {
            ctx.fillStyle = item.redactStyle === 'whiteout' ? '#ffffff' : (item.fillColor || '#000000');
            ctx.fillRect(rx, ry, rw, rh);

            if (hasStroke) {
              ctx.lineWidth = scaledStrokeWidth;
              ctx.strokeStyle = item.strokeColor;
              ctx.strokeRect(rx, ry, rw, rh);
            }

            if (item.text && item.redactStyle !== 'whiteout') {
              ctx.fillStyle = '#ffffff';
              ctx.font = `bold ${Math.max(10, Math.min(20, Math.floor(rh * 0.5)))}px monospace`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(item.text, rx + rw / 2, ry + rh / 2);
            }
          } else if (item.type === 'rectangle') {
            if (hasFill) {
              ctx.fillStyle = item.fillColor;
              ctx.fillRect(rx, ry, rw, rh);
            }
            if (hasStroke) {
              ctx.lineWidth = scaledStrokeWidth;
              ctx.strokeStyle = item.strokeColor;
              ctx.strokeRect(rx, ry, rw, rh);
            }
          } else if (item.type === 'circle') {
            ctx.beginPath();
            ctx.ellipse(rx + rw / 2, ry + rh / 2, rw / 2, rh / 2, 0, 0, 2 * Math.PI);
            if (hasFill) {
              ctx.fillStyle = item.fillColor;
              ctx.fill();
            }
            if (hasStroke) {
              ctx.lineWidth = scaledStrokeWidth;
              ctx.strokeStyle = item.strokeColor;
              ctx.stroke();
            }
          } else if (item.type === 'line' || item.type === 'arrow') {
            ctx.lineWidth = scaledStrokeWidth;
            ctx.strokeStyle = hasStroke ? item.strokeColor : '#ef4444';
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx + rw, ry + rh);
            ctx.stroke();

            if (item.type === 'arrow') {
              const angle = Math.atan2(rh, rw);
              const headLen = Math.max(8, scaledStrokeWidth * 4);
              ctx.fillStyle = hasStroke ? item.strokeColor : '#ef4444';
              ctx.beginPath();
              ctx.moveTo(rx + rw, ry + rh);
              ctx.lineTo(
                rx + rw - headLen * Math.cos(angle - Math.PI / 6),
                ry + rh - headLen * Math.sin(angle - Math.PI / 6)
              );
              ctx.lineTo(
                rx + rw - headLen * Math.cos(angle + Math.PI / 6),
                ry + rh - headLen * Math.sin(angle + Math.PI / 6)
              );
              ctx.closePath();
              ctx.fill();
            }
          } else if (item.type === 'text') {
            if (hasFill) {
              ctx.fillStyle = item.fillColor;
              ctx.fillRect(rx, ry, rw, rh);
            }
            if (hasStroke) {
              ctx.strokeStyle = item.strokeColor;
              ctx.lineWidth = scaledStrokeWidth;
              ctx.strokeRect(rx, ry, rw, rh);
            }
            ctx.fillStyle = item.textColor || '#000000';
            const fontFam = item.fontFamily === 'serif' ? 'Georgia, serif' : (item.fontFamily === 'monospace' ? 'Courier New, monospace' : 'Inter, sans-serif');
            const fontStyle = `${item.isItalic ? 'italic ' : ''}${item.isBold ? 'bold ' : ''}`;
            const fSize = Math.max(6, (item.fontSize || 16) * scaleFactor);
            const pad = Math.max(2, 4 * scaleFactor);
            const maxW = Math.max(10, rw - pad * 2);

            ctx.font = `${fontStyle}${fSize}px ${fontFam}`;
            ctx.textBaseline = 'top';

            const align = item.textAlign || 'left';
            drawWrappedText(ctx, item.text || '', rx + pad, ry + pad, maxW, fSize * 1.25, align);
          } else if (item.type === 'highlight') {
            ctx.fillStyle = item.fillColor || '#facc15';
            ctx.fillRect(rx, ry, rw, rh);
          } else if (item.type === 'stamp') {
            // Background fill
            ctx.fillStyle = item.fillColor || 'rgba(22, 163, 74, 0.1)';
            ctx.fillRect(rx, ry, rw, rh);

            // Double border stamp frame
            ctx.strokeStyle = item.strokeColor || '#16a34a';
            ctx.lineWidth = Math.max(2, 3 * scaleFactor);
            ctx.strokeRect(rx, ry, rw, rh);

            ctx.lineWidth = Math.max(1, 1 * scaleFactor);
            ctx.strokeRect(rx + 3 * scaleFactor, ry + 3 * scaleFactor, rw - 6 * scaleFactor, rh - 6 * scaleFactor);

            // Stamp text
            ctx.fillStyle = item.strokeColor || '#16a34a';
            const stampFontSize = item.fontSize
              ? Math.max(8, item.fontSize * scaleFactor)
              : getAutoStampFontSize(item.text || item.stampType || 'APPROVED', rw, rh);
            ctx.font = `bold ${stampFontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.text || item.stampType || 'APPROVED', rx + rw / 2, ry + rh / 2);
          } else if (item.type === 'signature') {
            // Signature background card
            if (hasFill) {
              ctx.fillStyle = item.fillColor;
              ctx.fillRect(rx, ry, rw, rh);
            }
            if (hasStroke) {
              ctx.strokeStyle = item.strokeColor;
              ctx.lineWidth = scaledStrokeWidth;
              ctx.strokeRect(rx, ry, rw, rh);
            }

            // Cursive / Calligraphic Signer Name
            ctx.fillStyle = item.strokeColor || '#2563eb';
            const sigFontSize = item.fontSize
              ? Math.max(8, item.fontSize * scaleFactor)
              : getAutoSignatureFontSize(item.signerName || 'Verified Signature', rw, rh);
            ctx.font = `italic 600 ${sigFontSize}px "Brush Script MT", "Caveat", "Segoe Script", cursive, sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.signerName || 'Verified Signature', rx + 12 * scaleFactor, ry + rh * 0.38);

            // Verified subline
            ctx.fillStyle = '#64748b';
            ctx.font = `bold ${Math.max(7, sigFontSize * 0.45)}px monospace`;
            const dateDisplay = item.signDate || new Date().toLocaleDateString();
            ctx.fillText(`✓ DIGITALLY SIGNED · ${dateDisplay}`, rx + 12 * scaleFactor, ry + rh * 0.75);
          }

          ctx.restore();
        }

        const pngUrl = canvas.toDataURL('image/png');
        const pngImg = await outputPdf.embedPng(pngUrl);
        const outputPage = secureRedaction ? outputPdf.addPage([pWidth, pHeight]) : page;
        outputPage.drawImage(pngImg, {
          x: 0,
          y: 0,
          width: pWidth,
          height: pHeight,
        });
      }

      await sourceLoadingTask?.destroy();

      const pdfBytes = await outputPdf.save({ useObjectStreams: true });
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mode === 'redact' ? `redacted_${file.name}` : `edited_${file.name}`;
      a.click();
      URL.revokeObjectURL(url);

      if (onSaveSuccess) onSaveSuccess();
    } catch (err: any) {
      console.error('Error saving edited PDF:', err);
      setErrorMessage(`Failed to save document: ${err?.message || 'Please check console for details and try again.'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pdf-editor flex flex-col rounded-2xl border border-[var(--border-color)] bg-[var(--surface-color)] text-[var(--text-primary)] shadow-xl overflow-hidden select-none min-h-[calc(100vh-140px)]">
      {errorMessage && (
        <div className="pdf-editor__error p-3 bg-zinc-950/80 border-b border-zinc-800">
          <ErrorBanner 
            message={errorMessage} 
            onDismiss={() => setErrorMessage(null)} 
            onRetry={handleSaveChanges} 
          />
        </div>
      )}

      {/* Top Main Toolbar */}
      <EditorCommandBar className="pdf-editor__toolbar px-4 py-2.5 justify-between gap-3 sticky top-0 z-30 overflow-x-auto flex-nowrap scrollbar-thin">
        <div className="pdf-editor__document shrink-0" title={file.name}>
          <FileText aria-hidden="true" />
          <span>
            <strong>{file.name}</strong>
            <small>{numPages || pageImages.length || 1} {(numPages || pageImages.length) === 1 ? 'page' : 'pages'} · Local document</small>
          </span>
        </div>
        <div className="pdf-editor__duplicate-tools flex items-center gap-2 shrink-0" aria-hidden="true">
          {/* Mode Switcher */}
          <div className="bg-[var(--surface-color)] border border-[var(--border-color)] rounded-xl p-1 flex items-center gap-1 shrink-0">
            <button
              onClick={() => { setActiveTool('select'); setEditingTextId(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTool === 'select'
                  ? 'bg-white text-zinc-950 font-bold shadow-sm border border-white'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>Select / Move</span>
            </button>

            {mode === 'redact' && (
              <button
                onClick={() => { setActiveTool('redact'); setEditingTextId(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTool === 'redact'
                    ? 'bg-white text-zinc-950 font-bold shadow-sm border border-white'
                    : 'text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Redact Box</span>
              </button>
            )}

            <button
              onClick={() => { setActiveTool('text'); setEditingTextId(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTool === 'text'
                  ? 'bg-white text-zinc-950 font-bold shadow-sm border border-white'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Add Text</span>
            </button>
          </div>

          <div className="h-6 w-px bg-[var(--border-color)] mx-0.5 hidden sm:block shrink-0" />

          {/* Vector Shapes Toolbar */}
          <div className="flex items-center gap-1 bg-[var(--surface-color)] p-1 rounded-xl border border-[var(--border-color)] shrink-0">
            <button
              title="Highlighter"
              onClick={() => { setActiveTool('highlight'); setEditingTextId(null); }}
              className={`p-1.5 rounded-lg transition cursor-pointer ${activeTool === 'highlight' ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm' : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-hover)]'}`}
            >
              <Highlighter className="w-4 h-4" />
            </button>
            <button
              title="Rectangle Shape"
              onClick={() => { setActiveTool('rectangle'); setEditingTextId(null); }}
              className={`p-1.5 rounded-lg transition cursor-pointer ${activeTool === 'rectangle' ? 'bg-white text-zinc-950 font-bold shadow-sm' : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-hover)]'}`}
            >
              <Square className="w-4 h-4" />
            </button>
            <button
              title="Circle / Ellipse Shape"
              onClick={() => { setActiveTool('circle'); setEditingTextId(null); }}
              className={`p-1.5 rounded-lg transition cursor-pointer ${activeTool === 'circle' ? 'bg-white text-zinc-950 font-bold shadow-sm' : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-hover)]'}`}
            >
              <Circle className="w-4 h-4" />
            </button>
            <button
              title="Straight Line"
              onClick={() => { setActiveTool('line'); setEditingTextId(null); }}
              className={`p-1.5 rounded-lg transition cursor-pointer ${activeTool === 'line' ? 'bg-white text-zinc-950 font-bold shadow-sm' : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-hover)]'}`}
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              title="Arrow Line"
              onClick={() => { setActiveTool('arrow'); setEditingTextId(null); }}
              className={`p-1.5 rounded-lg transition cursor-pointer ${activeTool === 'arrow' ? 'bg-white text-zinc-950 font-bold shadow-sm' : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-hover)]'}`}
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="h-6 w-px bg-[var(--border-color)] mx-0.5 hidden sm:block shrink-0" />

          {/* Quick Document Elements (Stamps, Digital Signatures, Watermark) */}
          <div className="flex items-center gap-1 bg-[var(--surface-color)] p-1 rounded-xl border border-[var(--border-color)] shrink-0">
            <Select onValueChange={val => {
              const p = STAMP_PRESETS.find(preset => preset.label === val);
              if (p) addStampItem(p);
            }}>
              <SelectTrigger className="h-8 w-auto min-w-0 text-xs font-semibold px-2.5 bg-transparent border-none text-[var(--text-secondary)] hover:text-white cursor-pointer shadow-none focus-visible:ring-0">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <Stamp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Stamp</span>
                </span>
              </SelectTrigger>
              <SelectContent>
                {STAMP_PRESETS.map(p => (
                  <SelectItem key={p.label} value={p.label} className="cursor-pointer">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="font-bold text-xs">{p.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              type="button"
              onClick={() => addSignatureItem()}
              className="h-8 px-2.5 text-xs font-semibold flex items-center gap-1.5 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-hover)] transition cursor-pointer whitespace-nowrap shrink-0"
              title="Insert Digital Signature"
            >
              <Signature className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Signature</span>
            </button>

            <button
              type="button"
              onClick={toggleWatermark}
              className="h-8 px-2.5 text-xs font-semibold flex items-center gap-1.5 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-hover)] transition cursor-pointer whitespace-nowrap shrink-0"
              title="Insert Diagonal Watermark"
            >
              <span className="font-bold text-rose-400 text-xs">WM</span>
              <span>Watermark</span>
            </button>
          </div>
        </div>

        {/* Selected Element Controls */}
        {mode === 'redact' && activeTool === 'redact' && !selectedItem && (
          <div className="pdf-editor__top-redaction pdf-editor__properties" aria-label="New redaction settings">
            <span className="pdf-editor__property-label" title="Redaction style"><Shield aria-hidden="true" /><span className="sr-only">Redaction style</span></span>
            <button
              onClick={() => setRedactStyle('blackout')}
              aria-pressed={redactStyle === 'blackout'}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${redactStyle === 'blackout' ? 'bg-white text-zinc-950 font-bold shadow-sm' : 'text-[var(--text-secondary)] hover:text-white'}`}
            >
              Black
            </button>
            <button
              onClick={() => setRedactStyle('whiteout')}
              aria-pressed={redactStyle === 'whiteout'}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${redactStyle === 'whiteout' ? 'bg-white text-zinc-950 font-bold shadow-sm' : 'text-[var(--text-secondary)] hover:text-white'}`}
            >
              White
            </button>
            <button
              onClick={() => setRedactStyle('custom-text')}
              aria-pressed={redactStyle === 'custom-text'}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${redactStyle === 'custom-text' ? 'bg-white text-zinc-950 font-bold shadow-sm' : 'text-[var(--text-secondary)] hover:text-white'}`}
            >
              Label
            </button>
            {redactStyle === 'custom-text' && (
              <input
                type="text"
                value={redactText}
                placeholder="Label text..."
                onChange={e => setRedactText(e.target.value)}
                className="bg-transparent border border-[var(--border-color)] px-2 py-0.5 rounded text-xs text-[var(--text-primary)] w-28 font-mono"
              />
            )}
            <div className="pdf-editor__redaction-border" title="Border for new redactions">
              <Square aria-hidden="true" />
              <span className="sr-only">Border</span>
              <input type="color" value={strokeColor === 'transparent' ? '#000000' : strokeColor} onChange={event => setStrokeColor(event.target.value)} aria-label="Redaction border color" />
              <button type="button" aria-pressed={strokeWidth > 0} onClick={() => setStrokeWidth(previous => previous > 0 ? 0 : 1)}>{strokeWidth > 0 ? 'Solid' : 'None'}</button>
              {strokeWidth > 0 && <input className="pdf-editor__property-number" type="number" min="1" max="12" value={strokeWidth} onChange={event => setStrokeWidth(Math.min(12, Math.max(1, Number(event.target.value) || 1)))} aria-label="Redaction border thickness" />}
            </div>
            <span className="pdf-editor__redaction-security"><ShieldAlert className="w-3.5 h-3.5" />Permanent on export</span>
          </div>
        )}

        {selectedItem && selectedItem.type === 'redact' && (
          <div className="pdf-editor__properties flex items-center gap-2.5 bg-[var(--surface-color)] border border-[var(--border-color)] px-3 py-1.5 rounded-xl text-xs shadow-sm flex-wrap">
            <Shield aria-hidden="true" />
            <span className="sr-only">Redaction style</span>
            <div className="flex items-center gap-1 bg-[var(--surface-hover)] p-0.5 rounded-lg border border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => updateSelectedItem({ redactStyle: 'blackout', fillColor: '#000000', text: '[REDACTED]' })}
                aria-pressed={selectedItem.redactStyle !== 'whiteout' && selectedItem.redactStyle !== 'custom-text'}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  selectedItem.redactStyle !== 'whiteout' && selectedItem.redactStyle !== 'custom-text'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                Black
              </button>
              <button
                type="button"
                onClick={() => updateSelectedItem({ redactStyle: 'whiteout', fillColor: '#ffffff', text: '' })}
                aria-pressed={selectedItem.redactStyle === 'whiteout'}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  selectedItem.redactStyle === 'whiteout'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                White
              </button>
              <button
                type="button"
                onClick={() => updateSelectedItem({ redactStyle: 'custom-text', text: selectedItem.text && selectedItem.text !== '[REDACTED]' ? selectedItem.text : 'CONFIDENTIAL' })}
                aria-pressed={selectedItem.redactStyle === 'custom-text'}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  selectedItem.redactStyle === 'custom-text'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                Label
              </button>
            </div>

            {selectedItem.redactStyle === 'custom-text' && (
              <input
                type="text"
                value={selectedItem.text || ''}
                placeholder="Label text..."
                onChange={e => updateSelectedItem({ text: e.target.value })}
                className="bg-[var(--surface-hover)] border border-[var(--border-color)] px-2 py-1 rounded-lg text-xs text-[var(--text-primary)] w-32 font-mono font-bold"
              />
            )}

            <div className="w-px h-4 bg-[var(--border-color)]" />

            {/* Redaction Fill Color */}
            <div className="flex items-center gap-1.5" title="Redaction Fill Color">
              <Highlighter aria-hidden="true" />
              <span className="sr-only">Redaction color</span>
              <div className="flex items-center gap-1 bg-[var(--surface-hover)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">
                <input
                  type="color"
                  value={selectedItem.fillColor || (selectedItem.redactStyle === 'whiteout' ? '#ffffff' : '#000000')}
                  onChange={e => updateSelectedItem({ fillColor: e.target.value })}
                  className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 p-0"
                />
                <span className="font-mono text-[10px] font-bold text-[var(--text-primary)] uppercase">
                  {selectedItem.fillColor || (selectedItem.redactStyle === 'whiteout' ? '#FFFFFF' : '#000000')}
                </span>
              </div>
              {hasEyeDropper && (
                <button
                  onClick={() => pickColorFromPage('fill')}
                  className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-white transition cursor-pointer"
                  title="Pick Fill Color from Page"
                >
                  <Pipette className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="w-px h-4 bg-[var(--border-color)]" />

            <div className="pdf-editor__redaction-border" title="Redaction border">
              <Square aria-hidden="true" />
              <span className="sr-only">Border</span>
              <input
                type="color"
                value={selectedItem.strokeColor === 'transparent' ? '#000000' : selectedItem.strokeColor}
                onChange={event => updateSelectedItem({ strokeColor: event.target.value })}
                aria-label="Redaction border color"
              />
              <button type="button" aria-pressed={selectedItem.strokeWidth > 0} onClick={() => updateSelectedItem({ strokeWidth: selectedItem.strokeWidth > 0 ? 0 : 1 })}>
                {selectedItem.strokeWidth > 0 ? 'Solid' : 'None'}
              </button>
              {selectedItem.strokeWidth > 0 && (
                <>
                  <input className="pdf-editor__property-number" type="number" min="1" max="12" value={selectedItem.strokeWidth} onChange={event => updateSelectedItem({ strokeWidth: Math.min(12, Math.max(1, Number(event.target.value) || 1)) })} aria-label="Redaction border thickness" />
                  <span className="pdf-editor__property-unit">px</span>
                </>
              )}
            </div>

            <div className="w-px h-4 bg-[var(--border-color)]" />

            {/* Opacity */}
            <div className="flex items-center gap-1.5" title="Opacity">
              <Eye aria-hidden="true" />
              <span className="sr-only">Opacity</span>
              <input className="pdf-editor__property-number" type="number" min="10" max="100" step="5" value={Math.round(selectedItem.opacity * 100)} onChange={e => updateSelectedItem({ opacity: Math.min(100, Math.max(10, Number(e.target.value) || 10)) / 100 })} />
              <span className="pdf-editor__property-unit">%</span>
            </div>

            <div className="w-px h-4 bg-[var(--border-color)]" />

            {/* Delete button */}
            <button
              onClick={() => deleteAnnotation(selectedItem.id)}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              title="Delete Selected Redaction (Delete / Backspace)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {selectedItem && selectedItem.type !== 'redact' && (
          <div className="pdf-editor__properties flex items-center gap-2.5 bg-[var(--surface-color)] border border-[var(--border-color)] px-3 py-1.5 rounded-xl text-xs shadow-sm flex-wrap">
            {(selectedItem.type === 'stamp' || selectedItem.type === 'signature') && (
              <>
                <div className="pdf-editor__property-command" title={`${selectedItem.type === 'stamp' ? 'Stamp' : 'Signature'} font size`}>
                  <Type aria-hidden="true" />
                  <input
                    className="pdf-editor__property-number"
                    type="number"
                    min="8"
                    max="144"
                    value={Math.round(selectedItem.fontSize ?? (
                      selectedItem.type === 'stamp'
                        ? getAutoStampFontSize(selectedItem.text || selectedItem.stampType || 'APPROVED', (pageDimensions[selectedItem.pageIndex]?.width || 1000) * selectedItem.width / 100, (pageDimensions[selectedItem.pageIndex]?.height || 1400) * selectedItem.height / 100)
                        : getAutoSignatureFontSize(selectedItem.signerName || 'Verified Signature', (pageDimensions[selectedItem.pageIndex]?.width || 1000) * selectedItem.width / 100, (pageDimensions[selectedItem.pageIndex]?.height || 1400) * selectedItem.height / 100)
                    ))}
                    aria-label={`${selectedItem.type === 'stamp' ? 'Stamp' : 'Signature'} font size`}
                    onChange={event => updateSelectedItem({ fontSize: Math.min(144, Math.max(8, Number(event.target.value) || 8)) })}
                  />
                  <span className="pdf-editor__property-unit">pt</span>
                </div>
                <button
                  type="button"
                  className="pdf-editor__auto-size"
                  aria-pressed={selectedItem.fontSize === undefined}
                  onClick={() => updateSelectedItem({ fontSize: undefined })}
                  title="Automatically fit text to the element"
                >
                  <RefreshCw aria-hidden="true" />
                  <span>Auto</span>
                </button>
                <div className="w-px h-4 bg-[var(--border-color)]" />
              </>
            )}
            {/* Text Specific Formatting */}
            {selectedItem.type === 'text' && (
              <>
                <div className="flex items-center gap-1" title="Font Family">
                  <Type aria-hidden="true" />
                  <span className="sr-only">Font family</span>
                  <Select
                    value={selectedItem.fontFamily || 'sans-serif'}
                    onValueChange={val => val && updateSelectedItem({ fontFamily: val })}
                  >
                    <SelectTrigger className="w-[110px] h-7 text-xs bg-[var(--surface-hover)] border-[var(--border-color)] text-[var(--text-primary)] font-bold rounded-lg cursor-pointer">
                      <SelectValue>{selectedItem.fontFamily || 'sans-serif'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sans-serif">Sans-Serif</SelectItem>
                      <SelectItem value="serif">Serif</SelectItem>
                      <SelectItem value="monospace">Monospace</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1" title="Font Size">
                  <Type aria-hidden="true" />
                  <span className="sr-only">Font size</span>
                  <Select
                    value={String(selectedItem.fontSize || 16)}
                    onValueChange={val => val && updateSelectedItem({ fontSize: Number(val) })}
                  >
                    <SelectTrigger className="w-[85px] h-7 text-xs bg-[var(--surface-hover)] border-[var(--border-color)] text-[var(--text-primary)] font-bold rounded-lg cursor-pointer">
                      <SelectValue>{`${selectedItem.fontSize || 16}px`}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64].map(s => (
                        <SelectItem key={s} value={String(s)}>{s}px</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Font Color */}
                <div className="flex items-center gap-1.5" title="Font Color">
                  <Pipette aria-hidden="true" />
                  <span className="sr-only">Text color</span>
                  <div className="flex items-center gap-1 bg-[var(--surface-hover)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">
                    <input
                      type="color"
                      value={selectedItem.textColor || '#000000'}
                      onChange={e => updateSelectedItem({ textColor: e.target.value })}
                      className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span className="font-mono text-[10px] font-bold text-[var(--text-primary)] uppercase">
                      {selectedItem.textColor || '#000000'}
                    </span>
                  </div>
                  {hasEyeDropper && (
                    <button
                      onClick={() => pickColorFromPage('text')}
                      className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-white transition cursor-pointer"
                      title="Pick Font Color from Page (Eyedropper)"
                    >
                      <Pipette className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-0.5 bg-[var(--surface-hover)] p-0.5 rounded border border-[var(--border-color)]">
                  <button
                    onClick={() => updateSelectedItem({ isBold: !selectedItem.isBold })}
                    aria-pressed={Boolean(selectedItem.isBold)}
                    className={`p-1 rounded transition cursor-pointer ${selectedItem.isBold ? 'bg-white text-zinc-950 font-bold' : 'text-[var(--text-secondary)]'}`}
                    title="Bold"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => updateSelectedItem({ isItalic: !selectedItem.isItalic })}
                    aria-pressed={Boolean(selectedItem.isItalic)}
                    className={`p-1 rounded transition cursor-pointer ${selectedItem.isItalic ? 'bg-white text-zinc-950 font-bold' : 'text-[var(--text-secondary)]'}`}
                    title="Italic"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-0.5 bg-[var(--surface-hover)] p-0.5 rounded border border-[var(--border-color)]">
                  <button
                    onClick={() => updateSelectedItem({ textAlign: 'left' })}
                    aria-pressed={selectedItem.textAlign === 'left' || !selectedItem.textAlign}
                    className={`p-1 rounded transition cursor-pointer ${selectedItem.textAlign === 'left' || !selectedItem.textAlign ? 'bg-white text-zinc-950 font-bold' : 'text-[var(--text-secondary)]'}`}
                    title="Align Left"
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => updateSelectedItem({ textAlign: 'center' })}
                    aria-pressed={selectedItem.textAlign === 'center'}
                    className={`p-1 rounded transition cursor-pointer ${selectedItem.textAlign === 'center' ? 'bg-white text-zinc-950 font-bold' : 'text-[var(--text-secondary)]'}`}
                    title="Align Center"
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => updateSelectedItem({ textAlign: 'right' })}
                    aria-pressed={selectedItem.textAlign === 'right'}
                    className={`p-1 rounded transition cursor-pointer ${selectedItem.textAlign === 'right' ? 'bg-white text-zinc-950 font-bold' : 'text-[var(--text-secondary)]'}`}
                    title="Align Right"
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="w-px h-4 bg-[var(--border-color)]" />
              </>
            )}

            {/* Stroke / Border Color with quick Solid / None toggle & Eyedropper */}
            <div className="flex items-center gap-1.5" title="Border Color">
              <Square aria-hidden="true" />
              <span className="sr-only">Border</span>
              <div className="flex items-center gap-1 bg-[var(--surface-hover)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">
                <input
                  type="color"
                  value={selectedItem.strokeColor === 'transparent' ? '#ffffff' : selectedItem.strokeColor}
                  onChange={e => updateSelectedItem({ strokeColor: e.target.value })}
                  className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 p-0"
                />
                <span className="font-mono text-[10px] font-bold text-[var(--text-primary)] uppercase">
                  {selectedItem.strokeColor === 'transparent' ? 'None' : selectedItem.strokeColor}
                </span>
              </div>
              {hasEyeDropper && (
                <button
                  onClick={() => pickColorFromPage('stroke')}
                  className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-white transition cursor-pointer"
                  title="Pick Border Color from Page (Eyedropper)"
                >
                  <Pipette className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => updateSelectedItem(selectedItem.strokeColor === 'transparent'
                  ? { strokeColor: selectedItem.lastStrokeColor || '#ffffff' }
                  : { lastStrokeColor: selectedItem.strokeColor, strokeColor: 'transparent' })}
                aria-pressed={selectedItem.strokeColor !== 'transparent'}
                className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase transition cursor-pointer ${
                  selectedItem.strokeColor === 'transparent'
                    ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                    : 'bg-white text-zinc-950 border border-white'
                }`}
              >
                {selectedItem.strokeColor === 'transparent' ? 'None' : 'Solid'}
              </button>
            </div>

            <div className="w-px h-4 bg-[var(--border-color)]" />

            {/* Fill / Background Color with quick Solid / Transp. toggle & Eyedropper */}
            {selectedItem.type !== 'line' && selectedItem.type !== 'arrow' && (
              <div className="flex items-center gap-1.5" title="Background Fill">
                <Highlighter aria-hidden="true" />
                <span className="sr-only">Fill</span>
                <div className="flex items-center gap-1 bg-[var(--surface-hover)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">
                  <input
                    type="color"
                    value={selectedItem.fillColor === 'transparent' ? '#ffffff' : selectedItem.fillColor}
                    onChange={e => updateSelectedItem({ fillColor: e.target.value })}
                    className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <span className="font-mono text-[10px] font-bold text-[var(--text-primary)] uppercase">
                    {selectedItem.fillColor === 'transparent' ? 'Transp.' : selectedItem.fillColor}
                  </span>
                </div>
                {hasEyeDropper && (
                  <button
                    onClick={() => pickColorFromPage('fill')}
                    className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-white transition cursor-pointer"
                    title="Pick Fill Color from Page (Eyedropper)"
                  >
                    <Pipette className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => updateSelectedItem(selectedItem.fillColor === 'transparent'
                    ? { fillColor: selectedItem.lastFillColor || '#ffffff' }
                    : { lastFillColor: selectedItem.fillColor, fillColor: 'transparent' })}
                  aria-pressed={selectedItem.fillColor !== 'transparent'}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase transition cursor-pointer ${
                    selectedItem.fillColor === 'transparent'
                      ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                      : 'bg-white text-zinc-950 border border-white'
                  }`}
                >
                  {selectedItem.fillColor === 'transparent' ? 'Transp.' : 'Solid'}
                </button>
              </div>
            )}

            {selectedItem.type !== 'text' && (
              <>
                <div className="w-px h-4 bg-[var(--border-color)]" />
                <div className="flex items-center gap-1.5" title="Thickness">
                  <Minus aria-hidden="true" />
                  <span className="sr-only">Thickness</span>
                  <input className="pdf-editor__property-number" type="number" min="1" max="20" value={selectedItem.strokeWidth} onChange={e => updateSelectedItem({ strokeWidth: Math.min(20, Math.max(1, Number(e.target.value) || 1)) })} />
                  <span className="pdf-editor__property-unit">px</span>
                </div>
              </>
            )}

            <div className="w-px h-4 bg-[var(--border-color)]" />

            {/* Opacity */}
            <div className="flex items-center gap-1.5" title="Opacity">
              <Eye aria-hidden="true" />
              <span className="sr-only">Opacity</span>
              <input className="pdf-editor__property-number" type="number" min="10" max="100" step="5" value={Math.round(selectedItem.opacity * 100)} onChange={e => updateSelectedItem({ opacity: Math.min(100, Math.max(10, Number(e.target.value) || 10)) / 100 })} />
              <span className="pdf-editor__property-unit">%</span>
            </div>

            <div className="w-px h-4 bg-[var(--border-color)]" />

            {/* Rotation */}
            <div className="flex items-center gap-1.5" title="Rotation Angle">
              <RotateCw className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <input className="pdf-editor__property-number" type="number" min="0" max="359" value={selectedItem.rotation} onChange={e => updateSelectedItem({ rotation: Math.min(359, Math.max(0, Number(e.target.value) || 0)) })} />
              <span className="pdf-editor__property-unit">°</span>
            </div>

            <div className="w-px h-4 bg-[var(--border-color)]" />

            {/* Delete button */}
            <button
              onClick={() => deleteAnnotation(selectedItem.id)}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              title="Delete Selected Element (Delete / Backspace)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {activeDocumentEffect && !selectedItem && (
          <div className="pdf-editor__watermark-toolbar" aria-label="Watermark properties">
            <div className="pdf-editor__ribbon-group pdf-editor__ribbon-group--content">
              <div className="pdf-editor__ribbon-row">
                <label className="pdf-editor__watermark-text" title="Watermark text">
                  <Type className="pdf-editor__ribbon-icon" aria-hidden="true" />
                  <span className="sr-only">Text</span>
                  <input
                    type="text"
                    value={activeDocumentEffect === 'pattern' ? patternWatermarkText : watermarkText}
                    maxLength={48}
                    aria-label="Watermark text"
                    onChange={event => activeDocumentEffect === 'pattern' ? setPatternWatermarkText(event.target.value) : setWatermarkText(event.target.value)}
                  />
                </label>
              </div>
              <div className="pdf-editor__ribbon-row">
                <label className="pdf-editor__ribbon-color" title="Watermark color">
                  <Pipette className="pdf-editor__ribbon-icon" aria-hidden="true" />
                  <span className="sr-only">Color</span>
                  <input
                    className="pdf-editor__watermark-color"
                    type="color"
                    value={activeDocumentEffect === 'pattern' ? patternWatermarkColor : watermarkColor}
                    aria-label="Watermark color"
                    onChange={event => activeDocumentEffect === 'pattern' ? setPatternWatermarkColor(event.target.value) : setWatermarkColor(event.target.value)}
                  />
                </label>
                {activeDocumentEffect === 'watermark' && (
                  <label title="Watermark font size">
                    <Type className="pdf-editor__ribbon-icon" aria-hidden="true" />
                    <span className="sr-only">Font size</span>
                    <input
                      className="pdf-editor__watermark-number"
                      type="number"
                      min="12"
                      max="144"
                      step="1"
                      value={watermarkFontSize}
                      aria-label="Watermark font size"
                      onChange={event => setWatermarkFontSize(Math.min(144, Math.max(12, Number(event.target.value) || 12)))}
                    />
                    <output>pt</output>
                  </label>
                )}
              </div>
              <small>{activeDocumentEffect === 'pattern' ? 'Pattern text' : 'Watermark text'}</small>
            </div>

            <div className="pdf-editor__ribbon-group">
              <div className="pdf-editor__ribbon-row">
                <label title="Watermark opacity">
                  <Eye className="pdf-editor__ribbon-icon" aria-hidden="true" />
                  <span className="sr-only">Opacity</span>
                  <input className="pdf-editor__watermark-number" type="number" min="5" max="60" value={activeDocumentEffect === 'pattern' ? patternWatermarkOpacity : watermarkOpacity} aria-label="Watermark opacity percentage" onChange={event => activeDocumentEffect === 'pattern' ? setPatternWatermarkOpacity(Math.min(60, Math.max(5, Number(event.target.value) || 5))) : setWatermarkOpacity(Math.min(60, Math.max(5, Number(event.target.value) || 5)))} />
                  <output>%</output>
                </label>
              </div>
              <div className="pdf-editor__ribbon-row">
                <label title="Watermark rotation">
                  <RotateCw className="pdf-editor__ribbon-icon" aria-hidden="true" />
                  <span className="sr-only">Angle</span>
                  <input className="pdf-editor__watermark-number" type="number" min="-180" max="180" step="5" value={activeDocumentEffect === 'pattern' ? patternWatermarkRotation : watermarkRotation} aria-label="Watermark rotation angle" onChange={event => activeDocumentEffect === 'pattern' ? setPatternWatermarkRotation(Math.min(180, Math.max(-180, Number(event.target.value) || 0))) : setWatermarkRotation(Math.min(180, Math.max(-180, Number(event.target.value) || 0)))} />
                  <output>°</output>
                </label>
              </div>
              <small>Appearance</small>
            </div>

            {activeDocumentEffect === 'pattern' && (
              <div className="pdf-editor__ribbon-group">
                <div className="pdf-editor__ribbon-row">
                  <label title="Pattern watermark font size">
                    <Type className="pdf-editor__ribbon-icon" aria-hidden="true" />
                    <span className="sr-only">Tile size</span>
                    <input
                      className="pdf-editor__watermark-number"
                      type="number"
                      min="6"
                      max="48"
                      step="1"
                      value={patternWatermarkFontSize}
                      aria-label="Pattern watermark font size"
                      onChange={event => setPatternWatermarkFontSize(Math.min(48, Math.max(6, Number(event.target.value) || 6)))}
                    />
                    <output>pt</output>
                  </label>
                </div>
                <div className="pdf-editor__ribbon-row">
                  <label title="Pattern spacing">
                    <Layers className="pdf-editor__ribbon-icon" aria-hidden="true" />
                    <span className="sr-only">Pattern spacing</span>
                    <input className="pdf-editor__watermark-number" type="number" min="2" max="6" value={watermarkDensity} aria-label="Pattern spacing" onChange={event => setWatermarkDensity(Math.min(6, Math.max(2, Number(event.target.value) || 2)))} />
                  </label>
                </div>
                <small>Pattern</small>
              </div>
            )}

            <button type="button" className="pdf-editor__watermark-done" onClick={() => setActiveDocumentEffect(null)} title="Finish watermark editing">
              <CheckCircle aria-hidden="true" />
              <span className="sr-only">Done</span>
            </button>
          </div>
        )}

        {/* Zoom Controls */}
        <WorkspaceZoomControls value={zoom} onChange={setZoom} min={40} max={200} />
      </EditorCommandBar>

      {/* Main Workspace (Viewport + Side Layer Panel) */}
      <div className="pdf-editor__workspace flex-1 flex overflow-hidden relative">
        {/* ═══ LEFT SIDEBAR (ImageTools Pattern) ═══ */}
        <EditorSidebar
          onClickCapture={() => {
            setActiveDocumentEffect(null);
            setSelectedId(null);
            setEditingTextId(null);
          }}
          className={`shrink-0 transition-[width] duration-200 ease-out select-none z-10 ${showToolDrawer ? 'w-64' : 'w-14'}`}
        >
          {!showToolDrawer ? (
            /* Collapsed Icon Rail with Tooltips */
            <div className="h-full flex flex-col items-center py-3 bg-[#18191e] justify-between w-full select-none">
              <div className="flex flex-col items-center gap-1.5 w-full px-2">
                {/* Expand button */}
                <button
                  type="button"
                  onClick={() => setShowToolDrawer(true)}
                  className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer mb-1"
                  title="Expand sidebar"
                >
                  <PanelLeft className="w-4 h-4" />
                </button>

                <div className="w-6 h-[1px] bg-white/10 mb-1" />

                {/* Canvas tool icons with hover tooltips */}
                <div className="flex flex-col items-center gap-1 w-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                  <button
                    type="button"
                    onClick={() => { setActiveTool('select'); setEditingTextId(null); }}
                    title="Select / Move (Click to activate)"
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer relative group ${
                      activeTool === 'select'
                        ? 'bg-white text-zinc-950 font-bold shadow-md'
                        : 'text-zinc-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <MousePointer className="w-4 h-4" />
                    <div className="absolute left-full ml-3 px-2.5 py-1 bg-zinc-900 border border-zinc-700/80 text-zinc-100 text-xs font-semibold rounded-md shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                      Select / Move
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTool('text'); setEditingTextId(null); }}
                    title="Add Text (Click to activate)"
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer relative group ${
                      activeTool === 'text'
                        ? 'bg-white text-zinc-950 font-bold shadow-md'
                        : 'text-zinc-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Type className="w-4 h-4" />
                    <div className="absolute left-full ml-3 px-2.5 py-1 bg-zinc-900 border border-zinc-700/80 text-zinc-100 text-xs font-semibold rounded-md shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                      Add Text
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTool('highlight'); setEditingTextId(null); }}
                    title="Highlighter (Click to activate)"
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer relative group ${
                      activeTool === 'highlight'
                        ? 'bg-amber-400 text-zinc-950 font-bold shadow-md'
                        : 'text-zinc-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Highlighter className="w-4 h-4" />
                    <div className="absolute left-full ml-3 px-2.5 py-1 bg-zinc-900 border border-zinc-700/80 text-zinc-100 text-xs font-semibold rounded-md shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                      Highlighter
                    </div>
                  </button>

                  <div className="w-5 h-[1px] bg-white/10 my-1" />

                  <button
                    type="button"
                    onClick={() => { setActiveTool('rectangle'); setEditingTextId(null); }}
                    title="Rectangle (Click to activate)"
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer relative group ${
                      activeTool === 'rectangle'
                        ? 'bg-white text-zinc-950 font-bold shadow-md'
                        : 'text-zinc-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Square className="w-4 h-4" />
                    <div className="absolute left-full ml-3 px-2.5 py-1 bg-zinc-900 border border-zinc-700/80 text-zinc-100 text-xs font-semibold rounded-md shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                      Rectangle
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTool('circle'); setEditingTextId(null); }}
                    title="Circle (Click to activate)"
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer relative group ${
                      activeTool === 'circle'
                        ? 'bg-white text-zinc-950 font-bold shadow-md'
                        : 'text-zinc-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Circle className="w-4 h-4" />
                    <div className="absolute left-full ml-3 px-2.5 py-1 bg-zinc-900 border border-zinc-700/80 text-zinc-100 text-xs font-semibold rounded-md shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                      Circle
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTool('line'); setEditingTextId(null); }}
                    title="Line (Click to activate)"
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer relative group ${
                      activeTool === 'line'
                        ? 'bg-white text-zinc-950 font-bold shadow-md'
                        : 'text-zinc-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Minus className="w-4 h-4" />
                    <div className="absolute left-full ml-3 px-2.5 py-1 bg-zinc-900 border border-zinc-700/80 text-zinc-100 text-xs font-semibold rounded-md shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                      Line
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTool('arrow'); setEditingTextId(null); }}
                    title="Arrow (Click to activate)"
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer relative group ${
                      activeTool === 'arrow'
                        ? 'bg-white text-zinc-950 font-bold shadow-md'
                        : 'text-zinc-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <ArrowRight className="w-4 h-4" />
                    <div className="absolute left-full ml-3 px-2.5 py-1 bg-zinc-900 border border-zinc-700/80 text-zinc-100 text-xs font-semibold rounded-md shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                      Arrow
                    </div>
                  </button>

                  {mode === 'redact' && (
                    <button
                      type="button"
                      onClick={() => { setActiveTool('redact'); setEditingTextId(null); }}
                      title="Redact Box (Click to activate)"
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer relative group ${
                        activeTool === 'redact'
                          ? 'bg-white text-zinc-950 font-bold shadow-md'
                          : 'text-zinc-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Shield className="w-4 h-4" />
                      <div className="absolute left-full ml-3 px-2.5 py-1 bg-zinc-900 border border-zinc-700/80 text-zinc-100 text-xs font-semibold rounded-md shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                        Redact Box
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Page Counter Indicator at bottom */}
              <div className="pt-2 border-t border-white/10 w-full flex justify-center px-1">
                <span className="text-[10px] font-mono font-bold text-zinc-400">
                  {currentPage + 1}/{numPages || 1}
                </span>
              </div>
            </div>
          ) : (
            /* Expanded Compact Sidebar */
            <div className="h-full flex flex-col min-h-0 bg-[#18191e]">
              {/* Compact Header with Collapse button */}
              <EditorSidebarHeader className="h-10 px-3.5 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Tools</span>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-semibold text-zinc-400" aria-live="polite">
                    Page {currentPage + 1} of {numPages || 1}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowToolDrawer(false)}
                  className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                  title="Collapse to icon rail"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </EditorSidebarHeader>

              {/* Tool Navigation & Canvas Selection */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 px-1">
                    Document Modes
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectTool?.('pdf-edit')}
                      aria-current={mode === 'edit' ? 'page' : undefined}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                        mode === 'edit'
                          ? 'bg-white text-zinc-950 border-white font-bold shadow-sm'
                          : 'bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-300 hover:text-white border-zinc-800'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Edit PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectTool?.('pdf-redact')}
                      aria-current={mode === 'redact' ? 'page' : undefined}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                        mode === 'redact'
                          ? 'bg-white text-zinc-950 border-white font-bold shadow-sm'
                          : 'bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-300 hover:text-white border-zinc-800'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Redact</span>
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 px-1">
                    Canvas Tools
                  </div>
                  <div className="space-y-1">
                    {[
                      { id: 'select', label: 'Select / Move', icon: MousePointer },
                      { id: 'text', label: 'Add Text', icon: Type },
                      { id: 'highlight', label: 'Highlighter', icon: Highlighter },
                      { id: 'rectangle', label: 'Rectangle', icon: Square },
                      { id: 'circle', label: 'Circle / Ellipse', icon: Circle },
                      { id: 'line', label: 'Straight Line', icon: Minus },
                      { id: 'arrow', label: 'Arrow', icon: ArrowRight },
                      ...(mode === 'redact' ? [{ id: 'redact', label: 'Redact Box', icon: Shield }] : []),
                    ].map(tool => {
                      const Icon = tool.icon;
                      const isActive = activeTool === tool.id;
                      return (
                        <button
                          key={tool.id}
                          type="button"
                          data-active={isActive}
                          aria-pressed={isActive}
                          onClick={() => {
                            setActiveTool(tool.id as any);
                            setEditingTextId(null);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                            isActive
                              ? 'bg-white text-zinc-950 border-white font-bold shadow-sm'
                              : 'bg-zinc-900/40 hover:bg-zinc-800/80 text-zinc-300 hover:text-white border-transparent'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span>{tool.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pdf-editor__insert-panel">
                  <div className="pdf-editor__panel-heading">
                    <span>Insert</span>
                    <div className="pdf-editor__scope" role="group" aria-label="Apply inserted element to">
                      <button
                        type="button"
                        aria-pressed={elementScope === 'current'}
                        onClick={() => setElementScope('current')}
                      >
                        This page
                      </button>
                      <button
                        type="button"
                        aria-pressed={elementScope === 'all'}
                        onClick={() => setElementScope('all')}
                      >
                        All pages
                      </button>
                    </div>
                  </div>

                  <Select onValueChange={value => {
                    const preset = STAMP_PRESETS.find(item => item.label === value);
                    if (preset) addStampItem(preset);
                  }}>
                    <SelectTrigger className="pdf-editor__insert-action">
                      <span className="pdf-editor__stamp-trigger-content">
                        <Stamp aria-hidden="true" />
                        <strong>Stamp</strong>
                        <small>Choose style</small>
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {STAMP_PRESETS.map(preset => (
                        <SelectItem key={preset.label} value={preset.label}>{preset.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <button type="button" className="pdf-editor__insert-action" onClick={() => addSignatureItem()}>
                    <span><Signature aria-hidden="true" />Signature</span>
                    <small>{elementScope === 'all' ? 'Every page' : `Page ${currentPage + 1}`}</small>
                  </button>
                  <button
                    type="button"
                    className="pdf-editor__insert-action"
                    aria-pressed={targetPageIndexes().every(pageIndex => watermarkPages.includes(pageIndex))}
                    onClick={toggleWatermark}
                  >
                    <span><b aria-hidden="true">WM</b>Watermark</span>
                    <small>{targetPageIndexes().every(pageIndex => watermarkPages.includes(pageIndex)) ? 'Applied' : 'Apply'}</small>
                  </button>
                  <button
                    type="button"
                    className="pdf-editor__insert-action"
                    aria-pressed={targetPageIndexes().every(pageIndex => patternWatermarkPages.includes(pageIndex))}
                    onClick={togglePatternWatermark}
                  >
                    <span><b aria-hidden="true">WM</b>Pattern watermark</span>
                    <small>{targetPageIndexes().every(pageIndex => patternWatermarkPages.includes(pageIndex)) ? 'Applied' : 'Apply'}</small>
                  </button>

                </div>
              </div>
            </div>
          )}
        </EditorSidebar>
        {/* PDF Document Canvas Viewport with Non-Passive Wheel Zoom */}
        <div
          ref={viewportRef}
          className="pdf-editor__viewport flex-1 overflow-y-auto overflow-x-auto bg-[var(--bg-color)] p-6 flex justify-center items-start relative max-h-[calc(100vh-140px)] min-h-[500px]"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center my-24 gap-3 text-[var(--text-secondary)]">
              <RefreshCw className="w-8 h-8 animate-spin text-white" />
              <span className="text-sm font-semibold">Rendering PDF Document...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-8 items-center" style={{ zoom: `${zoom}%` }}>
              {pageImages.map((imgUrl, pageIdx) => {
                const dims = pageDimensions[pageIdx] || { width: 600, height: 800 };
                const isCurrent = pageIdx === currentPage;

                return (
                  <div
                    key={pageIdx}
                    data-pdf-page-index={pageIdx}
                    onClick={event => {
                      setCurrentPage(pageIdx);
                      if ((event.target as HTMLElement).closest('.pdf-editor__annotation-layer')) return;
                      setSelectedId(null);
                      setEditingTextId(null);
                      setActiveDocumentEffect(null);
                    }}
                    className={`relative shadow-2xl transition-all rounded-md border ${
                      isCurrent ? 'border-zinc-500 ring-1 ring-zinc-500' : 'border-[var(--border-color)]'
                    }`}
                    style={{ width: dims.width, height: dims.height }}
                  >
                    {/* Rendered PDF Page Background */}
                    <img
                      src={imgUrl}
                      alt={`Page ${pageIdx + 1}`}
                      className="w-full h-full object-contain pointer-events-none select-none"
                    />

                    {pageTextContents[pageIdx] && pageViewports[pageIdx] && (
                      <SelectablePdfTextLayer
                        textContent={pageTextContents[pageIdx]}
                        viewport={pageViewports[pageIdx]}
                      />
                    )}

                    {watermarkPages.includes(pageIdx) && (
                      <div
                        className="pdf-editor__page-watermark-single"
                        style={{ color: watermarkColor, fontSize: `${watermarkFontSize * 1.6}px`, opacity: watermarkOpacity / 100, transform: `translate(-50%, -50%) rotate(${watermarkRotation}deg)` }}
                        aria-label="Watermark applied"
                      >
                        {watermarkText || 'WATERMARK'}
                      </div>
                    )}

                    {patternWatermarkPages.includes(pageIdx) && (
                      <div
                        className="pdf-editor__page-watermark"
                        style={{
                          opacity: patternWatermarkOpacity / 100,
                          color: patternWatermarkColor,
                          fontSize: `${patternWatermarkFontSize * 1.6}px`,
                        }}
                        aria-label="Pattern watermark applied"
                      >
                        {getWatermarkPatternPositions(watermarkDensity).map((position, index) => (
                          <span key={index} style={{ left: `${position.x}%`, top: `${position.y}%`, transform: `translate(-50%, -50%) rotate(${patternWatermarkRotation}deg)` }}>{patternWatermarkText || 'WATERMARK'}</span>
                        ))}
                      </div>
                    )}

                    {/* Interactive Overlay Layer */}
                    <div
                      onMouseDown={event => handleMouseDown(event, pageIdx)}
                      onMouseMove={handleMouseMove}
                      onMouseUp={event => handleMouseUp(event, pageIdx)}
                      className={`pdf-editor__annotation-layer absolute inset-0 ${
                        activeTool !== 'select' ? 'cursor-crosshair pointer-events-auto' : 'cursor-default pointer-events-none'
                      }`}
                    >
                      {/* Draft Box preview during click-drag creation */}
                      {isCurrent && isDrawing && draftBox && (
                        <div
                          className={`absolute border-2 border-dashed pointer-events-none ${
                            activeTool === 'redact'
                              ? 'bg-black border-red-500'
                              : 'border-white bg-white/10'
                          }`}
                          style={{
                            left: `${draftBox.x}%`,
                            top: `${draftBox.y}%`,
                            width: `${draftBox.w}%`,
                            height: `${draftBox.h}%`,
                          }}
                        >
                          {activeTool === 'redact' && (
                            <div className="w-full h-full flex items-center justify-center text-white font-mono text-xs font-bold bg-black">
                              {redactStyle === 'custom-text' ? redactText : (redactStyle === 'whiteout' ? '' : '[REDACTED]')}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Committed Page Annotations / Redactions */}
                      {annotations
                        .filter(a => a.pageIndex === pageIdx && a.isVisible)
                        .map(item => {
                          const isSelected = selectedId === item.id;
                          const isEditing = editingTextId === item.id;

                          return (
                            <div
                              key={item.id}
                              onClick={e => e.stopPropagation()}
                              onMouseDown={e => {
                                const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                                if (rect) startMoveDrag(e, item, rect);
                              }}
                              onDoubleClick={e => {
                                e.stopPropagation();
                                if (item.type === 'text') setEditingTextId(item.id);
                              }}
                              className={`absolute group transition-shadow pointer-events-auto ${
                                activeTool === 'select' ? 'cursor-move' : 'cursor-pointer'
                              } ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-black z-20' : ''}`}
                              style={{
                                left: `${item.x}%`,
                                top: `${item.y}%`,
                                width: `${item.width}%`,
                                height: `${item.height}%`,
                                transform: `rotate(${item.rotation}deg)`,
                                opacity: item.opacity,
                                zIndex: isSelected ? 50 : annotations.indexOf(item) + 1,
                              }}
                            >
                              {/* Redaction Censor Box */}
                              {item.type === 'redact' && (
                                <div
                                  className="w-full h-full flex items-center justify-center font-mono font-bold text-xs select-none overflow-hidden"
                                  style={{
                                    backgroundColor: item.redactStyle === 'whiteout' ? '#ffffff' : (item.fillColor || '#000000'),
                                    color: '#ffffff',
                                    borderStyle: item.strokeWidth > 0 ? 'solid' : 'none',
                                    borderColor: item.strokeColor === 'transparent' ? 'transparent' : item.strokeColor,
                                    borderWidth: item.strokeWidth > 0 ? `${item.strokeWidth}px` : 0,
                                    boxSizing: 'border-box',
                                  }}
                                >
                                  {item.text}
                                </div>
                              )}

                              {item.type === 'rectangle' && (
                                <div
                                  className="w-full h-full rounded-xs"
                                  style={{
                                    borderWidth: `${item.strokeWidth}px`,
                                    borderStyle: item.strokeColor === 'transparent' ? 'none' : 'solid',
                                    borderColor: item.strokeColor,
                                    backgroundColor: item.fillColor,
                                  }}
                                />
                              )}

                              {item.type === 'circle' && (
                                <div
                                  className="w-full h-full rounded-full"
                                  style={{
                                    borderWidth: `${item.strokeWidth}px`,
                                    borderStyle: item.strokeColor === 'transparent' ? 'none' : 'solid',
                                    borderColor: item.strokeColor,
                                    backgroundColor: item.fillColor,
                                  }}
                                />
                              )}

                              {item.type === 'line' && (
                                <svg className="w-full h-full overflow-visible">
                                  <line
                                    x1="0%"
                                    y1="0%"
                                    x2="100%"
                                    y2="100%"
                                    stroke={item.strokeColor === 'transparent' ? '#ffffff' : item.strokeColor}
                                    strokeWidth={item.strokeWidth}
                                  />
                                </svg>
                              )}

                              {/* Real SVG Arrowhead rendering */}
                              {item.type === 'arrow' && (
                                <svg className="w-full h-full overflow-visible">
                                  <defs>
                                    <marker
                                      id={`arrowhead_${item.id}`}
                                      markerWidth="12"
                                      markerHeight="8"
                                      refX="10"
                                      refY="4"
                                      orient="auto"
                                    >
                                      <polygon
                                        points="0 0, 12 4, 0 8"
                                        fill={item.strokeColor === 'transparent' ? '#ffffff' : item.strokeColor}
                                      />
                                    </marker>
                                  </defs>
                                  <line
                                    x1="0%"
                                    y1="0%"
                                    x2="100%"
                                    y2="100%"
                                    stroke={item.strokeColor === 'transparent' ? '#ffffff' : item.strokeColor}
                                    strokeWidth={item.strokeWidth}
                                    markerEnd={`url(#arrowhead_${item.id})`}
                                  />
                                </svg>
                              )}
                              {/* Editable text box */}
                              {item.type === 'text' && (
                                <div
                                  onClick={e => {
                                    e.stopPropagation();
                                    setSelectedId(item.id);
                                    setEditingTextId(item.id);
                                  }}
                                  className="pdf-editor__text-box w-full h-full overflow-hidden flex items-start cursor-text"
                                  style={{
                                    backgroundColor: item.fillColor && item.fillColor !== 'transparent' ? item.fillColor : 'transparent',
                                  }}
                                >
                                  {isEditing ? (
                                    <textarea
                                      value={item.text || ''}
                                      onMouseDown={e => e.stopPropagation()}
                                      onClick={e => e.stopPropagation()}
                                      onChange={e => {
                                        e.stopPropagation();
                                        updateSelectedItem({ text: e.target.value });
                                      }}
                                      onKeyDown={e => {
                                        e.stopPropagation();
                                        if (e.key === 'Escape') setEditingTextId(null);
                                      }}
                                      onBlur={() => setEditingTextId(null)}
                                      style={{
                                        '--annotation-text-color': item.textColor || '#000000',
                                        fontSize: `${item.fontSize || 16}px`,
                                        fontFamily: item.fontFamily === 'serif' ? 'Georgia, serif' : (item.fontFamily === 'monospace' ? 'Courier New, monospace' : 'Inter, sans-serif'),
                                        fontWeight: item.isBold ? 'bold' : 'normal',
                                        fontStyle: item.isItalic ? 'italic' : 'normal',
                                        textAlign: item.textAlign || 'left',
                                      } as React.CSSProperties & { '--annotation-text-color': string }}
                                      className="pdf-editor__text-input w-full h-full border-none focus:outline-none focus:ring-0 resize-none leading-snug shadow-none cursor-text select-text z-30"
                                      placeholder="Type text here..."
                                      autoFocus
                                    />
                                  ) : (
                                    <span
                                      style={{
                                        color: item.textColor || '#000000',
                                        fontSize: `${item.fontSize || 16}px`,
                                        fontFamily: item.fontFamily === 'serif' ? 'Georgia, serif' : (item.fontFamily === 'monospace' ? 'Courier New, monospace' : 'Inter, sans-serif'),
                                        fontWeight: item.isBold ? 'bold' : 'normal',
                                        fontStyle: item.isItalic ? 'italic' : 'normal',
                                        textAlign: item.textAlign || 'left',
                                      }}
                                      className="pdf-editor__text-value w-full h-full break-words whitespace-pre-wrap leading-snug pointer-events-auto cursor-text"
                                    >
                                      {item.text || 'Type text here...'}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Highlighter Box */}
                              {item.type === 'highlight' && (
                                <div
                                  className="w-full h-full rounded-sm pointer-events-none"
                                  style={{
                                    backgroundColor: item.fillColor || '#facc15',
                                    mixBlendMode: 'multiply',
                                  }}
                                />
                              )}

                              {/* Official Document Stamp */}
                              {item.type === 'stamp' && (
                                <div
                                  className="w-full h-full rounded-lg flex items-center justify-center p-2 font-black uppercase tracking-wider text-center select-none shadow-sm"
                                  style={{
                                    border: `3px solid ${item.strokeColor || '#16a34a'}`,
                                    outline: `1px solid ${item.strokeColor || '#16a34a'}`,
                                    outlineOffset: '-5px',
                                    color: item.strokeColor || '#16a34a',
                                    backgroundColor: item.fillColor || 'rgba(22, 163, 74, 0.1)',
                                    fontSize: `${item.fontSize ?? getAutoStampFontSize(item.text || item.stampType || 'APPROVED', pageDimensions[pageIdx].width * item.width / 100, pageDimensions[pageIdx].height * item.height / 100)}px`,
                                  }}
                                >
                                  {item.text || item.stampType || 'APPROVED'}
                                </div>
                              )}

                              {/* Digital Signature Badge */}
                              {item.type === 'signature' && (
                                <div
                                  className="w-full h-full rounded-xl flex flex-col justify-center px-3.5 py-2 border shadow-md select-none backdrop-blur-xs"
                                  style={{
                                    borderColor: item.strokeColor || '#3b82f6',
                                    backgroundColor: item.fillColor || 'rgba(59, 130, 246, 0.05)',
                                    color: item.strokeColor || '#3b82f6',
                                  }}
                                >
                                  <div
                                    className="font-semibold italic leading-tight truncate"
                                    style={{
                                      fontFamily: '"Brush Script MT", "Caveat", "Segoe Script", cursive, sans-serif',
                                      fontSize: `${item.fontSize ?? getAutoSignatureFontSize(item.signerName || 'Verified Signature', pageDimensions[pageIdx].width * item.width / 100, pageDimensions[pageIdx].height * item.height / 100)}px`,
                                    }}
                                  >
                                    {item.signerName || 'Verified Signature'}
                                  </div>
                                  <div
                                    className="flex items-center gap-1.5 font-mono font-bold text-zinc-500 mt-1 uppercase tracking-wider"
                                    style={{
                                      fontSize: `${Math.max(9, (item.fontSize ?? getAutoSignatureFontSize(item.signerName || 'Verified Signature', pageDimensions[pageIdx].width * item.width / 100, pageDimensions[pageIdx].height * item.height / 100)) * 0.45)}px`,
                                    }}
                                  >
                                    <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                                    <span>Digitally Signed · {item.signDate || new Date().toLocaleDateString()}</span>
                                  </div>
                                </div>
                              )}

                              {/* Interactive Selection Bounding Box with 8 Resize Handles & Rotation Stem */}
                              {isSelected && activeTool === 'select' && (
                                <div className="absolute -inset-1 border-2 border-white pointer-events-none">
                                  {/* Top Rotation Stem */}
                                  <div
                                    onMouseDown={e => {
                                      const rect = e.currentTarget.closest('.relative')?.getBoundingClientRect();
                                      if (rect) startRotateDrag(e, item, rect);
                                    }}
                                    className="absolute -top-7 left-1/2 -translate-x-1/2 w-5 h-5 bg-white rounded-full flex items-center justify-center text-zinc-950 pointer-events-auto cursor-grab hover:scale-110 transition-transform shadow-md border border-zinc-400"
                                    title="Drag to Rotate Shape"
                                  >
                                    <RotateCw className="w-3 h-3 text-zinc-950" />
                                  </div>
                                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-white pointer-events-none" />

                                  {/* 8-Point Corner & Edge Resize Handles */}
                                  <div
                                    onMouseDown={e => {
                                      const rect = e.currentTarget.closest('.relative')?.getBoundingClientRect();
                                      if (rect) startResizeDrag(e, item, 'tl', rect);
                                    }}
                                    className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-zinc-900 rounded-full pointer-events-auto cursor-nwse-resize hover:scale-125 transition-transform"
                                  />
                                  <div
                                    onMouseDown={e => {
                                      const rect = e.currentTarget.closest('.relative')?.getBoundingClientRect();
                                      if (rect) startResizeDrag(e, item, 'tr', rect);
                                    }}
                                    className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-zinc-900 rounded-full pointer-events-auto cursor-nesw-resize hover:scale-125 transition-transform"
                                  />
                                  <div
                                    onMouseDown={e => {
                                      const rect = e.currentTarget.closest('.relative')?.getBoundingClientRect();
                                      if (rect) startResizeDrag(e, item, 'bl', rect);
                                    }}
                                    className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-zinc-900 rounded-full pointer-events-auto cursor-nesw-resize hover:scale-125 transition-transform"
                                  />
                                  <div
                                    onMouseDown={e => {
                                      const rect = e.currentTarget.closest('.relative')?.getBoundingClientRect();
                                      if (rect) startResizeDrag(e, item, 'br', rect);
                                    }}
                                    className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-zinc-900 rounded-full pointer-events-auto cursor-nwse-resize hover:scale-125 transition-transform"
                                  />

                                  {/* Edge Middle Handles */}
                                  <div
                                    onMouseDown={e => {
                                      const rect = e.currentTarget.closest('.relative')?.getBoundingClientRect();
                                      if (rect) startResizeDrag(e, item, 'tm', rect);
                                    }}
                                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-zinc-900 rounded-full pointer-events-auto cursor-ns-resize hover:scale-125 transition-transform"
                                  />
                                  <div
                                    onMouseDown={e => {
                                      const rect = e.currentTarget.closest('.relative')?.getBoundingClientRect();
                                      if (rect) startResizeDrag(e, item, 'bm', rect);
                                    }}
                                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-zinc-900 rounded-full pointer-events-auto cursor-ns-resize hover:scale-125 transition-transform"
                                  />
                                  <div
                                    onMouseDown={e => {
                                      const rect = e.currentTarget.closest('.relative')?.getBoundingClientRect();
                                      if (rect) startResizeDrag(e, item, 'ml', rect);
                                    }}
                                    className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 bg-white border-2 border-zinc-900 rounded-full pointer-events-auto cursor-ew-resize hover:scale-125 transition-transform"
                                  />
                                  <div
                                    onMouseDown={e => {
                                      const rect = e.currentTarget.closest('.relative')?.getBoundingClientRect();
                                      if (rect) startResizeDrag(e, item, 'mr', rect);
                                    }}
                                    className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-white border-2 border-zinc-900 rounded-full pointer-events-auto cursor-ew-resize hover:scale-125 transition-transform"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>

                    {/* Page Index Label */}
                    <div
                      className="pdf-editor__page-badge absolute top-3 left-3 bg-[var(--surface-color)]/90 backdrop-blur px-2.5 py-1 rounded-lg font-mono font-bold text-[var(--text-secondary)] border border-[var(--border-color)] shadow-sm"
                      style={{ transform: `scale(${100 / zoom})`, transformOrigin: 'top left' }}
                    >
                      Page {pageIdx + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Side Panel (Layers & Elements) */}
        <div className="pdf-editor__layers w-80 bg-[var(--surface-color)] border-l border-[var(--border-color)] flex flex-col justify-between shrink-0">
          <div>
            {/* Header */}
            <div className="pdf-editor__layers-header p-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                <Layers className="w-4 h-4 text-white" />
                <span>{mode === 'redact' ? 'Redactions' : 'Layers'}</span>
              </h3>
              <button
                onClick={removeAllAnnotations}
                className="text-xs text-zinc-400 hover:text-white hover:underline font-semibold cursor-pointer"
              >
                Remove all
              </button>
            </div>

            {/* Reorder Notification Banner */}
            <div className="pdf-editor__layers-hint m-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-start gap-2 text-xs text-zinc-300">
              <ShieldAlert className="w-4 h-4 text-white shrink-0 mt-0.5" />
              <span>Select an element here or on the page. Drag its handles to resize.</span>
            </div>

            {watermarkPages.length > 0 && (
              <div className="pdf-editor__document-effect">
                <div>
                  <b>Watermark</b>
                  <small>{watermarkPages.length === numPages ? 'All pages' : `${watermarkPages.length} ${watermarkPages.length === 1 ? 'page' : 'pages'}`}</small>
                </div>
                <button type="button" onClick={() => { setWatermarkPages([]); setActiveDocumentEffect(null); }}>Remove</button>
              </div>
            )}

            {patternWatermarkPages.length > 0 && (
              <div className="pdf-editor__document-effect">
                <div>
                  <b>Pattern watermark</b>
                  <small>{patternWatermarkPages.length === numPages ? 'All pages' : `${patternWatermarkPages.length} ${patternWatermarkPages.length === 1 ? 'page' : 'pages'}`}</small>
                </div>
                <button type="button" onClick={() => { setPatternWatermarkPages([]); setActiveDocumentEffect(null); }}>Remove</button>
              </div>
            )}

            {/* Elements / Layers List */}
            <div className="pdf-editor__layers-list p-3 overflow-y-auto max-h-[calc(100vh-320px)] space-y-4">
              {Array.from({ length: numPages }).map((_, pIdx) => {
                const pageAnnots = [...annotations.filter(a => a.pageIndex === pIdx)].slice().reverse();
                if (pageAnnots.length === 0) return null;

                return (
                  <div key={pIdx} className="pdf-editor__layer-page space-y-1.5">
                    <div className="pdf-editor__layer-page-title text-xs font-bold text-[var(--text-secondary)] px-1">
                      Page {pIdx + 1}
                    </div>

                    {pageAnnots.map(item => {
                      const isSelected = selectedId === item.id || editingTextId === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setCurrentPage(pIdx);
                            setSelectedId(item.id);
                          }}
                          className={`pdf-editor__layer-item p-3 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--surface-hover)] border-white text-white shadow-sm font-bold'
                              : 'bg-[var(--surface-color)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            {/* Reorder arrows */}
                            <div className="flex flex-col gap-0.5 text-[var(--text-secondary)]">
                              <button
                                onClick={e => { e.stopPropagation(); moveLayer(item.id, 'up'); }}
                                className="hover:text-[var(--text-primary)] cursor-pointer"
                                title="Bring Forward (Move Up in Stack)"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); moveLayer(item.id, 'down'); }}
                                className="hover:text-[var(--text-primary)] cursor-pointer"
                                title="Send Backward (Move Down in Stack)"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Layer Color Badge */}
                            <div
                              className="w-3.5 h-3.5 rounded border border-[var(--border-color)] shrink-0"
                              style={{
                                backgroundColor: item.type === 'redact'
                                  ? (item.fillColor || '#000000')
                                  : (item.type === 'text'
                                      ? (item.fillColor && item.fillColor !== 'transparent' ? item.fillColor : (item.textColor || '#000000'))
                                      : (item.fillColor === 'transparent' ? item.strokeColor : item.fillColor)),
                              }}
                            />

                            {/* Name */}
                            <span className="font-medium truncate max-w-[110px]">
                              {item.name}
                            </span>
                          </div>

                          {/* Action controls */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                updateSelectedItem({ isVisible: !item.isVisible });
                              }}
                              className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                              title={item.isVisible ? 'Hide' : 'Show'}
                            >
                              {item.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />}
                            </button>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                deleteAnnotation(item.id);
                              }}
                              className="p-1 text-[var(--text-secondary)] hover:text-white cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {!hasDocumentChanges && (
                <div className="py-8 text-center text-xs text-[var(--text-tertiary)] italic">
                  {mode === 'redact'
                    ? 'No redactions added yet. Click "Redact Box" above to blackout sensitive areas.'
                    : 'No elements yet. Choose a tool from the left panel to start editing.'}
                </div>
              )}
            </div>
          </div>

          {/* Save & Export Button */}
          <div className="pdf-editor__layers-footer p-4 border-t border-[var(--border-color)] bg-[var(--surface-color)]">
            <button
              onClick={handleSaveChanges}
              disabled={saving || !hasDocumentChanges}
              className={`w-full font-extrabold py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 text-xs transition-all ${
                !hasDocumentChanges
                  ? 'bg-zinc-800 text-zinc-300 border border-zinc-700 cursor-not-allowed opacity-90'
                  : 'bg-white hover:bg-zinc-100 text-zinc-950 border border-white cursor-pointer'
              }`}
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-current" />
                  <span className="font-extrabold text-xs">Building PDF...</span>
                </>
              ) : (
                <>
                  <span className="font-extrabold text-xs">Download PDF</span>
                  <ArrowRight className="w-4 h-4 shrink-0 stroke-[3]" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Custom Remove All Confirmation Modal */}
      {showRemoveAllConfirm && createPortal(
        <div className="pdf-editor-dialog fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md" onMouseDown={() => setShowRemoveAllConfirm(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="remove-all-title" className="w-full max-w-md max-h-[calc(100svh-2rem)] overflow-y-auto bg-[var(--surface-color)] border border-[var(--border-color)] rounded-2xl p-6 shadow-2xl space-y-4" onMouseDown={event => event.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 text-red-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 id="remove-all-title" className="text-base font-bold text-[var(--text-primary)]">Remove All Elements?</h4>
                <p className="text-xs text-[var(--text-secondary)]">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Are you sure you want to remove all annotations, text boxes, shapes, redactions, and document effects?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                autoFocus
                onClick={() => setShowRemoveAllConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-secondary)] bg-[var(--surface-hover)] hover:text-white border border-[var(--border-color)] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setAnnotations([]);
                  setWatermarkPages([]);
                  setPatternWatermarkPages([]);
                  setActiveDocumentEffect(null);
                  setSelectedId(null);
                  setEditingTextId(null);
                  setShowRemoveAllConfirm(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition shadow-lg shadow-red-900/30 cursor-pointer"
              >
                Remove All Elements
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Custom No Annotations Warning Modal */}
      {showNoAnnotsWarning && createPortal(
        <div className="pdf-editor-dialog fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md" onMouseDown={() => setShowNoAnnotsWarning(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="no-changes-title" className="w-full max-w-md max-h-[calc(100svh-2rem)] overflow-y-auto bg-[var(--surface-color)] border border-[var(--border-color)] rounded-2xl p-6 shadow-2xl space-y-4" onMouseDown={event => event.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 id="no-changes-title" className="text-base font-bold text-[var(--text-primary)]">No Changes Made</h4>
                <p className="text-xs text-[var(--text-secondary)]">Add annotations before saving</p>
              </div>
            </div>

            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              You haven't added any redactions, text boxes, or shapes to this document yet. Add some elements to your PDF before saving.
            </p>

            <div className="flex justify-end pt-2">
              <button
                autoFocus
                onClick={() => setShowNoAnnotsWarning(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-zinc-950 bg-white hover:bg-zinc-200 transition cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
