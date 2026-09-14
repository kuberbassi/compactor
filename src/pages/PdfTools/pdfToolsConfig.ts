import {
  Layers as LayersIcon,
  Split as SplitIcon,
  Settings as SettingsIcon,
  Lock as LockIcon,
  Image as ImageIcon
} from 'lucide-react';

export interface ToolItem {
  id: string;
  label: string;
  icon: any;
  desc: string;
  category: 'organize' | 'optimize' | 'security' | 'convert';
}

export interface ToolGroup {
  id: 'organize' | 'optimize' | 'security' | 'convert';
  title: string;
  items: ToolItem[];
}

export interface CompressionResult {
  sourceName: string;
  sourceSize: number;
  outputName: string;
  outputSize: number;
  url?: string;
  error?: string;
}

export const WORKFLOW_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'organize', label: 'Pages' },
  { id: 'optimize', label: 'Optimize' },
  { id: 'security', label: 'Security' },
  { id: 'convert', label: 'Convert' },
] as const;

export type WorkflowCategoryId = typeof WORKFLOW_CATEGORIES[number]['id'];

export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'organize',
    title: 'Pages',
    items: [
      { id: 'pdf-organize', label: 'Organize Pages', icon: LayersIcon, desc: 'Reorder, rotate & delete pages visually', category: 'organize' },
      { id: 'pdf-split', label: 'Split PDF', icon: SplitIcon, desc: 'Extract specific page ranges or split pages', category: 'organize' },
      { id: 'pdf-merge', label: 'Merge PDF', icon: LayersIcon, desc: 'Combine multiple PDFs into one document', category: 'organize' },
    ]
  },
  {
    id: 'optimize',
    title: 'Optimize',
    items: [
      { id: 'pdf-compress', label: 'Compress PDF', icon: SettingsIcon, desc: 'Reduce file size efficiently with custom quality & metadata stripping', category: 'optimize' },
    ]
  },
  {
    id: 'security',
    title: 'Security',
    items: [
      { id: 'pdf-protect', label: 'PDF Security', icon: LockIcon, desc: 'Protect, unlock, flatten, or make searchable with OCR', category: 'security' },
    ]
  },
  {
    id: 'convert',
    title: 'Convert',
    items: [
      { id: 'pdf-to-image', label: 'Export PDF', icon: ImageIcon, desc: 'Export PDF pages as PNG, JPG, or structured Markdown', category: 'convert' },
    ]
  }
];

export const PDF_MODE_TABS = [
  { id: 'pdf-edit', label: 'Edit' },
  { id: 'pdf-organize', label: 'Tools' },
  { id: 'pdf-word-to-pdf', label: 'Markdown' },
] as const;

export const CANVAS_PDF_TOOLS = new Set(['pdf-edit', 'pdf-redact', 'pdf-stamps', 'pdf-sign', 'pdf-watermark']);

export const parsePageRanges = (rangeStr: string, maxPages: number): number[] => {
  const pages = new Set<number>();
  const tokens = rangeStr.split(',');
  for (const token of tokens) {
    const t = token.trim();
    if (t.includes('-')) {
      const parts = t.split('-');
      const start = parseInt(parts[0], 10);
      const end = parseInt(parts[1], 10);
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(maxPages, Math.max(start, end));
        for (let p = min; p <= max; p++) {
          if (p >= 1 && p <= maxPages) pages.add(p);
        }
      }
    } else {
      const p = parseInt(t, 10);
      if (!isNaN(p) && p >= 1 && p <= maxPages) pages.add(p);
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
};

export const formatPageRanges = (pages: number[]): string => {
  const sorted = Array.from(new Set(pages)).sort((a, b) => a - b);
  if (sorted.length === 0) return '';

  const ranges: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];
  for (let index = 1; index < sorted.length; index += 1) {
    const page = sorted[index];
    if (page === previous + 1) {
      previous = page;
      continue;
    }
    ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = page;
    previous = page;
  }
  ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
  return ranges.join(', ');
};
