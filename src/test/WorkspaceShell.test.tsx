import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceShell } from '../components/Workspace/WorkspaceShell';

describe('WorkspaceShell', () => {
  it('presents the active document, actions, and local processing status', () => {
    render(
      <WorkspaceShell
        title="Image Editor"
        fileName="photo.png"
        fileMeta="1200 x 800"
        status="Ready to export"
        onExit={() => undefined}
        actions={<button type="button">Export</button>}
      >
        <div>Canvas</div>
      </WorkspaceShell>,
    );

    expect(screen.getByText('photo.png')).toBeInTheDocument();
    expect(screen.getByText('1200 x 800')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByText('Private')).toBeInTheDocument();
  });

  it('keeps the workspace header focused on document actions', () => {
    render(
      <WorkspaceShell title="Image Editor" onExit={() => undefined}>
        <div>Canvas</div>
      </WorkspaceShell>,
    );

    expect(screen.getByRole('region', { name: 'Image Editor workspace' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /focus mode/i })).not.toBeInTheDocument();
    expect(screen.getByText('Private')).toBeInTheDocument();
  });

  it('uses the exit action to return to the tool picker', () => {
    const onExit = vi.fn();
    render(
      <WorkspaceShell title="Image Editor" onExit={onExit}>
        <div>Canvas</div>
      </WorkspaceShell>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Exit Image Editor' }));
    expect(onExit).toHaveBeenCalledOnce();
  });
});
