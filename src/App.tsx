import { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { Footer } from './components/Common/Footer';
import { Dashboard } from './pages/Dashboard';
import { VideoCompressor } from './pages/VideoCompressor/VideoCompressor';
import { ImageTools } from './pages/ImageTools/ImageTools';
import { PdfTools } from './pages/PdfTools/PdfTools';
import { AudioTools } from './pages/AudioTools/AudioTools';
import { UniversalConverter } from './pages/UniversalConverter/UniversalConverter';
import { Rasterbator } from './pages/Rasterbator/Rasterbator';
import { MetadataEditor } from './pages/MetadataEditor/MetadataEditor';
import { NotFound } from './pages/NotFound';
import { Diagnostics } from './pages/Diagnostics';
import SimpleNav from './components/ui/SimpleNav';

function MainApp() {
  const [activeToolId, setActiveToolId] = useState<string | null>(() => window.location.hash.slice(1) || null);
  const [uploadCount, setUploadCount] = useState<number>(() => {
    const saved = localStorage.getItem('compactor_upload_count');
    return saved ? parseInt(saved, 10) : 0;
  });

  useEffect(() => {
    const handleHashChange = () => {
      setActiveToolId(window.location.hash.slice(1) || null);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const incrementUploadCount = () => {
    setUploadCount((prev) => {
      const next = prev + 1;
      localStorage.setItem('compactor_upload_count', next.toString());
      return next;
    });
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
      case 'diagnostics':
        return <Diagnostics onGoHome={goHome} />;
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

      <main className={`main-content ${activeToolId ? 'tool-page-active' : ''}`}>
        {renderContent()}
      </main>
      <Footer />
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
