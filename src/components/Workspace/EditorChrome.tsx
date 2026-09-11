import React from 'react';
import { cn } from '../../lib/utils';

type EditorSurfaceProps = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
};

type EditorSidebarHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

export const EditorCommandBar: React.FC<EditorSurfaceProps> = ({ className, children, ...props }) => (
  <header className={cn('editor-command-bar', className)} {...props}>
    {children}
  </header>
);

export const EditorSidebar: React.FC<EditorSurfaceProps> = ({ className, children, ...props }) => (
  <aside className={cn('editor-sidebar', className)} {...props}>
    {children}
  </aside>
);

export const EditorSidebarHeader: React.FC<EditorSidebarHeaderProps> = ({ className, children, ...props }) => (
  <div className={cn('editor-sidebar__header', className)} {...props}>
    {children}
  </div>
);
