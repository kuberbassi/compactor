import {
  EditIcon,
  Layers as LayersIcon,
  Split as SplitIcon,
  Crop as CropIcon,
  Settings as SettingsIcon,
  Lock as LockIcon,
  ShieldCheck as ShieldIcon,
  FileText,
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
  { id: 'all', label: 'All workflows' },
  { id: 'organize', label: 'Organize & Pages' },
  { id: 'optimize', label: 'Optimize' },
  { id: 'security', label: 'Security & Clean' },
  { id: 'convert', label: 'Convert & Export' },
] as const;

export type WorkflowCategoryId = typeof WORKFLOW_CATEGORIES[number]['id'];

export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'organize',
    title: 'Organize & Pages',
    items: [
      { id: 'pdf-organize', label: 'Page Organizer', icon: LayersIcon, desc: 'Reorder, rotate & delete pages visually', category: 'organize' },
      { id: 'pdf-merge', label: 'Merge PDF', icon: LayersIcon, desc: 'Combine multiple PDFs into one document', category: 'organize' },
      { id: 'pdf-split', label: 'Split PDF', icon: SplitIcon, desc: 'Extract specific page ranges or split pages', category: 'organize' },
      { id: 'pdf-crop-tool', label: 'Crop Margins', icon: CropIcon, desc: 'Trim whitespace margins off pages', category: 'organize' },
      { id: 'pdf-remove-blank-pages', label: 'Remove Blank Pages', icon: FileText, desc: 'Detect & strip empty white sheets automatically', category: 'organize' },
    ]
  },
  {
    id: 'optimize',
    title: 'Optimize & Compress',
    items: [
      { id: 'pdf-compress', label: 'Compress PDF', icon: SettingsIcon, desc: 'Reduce file size efficiently with custom quality', category: 'optimize' },
    ]
  },
  {
    id: 'security',
    title: 'Protect & Security',
    items: [
      { id: 'pdf-protect', label: 'Protect Password', icon: LockIcon, desc: 'Encrypt document with password protection', category: 'security' },
      { id: 'pdf-unlock', label: 'Unlock PDF', icon: ShieldIcon, desc: 'Remove password & decrypt document', category: 'security' },
      { id: 'pdf-flatten-forms', label: 'Flatten Form Fields', icon: EditIcon, desc: 'Permanently lock interactive form fields while keeping text searchable', category: 'security' },
      { id: 'pdf-flatten-entire', label: 'Flatten Entire PDF', icon: ShieldIcon, desc: 'Rasterize pages into images to strip all selectable text and scripts', category: 'security' },
      { id: 'pdf-remove-metadata', label: 'Remove Metadata', icon: ShieldIcon, desc: 'Clean author, title & creation timestamps', category: 'security' },
      { id: 'pdf-page-numbers', label: 'Page Numbers', icon: FileText, desc: 'Insert formatted header/footer page numbers', category: 'security' },
    ]
  },
  {
    id: 'convert',
    title: 'Convert & Export',
    items: [
      { id: 'pdf-ocr', label: 'OCR & Searchable PDF', icon: FileText, desc: 'Recognize scanned text and embed an invisible searchable text layer', category: 'convert' },
      { id: 'pdf-to-image', label: 'PDF to Images', icon: ImageIcon, desc: 'Export pages to 300 DPI PNG/JPG images', category: 'convert' },
      { id: 'pdf-jpg-to-pdf', label: 'Images to PDF', icon: ImageIcon, desc: 'Convert image files into a clean PDF document', category: 'convert' },
      { id: 'pdf-to-word', label: 'PDF to Markdown', icon: FileText, desc: 'Extract structured text layer to Markdown (.md)', category: 'convert' },
    ]
  }
];

export const PDF_MODE_TABS = [
  { id: 'pdf-edit', label: 'Edit document' },
  { id: 'pdf-organize', label: 'PDF workflows' },
  { id: 'pdf-word-to-pdf', label: 'Markdown workspace' },
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
        const min = Math.min(start, end);
        const max = Math.max(start, end);
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
