import type { ReactNode } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Badge } from '../ui/badge';

interface WorkspaceShellProps {
  title: string;
  fileName?: string;
  fileMeta?: string;
  status?: string;
  statusDetail?: string;
  onExit: () => void;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function WorkspaceShell({
  title,
  fileName,
  fileMeta,
  onExit,
  actions,
  children,
  className = '',
}: WorkspaceShellProps) {
  return (
    <section className={`workspace-shell ${className}`} aria-label={`${title} workspace`}>
      <header className="workspace-command-bar">
        <div className="workspace-command-bar__identity">
          <button type="button" onClick={onExit} className="workspace-icon-button" aria-label={`Exit ${title}`} title="Back to all tools">
            <ArrowLeft aria-hidden="true" />
          </button>
          <div className="workspace-document-mark" aria-hidden="true" />
          <div className="workspace-document-name">
            <strong>{fileName || title}</strong>
            <span>{fileMeta || 'Local workspace'}</span>
          </div>
        </div>

        <div className="workspace-command-bar__title" aria-hidden="true">{title}</div>

        <div className="workspace-command-bar__actions">
          <Badge variant="outline" className="workspace-private-badge"><ShieldCheck aria-hidden="true" /> Private</Badge>
          {actions}
        </div>
      </header>

      <div className="workspace-shell__content">{children}</div>
    </section>
  );
}
