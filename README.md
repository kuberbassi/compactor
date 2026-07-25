<p align="center">
  <img src="public/logo.svg" width="96" alt="Compactor Logo" />
</p>

<h1 align="center">Compactor</h1>

<p align="center">
  <b>100% Client-Side Private Media Compressor, PDF Studio & Universal Converter</b><br />
  <i>Designed & Developed by <a href="https://kuberbassi.com">Kuber Bassi</a></i>
</p>

<p align="center">
  <a href="https://compactor.kuberbassi.com"><strong>Explore Live Web Application &raquo;</strong></a>
</p>

---

## 🔒 100% Client-Side Privacy Architecture

**Compactor** is built on a privacy-first, zero-server-upload architecture. Every video compression, PDF edit, audio transcode, image optimization, and format conversion happens **directly inside your browser** using client-side WebAssembly and HTML5 engines.

- **Zero Data Leakage**: Your sensitive documents, photos, and videos never leave your local device.
- **Offline & Sandbox Ready**: Runs smoothly inside browser sandboxes without reliance on backend APIs.
- **High-Performance Multithreading**: Utilizes WebAssembly `SharedArrayBuffer` for hardware-accelerated processing.

---

## ✨ Suite Features

### 🎬 Video Suite
- **Smart Target Clamping**: Preset compressor for **Discord (≤10 MB)**, **WhatsApp (≤16 MB)**, **TikTok (≤70 MB)**, and **Instagram (≤95 MB)** with guaranteed 2-pass size bounds.
- **Video to Audio**: Extract high-bitrate MP3, AAC, or uncompressed WAV audio tracks.
- **Video to GIF**: Convert video clips into smooth 24/15/10 FPS animated GIFs with resolution scaling.
- **Mute Video**: Strip audio channels instantly.

### 📄 PDF Studio Pro
- **Document Scan Filters**: Smart Magic Color, Whiteboard Clean, B&W Binary Thresholding, and Vibrant Diagram filters.
- **Page Organization**: Drag-and-drop page reordering, rotation, page extraction, and deletion.
- **Merge & Split**: Combine multiple PDFs into a unified document or split page ranges.
- **Crop Margins**: Interactive trim percentage control for clean printable layouts.
- **Sign & Stamp**: Vector approval stamps (`APPROVED`, `CONFIDENTIAL`, `FINAL DRAFT`) and digital signatures.
- **Security**: Password encryption (AES-128/256) and password removal.

### 🖼️ Image Optimizer
- Multi-format lossy and lossless compression (PNG, JPG, WebP, GIF, AVIF).
- Aspect ratio cropping (`1:1`, `16:9`, `4:3`, `9:16`), rotation, horizontal/vertical flipping.
- Interactive pixelation censorship brush for blurring sensitive region coordinates.

### 🎵 Audio Optimizer
- High-efficiency WASM audio compressor with trim range timeline and waveform previews.

### 🔄 Universal Format Converter
- Compatibility matrix supporting **212+ media & document formats** (Video, Audio, Images, Documents, E-books, Spreadsheets).

### 🏷️ Metadata Editor
- Inspect and edit EXIF, ID3, and PDF tags directly in-browser.

---

## 🛠️ Technology Stack

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite
- **Styling**: Vanilla CSS + TailwindCSS + Custom Design Tokens
- **UI Components**: Radix UI / Shadcn Primaries
- **Processing Engines**: `@ffmpeg/ffmpeg` (WASM), `pdf-lib`, HTML5 Canvas 2D API

---

## 🚀 Local Setup & Installation

```bash
# 1. Clone repository
git clone https://github.com/kuberbassi/compactor.git
cd compactor

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

---

## 👤 Author & Credits

Designed & Developed with ❤️ by **[Kuber Bassi](https://kuberbassi.com)**.

License: MIT