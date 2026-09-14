# Compactor Master Documentation (antigravity.md)

This document compiles and summarizes the operational, architectural, and feature documentation of Compactor into a single concise reference. *(For foundational core principles and code styling, refer to `docs/CODEX.md`)*.

---

## 1. Product Architecture & Execution Model

Compactor is a 100% client-side, browser-native file processing suite built on React 19, TypeScript, Tailwind CSS v4, and WebAssembly.

### Core Processing Engines
- **Video / Audio**: FFmpeg WASM (`@ffmpeg/ffmpeg`), Web Audio API, SoundTouchJS, Rubberband WASM.
- **Documents & PDF**: PDF-lib, PDF.js (v6), Tesseract.js (WASM OCR), fflate, mammoth, docx-preview.
- **Images**: Canvas 2D / WebGL, ImageTracerJS.
- **Offline Persistence**: IndexedDB (`persistentJobQueue.ts` via `compactor_job_db`) protecting long queues across tab refreshes.

---

## 2. Tool Suites & Key Routing

All tools use direct, crawlable routes, synchronized with the global `Ctrl/Cmd + K` Command Palette.

### A. PDF Suite
- `/edit-pdf` (`pdf-edit`): Visual annotation, text, shapes, vector stamps, and drawing canvas.
- `/organize-pdf` (`pdf-organize`): Visual page grid reordering, 90°/180° rotation, and extraction.
- `/merge-pdf` (`pdf-merge`) & `/split-pdf` (`pdf-split`): Multi-file combining and range extraction (`1-3, 5`).
- `/compress-pdf` (`pdf-compress`): Multi-file PDF compression with quality presets and metadata stripping.
- `/flatten-pdf-forms` (`pdf-flatten-forms`): Locks interactive form controls/inputs to static vectors; keeps text selectable and searchable.
- `/flatten-entire-pdf` (`pdf-flatten-entire`): Rasterizes all pages to images (150 / 300 / 600 DPI presets); completely strips selectable text and scripts.
- `/flatten-pdf` (`pdf-flatten`): Combined tool route offering both form and complete flattening options.
- `/ocr-pdf` (`pdf-ocr`): Tesseract.js WASM text recognition synthesizing an invisible searchable text layer over scans.
- `/remove-pdf-metadata` (`pdf-remove-metadata`): Strips author, producer, creation timestamps, and XMP streams.
- `/remove-blank-pdf-pages` (`pdf-remove-blank-pages`): Dual-scan algorithm (pixel density + text stream) stripping empty pages.
- `/extract-pdf-text` (`pdf-extract-text`): Plain `.txt` export with page delimiter headers.
- `/watermark-pdf` (`pdf-watermark`), `/number-pdf-pages` (`pdf-page-numbers`), `/crop-pdf` (`pdf-crop-tool`).
- `/protect-pdf` (`pdf-protect`) & `/unlock-pdf` (`pdf-unlock`): Password encryption and decryption.

### B. Image Tools & Poster Maker
- `/image-editor` (`image-optimizer`):
  - Compact 2-column sidebar navigation with pinned actions and collapsible icon rail.
  - Multi-image queue strip with batch processing and `.zip` download.
  - Format transcoding: Lossless PNG, JEPG, and WebP.
  - Crop presets, 90°/180° rotation, horizontal/vertical flips.
  - Scan Clean: Auto deskew, Sauvola binarization, contrast boost, clean white background, and transparent signature extraction.
  - Live Watermark: Real-time canvas preview of text, position, opacity, font size, and color.
  - "To PDF" tab: Converts each selected image into an individual single-page PDF.
- `/poster-maker` (`rasterbator`):
  - Converts images into tiled printable multi-page wall posters (A4, A3, A2, Letter, Legal, Tabloid).
  - Dot-halftone, monochrome, and color modes.
  - Halftone dot coordinates anchor to master-poster coordinates (`col * tileWidthPx`, `row * tileHeightPx`) to prevent seam misalignment.
  - Safety capped at 100 sheets maximum.

### C. Audio & Video Tools
- `/compress-video` (`video-compressor`):
  - Standard H.264 re-encoding (`-profile:v high -level:v 4.1 -pix_fmt yuv420p`+ `+faststart`).
  - Strict timestamp alignment (`-avoid_negative_ts make_zero`) eliminating initial frame freezing.
  - Audio clock synchronization via `aresample=async=1:first_pts=0`.
- `/video-to-audio`, `/video-to-gif`, `/mute-video`.
- `/compress-audio` (`audio-optimizer`): Bitrate compression, trimming, and EBU R128 `loudnorm` volume normalization.
- `/join-audio` (`audio-joiner`), `/audio-key-bpm-finder`, `/change-audio-pitch-speed`.
- All audio tools accept direct video drops to extract pure audio tracks on the fly.

### D. Universal Converter & Metadata Editor
- `/file-converter` (`universal-converter`):
  - Batch transcoding for video (VOB, MPEG, MPG, TS, M2TS to MP4, WMV, ASF, FLV), audio (FLAC, OGG, OPUS, AIFF, ALAC), and images (TIFF, TGA, AVIF, WebP).
  - Office documents: DOCX to PDF, Markdown to PDF, PPTX to PDF, and XLSX/CSV/TSV to formatted PDF & HTML tables.
  - Automatic `fflate` ZIP export when processing 2+ items.
- `/metadata-editor` (`metadata-editor`):
  - Inspect, modify, or strip EXIF, ID3, and document metadata tags privately.

---

## 3. Manual Testing & Verification Checklist

Quick validation guide for manual QA:

### PDF Suite
1. **Remove Metadata (`/remove-pdf-metadata`)**: Upload PDF → Export. Confirm author, title, creation date, and XMP streams stripped.
2. **Rotate PDF (`/rotate-pdf`)**: 90° CW, 180°, 90° CCW all-page lossless rotation.
3. **Extract Text (`/extract-pdf-text`)**: Plain `.txt` export with `--- Page X of Y ---` delimiters.
4. **Remove Blank Pages (`/remove-blank-pdf-pages`)**: Dual-scan visual density + text layer detection removing empty pages.
5. **Flatten Forms (`/flatten-pdf-forms`)**: AcroForm fields converted to static vectors; document text remains selectable and searchable.
6. **Flatten Entire PDF (`/flatten-entire-pdf`)**: Full rasterization (150/300/600 DPI) into flat image layers; text cannot be extracted.
7. **OCR & Searchable PDF (`/ocr-pdf`)**: Tesseract.js WASM progress tracking; overlays invisible aligned selectable text on scanned documents.
8. **Batch ZIP Download**: Available when processing 2+ files in Compress PDF (`/compress-pdf`) or PDF to Images (`/pdf-to-images`).

### Image & Poster Tools
1. **Watermark Tab**: Live overlay preview for text, position (Center, corners), opacity (5-100%), font size, and color.
2. **To PDF Tab**: Converts multiple selected images into individual single-page PDFs.
3. **Scan Clean Tab**: Magic Contrast, Crisp B&W Document, Auto Deskew & Level, Clean White Background, and Transparent Background (for signatures).
4. **Poster Maker (`/poster-maker`)**: Live halftone dot grid preview, sheet size selection (A4-A2, Letter, Legal, Tabloid), max 100 sheets cap, seam-aligned coordinates.
5. **Batch ZIP**: Bundles converted images into `compactor-images.zip`.

### Audio & Video Tools
1. **Volume Normalization**: EBU R128 `loudnorm` filter toggle standardizing quiet/loud passages.
2. **Audio Fade In/Out**: 0.5s–5s fade envelope dropdowns.
3. **Channel Mode**: Stereo / Mono / Original toggle buttons.
4. **Video-to-Audio**: Direct video drag-and-drop into audio workspace drops video stream and extracts clean audio track.
5. **Video Compressor**: Standard H.264 profile, `-avoid_negative_ts make_zero`, and audio sync (`aresample=async=1`).

### Universal Converter & Persistence
1. **Office Formats**: XLSX/CSV to tabular PDF/HTML, PPTX to 16:9 PDF slides, DOCX to styled PDF.
2. **Legacy/High-End Formats**: VOB, TS, FLV, FLAC, OGG, OPUS, AIFF, TIFF, AVIF.
3. **Crash Recovery & Offline Queues**: IndexedDB (`compactor_job_db`) via `persistentJobQueue.ts` preserves in-flight files and queue states across reloads.
4. **Settings Persistence**: LocalStorage stores compression presets, channel choices, and tool configurations.

---

## 4. Maintenance & CI/CD Runbook

Always run commands via `npm.cmd` on Windows.

### Routine Verification
```powershell
npm.cmd run quality   # Lint, full Vitest suite, strict TypeScript, and production build
```

### Dependency Updates
```powershell
npm.cmd outdated
npm.cmd update
npm.cmd run quality
```

### Processed-Files Counter Setup
- Configured via Upstash Redis (`UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`).
- Key: `compactor:processed-files:v1` (initialized at `4,806,745` via Redis `SET NX`).
- Fallback: Labels counter as "on-device" when Redis is unreachable.
