import { compactToolForId } from './compactTools';
import { CompactHome } from './CompactHome';
import { CompactToolIntro } from './components/CompactToolIntro';
import { CompactUnsupported } from './components/CompactUnsupported';
import { CompactCompressor } from './CompactCompressor';
import { CompactMediaCompressor } from './CompactMediaCompressor';
import { CompactConverter } from './CompactConverter';
import { CompactPdfTool } from './CompactPdfTool';
import { CompactImagesToPdf } from './CompactImagesToPdf';
import { CompactAudioTool } from './CompactAudioTool';
import './compact.css';

interface CompactAppProps {
  activeToolId: string | null;
  onGoHome: () => void;
  onSelectTool: (toolId: string) => void;
  onProcessed?: (count: number) => void;
}

export function CompactApp({ activeToolId, onGoHome, onSelectTool, onProcessed = () => undefined }: CompactAppProps) {
  if (!activeToolId) return <CompactHome onSelectTool={onSelectTool} />;

  const compactTool = compactToolForId(activeToolId);
  if (compactTool?.launchPhase === 3) return <CompactCompressor tool={compactTool} onGoHome={onGoHome} onProcessed={onProcessed} />;
  if (compactTool?.launchPhase === 4) return <CompactMediaCompressor tool={compactTool} onGoHome={onGoHome} onProcessed={onProcessed} />;
  if (compactTool?.launchPhase === 5) return <CompactConverter onGoHome={onGoHome} onProcessed={onProcessed} />;
  if (compactTool?.launchPhase === 6 && compactTool.id === 'pdf-jpg-to-pdf') return <CompactImagesToPdf onGoHome={onGoHome} onProcessed={onProcessed} />;
  if (compactTool?.launchPhase === 6) return <CompactPdfTool tool={compactTool} onGoHome={onGoHome} onProcessed={onProcessed} />;
  if (compactTool?.launchPhase === 7) return <CompactAudioTool tool={compactTool} onGoHome={onGoHome} onProcessed={onProcessed} />;
  if (compactTool) return <CompactToolIntro tool={compactTool} onGoHome={onGoHome} />;

  return <CompactUnsupported toolId={activeToolId} onGoHome={onGoHome} onSelectTool={onSelectTool} />;
}
