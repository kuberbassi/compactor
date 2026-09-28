import {
  FileArchive,
  FileImage,
  FileLock2,
  FileOutput,
  FileStack,
  FileText,
  FileUp,
  Film,
  Images,
  Music2,
  Repeat2,
  Stamp,
  ScanLine,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { routeForTool } from '../config/toolRoutes';
import type { ToolRoute } from '../config/toolRoutes';

export type CompactToolGroup = 'compress' | 'audio' | 'convert' | 'pdf';

export interface CompactToolCapability {
  id: string;
  route: ToolRoute;
  group: CompactToolGroup;
  Icon: LucideIcon;
  acceptsMultiple: boolean;
  launchPhase: 3 | 4 | 5 | 6 | 7;
  shortDescription: string;
}

interface CompactToolDefinition extends Omit<CompactToolCapability, 'route'> {}

const DEFINITIONS: CompactToolDefinition[] = [
  { id: 'image-optimizer', group: 'compress', Icon: Images, acceptsMultiple: true, launchPhase: 3, shortDescription: 'Compress and export several images together.' },
  { id: 'pdf-compress', group: 'compress', Icon: FileArchive, acceptsMultiple: true, launchPhase: 3, shortDescription: 'Reduce PDF size with private browser processing.' },
  { id: 'audio-optimizer', group: 'compress', Icon: Music2, acceptsMultiple: true, launchPhase: 4, shortDescription: 'Compress or transcode audio with a simple queue.' },
  { id: 'audio-joiner', group: 'audio', Icon: Music2, acceptsMultiple: true, launchPhase: 7, shortDescription: 'Join several tracks in the order you choose.' },
  { id: 'audio-bpm-finder', group: 'audio', Icon: Music2, acceptsMultiple: false, launchPhase: 7, shortDescription: 'Detect tempo, musical key, and Camelot notation.' },
  { id: 'audio-pitch-speed', group: 'audio', Icon: Music2, acceptsMultiple: false, launchPhase: 7, shortDescription: 'Change pitch and playback speed, then export WAV.' },
  { id: 'video-compressor', group: 'compress', Icon: Film, acceptsMultiple: true, launchPhase: 4, shortDescription: 'Make videos smaller for sharing.' },
  { id: 'universal-converter', group: 'convert', Icon: Repeat2, acceptsMultiple: true, launchPhase: 5, shortDescription: 'Convert supported documents, media, and data files.' },
  { id: 'convert-word-to-pdf', group: 'convert', Icon: FileText, acceptsMultiple: true, launchPhase: 5, shortDescription: 'Convert Word documents to PDF.' },
  { id: 'pdf-merge', group: 'pdf', Icon: FileStack, acceptsMultiple: true, launchPhase: 6, shortDescription: 'Combine PDFs in the order you choose.' },
  { id: 'pdf-protect', group: 'pdf', Icon: FileLock2, acceptsMultiple: false, launchPhase: 6, shortDescription: 'Add password protection without uploading the file.' },
  { id: 'pdf-unlock', group: 'pdf', Icon: FileOutput, acceptsMultiple: false, launchPhase: 6, shortDescription: 'Unlock a PDF you are authorized to modify.' },
  { id: 'pdf-to-image', group: 'pdf', Icon: FileImage, acceptsMultiple: false, launchPhase: 6, shortDescription: 'Export selected PDF pages as PNG or JPEG.' },
  { id: 'pdf-jpg-to-pdf', group: 'pdf', Icon: FileUp, acceptsMultiple: true, launchPhase: 6, shortDescription: 'Reorder and rotate images, then export one PDF.' },
  { id: 'pdf-watermark', group: 'pdf', Icon: Stamp, acceptsMultiple: false, launchPhase: 6, shortDescription: 'Add a simple text watermark to every page.' },
  { id: 'pdf-flatten', group: 'pdf', Icon: ScanLine, acceptsMultiple: false, launchPhase: 6, shortDescription: 'Lock form fields or rasterize the entire document.' },
];

export const COMPACT_TOOL_GROUPS: Array<{ id: CompactToolGroup; title: string; description: string }> = [
  { id: 'compress', title: 'Compress files', description: 'Smaller files, private processing, simple bulk export.' },
  { id: 'audio', title: 'Audio tools', description: 'Analyze, join, and transform audio in focused mobile workflows.' },
  { id: 'convert', title: 'Convert files', description: 'Verified format pairs using the same desktop engines.' },
  { id: 'pdf', title: 'PDF quick tools', description: 'Useful document tasks designed for a narrow screen.' },
];

export const COMPACT_TOOLS: CompactToolCapability[] = DEFINITIONS.map(definition => {
  const route = routeForTool(definition.id);
  if (!route) throw new Error(`Compact tool ${definition.id} has no canonical route`);
  return { ...definition, route };
});

const compactToolById = new Map(COMPACT_TOOLS.map(tool => [tool.id, tool]));

export const compactToolForId = (id: string): CompactToolCapability | undefined => compactToolById.get(id);

export const compactAlternativesFor = (id: string): CompactToolCapability[] => {
  if (id.startsWith('video-')) return COMPACT_TOOLS.filter(tool => tool.id === 'video-compressor' || tool.id === 'universal-converter');
  if (id.startsWith('audio-')) return COMPACT_TOOLS.filter(tool => tool.id === 'audio-optimizer' || tool.id === 'universal-converter');
  if (id.startsWith('image-')) return COMPACT_TOOLS.filter(tool => tool.id === 'image-optimizer' || tool.id === 'pdf-jpg-to-pdf');
  if (id.startsWith('pdf-')) return COMPACT_TOOLS.filter(tool => tool.group === 'pdf').slice(0, 3);
  return COMPACT_TOOLS.filter(tool => tool.id === 'universal-converter' || tool.id === 'image-optimizer');
};
