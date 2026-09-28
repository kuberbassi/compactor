import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { Footer } from './components/Common/Footer';
import { EmbedWatermark } from './components/Common/EmbedWatermark';
import { Dashboard } from './pages/Dashboard';
import SimpleNav from './components/ui/SimpleNav';
import { CommandPalette } from './components/Common/CommandPalette';
import { Skeleton } from './components/ui/skeleton';
import { pathForTool, toolIdFromLocation, updateToolMetadata } from './config/toolRoutes';

import { getProcessedCount, recordProcessedFiles } from './utils/counterStorage';
import type { ProcessedCountSnapshot } from './utils/counterStorage';
import { useLayoutMode } from './compact/hooks/useLayoutMode';

const VideoCompressor = lazy(() => import('./pages/VideoCompressor/VideoCompressor').then(m => ({ default: m.VideoCompressor })));
const ImageTools = lazy(() => import('./pages/ImageTools/ImageTools').then(m => ({ default: m.ImageTools })));
const PdfTools = lazy(() => import('./pages/PdfTools/PdfTools').then(m => ({ default: m.PdfTools })));
const AudioTools = lazy(() => import('./pages/AudioTools/AudioTools').then(m => ({ default: m.AudioTools })));
const UniversalConverter = lazy(() => import('./pages/UniversalConverter/UniversalConverter').then(m => ({ default: m.UniversalConverter })));
const Rasterbator = lazy(() => import('./pages/Rasterbator/Rasterbator').then(m => ({ default: m.Rasterbator })));
const MetadataEditor = lazy(() => import('./pages/MetadataEditor/MetadataEditor').then(m => ({ default: m.MetadataEditor })));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const TermsConditions = lazy(() => import('./pages/TermsConditions').then(m => ({ default: m.TermsConditions })));
const NotFound = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));
const CompactApp = lazy(() => import('./compact/CompactApp').then(m => ({ default: m.CompactApp })));

function MainApp() {
  const layoutMode = useLayoutMode();
  const seenCompactPresentation = useRef(layoutMode === 'compact');
  const seenFullPresentation = useRef(layoutMode === 'full');
  if (layoutMode === 'compact') seenCompactPresentation.current = true;
  else seenFullPresentation.current = true;
  const [activeToolId, setActiveToolId] = useState<string | null>(() => toolIdFromLocation(window.location));
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [recentToolIds, setRecentToolIds] = useState<string[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('compactor:recent-tools') || '[]');
      return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string').slice(0, 4) : [];
    } catch { return []; }
  });
  const [processedCount, setProcessedCount] = useState<ProcessedCountSnapshot>({ count: 0, scope: 'device' });

  useEffect(() => {
    // Defer the non-critical metric request so it never delays the app.
    const startIdleTasks = () => {
      getProcessedCount().then(setProcessedCount);
    };

    let idleId: number | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    if ('requestIdleCallback' in window) {
      idleId = (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(startIdleTasks, { timeout: 2000 });
    } else {
      timerId = setTimeout(startIdleTasks, 200);
    }

    const handleLocationChange = () => {
      setActiveToolId(toolIdFromLocation(window.location));
    };
    const handleCustomCountUpdate = (e: Event) => {
      const customEv = e as CustomEvent<ProcessedCountSnapshot>;
      if (customEv.detail && typeof customEv.detail.count === 'number') {
        setProcessedCount(customEv.detail);
      }
    };

    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('compactor:count-updated', handleCustomCountUpdate);
    return () => {
      if (idleId && 'cancelIdleCallback' in window) {
        (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
      }
      if (timerId) clearTimeout(timerId);
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('compactor:count-updated', handleCustomCountUpdate);
    };
  }, []);

  useEffect(() => {
    updateToolMetadata(activeToolId);
  }, [activeToolId]);

  useEffect(() => {
    const handleCommandShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(value => !value);
      }
    };
    window.addEventListener('keydown', handleCommandShortcut);
    return () => window.removeEventListener('keydown', handleCommandShortcut);
  }, []);

  const incrementUploadCount = (amount: number = 1) => {
    recordProcessedFiles(amount).then(setProcessedCount);
  };

  const goHome = () => {
    window.history.pushState(null, '', '/');
    setActiveToolId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectTool = (toolId: string) => {
    window.history.pushState(null, '', pathForTool(toolId));
    setActiveToolId(toolId);
    setRecentToolIds(previous => {
      const next = [toolId, ...previous.filter(id => id !== toolId)].slice(0, 4);
      try { localStorage.setItem('compactor:recent-tools', JSON.stringify(next)); } catch { /* recent tools are optional */ }
      return next;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderContent = () => {
    switch (activeToolId) {
      case 'video-compressor':
        return <VideoCompressor mode="compress" onGoHome={goHome} onSelectTool={selectTool} onUploadSuccess={incrementUploadCount} />;
      case 'video-trim':
        return <VideoCompressor mode="compress" initialTab="trim" onGoHome={goHome} onSelectTool={selectTool} onUploadSuccess={incrementUploadCount} />;
      case 'video-convert':
        return <VideoCompressor mode="compress" initialTab="format" onGoHome={goHome} onSelectTool={selectTool} onUploadSuccess={incrementUploadCount} />;
      case 'video-to-gif':
        return <VideoCompressor mode="gif" onGoHome={goHome} onSelectTool={selectTool} onUploadSuccess={incrementUploadCount} />;
      case 'video-to-audio':
        return <VideoCompressor mode="to-audio" onGoHome={goHome} onSelectTool={selectTool} onUploadSuccess={incrementUploadCount} />;
      case 'video-mute':
        return <VideoCompressor mode="mute" onGoHome={goHome} onSelectTool={selectTool} onUploadSuccess={incrementUploadCount} />;
      case 'image-optimizer':
        return <ImageTools onGoHome={goHome} onSelectTool={selectTool} onUploadSuccess={incrementUploadCount} />;
      case 'image-resize':
        return <ImageTools initialTab="resize" onGoHome={goHome} onSelectTool={selectTool} onUploadSuccess={incrementUploadCount} />;
      case 'image-crop':
        return <ImageTools initialTab="crop" onGoHome={goHome} onSelectTool={selectTool} onUploadSuccess={incrementUploadCount} />;
      case 'image-convert':
        return <ImageTools initialTab="format" onGoHome={goHome} onSelectTool={selectTool} onUploadSuccess={incrementUploadCount} />;
      case 'image-watermark':
        return <ImageTools initialTab="watermark" onGoHome={goHome} onSelectTool={selectTool} onUploadSuccess={incrementUploadCount} />;
      case 'pdf-jpg-to-pdf':
        return <ImageTools initialTab="image-to-pdf" onGoHome={goHome} onSelectTool={selectTool} onUploadSuccess={incrementUploadCount} />;
      case 'audio-optimizer':
      case 'audio-joiner':
      case 'audio-bpm-finder':
      case 'audio-pitch-speed':
        return <AudioTools mode={activeToolId} onGoHome={goHome} onSelectTool={selectTool} onUploadSuccess={incrementUploadCount} />;
      case 'universal-converter':
        return <UniversalConverter onGoHome={goHome} onSelectTool={selectTool} onUploadSuccess={incrementUploadCount} />;
      case 'convert-word-to-pdf':
        return <UniversalConverter initialTargetFormat="pdf" title="Word to PDF" description="Convert DOCX Word documents to PDF privately in your browser." onGoHome={goHome} onSelectTool={selectTool} onUploadSuccess={incrementUploadCount} />;
      case 'rasterbator':
        return <Rasterbator onGoHome={goHome} onSelectTool={selectTool} onUploadSuccess={incrementUploadCount} />;
      case 'metadata-editor':
        return <MetadataEditor onGoHome={goHome} onSelectTool={selectTool} onUploadSuccess={incrementUploadCount} />;
      case 'privacy':
        return <PrivacyPolicy onGoHome={goHome} />;
      case 'terms':
        return <TermsConditions onGoHome={goHome} />;
      default:
        if (activeToolId && activeToolId.startsWith('pdf-')) {
          return <PdfTools toolId={activeToolId} onGoHome={goHome} onUploadSuccess={incrementUploadCount} />;
        }
        return activeToolId ? <NotFound onGoHome={goHome} /> : <Dashboard onSelectTool={selectTool} processedCount={processedCount} recentToolIds={recentToolIds} onOpenSearch={() => setCommandPaletteOpen(true)} />;
    }
  };

  const isLegalPage = activeToolId === 'privacy' || activeToolId === 'terms';
  const compactPresentation = (
    <Suspense fallback={<div className="compact-app-loading" role="status">Loading Compact Compactor…</div>}>
      {isLegalPage ? <div className="compact-legal-page">{renderContent()}</div> : (
        <CompactApp activeToolId={activeToolId} onGoHome={goHome} onSelectTool={selectTool} onProcessed={incrementUploadCount} />
      )}
    </Suspense>
  );
  const fullPresentation = (
    <div
      className={`app-container relative ${activeToolId ? `app-tool app-tool--${activeToolId}` : 'app-home'}`}
      data-layout-mode="full"
    >
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div className="mesh-gradient-sphere-1" aria-hidden="true" />
      <div className="mesh-gradient-sphere-2" aria-hidden="true" />
      
      <SimpleNav
        onBrandClick={goHome}
        onLinkClick={selectTool}
        forceBg={!!activeToolId}
        activeToolId={activeToolId}
        onOpenSearch={() => setCommandPaletteOpen(true)}
      />

      <main 
        id="main-content"
        key={activeToolId || 'dashboard'} 
        className={`main-content page-entrance ${activeToolId ? 'tool-page-active' : ''}`}
      >
        <Suspense fallback={
          <div className="app-loading-shell" role="status" aria-label="Loading tool workspace">
            <div className="app-loading-shell__bar"><Skeleton className="h-7 w-48" /><Skeleton className="h-7 w-24" /></div>
            <div className="app-loading-shell__body">
              <Skeleton className="app-loading-shell__rail" />
              <div><Skeleton className="h-8 w-52" /><Skeleton className="mt-3 h-4 w-72 max-w-full" /><Skeleton className="mt-8 h-64 w-full" /></div>
            </div>
            <span className="sr-only">Loading module...</span>
          </div>
        }>
          {renderContent()}
        </Suspense>
      </main>
      <Footer onNavigate={selectTool} />
      <EmbedWatermark />
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} onSelectTool={selectTool} />
    </div>
  );

  return (
    <>
      {seenCompactPresentation.current ? <div hidden={layoutMode !== 'compact'} aria-hidden={layoutMode !== 'compact'}>{compactPresentation}</div> : null}
      {seenFullPresentation.current ? <div hidden={layoutMode !== 'full'} aria-hidden={layoutMode !== 'full'}>{fullPresentation}</div> : null}
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}

export default App;
