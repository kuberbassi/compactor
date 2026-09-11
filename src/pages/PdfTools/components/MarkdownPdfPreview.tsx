import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { nextPreviewZoom } from '../../../utils/markdownPreviewZoom';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

function PdfPage({ pdf, number, width, scrollRoot }: { pdf: PDFDocumentProxy; number: number; width: number; scrollRoot: HTMLDivElement | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [ratio, setRatio] = useState(1.414);
  const [error, setError] = useState('');
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new IntersectionObserver(
      entries => setVisible(entries.some(entry => entry.isIntersecting)),
      { root: scrollRoot, rootMargin: '500px' },
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [scrollRoot]);
  useEffect(() => {
    if (!visible) {
      if (canvasRef.current) { canvasRef.current.width = 0; canvasRef.current.height = 0; }
      return;
    }
    let cancelled = false;
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    const render = async () => {
      const page = await pdf.getPage(number);
      if (cancelled || !canvasRef.current) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const viewport = page.getViewport({ scale: width / base.width * Math.min(window.devicePixelRatio || 1, 2) });
      const canvas = canvasRef.current;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      task = page.render({ canvas, viewport });
      await task.promise;
      if (!cancelled) setError('');
    };
    void render().catch(error => { if (!cancelled) setError(error instanceof Error ? error.message : 'Could not render page'); });
    return () => { cancelled = true; task?.cancel(); };
  }, [pdf, number, width, visible]);
  return <figure className={`markdown-pdf-page ${error ? 'has-error' : ''}`} style={{ width }}>
    <canvas ref={canvasRef} role="img" aria-label={`PDF page ${number}`} style={{ width, height: width * ratio }} />
    <figcaption className={error ? '' : 'sr-only'}>{error || `Page ${number}`}</figcaption>
  </figure>;
}

export function MarkdownPdfPreview({ blob, zoom, onZoomChange, scrollProgress, onScrollProgress }: {
  blob: Blob;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  scrollProgress?: number;
  onScrollProgress?: (progress: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressScrollReportRef = useRef(false);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(480);
  const [loaded, setLoaded] = useState<{ blob: Blob; pdf: PDFDocumentProxy } | null>(null);
  const pdf = loaded?.blob === blob ? loaded.pdf : null;
  const [error, setError] = useState('');
  const setContainer = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    setScrollRoot(node);
  }, []);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(120, entries[0].contentRect.width - 40)));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    let loading: ReturnType<typeof pdfjs.getDocument> | undefined;
    void blob.arrayBuffer().then(async data => {
      if (cancelled) return;
      loading = pdfjs.getDocument({ data: new Uint8Array(data), verbosity: 0 });
      const document = await loading.promise;
      if (!cancelled) { setLoaded({ blob, pdf: document }); setError(''); }
    }).catch(error => { if (!cancelled) setError(error instanceof Error ? error.message : 'Could not open preview'); });
    return () => { cancelled = true; void loading?.destroy(); };
  }, [blob]);
  const pageWidth = width * (zoom / 100);
  useEffect(() => {
    const container = containerRef.current;
    if (!container || scrollProgress === undefined) return;
    const maxScroll = container.scrollHeight - container.clientHeight;
    if (maxScroll <= 0) return;
    const target = maxScroll * scrollProgress;
    if (Math.abs(container.scrollTop - target) <= 1) return;
    suppressScrollReportRef.current = true;
    container.scrollTop = target;
    requestAnimationFrame(() => { suppressScrollReportRef.current = false; });
  }, [pageWidth, pdf, scrollProgress]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = container.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const contentX = container.scrollLeft + pointerX;
      const contentY = container.scrollTop + pointerY;
      const currentScale = zoom / 100;
      const next = nextPreviewZoom(currentScale, event.deltaY);
      if (Math.abs(next - currentScale) < 0.001) return;
      const ratio = next / currentScale;
      onZoomChange(Math.round(next * 100));
      requestAnimationFrame(() => {
        container.scrollLeft = contentX * ratio - pointerX;
        container.scrollTop = contentY * ratio - pointerY;
      });
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [onZoomChange, zoom]);
  return <div
    className="markdown-pdf-viewport workbench-scroll-region"
    ref={setContainer}
    tabIndex={0}
    aria-label={`Scrollable PDF page preview, ${zoom}% zoom. Hold Control or Command and scroll to zoom.`}
    onScroll={onScrollProgress ? event => {
      if (suppressScrollReportRef.current) return;
      const node = event.currentTarget;
      const maxScroll = node.scrollHeight - node.clientHeight;
      onScrollProgress(maxScroll > 0 ? node.scrollTop / maxScroll : 0);
    } : undefined}
  >
    <div className="markdown-pdf-pages">
      {error && <p role="alert">{error}</p>}
      {!pdf && !error && <p role="status">Opening PDF preview…</p>}
      {pdf && Array.from({ length: pdf.numPages }, (_, i) => <PdfPage key={`${pdf.fingerprints[0]}-${i}`} pdf={pdf} number={i + 1} width={pageWidth} scrollRoot={scrollRoot} />)}
    </div>
    <span className="sr-only" aria-live="polite">Preview zoom {zoom}%</span>
  </div>;
}
