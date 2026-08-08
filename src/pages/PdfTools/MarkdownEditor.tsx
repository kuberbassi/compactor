import React, { useState, useRef } from 'react';
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3, Heading4,
  List, ListOrdered, CheckSquare, Quote, Terminal, Table as TableIcon,
  Link as LinkIcon, Image as ImageIcon, Minus, Eraser, FileText, Download,
  Eye, Columns3, Edit3, Copy, Check, RefreshCw, FileCode
} from 'lucide-react';
import { markdownToPdf } from '../../utils/pdf';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

interface MarkdownEditorProps {
  initialContent?: string;
  onGoHome?: () => void;
  onExportSuccess?: () => void;
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
    initialContent || TEMPLATES[0].content
  );
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [copied, setCopied] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleCopyMarkdown = () => {
    try {
      navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed copying markdown:', err);
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

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const pdfBlob = await markdownToPdf(markdown);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      const cleanName = (selectedTemplateName || 'document').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
      a.download = `${cleanName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (onExportSuccess) onExportSuccess();
    } catch (err) {
      console.error('Failed exporting MD to PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Stats
  const wordsCount = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
  const charsCount = markdown.length;
  const readTimeMin = Math.ceil(wordsCount / 200);

  // Parse inline markdown syntax safely
  const parseInlineMarkdown = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded-xl my-3 border border-[var(--border-color)] shadow-md" />')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-white underline font-bold hover:text-zinc-300 transition">$1</a>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-extrabold text-[var(--text-primary)]">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic text-[var(--text-primary)]">$1</em>')
      .replace(/~~(.*?)~~/g, '<del class="line-through text-[var(--text-tertiary)]">$1</del>')
      .replace(/`([^`]+)`/g, '<code class="bg-zinc-800 text-zinc-100 px-1.5 py-0.5 rounded border border-zinc-700 font-mono text-[11px]">$1</code>');
  };

  // Render full HTML preview of Markdown
  const renderMarkdownToHtml = (md: string): string => {
    if (!md) return '';

    let content = md;
    const codeBlocks: string[] = [];

    // Extract codeblocks first to prevent inner parsing conflict
    content = content.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const placeholder = `___CODEBLOCK_${codeBlocks.length}___`;
      const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
      codeBlocks.push(
        `<div class="my-4 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 font-mono text-xs shadow-md">
          <div class="bg-zinc-900 px-4 py-1.5 border-b border-zinc-800 text-zinc-400 text-[11px] font-bold uppercase flex justify-between items-center">
            <span>${lang || 'code'}</span>
          </div>
          <pre class="p-4 overflow-x-auto text-zinc-200 leading-relaxed font-mono"><code>${escapedCode}</code></pre>
        </div>`
      );
      return placeholder;
    });

    const lines = content.split('\n');
    const resultLines: string[] = [];
    let inTable = false;
    let tableHeaderProcessed = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trimEnd();

      if (line.includes('___CODEBLOCK_')) {
        if (inTable) { resultLines.push('</tbody></table></div>'); inTable = false; }
        const index = parseInt(line.match(/___CODEBLOCK_(\d+)___/)?.[1] || '0', 10);
        resultLines.push(codeBlocks[index] || '');
        continue;
      }

      // GFM Tables
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          resultLines.push('<div class="overflow-x-auto my-4 rounded-xl border border-[var(--border-color)] shadow-sm"><table class="w-full text-left border-collapse text-xs">');
          inTable = true;
          tableHeaderProcessed = false;
        }

        if (line.includes('---')) {
          tableHeaderProcessed = true;
          resultLines.push('<tbody class="divide-y divide-[var(--border-color)] bg-[var(--surface-color)]">');
          continue;
        }

        const cells = line.split('|').slice(1, -1);
        if (!tableHeaderProcessed) {
          resultLines.push('<thead class="bg-[var(--surface-hover)] font-bold text-[var(--text-primary)] border-b border-[var(--border-color)]"><tr>');
          cells.forEach(c => {
            resultLines.push(`<th class="px-4 py-3 border-r border-[var(--border-color)] last:border-r-0 font-bold">${parseInlineMarkdown(c.trim())}</th>`);
          });
          resultLines.push('</tr></thead>');
        } else {
          resultLines.push('<tr class="hover:bg-[var(--surface-hover)] transition">');
          cells.forEach(c => {
            resultLines.push(`<td class="px-4 py-2.5 border-r border-[var(--border-color)] last:border-r-0 text-[var(--text-primary)]">${parseInlineMarkdown(c.trim())}</td>`);
          });
          resultLines.push('</tr>');
        }
        continue;
      } else if (inTable) {
        resultLines.push('</tbody></table></div>');
        inTable = false;
      }

      // Block Elements
      if (line.startsWith('# ')) {
        resultLines.push(`<h1 class="text-2xl font-black text-[var(--text-primary)] mt-6 mb-3 border-b border-[var(--border-color)] pb-2 tracking-tight">${parseInlineMarkdown(line.slice(2))}</h1>`);
      } else if (line.startsWith('## ')) {
        resultLines.push(`<h2 class="text-xl font-bold text-[var(--text-primary)] mt-5 mb-2 tracking-tight">${parseInlineMarkdown(line.slice(3))}</h2>`);
      } else if (line.startsWith('### ')) {
        resultLines.push(`<h3 class="text-lg font-bold text-[var(--text-primary)] mt-4 mb-1.5">${parseInlineMarkdown(line.slice(4))}</h3>`);
      } else if (line.startsWith('#### ')) {
        resultLines.push(`<h4 class="text-base font-bold text-[var(--text-secondary)] mt-3 mb-1">${parseInlineMarkdown(line.slice(5))}</h4>`);
      } else if (line.startsWith('> ')) {
        resultLines.push(`<blockquote class="border-l-4 border-white pl-4 py-2.5 my-3 text-[var(--text-primary)] bg-[var(--surface-hover)] rounded-r-xl font-medium italic shadow-xs">${parseInlineMarkdown(line.slice(2))}</blockquote>`);
      } else if (line.startsWith('- [x] ') || line.startsWith('* [x] ')) {
        resultLines.push(`<div class="flex items-center gap-2.5 my-1.5 text-xs text-[var(--text-primary)] font-medium"><span class="w-4 h-4 rounded bg-white text-zinc-950 flex items-center justify-center font-extrabold text-[10px] shrink-0">✓</span><span>${parseInlineMarkdown(line.slice(6))}</span></div>`);
      } else if (line.startsWith('- [ ] ') || line.startsWith('* [ ] ')) {
        resultLines.push(`<div class="flex items-center gap-2.5 my-1.5 text-xs text-[var(--text-secondary)] font-medium"><span class="w-4 h-4 rounded border border-zinc-600 bg-transparent flex items-center justify-center shrink-0"></span><span>${parseInlineMarkdown(line.slice(6))}</span></div>`);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        resultLines.push(`<li class="ml-5 list-disc text-[var(--text-primary)] my-1 text-xs leading-relaxed">${parseInlineMarkdown(line.slice(2))}</li>`);
      } else if (/^\d+\.\s/.test(line)) {
        const text = line.replace(/^\d+\.\s/, '');
        resultLines.push(`<li class="ml-5 list-decimal text-[var(--text-primary)] my-1 text-xs leading-relaxed">${parseInlineMarkdown(text)}</li>`);
      } else if (line.startsWith('---') || line.startsWith('***')) {
        resultLines.push(`<hr class="my-6 border-[var(--border-color)]" />`);
      } else if (line.trim() === '') {
        resultLines.push(`<div class="h-2"></div>`);
      } else {
        resultLines.push(`<p class="text-[var(--text-primary)] my-2 text-xs leading-relaxed font-sans">${parseInlineMarkdown(line)}</p>`);
      }
    }

    if (inTable) resultLines.push('</tbody></table></div>');
    return resultLines.join('\n');
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-140px)] rounded-2xl border border-[var(--border-color)] bg-[var(--surface-color)] text-[var(--text-primary)] shadow-xl overflow-hidden">
      {/* Top Header Controls */}
      <div className="border-b border-[var(--border-color)] bg-[var(--surface-hover)] px-6 py-3 flex items-center justify-between gap-4 flex-wrap sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <FileCode className="w-5 h-5 text-white stroke-[2.5]" />
          <span className="text-sm font-extrabold text-[var(--text-primary)] tracking-tight">Markdown Studio</span>
        </div>

        {/* Templates & View Switcher */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Custom Dark Theme Popover Template Dropdown */}
          <div className="flex items-center gap-2 bg-[var(--surface-color)] px-3 py-1 rounded-xl border border-[var(--border-color)] text-xs">
            <span className="text-[var(--text-secondary)] font-semibold whitespace-nowrap">Template:</span>
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

          <div className="h-6 w-px bg-[var(--border-color)]" />

          {/* View Switcher */}
          <div className="flex items-center bg-[var(--surface-color)] p-1 rounded-xl border border-[var(--border-color)]">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'split'
                  ? 'bg-white text-zinc-950 font-extrabold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-hover)] font-medium'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
            <button
              onClick={() => setViewMode('edit')}
              className={`px-3 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'edit'
                  ? 'bg-white text-zinc-950 font-extrabold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-hover)] font-medium'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editor</span>
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'preview'
                  ? 'bg-white text-zinc-950 font-extrabold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-hover)] font-medium'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          </div>

          <div className="h-6 w-px bg-[var(--border-color)]" />

          {/* Actions */}
          <button
            onClick={handleCopyMarkdown}
            className={`px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition font-extrabold cursor-pointer ${
              copied
                ? 'bg-emerald-500 text-black border border-emerald-400'
                : 'bg-zinc-900 text-white hover:bg-zinc-800 border border-zinc-700'
            }`}
            title="Copy Full Markdown Content"
          >
            {copied ? <Check className="w-4 h-4 text-black stroke-[3]" /> : <Copy className="w-4 h-4 text-white stroke-[2.5]" />}
            <span>{copied ? 'Copied!' : 'Copy MD'}</span>
          </button>

          <button
            onClick={handleDownloadMdFile}
            className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs flex items-center gap-1.5 border border-zinc-700 transition font-extrabold cursor-pointer"
            title="Download .md file"
          >
            <FileText className="w-4 h-4 text-white stroke-[2.5]" />
            <span>Save .MD</span>
          </button>

          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold text-xs px-4 py-2 rounded-xl border border-zinc-700 shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: '#18181b', color: '#ffffff' }}
          >
            {isExporting ? (
              <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-white" style={{ color: '#ffffff' }} />
            ) : (
              <Download className="w-4 h-4 shrink-0 stroke-[2.5] text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
            )}
            <span className="font-extrabold text-xs text-white" style={{ color: '#ffffff' }}>Compile PDF</span>
          </button>
        </div>
      </div>

      {/* Rich Formatting Toolbar */}
      <div className="border-b border-[var(--border-color)] bg-[var(--surface-color)] px-6 py-2 flex items-center gap-1 overflow-x-auto text-[var(--text-secondary)]">
        <button onClick={() => insertFormatting('**', '**', 'bold text')} className="p-1.5 hover:bg-[var(--surface-hover)] hover:text-white rounded-lg transition cursor-pointer" title="Bold (**text**)">
          <Bold className="w-4 h-4" />
        </button>
        <button onClick={() => insertFormatting('*', '*', 'italic text')} className="p-1.5 hover:bg-[var(--surface-hover)] hover:text-white rounded-lg transition cursor-pointer" title="Italic (*text*)">
          <Italic className="w-4 h-4" />
        </button>
        <button onClick={() => insertFormatting('~~', '~~', 'strikethrough')} className="p-1.5 hover:bg-[var(--surface-hover)] hover:text-white rounded-lg transition cursor-pointer" title="Strikethrough (~~text~~)">
          <Strikethrough className="w-4 h-4" />
        </button>
        <button onClick={() => insertFormatting('`', '`', 'code')} className="p-1.5 hover:bg-[var(--surface-hover)] hover:text-white rounded-lg transition cursor-pointer" title="Inline Code (`code`)">
          <Code className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-[var(--border-color)] mx-1" />

        <button onClick={() => insertLinePrefix('# ')} className="p-1.5 hover:bg-[var(--surface-hover)] hover:text-white rounded-lg transition cursor-pointer" title="Heading 1">
          <Heading1 className="w-4 h-4" />
        </button>
        <button onClick={() => insertLinePrefix('## ')} className="p-1.5 hover:bg-[var(--surface-hover)] hover:text-white rounded-lg transition cursor-pointer" title="Heading 2">
          <Heading2 className="w-4 h-4" />
        </button>
        <button onClick={() => insertLinePrefix('### ')} className="p-1.5 hover:bg-[var(--surface-hover)] hover:text-white rounded-lg transition cursor-pointer" title="Heading 3">
          <Heading3 className="w-4 h-4" />
        </button>
        <button onClick={() => insertLinePrefix('#### ')} className="p-1.5 hover:bg-[var(--surface-hover)] hover:text-white rounded-lg transition cursor-pointer" title="Heading 4">
          <Heading4 className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-[var(--border-color)] mx-1" />

        <button onClick={() => insertLinePrefix('- ')} className="p-1.5 hover:bg-[var(--surface-hover)] hover:text-white rounded-lg transition cursor-pointer" title="Bulleted List">
          <List className="w-4 h-4" />
        </button>
        <button onClick={() => insertLinePrefix('1. ')} className="p-1.5 hover:bg-[var(--surface-hover)] hover:text-white rounded-lg transition cursor-pointer" title="Numbered List">
          <ListOrdered className="w-4 h-4" />
        </button>
        <button onClick={() => insertLinePrefix('- [ ] ')} className="p-1.5 hover:bg-[var(--surface-hover)] hover:text-white rounded-lg transition cursor-pointer" title="Task Checklist">
          <CheckSquare className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-[var(--border-color)] mx-1" />

        <button onClick={() => insertLinePrefix('> ')} className="p-1.5 hover:bg-[var(--surface-hover)] hover:text-white rounded-lg transition cursor-pointer" title="Blockquote">
          <Quote className="w-4 h-4" />
        </button>
        <button onClick={() => insertFormatting('\n```typescript\n', '\n```\n', '// code here')} className="p-1.5 hover:bg-[var(--surface-hover)] hover:text-white rounded-lg transition cursor-pointer" title="Code Block">
          <Terminal className="w-4 h-4" />
        </button>
        <button onClick={insertTable} className="p-1.5 hover:bg-[var(--surface-hover)] hover:text-white rounded-lg transition cursor-pointer" title="Insert Table">
          <TableIcon className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-[var(--border-color)] mx-1" />

        <button onClick={() => insertFormatting('[', '](https://example.com)', 'link text')} className="p-1.5 hover:bg-[var(--surface-hover)] hover:text-white rounded-lg transition cursor-pointer" title="Insert Link">
          <LinkIcon className="w-4 h-4" />
        </button>
        <button onClick={() => insertFormatting('![', '](https://example.com/image.png)', 'alt text')} className="p-1.5 hover:bg-[var(--surface-hover)] hover:text-white rounded-lg transition cursor-pointer" title="Insert Image">
          <ImageIcon className="w-4 h-4" />
        </button>
        <button onClick={() => insertFormatting('\n---\n')} className="p-1.5 hover:bg-[var(--surface-hover)] hover:text-white rounded-lg transition cursor-pointer" title="Horizontal Divider">
          <Minus className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-[var(--border-color)] mx-1" />

        <button onClick={() => setMarkdown('')} className="p-1.5 hover:bg-[var(--surface-hover)] hover:text-white rounded-lg text-[var(--text-secondary)] transition cursor-pointer" title="Clear Text">
          <Eraser className="w-4 h-4" />
        </button>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Raw Markdown Editor Area */}
        {(viewMode === 'split' || viewMode === 'edit') && (
          <div className="flex-1 flex flex-col bg-[var(--bg-color)] border-b md:border-b-0 md:border-r border-[var(--border-color)] p-4 sm:p-6 overflow-hidden min-h-[300px] md:min-h-0">
            <textarea
              ref={textareaRef}
              value={markdown}
              onChange={e => setMarkdown(e.target.value)}
              placeholder="Start writing Markdown..."
              className="w-full h-full bg-transparent text-[var(--text-primary)] font-mono text-sm leading-relaxed resize-none focus:outline-none placeholder:text-[var(--text-tertiary)]"
            />
          </div>
        )}

        {/* Rendered Live Preview Area */}
        {(viewMode === 'split' || viewMode === 'preview') && (
          <div className="flex-1 bg-[var(--bg-color)] p-4 sm:p-8 overflow-y-auto min-h-[300px] md:min-h-0">
            <div id="markdown-preview-container" className="max-w-3xl mx-auto bg-[var(--surface-color)] border border-[var(--border-color)] rounded-2xl p-4 sm:p-8 shadow-2xl">
              <div
                dangerouslySetInnerHTML={{
                  __html: renderMarkdownToHtml(markdown),
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className="border-t border-[var(--border-color)] bg-[var(--surface-hover)] px-6 py-2.5 flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-4">
          <span><strong>{wordsCount}</strong> words</span>
          <span><strong>{charsCount}</strong> characters</span>
          <span><strong>{readTimeMin}</strong> min read</span>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span>Markdown Workspace</span>
        </div>
      </div>
    </div>
  );
};
