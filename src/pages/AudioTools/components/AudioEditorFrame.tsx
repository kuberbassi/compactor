import React, { useState } from 'react';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { EditorSidebar } from '../../../components/Workspace/EditorChrome';
import { formatBytes } from '../../../utils/image';
import { AudioWorkspaceBar } from './AudioWorkspaceBar';
import { AudioModeNav, AudioModeRail } from './AudioModeNav';

interface AudioEditorFrameProps {
  file: File;
  activeTool: string;
  onSelectTool: (toolId: string) => void;
  onChangeFile: () => void;
  children: React.ReactNode;
  controls: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Shared editor chrome for all single-track Audio modes.  The mode changes the
 * controls and main content, while the navigation, source strip, and spacing
 * remain identical to the Video editor.
 */
export function AudioEditorFrame({
  file,
  activeTool,
  onSelectTool,
  onChangeFile,
  children,
  controls,
  action,
  className = '',
}: AudioEditorFrameProps) {
  const fileFormat = file.name.split('.').pop()?.toUpperCase() || 'AUDIO';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className={`audio-editor-frame ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''} ${className}`}>
      <EditorSidebar className={`audio-editor-frame__sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
        {sidebarCollapsed ? (
          <div className="audio-sidebar-rail">
            <div className="flex flex-col items-center gap-1.5 w-full px-2">
              <button type="button" onClick={() => setSidebarCollapsed(false)} title="Expand audio controls" aria-label="Expand audio controls"><PanelLeft /></button>
              <div className="w-6 h-px bg-white/10 my-1" />
              <AudioModeRail activeId={activeTool} onChange={(id) => { onSelectTool(id); setSidebarCollapsed(false); }} />
            </div>
          </div>
        ) : (
          <>
            <div className="audio-mode-sidebar-heading">
              <div className="audio-mode-sidebar-heading__title"><strong>Audio controls</strong><span>{fileFormat}</span></div>
              <button type="button" onClick={() => setSidebarCollapsed(true)} title="Collapse audio controls" aria-label="Collapse audio controls"><PanelLeftClose /></button>
            </div>
            <AudioModeNav activeId={activeTool} onChange={onSelectTool} />
            <div className="audio-editor-frame__controls">{controls}</div>
            {action ? <div className="audio-editor-frame__action">{action}</div> : null}
          </>
        )}
      </EditorSidebar>

      <main className="audio-editor-frame__main">
        <AudioWorkspaceBar
          title={file.name}
          meta={`${fileFormat} source · ${formatBytes(file.size)}`}
          onRemove={onChangeFile}
        />
        <div className="audio-editor-frame__preview">{children}</div>
      </main>
    </div>
  );
}
