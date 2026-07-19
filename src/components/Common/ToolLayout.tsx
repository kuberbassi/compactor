import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

export function ToolLayout({ title, description, icon, onBack, children, className }: {
  title: string; description: string; icon?: ReactNode; onBack: () => void; children: ReactNode; className?: string;
}) {
  return <section className={cn('tool-layout', className)}>
    <header className="tool-layout__header">
      <div className="tool-layout__title">
        {icon && <span className="tool-layout__icon">{icon}</span>}
        <div><h1>{title}</h1><p>{description}</p></div>
      </div>
      <button className="button button--quiet" onClick={onBack}><ArrowLeft size={15} /> All tools</button>
    </header>
    {children}
  </section>;
}

export function SurfaceCard({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('surface-card', className)}>{children}</section>;
}
