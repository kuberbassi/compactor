<p align="center">
  <img src="public/logo.svg" width="96" alt="Compactor Logo" />
</p>

<h1 align="center">Compactor</h1>

<p align="center">
  <b>100% Client-Side Private Media Compressor, PDF Studio & Universal Converter</b><br />
  <i>Designed & Developed by <a href="https://kuberbassi.com">Kuber Bassi</a></i>
</p>

<p align="center">
  <a href="https://compactor.kuberbassi.com"><strong>⚡ Open Live Web Application &raquo;</strong></a>
</p>

---

## 🔒 100% Client-Side Privacy Architecture

**Compactor** is built on a privacy-first, zero-server-upload architecture. Every video compression, PDF edit, audio transcode, image optimization, and format conversion happens **directly inside your browser** using client-side WebAssembly and HTML5 processing engines.

- **Zero Server Uploads**: Files, videos, and documents never leave your local device.
- **Offline & Sandbox Ready**: Executes locally inside browser sandboxes without reliance on backend APIs.
- **High-Performance Multithreading**: Utilizes WebAssembly `SharedArrayBuffer` with COOP/COEP headers for hardware-accelerated parallel encoding.

---

## ✨ Feature Suites

### 🎬 Video Suite
- **Target Size Clamping**: Preset compressor for **Discord (≤10 MB)**, **WhatsApp (≤16 MB)**, **TikTok (≤70 MB)**, and **Instagram (≤95 MB)** with 2-pass size bounds.
- **Video to Audio**: Extract high-bitrate MP3, AAC, or WAV audio tracks.
- **Video to GIF**: Convert video clips into smooth 24/15/10 FPS animated GIFs.
- **Mute Video**: Strip audio channels instantly with zero re-encoding loss.

### 📄 PDF Studio Pro
- **Document Scan Filters**: Smart Magic Color, Whiteboard Clean, B&W Binary Thresholding, and Vibrant Diagram filters.
- **Page Organization**: Drag-and-drop page reordering, rotation, extraction, and deletion.
- **Merge & Split**: Combine multiple PDFs into a single file or extract specific page ranges.
- **Crop Margins**: Interactive trim percentage control for clean printable layouts.
- **Sign & Stamp**: Vector approval stamps (`APPROVED`, `CONFIDENTIAL`, `FINAL DRAFT`) and digital signatures.
- **Security**: AES-128/256 password encryption and password removal.

### 🖼️ Image Optimizer
- Multi-format lossy and lossless compression (PNG, JPG, WebP, GIF, AVIF).
- Aspect ratio cropping (`1:1`, `16:9`, `4:3`, `9:16`), rotation, horizontal/vertical flipping.
- Interactive pixelation censorship brush for obscuring sensitive document regions.

### 🎵 Audio Suite & Converter
- **Compress Audio**: High-efficiency WASM audio compressor with trim range timeline & waveform previews.
- **Audio Joiner**: Merge & concatenate multiple audio tracks into a single seamless audio file.
- **Key & BPM Finder**: 100% in-browser Web Audio API detection of tempo (BPM), musical key & Camelot wheel code.
- **Pitch & Speed Changer**: Transpose key pitch (-12 to +12 semitones) & adjust playback tempo (0.5x to 2.0x).
- **Universal Format Converter**: Matrix supporting **212+ media & document formats** (Video, Audio, Images, Documents, E-books, Spreadsheets).
- **Metadata Editor**: Inspect and edit EXIF, ID3, and PDF tags directly in-browser.
- **Poster Maker**: Multi-page printable wall poster grid generator.

---

## 🛠️ Technology Stack & Architecture

- **Core**: React 19, TypeScript, Vite
- **Styling & UI**: TailwindCSS v4, Base UI, Custom Glassmorphism Design Tokens
- **Processing Engines**: `@ffmpeg/ffmpeg` (WASM), `@ffmpeg/util`, `pdf-lib`, `pdfjs-dist`, HTML5 Canvas 2D API
- **Testing**: Vitest + Testing Library + JSDOM
- **Deployment**: Vercel with COOP/COEP security headers & immutable asset caching

---

## 🚀 Quick Start & Development

```bash
# 1. Clone repository
git clone https://github.com/kuberbassi/compactor.git
cd compactor

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Run Vitest test suite
npm run test

# 5. Build for production
npm run build
```

---

## 📲 Progressive Web App (PWA)

Compactor is configured as a standalone Web App (**Compressor**). It can be installed directly onto iOS, Android, or desktop devices with standalone app window support and quick shortcuts.

---

## 👤 Author & License

Designed & Developed with ❤️ by **[Kuber Bassi](https://kuberbassi.com)**.

License: MIT