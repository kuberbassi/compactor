import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import {
  MousePointer, Type, Square, Circle, Minus, ArrowRight,
  Trash2, RotateCw, Eye, EyeOff, ArrowUp, ArrowDown,
  ZoomIn, ZoomOut, ShieldAlert, RefreshCw, Layers, Pipette,
  Shield, AlignLeft, AlignCenter, AlignRight, Bold, Italic, AlertTriangle
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface AnnotationItem {
  id: string;
  pageIndex: number; // 0-indexed
  type: 'rectangle' | 'circle' | 'line' | 'arrow' | 'text' | 'redact';
  name: string;
  x: number; // relative percentage (0 to 100)
  y: number; // relative percentage (0 to 100)
  width: number; // relative percentage (0 to 100)
  height: number; // relative percentage (0 to 100)
  strokeColor: string; // hex or 'transparent'
  fillColor: string; // hex or 'transparent'
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
}

interface PdfEditorProps {
  file: File;
  mode?: 'edit' | 'redact';
  onGoHome?: () => void;
  onSaveSuccess?: () => void;
}

export const PdfEditor: React.FC<PdfEditorProps> = ({ file, mode = 'edit', onSaveSuccess }) => {
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(0); // 0-indexed
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  
  // Default PDF zoom set to 75% for optimal page fitting & accuracy
  const [zoom, setZoom] = useState<number>(75);
  const [activeTool, setActiveTool] = useState<
    'select' | 'text' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'redact'
  >(mode === 'redact' ? 'redact' : 'select');

  // Annotation state
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

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

  // Non-passive wheel event listener to intercept Ctrl+Scroll and prevent browser tab zoom
  useEffect(() => {
    const elem = viewportRef.current;
    if (!elem) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          setZoom(z => Math.min(200, z + 5));
        } else {
          setZoom(z => Math.max(40, z - 5));
        }
      }
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
    const loadPdf = async () => {
      setLoading(true);
      try {
        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;
        const total = pdf.numPages;
        setNumPages(total);

        const imgs: string[] = [];
        const dims: { width: number; height: number }[] = [];

        for (let i = 1; i <= total; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.6 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await (page.render as any)({ canvasContext: ctx, viewport, canvas }).promise;
            imgs.push(canvas.toDataURL('image/jpeg', 0.92));
            dims.push({ width: viewport.width, height: viewport.height });
          }
        }

        if (isMounted) {
          setPageImages(imgs);
          setPageDimensions(dims);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error rendering PDF pages:', err);
        if (isMounted) setLoading(false);
      }
    };
    loadPdf();
    return () => { isMounted = false; };
  }, [file]);

  const selectedItem = annotations.find(a => a.id === selectedId);

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

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
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

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
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
        pageIndex: currentPage,
        type: 'redact',
        name: `Redaction Area #${annotations.filter(a => a.type === 'redact').length + 1}`,
        x,
        y,
        width: w,
        height: h,
        strokeColor: redactStyle === 'whiteout' ? '#ffffff' : '#000000',
        fillColor: redactStyle === 'whiteout' ? '#ffffff' : '#000000',
        strokeWidth: 0,
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
        pageIndex: currentPage,
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
        text: 'Type text here...',
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
    } else if (activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'line' || activeTool === 'arrow') {
      const x = Math.min(drawStart.x, coords.x);
      const y = Math.min(drawStart.y, coords.y);
      const w = Math.max(2, Math.abs(coords.x - drawStart.x));
      const h = Math.max(2, Math.abs(coords.y - drawStart.y));

      const typeName = activeTool.charAt(0).toUpperCase() + activeTool.slice(1);
      const newAnnot: AnnotationItem = {
        id,
        pageIndex: currentPage,
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
    if (annotations.length === 0) {
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
        if (pageAnnots.length === 0 && !secureRedaction) continue;

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
    } catch (err) {
      console.error('Error saving edited PDF:', err);
      alert('Failed to save document. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pdf-editor flex flex-col rounded-2xl border border-[var(--border-color)] bg-[var(--surface-color)] text-[var(--text-primary)] shadow-xl overflow-hidden select-none min-h-[calc(100vh-140px)]">
      {/* Top Main Toolbar */}
      <div className="pdf-editor__toolbar border-b border-[var(--border-color)] bg-[var(--surface-hover)] px-4 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode Switcher */}
          <div className="bg-[var(--surface-color)] border border-[var(--border-color)] rounded-xl p-1 flex items-center gap-1">
            <button
              onClick={() => { setActiveTool('select'); setEditingTextId(null); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
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
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === 'text'
                  ? 'bg-white text-zinc-950 font-bold shadow-sm border border-white'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Add Text</span>
            </button>
          </div>

          <div className="h-6 w-px bg-[var(--border-color)] mx-1 hidden sm:block" />

          {/* Vector Shapes Toolbar */}
          <div className="flex items-center gap-1 bg-[var(--surface-color)] p-1 rounded-xl border border-[var(--border-color)]">
            <button
              title="Rectangle Shape"
              onClick={() => { setActiveTool('rectangle'); setEditingTextId(null); }}
              className={`p-2 rounded-lg transition cursor-pointer ${activeTool === 'rectangle' ? 'bg-white text-zinc-950 font-bold shadow-sm' : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-hover)]'}`}
            >
              <Square className="w-4 h-4" />
            </button>
            <button
              title="Circle / Ellipse Shape"
              onClick={() => { setActiveTool('circle'); setEditingTextId(null); }}
              className={`p-2 rounded-lg transition cursor-pointer ${activeTool === 'circle' ? 'bg-white text-zinc-950 font-bold shadow-sm' : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-hover)]'}`}
            >
              <Circle className="w-4 h-4" />
            </button>
            <button
              title="Straight Line"
              onClick={() => { setActiveTool('line'); setEditingTextId(null); }}
              className={`p-2 rounded-lg transition cursor-pointer ${activeTool === 'line' ? 'bg-white text-zinc-950 font-bold shadow-sm' : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-hover)]'}`}
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              title="Arrow Line"
              onClick={() => { setActiveTool('arrow'); setEditingTextId(null); }}
              className={`p-2 rounded-lg transition cursor-pointer ${activeTool === 'arrow' ? 'bg-white text-zinc-950 font-bold shadow-sm' : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-hover)]'}`}
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Selected Element Controls */}
        {mode === 'redact' && activeTool === 'redact' && (
          <div className="flex items-center gap-2 bg-[var(--surface-color)] border border-[var(--border-color)] px-3 py-1.5 rounded-xl text-xs">
            <span className="text-[var(--text-secondary)] font-bold">Redaction Style:</span>
            <button
              onClick={() => setRedactStyle('blackout')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${redactStyle === 'blackout' ? 'bg-black text-white' : 'text-[var(--text-secondary)]'}`}
            >
              Blackout
            </button>
            <button
              onClick={() => setRedactStyle('whiteout')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${redactStyle === 'whiteout' ? 'bg-zinc-200 text-zinc-900' : 'text-[var(--text-secondary)]'}`}
            >
              Whiteout
            </button>
            <button
              onClick={() => setRedactStyle('custom-text')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${redactStyle === 'custom-text' ? 'bg-white text-zinc-950 font-bold' : 'text-[var(--text-secondary)]'}`}
            >
              Label
            </button>
            {redactStyle === 'custom-text' && (
              <input
                type="text"
                value={redactText}
                onChange={e => setRedactText(e.target.value)}
                className="bg-transparent border border-[var(--border-color)] px-2 py-0.5 rounded text-xs text-[var(--text-primary)] w-28 font-mono"
              />
            )}
          </div>
        )}

        {selectedItem && (
          <div className="flex items-center gap-2.5 bg-[var(--surface-color)] border border-[var(--border-color)] px-3 py-1.5 rounded-xl text-xs shadow-sm flex-wrap">
            {/* Text Specific Formatting */}
            {selectedItem.type === 'text' && (
              <>
                <div className="flex items-center gap-1" title="Font Family">
                  <span className="text-[var(--text-secondary)] font-medium">Font:</span>
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
                  <span className="text-[var(--text-secondary)] font-medium">Size:</span>
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
                  <span className="text-[var(--text-secondary)] font-medium">Text Color:</span>
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
                    className={`p-1 rounded transition cursor-pointer ${selectedItem.isBold ? 'bg-white text-zinc-950 font-bold' : 'text-[var(--text-secondary)]'}`}
                    title="Bold"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => updateSelectedItem({ isItalic: !selectedItem.isItalic })}
                    className={`p-1 rounded transition cursor-pointer ${selectedItem.isItalic ? 'bg-white text-zinc-950 font-bold' : 'text-[var(--text-secondary)]'}`}
                    title="Italic"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-0.5 bg-[var(--surface-hover)] p-0.5 rounded border border-[var(--border-color)]">
                  <button
                    onClick={() => updateSelectedItem({ textAlign: 'left' })}
                    className={`p-1 rounded transition cursor-pointer ${selectedItem.textAlign === 'left' || !selectedItem.textAlign ? 'bg-white text-zinc-950 font-bold' : 'text-[var(--text-secondary)]'}`}
                    title="Align Left"
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => updateSelectedItem({ textAlign: 'center' })}
                    className={`p-1 rounded transition cursor-pointer ${selectedItem.textAlign === 'center' ? 'bg-white text-zinc-950 font-bold' : 'text-[var(--text-secondary)]'}`}
                    title="Align Center"
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => updateSelectedItem({ textAlign: 'right' })}
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
              <span className="text-[var(--text-secondary)] font-medium">Border:</span>
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
                onClick={() => updateSelectedItem({ strokeColor: selectedItem.strokeColor === 'transparent' ? '#ffffff' : 'transparent' })}
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
                <span className="text-[var(--text-secondary)] font-medium">Fill:</span>
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
                  onClick={() => updateSelectedItem({ fillColor: selectedItem.fillColor === 'transparent' ? '#ffffff' : 'transparent' })}
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

            {selectedItem.type !== 'text' && selectedItem.type !== 'redact' && (
              <>
                <div className="w-px h-4 bg-[var(--border-color)]" />
                <div className="flex items-center gap-1.5" title="Thickness">
                  <span className="text-[var(--text-secondary)] font-medium">Thick:</span>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={selectedItem.strokeWidth}
                    onChange={e => updateSelectedItem({ strokeWidth: Number(e.target.value) })}
                    className="w-14 accent-white"
                  />
                  <span className="w-5 text-right font-mono text-[11px]">{selectedItem.strokeWidth}px</span>
                </div>
              </>
            )}

            <div className="w-px h-4 bg-[var(--border-color)]" />

            {/* Opacity */}
            <div className="flex items-center gap-1.5" title="Opacity">
              <span className="text-[var(--text-secondary)] font-medium">Opacity:</span>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={selectedItem.opacity}
                onChange={e => updateSelectedItem({ opacity: Number(e.target.value) })}
                className="w-14 accent-white"
              />
              <span className="w-7 text-right font-mono text-[11px]">{Math.round(selectedItem.opacity * 100)}%</span>
            </div>

            <div className="w-px h-4 bg-[var(--border-color)]" />

            {/* Rotation */}
            <div className="flex items-center gap-1.5" title="Rotation Angle">
              <RotateCw className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <input
                type="range"
                min="0"
                max="360"
                value={selectedItem.rotation}
                onChange={e => updateSelectedItem({ rotation: Number(e.target.value) })}
                className="w-14 accent-white"
              />
              <span className="w-7 text-right font-mono text-[11px]">{selectedItem.rotation}°</span>
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

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[var(--surface-color)] px-2.5 py-1 rounded-xl border border-[var(--border-color)] text-xs">
            <button onClick={() => setZoom(z => Math.max(40, z - 10))} className="p-1 hover:text-white text-[var(--text-secondary)] cursor-pointer">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="w-12 text-center font-mono font-bold text-[var(--text-primary)]">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="p-1 hover:text-white text-[var(--text-secondary)] cursor-pointer">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace (Viewport + Side Layer Panel) */}
      <div className="pdf-editor__workspace flex-1 flex overflow-hidden relative">
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
                    onClick={e => {
                      setCurrentPage(pageIdx);
                      // Deselect items when clicking blank space on page
                      if (e.target === e.currentTarget) {
                        setSelectedId(null);
                        setEditingTextId(null);
                      }
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

                    {/* Interactive Overlay Layer */}
                    <div
                      onMouseDown={isCurrent ? handleMouseDown : undefined}
                      onMouseMove={isCurrent ? handleMouseMove : undefined}
                      onMouseUp={isCurrent ? handleMouseUp : undefined}
                      className={`absolute inset-0 ${
                        activeTool !== 'select' ? 'cursor-crosshair' : 'cursor-default'
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
                              onMouseDown={e => {
                                const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                                if (rect) startMoveDrag(e, item, rect);
                              }}
                              onDoubleClick={e => {
                                e.stopPropagation();
                                if (item.type === 'text') setEditingTextId(item.id);
                              }}
                              className={`absolute group transition-shadow ${
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
                                    border: item.redactStyle === 'whiteout' ? '1px dashed #ccc' : 'none',
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
                                  className="w-full h-full p-1 overflow-visible flex items-start !bg-transparent cursor-text"
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
                                      style={{
                                        backgroundColor: item.fillColor && item.fillColor !== 'transparent' ? item.fillColor : 'transparent',
                                        color: item.textColor || '#000000',
                                        fontSize: `${item.fontSize || 16}px`,
                                        fontFamily: item.fontFamily === 'serif' ? 'Georgia, serif' : (item.fontFamily === 'monospace' ? 'Courier New, monospace' : 'Inter, sans-serif'),
                                        fontWeight: item.isBold ? 'bold' : 'normal',
                                        fontStyle: item.isItalic ? 'italic' : 'normal',
                                        textAlign: item.textAlign || 'left',
                                      }}
                                      className="w-full h-full !bg-transparent border-none focus:outline-none focus:ring-0 resize-none p-0 leading-tight shadow-none cursor-text select-text z-30"
                                      placeholder="Type text here..."
                                      autoFocus
                                    />
                                  ) : (
                                    <span
                                      style={{
                                        backgroundColor: item.fillColor && item.fillColor !== 'transparent' ? item.fillColor : 'transparent',
                                        color: item.textColor || '#000000',
                                        fontSize: `${item.fontSize || 16}px`,
                                        fontFamily: item.fontFamily === 'serif' ? 'Georgia, serif' : (item.fontFamily === 'monospace' ? 'Courier New, monospace' : 'Inter, sans-serif'),
                                        fontWeight: item.isBold ? 'bold' : 'normal',
                                        fontStyle: item.isItalic ? 'italic' : 'normal',
                                        textAlign: item.textAlign || 'left',
                                      }}
                                      className="w-full break-words leading-tight pointer-events-auto !bg-transparent cursor-text"
                                    >
                                      {item.text || 'Type text here...'}
                                    </span>
                                  )}
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
                    <div className="absolute top-3 left-3 bg-[var(--surface-color)]/90 backdrop-blur px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-[var(--text-secondary)] border border-[var(--border-color)] shadow-sm">
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
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                <Layers className="w-4 h-4 text-white" />
                <span>{mode === 'redact' ? 'Redaction Layers' : 'Edit PDF'}</span>
              </h3>
              <button
                onClick={removeAllAnnotations}
                className="text-xs text-zinc-400 hover:text-white hover:underline font-semibold cursor-pointer"
              >
                Remove all
              </button>
            </div>

            {/* Reorder Notification Banner */}
            <div className="m-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-start gap-2 text-xs text-zinc-300">
              <ShieldAlert className="w-4 h-4 text-white shrink-0 mt-0.5" />
              <span>Click element on page or layer below to select. Drag corner handles to resize.</span>
            </div>

            {/* Elements / Layers List */}
            <div className="p-3 overflow-y-auto max-h-[calc(100vh-320px)] space-y-4">
              {Array.from({ length: numPages }).map((_, pIdx) => {
                const pageAnnots = [...annotations.filter(a => a.pageIndex === pIdx)].slice().reverse();
                if (pageAnnots.length === 0) return null;

                return (
                  <div key={pIdx} className="space-y-1.5">
                    <div className="text-xs font-bold text-[var(--text-secondary)] px-1">
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
                          className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all cursor-pointer ${
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

              {annotations.length === 0 && (
                <div className="py-8 text-center text-xs text-[var(--text-tertiary)] italic">
                  {mode === 'redact'
                    ? 'No redactions added yet. Click "Redact Box" above to blackout sensitive areas.'
                    : 'No elements added yet. Select a shape or text from the toolbar above to start editing.'}
                </div>
              )}
            </div>
          </div>

          {/* Save & Export Button */}
          <div className="p-4 border-t border-[var(--border-color)] bg-[var(--surface-color)]">
            <button
              onClick={handleSaveChanges}
              disabled={saving || annotations.length === 0}
              className={`w-full font-extrabold py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 text-xs transition-all ${
                annotations.length === 0
                  ? 'bg-zinc-800 text-zinc-300 border border-zinc-700 cursor-not-allowed opacity-90'
                  : 'bg-white hover:bg-zinc-100 text-zinc-950 border border-white cursor-pointer'
              }`}
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-current" />
                  <span className="font-extrabold text-xs">Compiling PDF Document...</span>
                </>
              ) : (
                <>
                  <span className="font-extrabold text-xs">Save & Export Document</span>
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
              Are you sure you want to remove all annotations, text boxes, shapes, and redactions from this document?
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
