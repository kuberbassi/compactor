import type { ReactNode } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { BrandMark } from '../../components/Common/BrandMark';

interface CompactShellProps {
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  children: ReactNode;
  action?: ReactNode;
}

export function CompactShell({ title, eyebrow = 'Compact Compactor', onBack, children, action }: CompactShellProps) {
  return (
    <div className="compact-app">
      <header className="compact-header">
        {onBack ? (
          <button type="button" className="compact-icon-button" onClick={onBack} aria-label="Go back">
            <ArrowLeft aria-hidden="true" />
          </button>
        ) : (
          <span className="compact-brand-mark" aria-hidden="true"><BrandMark /></span>
        )}
        <div className="compact-header__copy">
          <span>{eyebrow}</span>
          <strong>{title}</strong>
        </div>
        <span className="compact-private-badge"><ShieldCheck aria-hidden="true" /> Private</span>
      </header>

      <main id="compact-main-content" className="compact-main">{children}</main>
      {action ? <footer className="compact-action-bar">{action}</footer> : null}
    </div>
  );
}
