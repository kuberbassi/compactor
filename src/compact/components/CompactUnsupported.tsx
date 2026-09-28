import { ArrowRight, MonitorUp } from 'lucide-react';
import { compactAlternativesFor } from '../compactTools';
import { routeForTool } from '../../config/toolRoutes';
import { CompactShell } from './CompactShell';

interface CompactUnsupportedProps {
  toolId: string;
  onGoHome: () => void;
  onSelectTool: (toolId: string) => void;
}

export function CompactUnsupported({ toolId, onGoHome, onSelectTool }: CompactUnsupportedProps) {
  const route = routeForTool(toolId);
  const alternatives = compactAlternativesFor(toolId);

  return (
    <CompactShell title={route?.title || 'Tool not found'} onBack={onGoHome}>
      <section className="compact-message-card">
        <span className="compact-message-card__icon"><MonitorUp aria-hidden="true" /></span>
        <p className="compact-kicker">Full workspace tool</p>
        <h1>{route ? `${route.title} needs a larger editing workspace.` : 'This route is not available.'}</h1>
        <p>{route ? 'Open it on a tablet or laptop for the full editor, or use one of these compact alternatives now.' : 'Return to Compact Compactor and choose an available file task.'}</p>
      </section>

      {route ? (
        <section className="compact-section" aria-labelledby="compact-alternatives-title">
          <div className="compact-section__heading"><span>Available here</span><h2 id="compact-alternatives-title">Try a compact alternative</h2></div>
          <div className="compact-tool-grid">
            {alternatives.map(tool => (
              <button type="button" className="compact-tool-card" key={tool.id} onClick={() => onSelectTool(tool.id)}>
                <span className="compact-tool-card__icon"><tool.Icon aria-hidden="true" /></span>
                <span className="compact-tool-card__copy"><strong>{tool.route.title}</strong><small>{tool.shortDescription}</small></span>
                <ArrowRight aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </CompactShell>
  );
}
