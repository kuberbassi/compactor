import { ArrowRight, Check, Files } from 'lucide-react';
import type { CompactToolCapability } from '../compactTools';
import { CompactShell } from './CompactShell';

interface CompactToolIntroProps {
  tool: CompactToolCapability;
  onGoHome: () => void;
}

export function CompactToolIntro({ tool, onGoHome }: CompactToolIntroProps) {
  const { Icon } = tool;
  return (
    <CompactShell
      title={tool.route.title}
      onBack={onGoHome}
      action={<button type="button" className="compact-primary-action" disabled>Continue <ArrowRight aria-hidden="true" /></button>}
    >
      <section className="compact-tool-intro">
        <span className="compact-tool-intro__icon"><Icon aria-hidden="true" /></span>
        <p className="compact-kicker">Compact workflow · Phase {tool.launchPhase}</p>
        <h1>{tool.route.title}</h1>
        <p>{tool.shortDescription}</p>
      </section>
      <ol className="compact-step-list" aria-label="Compact workflow steps">
        <li><span><Files aria-hidden="true" /></span><div><strong>Add {tool.acceptsMultiple ? 'files' : 'a file'}</strong><small>Choose from your device. Nothing is uploaded.</small></div></li>
        <li><span><Check aria-hidden="true" /></span><div><strong>Choose simple options</strong><small>Useful defaults first, advanced controls when needed.</small></div></li>
        <li><span><ArrowRight aria-hidden="true" /></span><div><strong>Process and export</strong><small>See progress, then download or share the result.</small></div></li>
      </ol>
      <p className="compact-build-note" role="status">The compact shell is ready. Processing controls arrive in the next implementation phase.</p>
    </CompactShell>
  );
}
