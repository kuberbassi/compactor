import { useState, useEffect, lazy, Suspense } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { Footer } from './components/Common/Footer';
import { Dashboard } from './pages/Dashboard';
import SimpleNav from './components/ui/SimpleNav';

import { getStoredUploadCount, incrementStoredUploadCount } from './utils/counterStorage';

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

function MainApp() {
  const [activeToolId, setActiveToolId] = useState<string | null>(() => window.location.hash.slice(1) || null);
  const [uploadCount, setUploadCount] = useState<number>(1489230);

  useEffect(() => {
    // Load count asynchronously from dual storage (localStorage + IndexedDB)
    getStoredUploadCount().then(setUploadCount);

    // Live organic background increment ticker (simulates global user activity)
    const tickInterval = setInterval(() => {
      if (Math.random() > 0.35) {
        const amount = Math.floor(Math.random() * 3) + 1;
        incrementStoredUploadCount(amount).then(setUploadCount);
      }
    }, Math.floor(Math.random() * 6000) + 7000);

    const handleHashChange = () => {
      setActiveToolId(window.location.hash.slice(1) || null);
    };
    const handleCustomCountUpdate = (e: Event) => {
      const customEv = e as CustomEvent<number>;
      if (typeof customEv.detail === 'number') {
        setUploadCount(customEv.detail);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('compactor:count-updated', handleCustomCountUpdate);
    return () => {
      clearInterval(tickInterval);
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('compactor:count-updated', handleCustomCountUpdate);
    };
  }, []);

  const incrementUploadCount = () => {
    incrementStoredUploadCount().then(setUploadCount);
  };

  const goHome = () => {
    window.history.replaceState(null, '', window.location.pathname);
    setActiveToolId(null);
  };

  const selectTool = (toolId: string) => {
    window.location.hash = toolId;
    setActiveToolId(toolId);
  };

  const renderContent = () => {
    switch (activeToolId) {
      case 'video-compressor':
        return <VideoCompressor mode="compress" onGoHome={goHome} onUploadSuccess={incrementUploadCount} />;
      case 'video-to-gif':
        return <VideoCompressor mode="gif" onGoHome={goHome} onUploadSuccess={incrementUploadCount} />;
      case 'video-to-audio':
        return <VideoCompressor mode="to-audio" onGoHome={goHome} onUploadSuccess={incrementUploadCount} />;
      case 'video-mute':
        return <VideoCompressor mode="mute" onGoHome={goHome} onUploadSuccess={incrementUploadCount} />;
      case 'image-optimizer':
        return <ImageTools onGoHome={goHome} onUploadSuccess={incrementUploadCount} />;
      case 'audio-optimizer':
        return <AudioTools onGoHome={goHome} onUploadSuccess={incrementUploadCount} />;
      case 'universal-converter':
        return <UniversalConverter onGoHome={goHome} onUploadSuccess={incrementUploadCount} />;
      case 'rasterbator':
        return <Rasterbator onGoHome={goHome} onUploadSuccess={incrementUploadCount} />;
      case 'metadata-editor':
        return <MetadataEditor onGoHome={goHome} onUploadSuccess={incrementUploadCount} />;
      case 'privacy':
        return <PrivacyPolicy onGoHome={goHome} />;
      case 'terms':
        return <TermsConditions onGoHome={goHome} />;
      default:
        if (activeToolId && activeToolId.startsWith('pdf-')) {
          return <PdfTools toolId={activeToolId} onGoHome={goHome} onUploadSuccess={incrementUploadCount} />;
        }
        if (activeToolId && activeToolId.startsWith('video-')) {
          return <VideoCompressor mode={activeToolId.replace('video-', '') as any} onGoHome={goHome} onUploadSuccess={incrementUploadCount} />;
        }
        return activeToolId ? <NotFound onGoHome={goHome} /> : <Dashboard onSelectTool={selectTool} uploadCount={uploadCount} />;
    }
  };

  return (
    <div className="app-container relative">
      <div className="mesh-gradient-sphere-1" aria-hidden="true" />
      <div className="mesh-gradient-sphere-2" aria-hidden="true" />
      
      <SimpleNav
        onBrandClick={goHome}
        onLinkClick={selectTool}
        forceBg={!!activeToolId}
        activeToolId={activeToolId}
      />

      <main 
        key={activeToolId || 'dashboard'} 
        className={`main-content page-entrance ${activeToolId ? 'tool-page-active' : ''}`}
      >
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-[50vh] text-xs font-mono text-zinc-400 gap-2">
            <span className="dot-glow-white shrink-0" />
            <span>Loading module...</span>
          </div>
        }>
          {renderContent()}
        </Suspense>
      </main>
      <Footer onNavigate={selectTool} />
    </div>
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
