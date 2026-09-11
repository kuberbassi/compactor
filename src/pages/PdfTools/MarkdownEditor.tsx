import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3, Heading4,
  List, ListOrdered, CheckSquare, Quote, Terminal, Table as TableIcon,
  Link as LinkIcon, Image as ImageIcon, Minus, Eraser, FileText, Download,
  Eye, Columns2, Edit3, Copy, Check, RefreshCw
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { compileMarkdownPdf } from '../../utils/markdownPdf';
import { MarkdownPdfPreview } from './components/MarkdownPdfPreview';
import '../../styles/markdown.css';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ErrorBanner } from '../../components/Common/ErrorBanner';
import { WorkspaceZoomControls } from '../../components/Workspace/WorkspaceControls';

interface MarkdownEditorProps {
  initialContent?: string;
  onGoHome?: () => void;
  onExportSuccess?: () => void;
}

type ViewMode = 'split' | 'edit' | 'preview';

function ViewModeButton({ mode, activeMode, label, Icon, onSelect }: {
  mode: ViewMode;
  activeMode: ViewMode;
  label: string;
  Icon: LucideIcon;
  onSelect: (mode: ViewMode) => void;
}) {
  const active = mode === activeMode;
  return <button
    type="button"
    onClick={() => onSelect(mode)}
    aria-pressed={active}
    className={`markdown-view-button ${active ? 'is-active' : ''}`}
  >
    <Icon aria-hidden="true" />
    <span>{label}</span>
  </button>;
}

function FormattingButton({ label, Icon, onClick, tone }: {
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
  tone?: 'danger';
}) {
  return <button
    type="button"
    onClick={onClick}
    className={`markdown-format-button ${tone ? `is-${tone}` : ''}`}
    title={label}
    aria-label={label}
  >
    <Icon aria-hidden="true" />
  </button>;
}

function ToolbarDivider() {
  return <span className="markdown-format-divider" aria-hidden="true" />;
}

const TEMPLATES = [
  {
    name: 'GitHub README',
    content: `# Project Name

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)

A modern, high-performance web application built for everyday document workflows.

## Key Features
- **Instant Processing:** Fast client-side execution with zero latency.
- **Privacy First:** 100% local document handling on your machine.
- **Theme Parity:** Full dark/light mode charcoal design system.

## Quick Start

\`\`\`bash
# Clone the repository
git clone https://github.com/username/project-name.git

# Install dependencies
npm install

# Start local server
npm run dev
\`\`\`

## Usage Example

\`\`\`typescript
import { compileDocument } from './utils/processor';

const result = await compileDocument({
  title: 'My Project Document',
  exportPdf: true
});
\`\`\`

## License
Distributed under the MIT License. See \`LICENSE\` for details.
`,
  },
  {
    name: 'Blank',
    content: `# Document Title

Start typing your markdown content here...
`,
  },
  {
    name: 'Meeting Notes',
    content: `# Meeting Notes
**Date:** August 6, 2026 | **Attendees:** Product, Engineering, Design

## Agenda Topics
1. Review quarterly roadmap milestones
2. Finalize document editor feature set

## Key Decisions
- [x] Finalize PDF shape editor & redaction controls
- [x] Upgrade Markdown tool to rich interactive editor
- [ ] Schedule staging verification build

> **Note:** Follow-up sync scheduled for next Tuesday at 10 AM.
`,
  },
  {
    name: 'Project Proposal',
    content: `# Project Proposal

## Overview
Brief introduction to the proposed project goals, technical scope, and expected deliverables.

## Scope & Objectives
- **Objective 1:** Deliver high-performance document editing features.
- **Objective 2:** Ensure 100% color contrast and global theme compliance.

## Technical Architecture
\`\`\`typescript
const architecture = {
  editor: 'React + TypeScript',
  pdfEngine: 'pdf-lib & pdfjs-dist',
  theme: 'Global Charcoal Theme System'
};
\`\`\`

## Timeline & Deliverables
| Phase | Duration | Key Output |
| :--- | :--- | :--- |
| Phase 1 | 1 Week | Architecture & UI Specs |
| Phase 2 | 2 Weeks | Core Feature Implementation |
| Phase 3 | 1 Week | QA Verification & Release |
`,
  },
  {
    name: 'API Specification',
    content: `# API Specification

## Endpoint: Compile PDF
POST \`/api/v1/documents/compile\`

### Request Headers
| Header | Type | Description |
| :--- | :--- | :--- |
| \`Content-Type\` | \`application/json\` | JSON payload |
| \`Authorization\` | \`Bearer <token>\` | Bearer auth token |

### Request Body Example
\`\`\`json
{
  "title": "Quarterly Performance Report",
  "format": "pdf",
  "includeHeader": true
}
\`\`\`

### Response
\`\`\`json
{
  "status": "success",
  "documentId": "doc_9823471029",
  "downloadUrl": "https://example.com/exports/doc.pdf"
}
\`\`\`
`,
  }
];

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  initialContent,
  onExportSuccess
}) => {
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>('GitHub README');
  const [markdown, setMarkdown] = useState<string>(
    initialContent ?? TEMPLATES[0].content
  );
  const [viewMode, setViewMode] = useState<ViewMode>(() => window.matchMedia?.('(max-width: 767px)').matches ? 'edit' : 'split');
  const [copied, setCopied] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const suppressEditorScrollRef = useRef(false);
  const [retry, setRetry] = useState(0);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [splitScrollProgress, setSplitScrollProgress] = useState(0);
  const [compiled, setCompiled] = useState<{ key: string; blob: Blob; warnings: string[] } | null>(null);
  const [compileError, setCompileError] = useState<{ key: string; message: string } | null>(null);
  const compileQueue = useRef<Promise<unknown>>(Promise.resolve());
  const documentKey = JSON.stringify([markdown, selectedTemplateName]);
  const ready = compiled?.key === documentKey;
  const failed = compileError?.key === documentKey;

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      compileQueue.current = compileQueue.current.catch(() => undefined).then(async () => {
        if (cancelled) return;
        try {
          const result = await compileMarkdownPdf(markdown, selectedTemplateName);
          if (!cancelled) { setCompiled({ key: documentKey, ...result }); setCompileError(null); }
        } catch (error) {
          if (!cancelled) setCompileError({ key: documentKey, message: error instanceof Error ? error.message : 'Could not compile PDF.' });
        }
      });
    }, 450);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [markdown, selectedTemplateName, documentKey, retry]);

  // Helper to insert markdown text at cursor position
  const insertFormatting = (prefix: string, suffix: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = markdown.substring(start, end) || defaultText;
    const replacement = `${prefix}${selected}${suffix}`;

    const newMd = markdown.substring(0, start) + replacement + markdown.substring(end);
    setMarkdown(newMd);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selected.length
      );
    }, 10);
  };

  const insertLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = markdown.lastIndexOf('\n', start - 1) + 1;
    const newMd = markdown.substring(0, lineStart) + prefix + markdown.substring(lineStart);
    setMarkdown(newMd);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 10);
  };

  const insertTable = () => {
    const tableMd = `\n| Header 1 | Header 2 | Header 3 |\n| :--- | :---: | ---: |\n| Cell 1 | Cell 2 | Cell 3 |\n| Cell 4 | Cell 5 | Cell 6 |\n\n`;
    insertFormatting('', tableMd, '');
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not copy Markdown.');
    }
  };

  const handleDownloadMdFile = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanName = (selectedTemplateName || 'document').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    a.download = `${cleanName}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = useCallback(async () => {
    setIsExporting(true);
    try {
      if (!ready || !compiled) throw new Error('Wait for the updated PDF preview before downloading.');
      const pdfBlob = compiled.blob;
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      const cleanName = (selectedTemplateName || 'document').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
      a.download = `${cleanName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (onExportSuccess) onExportSuccess();
    } catch (err) {
      console.error('Failed exporting MD to PDF:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Could not export the Markdown preview.');
    } finally {
      setIsExporting(false);
    }
  }, [compiled, onExportSuccess, ready, selectedTemplateName]);

  useEffect(() => {
    const handlePrintShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'p') return;
      if (!editorRef.current?.contains(document.activeElement)) return;
      event.preventDefault();
      void handleExportPdf();
    };
    window.addEventListener('keydown', handlePrintShortcut);
    return () => window.removeEventListener('keydown', handlePrintShortcut);
  }, [handleExportPdf]);

  // Stats
  const wordsCount = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
  const charsCount = markdown.length;
  const readTimeMin = Math.ceil(wordsCount / 200);
  const syncEditorScroll = useCallback((progress: number) => {
    if (viewMode !== 'split' || !textareaRef.current) return;
    const textarea = textareaRef.current;
    const maxScroll = textarea.scrollHeight - textarea.clientHeight;
    if (maxScroll <= 0) return;
    const target = maxScroll * progress;
    if (Math.abs(textarea.scrollTop - target) <= 1) return;
    suppressEditorScrollRef.current = true;
    textarea.scrollTop = target;
    requestAnimationFrame(() => { suppressEditorScrollRef.current = false; });
  }, [viewMode]);

  return (
    <div ref={editorRef} className="markdown-editor flex flex-col h-full flex-1 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-color)] text-[var(--text-primary)] shadow-xl overflow-hidden">
      {errorMessage && (
        <div className="p-3 bg-zinc-950/80 border-b border-zinc-800">
          <ErrorBanner 
            message={errorMessage} 
            onDismiss={() => setErrorMessage(null)} 
            onRetry={handleExportPdf} 
          />
        </div>
      )}

      {/* Top Header Controls */}
      <div className="markdown-editor__header border-b border-[var(--border-color)] bg-[var(--surface-hover)] px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap sticky top-0 z-30">
        {/* Template selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-[var(--surface-color)] px-3 py-1 rounded-xl border border-[var(--border-color)] text-xs">
            <span className="text-[var(--text-secondary)] font-semibold whitespace-nowrap">Template</span>
            <Select
              value={selectedTemplateName}
              onValueChange={(tName) => {
                if (!tName) return;
                setSelectedTemplateName(tName);
                const found = TEMPLATES.find(t => t.name === tName);
                if (found) setMarkdown(found.content);
              }}
            >
              <SelectTrigger className="w-[160px] h-7 text-xs bg-[var(--surface-hover)] border-[var(--border-color)] text-[var(--text-primary)] font-bold rounded-lg cursor-pointer">
                <SelectValue>{selectedTemplateName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map(t => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* View Switcher & Action buttons */}
        <div className="flex items-center gap-3 flex-wrap">

          <div className="h-6 w-px bg-[var(--border-color)]" />

          {/* View Switcher */}
          <div className="markdown-view-switcher" role="group" aria-label="Workspace view">
            <ViewModeButton mode="split" activeMode={viewMode} label="Split" Icon={Columns2} onSelect={setViewMode} />
            <ViewModeButton mode="edit" activeMode={viewMode} label="Write" Icon={Edit3} onSelect={setViewMode} />
            <ViewModeButton mode="preview" activeMode={viewMode} label="Preview" Icon={Eye} onSelect={setViewMode} />
          </div>

          <div className="h-6 w-px bg-[var(--border-color)]" />

          {/* Actions */}
          <button
            type="button"
            aria-label="Copy Markdown"
            onClick={handleCopyMarkdown}
            className={`markdown-command-button text-xs flex items-center gap-1.5 transition font-extrabold cursor-pointer ${
              copied
                ? 'bg-emerald-500 text-black border border-emerald-400'
                : 'bg-zinc-900 text-white hover:bg-zinc-800 border border-zinc-700'
            }`}
            title="Copy Markdown"
          >
            {copied ? <Check className="w-4 h-4 text-black stroke-[3]" /> : <Copy className="w-4 h-4 text-white stroke-[2.5]" />}
            <span className="markdown-action-label markdown-action-label--wide">{copied ? 'Copied' : 'Copy'}</span>
            <span className="markdown-action-label markdown-action-label--compact">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            type="button"
            aria-label="Download Markdown"
            onClick={handleDownloadMdFile}
            className="markdown-command-button bg-zinc-900 hover:bg-zinc-800 text-white text-xs flex items-center gap-1.5 border border-zinc-700 transition font-extrabold cursor-pointer"
            title="Download Markdown"
          >
            <FileText className="w-4 h-4 text-white stroke-[2.5]" />
            <span className="markdown-action-label markdown-action-label--wide">Markdown</span>
            <span className="markdown-action-label markdown-action-label--compact">MD</span>
          </button>

          <button
            type="button"
            aria-label="Download PDF"
            onClick={handleExportPdf}
            disabled={isExporting || !ready}
            className="markdown-command-button bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold text-xs border border-zinc-700 shadow-md flex items-center gap-1.5 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: '#18181b', color: '#ffffff' }}
            title="Download PDF"
          >
            {isExporting ? (
              <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-white" style={{ color: '#ffffff' }} />
            ) : (
              <Download className="w-4 h-4 shrink-0 stroke-[2.5] text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
            )}
            <span className="markdown-action-label markdown-action-label--wide font-extrabold text-xs text-white" style={{ color: '#ffffff' }}>PDF</span>
            <span className="markdown-action-label markdown-action-label--compact font-extrabold text-xs text-white" style={{ color: '#ffffff' }}>PDF</span>
          </button>
        </div>
      </div>

      {/* Rich Formatting Toolbar */}
      <div className="markdown-editor__formatting border-b border-[var(--border-color)] bg-[var(--surface-color)] px-6 py-2 flex items-center gap-1 overflow-x-auto text-[var(--text-secondary)]" aria-label="Markdown formatting toolbar">
        <FormattingButton label="Bold (**text**)" Icon={Bold} onClick={() => insertFormatting('**', '**', 'bold text')} />
        <FormattingButton label="Italic (*text*)" Icon={Italic} onClick={() => insertFormatting('*', '*', 'italic text')} />
        <FormattingButton label="Strikethrough (~~text~~)" Icon={Strikethrough} onClick={() => insertFormatting('~~', '~~', 'strikethrough')} />
        <FormattingButton label="Inline code (`code`)" Icon={Code} onClick={() => insertFormatting('`', '`', 'code')} />
        <ToolbarDivider />
        <FormattingButton label="Heading 1" Icon={Heading1} onClick={() => insertLinePrefix('# ')} />
        <FormattingButton label="Heading 2" Icon={Heading2} onClick={() => insertLinePrefix('## ')} />
        <FormattingButton label="Heading 3" Icon={Heading3} onClick={() => insertLinePrefix('### ')} />
        <FormattingButton label="Heading 4" Icon={Heading4} onClick={() => insertLinePrefix('#### ')} />
        <ToolbarDivider />
        <FormattingButton label="Bulleted list" Icon={List} onClick={() => insertLinePrefix('- ')} />
        <FormattingButton label="Numbered list" Icon={ListOrdered} onClick={() => insertLinePrefix('1. ')} />
        <FormattingButton label="Task checklist" Icon={CheckSquare} onClick={() => insertLinePrefix('- [ ] ')} />
        <ToolbarDivider />
        <FormattingButton label="Blockquote" Icon={Quote} onClick={() => insertLinePrefix('> ')} />
        <FormattingButton label="Code block" Icon={Terminal} onClick={() => insertFormatting('\n```typescript\n', '\n```\n', '// code here')} />
        <FormattingButton label="Table" Icon={TableIcon} onClick={insertTable} />
        <ToolbarDivider />
        <FormattingButton label="Link" Icon={LinkIcon} onClick={() => insertFormatting('[', '](https://example.com)', 'link text')} />
        <FormattingButton label="Image" Icon={ImageIcon} onClick={() => insertFormatting('![', '](https://example.com/image.png)', 'alt text')} />
        <FormattingButton label="Horizontal rule" Icon={Minus} onClick={() => insertFormatting('\n---\n')} />
        <ToolbarDivider />
        <FormattingButton label="Clear Markdown" Icon={Eraser} tone="danger" onClick={() => setMarkdown('')} />
        {viewMode !== 'edit' && <WorkspaceZoomControls
          value={previewZoom}
          onChange={setPreviewZoom}
          min={60}
          max={250}
          step={10}
          className="markdown-preview-zoom"
        />}
      </div>

      {/* Main Workspace */}
      <div className={`markdown-editor__workspace markdown-editor__workspace--${viewMode} flex-1 flex flex-col md:flex-row overflow-hidden relative`}>
        {/* Raw Markdown Editor Area */}
        {(viewMode === 'split' || viewMode === 'edit') && (
          <div className="markdown-source-pane flex-1 flex flex-col bg-[var(--bg-color)] border-b md:border-b-0 md:border-r border-[var(--border-color)] overflow-hidden min-h-[300px] md:min-h-0">
            <textarea
              ref={textareaRef}
              value={markdown}
              onChange={e => setMarkdown(e.target.value)}
              onScroll={viewMode === 'split' ? event => {
                if (suppressEditorScrollRef.current) return;
                const node = event.currentTarget;
                const maxScroll = node.scrollHeight - node.clientHeight;
                setSplitScrollProgress(maxScroll > 0 ? node.scrollTop / maxScroll : 0);
              } : undefined}
              placeholder="Start writing Markdown..."
              className="markdown-source-input w-full h-full bg-transparent text-[var(--text-primary)] font-mono text-sm leading-relaxed resize-none focus:outline-none placeholder:text-[var(--text-tertiary)]"
              aria-label="Markdown source"
            />
          </div>
        )}

        {viewMode !== 'edit' && (
          <div className="markdown-pdf-preview" aria-busy={!ready && !failed}>
            {(!ready || failed || Boolean(compiled?.warnings.length)) && <div className={`markdown-pdf-notice ${failed ? 'is-error' : ''}`} role="status">
              {failed ? compileError.message : !ready ? 'Updating PDF preview...' : null}
              {failed && <button className="underline ml-2" onClick={() => setRetry(value => value + 1)}>Retry</button>}
              {ready && compiled.warnings.map(warning => <p key={warning}>{warning}</p>)}
            </div>}
            {compiled && <MarkdownPdfPreview
              blob={compiled.blob}
              zoom={previewZoom}
              onZoomChange={setPreviewZoom}
              scrollProgress={viewMode === 'split' ? splitScrollProgress : undefined}
              onScrollProgress={viewMode === 'split' ? syncEditorScroll : undefined}
            />}
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className="markdown-editor__status border-t border-[var(--border-color)] bg-[var(--surface-hover)] px-6 py-2.5 flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-4">
          <span><strong>{wordsCount}</strong> words</span>
          <span><strong>{charsCount}</strong> characters</span>
          <span><strong>{readTimeMin}</strong> min read</span>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span>{failed ? 'Preview unavailable' : ready ? 'Ready to download' : 'Updating preview...'}</span>
        </div>
      </div>
    </div>
  );
};
