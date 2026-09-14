export interface ToolRoute {
  id: string;
  path: string;
  title: string;
  description: string;
}

const route = (id: string, path: string, title: string, description: string): ToolRoute => ({ id, path, title, description });

export const TOOL_ROUTES: ToolRoute[] = [
  route('video-compressor', '/compress-video', 'Compress Video', 'Reduce video file size privately in your browser.'),
  route('video-to-audio', '/video-to-audio', 'Video to Audio', 'Extract an audio track from a video privately.'),
  route('video-to-gif', '/video-to-gif', 'Video to GIF', 'Turn a video clip into an animated GIF.'),
  route('video-mute', '/mute-video', 'Mute Video', 'Remove the audio track from a video.'),
  route('pdf-edit', '/edit-pdf', 'Edit PDF', 'Add text, shapes, annotations, and redactions to a PDF.'),
  route('pdf-organize', '/organize-pdf', 'Organize Pages', 'Reorder, rotate, and remove PDF pages visually.'),
  route('pdf-merge', '/merge-pdf', 'Merge PDF', 'Combine multiple PDF files into one document.'),
  route('pdf-split', '/split-pdf', 'Split PDF', 'Extract selected pages and page ranges from a PDF.'),
  route('pdf-crop-tool', '/crop-pdf', 'Crop PDF', 'Trim unwanted margins from PDF pages.'),
  route('pdf-compress', '/compress-pdf', 'Compress PDF', 'Reduce PDF file size with private browser processing.'),
  route('pdf-stamps', '/stamp-pdf', 'Stamp PDF', 'Apply a document stamp to PDF pages.'),
  route('pdf-redact', '/redact-pdf', 'Redact PDF', 'Permanently cover sensitive PDF content.'),
  route('pdf-flatten-forms', '/flatten-pdf-forms', 'Flatten PDF Form Fields', 'Lock interactive form fields while preserving searchable vector text.'),
  route('pdf-flatten-entire', '/flatten-entire-pdf', 'Flatten Entire PDF', 'Rasterize PDF pages to remove selectable text and interactive elements.'),
  route('pdf-flatten', '/flatten-pdf', 'Flatten PDF', 'Flatten form fields or render a completely non-selectable PDF.'),
  route('pdf-ocr', '/ocr-pdf', 'Make PDF Searchable', 'Add a searchable text layer to scanned PDF pages with private browser OCR.'),
  route('pdf-sign', '/sign-pdf', 'Sign PDF', 'Place a signature onto a PDF document.'),
  route('pdf-watermark', '/watermark-pdf', 'Watermark PDF', 'Add a custom watermark to PDF pages.'),
  route('pdf-protect', '/protect-pdf', 'Protect PDF', 'Add password protection to a PDF.'),
  route('pdf-unlock', '/unlock-pdf', 'Unlock PDF', 'Remove supported password protection from an authorized PDF.'),
  route('pdf-extract-text', '/extract-pdf-text', 'Extract PDF Text', 'Extract selectable PDF text and save it as a plain text file.'),
  route('pdf-remove-blank-pages', '/remove-blank-pdf-pages', 'Remove Blank PDF Pages', 'Detect and remove empty pages from a PDF document.'),
  route('pdf-remove-metadata', '/remove-pdf-metadata', 'Remove PDF Metadata', 'Strip author, title, timestamps, and identifying metadata from a PDF.'),
  route('pdf-page-numbers', '/number-pdf-pages', 'Add PDF Page Numbers', 'Insert page numbers into a PDF document.'),
  route('pdf-to-image', '/pdf-to-images', 'PDF to Images', 'Export PDF pages as PNG or JPEG images.'),
  route('pdf-jpg-to-pdf', '/images-to-pdf', 'Images to PDF', 'Combine JPG, PNG, and WebP images into a PDF document.'),
  route('pdf-word-to-pdf', '/markdown-to-pdf', 'Markdown to PDF', 'Write Markdown with a live preview and export it as PDF.'),
  route('pdf-to-word', '/pdf-to-markdown', 'PDF to Markdown', 'Extract a PDF text layer into structured Markdown.'),
  route('image-optimizer', '/image-editor', 'Image Editor', 'Compress, resize, crop, convert, and adjust images privately.'),
  route('rasterbator', '/poster-maker', 'Poster Maker', 'Split an image across printable poster pages.'),
  route('audio-optimizer', '/compress-audio', 'Compress Audio', 'Reduce audio file size and trim audio privately.'),
  route('audio-joiner', '/join-audio', 'Join Audio', 'Combine multiple audio tracks into one file.'),
  route('audio-bpm-finder', '/audio-key-bpm-finder', 'Find Key & BPM', 'Detect musical key, Camelot notation, and tempo privately.'),
  route('audio-pitch-speed', '/change-audio-pitch-speed', 'Pitch and Speed Changer', 'Adjust audio pitch and playback speed.'),
  route('universal-converter', '/file-converter', 'File Converter', 'Convert supported documents, images, audio, video, and data files.'),
  route('metadata-editor', '/metadata-editor', 'Metadata Editor', 'Inspect, edit, or remove supported file metadata.'),
];

export const seoTitleForRoute = (routeInfo: ToolRoute): string => `${routeInfo.title} Online — Free & Private | Compactor`;
