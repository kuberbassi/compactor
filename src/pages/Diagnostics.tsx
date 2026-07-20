import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { processImage } from '../utils/image';
import { compressAudio, compressVideo } from '../utils/ffmpeg';
import { compressVideoNative } from '../utils/nativeCompressor';
import { mergePdfs, signPdfDocument } from '../utils/pdf';
import { formatBytes } from '../utils/image';
import { Activity as ActivityIcon } from 'lucide-react';
import { 
  PiCheckCircleLight as CheckCircle,
  PiCpuLight as CpuIcon, 
  PiInfoLight as InfoIcon,
  PiPlayLight as PlayIcon, PiXCircleLight as XCircleIcon
} from 'react-icons/pi';

interface TestResult {
  id: string;
  name: string;
  category: 'Image' | 'Audio' | 'Video' | 'PDF';
  status: 'idle' | 'running' | 'success' | 'failed';
  timeTakenMs?: number;
  originalSize?: number;
  newSize?: number;
  rate?: number;
  speedMBs?: number;
  error?: string;
}

export const Diagnostics: React.FC<{ onGoHome: () => void }> = ({ onGoHome }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [systemInfo, setSystemInfo] = useState<{
    cores: string;
    memory: string;
    sab: string;
    ua: string;
  }>({ cores: 'Unknown', memory: 'Unknown', sab: 'Checking...', ua: '' });

  const [testResults, setTestResults] = useState<TestResult[]>([
    { id: 'img-webp', name: 'Image Compression (WebP)', category: 'Image', status: 'idle' },
    { id: 'img-jpeg', name: 'Image Compression (JPEG)', category: 'Image', status: 'idle' },
    { id: 'img-target', name: 'Image Target Size Loop', category: 'Image', status: 'idle' },
    { id: 'pdf-merge', name: 'PDF Merging (pdf-lib)', category: 'PDF', status: 'idle' },
    { id: 'pdf-sign', name: 'PDF Signing (pdf-lib)', category: 'PDF', status: 'idle' },
    { id: 'audio-wasm', name: 'Audio WASM Compression (FFmpeg)', category: 'Audio', status: 'idle' },
    { id: 'video-native', name: 'Video Native Compression', category: 'Video', status: 'idle' },
    { id: 'video-wasm', name: 'Video WASM Compression (FFmpeg)', category: 'Video', status: 'idle' },
  ]);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    // Gather system info
    const sabSupported = typeof SharedArrayBuffer !== 'undefined' ? 'Supported' : 'Not Supported (Fallback mode active)';
    const memory = (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB` : 'Not exposed';
    const cores = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} Cores` : 'Not exposed';
    setSystemInfo({
      cores,
      memory,
      sab: sabSupported,
      ua: navigator.userAgent
    });
  }, []);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // Helper generators
  const generateMockImageFile = (): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d')!;
      
      // Draw pretty colors and gradients to simulate high frequency data
      const grad = ctx.createLinearGradient(0, 0, 1000, 1000);
      grad.addColorStop(0, '#ff0077');
      grad.addColorStop(0.5, '#00ff88');
      grad.addColorStop(1, '#00aaff');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1000, 1000);
      
      // Add multiple circles
      for (let i = 0; i < 20; i++) {
        ctx.fillStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.3)`;
        ctx.beginPath();
        ctx.arc(Math.random() * 1000, Math.random() * 1000, Math.random() * 150 + 50, 0, Math.PI * 2);
        ctx.fill();
      }

      canvas.toBlob((blob) => {
        resolve(new File([blob!], 'mock_image.png', { type: 'image/png' }));
      }, 'image/png');
    });
  };

  const generateMockPdfFile = async (name = 'doc.pdf'): Promise<File> => {
    const { PDFDocument, rgb } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([400, 400]);
    page.drawText('Compactor Mock PDF for Diagnostics', {
      x: 50,
      y: 350,
      size: 14,
      color: rgb(0.1, 0.1, 0.1)
    });
    const bytes = await pdfDoc.save();
    return new File([bytes as any], name, { type: 'application/pdf' });
  };

  const generateMockAudioFile = (): File => {
    const sampleRate = 8000;
    const durationSec = 1;
    const numSamples = sampleRate * durationSec;
    const buffer = new ArrayBuffer(44 + numSamples);
    const view = new DataView(buffer);
    
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + numSamples, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, numSamples, true);
    
    // Write sine wave tone
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const sample = Math.round(128 + 127 * Math.sin(2 * Math.PI * 440 * t));
      view.setUint8(44 + i, sample);
    }
    
    const blob = new Blob([buffer], { type: 'audio/wav' });
    return new File([blob], 'mock_audio.wav', { type: 'audio/wav' });
  };

  const generateMockVideoFile = (): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 120;
      const ctx = canvas.getContext('2d')!;
      
      const stream = canvas.captureStream(10);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(new File([blob], 'mock_video.webm', { type: 'video/webm' }));
      };
      
      recorder.start();
      
      let frames = 0;
      const draw = () => {
        if (frames > 15) {
          recorder.stop();
          return;
        }
        ctx.fillStyle = `hsl(${frames * 24}, 80%, 40%)`;
        ctx.fillRect(0, 0, 160, 120);
        frames++;
        requestAnimationFrame(draw);
      };
      draw();
    });
  };

  const updateTestStatus = (id: string, status: TestResult['status'], data?: Partial<TestResult>) => {
    setTestResults((prev) => prev.map((t) => t.id === id ? { ...t, status, ...data } : t));
  };

  const runAllDiagnostics = async () => {
    setIsRunning(true);
    setLogs([]);
    addLog("Starting automated integration check suite...");
    addLog(`System metrics: CPU Cores: ${systemInfo.cores} | RAM: ${systemInfo.memory} | SAB: ${systemInfo.sab}`);

    // Reset results
    setTestResults((prev) => prev.map((t) => ({ ...t, status: 'idle', timeTakenMs: undefined, originalSize: undefined, newSize: undefined, rate: undefined, speedMBs: undefined, error: undefined })));

    try {
      // 1. TEST WebP Compression
      await runImageTestWebP();
      
      // 2. TEST JPEG Compression
      await runImageTestJpeg();

      // 3. TEST Image Target Size
      await runImageTestTarget();

      // 4. TEST PDF Merging
      await runPdfMergeTest();

      // 5. TEST PDF Signing
      await runPdfSignTest();

      // 6. TEST Audio WASM Compression
      await runAudioWasmTest();

      // 7. TEST Video Native Compression
      await runVideoNativeTest();

      // 8. TEST Video WASM Compression
      await runVideoWasmTest();

      addLog("All diagnostics checks executed successfully! Check individual tool rows.");
    } catch (err: any) {
      addLog(`Diagnostics process interrupted: ${err.message || err}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runImageTestWebP = async () => {
    const id = 'img-webp';
    updateTestStatus(id, 'running');
    addLog("Generating mock image (1000x1000px PNG) for WebP compression test...");
    
    try {
      const imgFile = await generateMockImageFile();
      addLog(`Mock Image Generated: ${formatBytes(imgFile.size)}`);
      
      const start = performance.now();
      const res = await processImage(imgFile, { quality: 0.75, format: 'image/webp' });
      const timeTaken = Math.round(performance.now() - start);
      
      const speed = (imgFile.size / (1024 * 1024)) / (timeTaken / 1000);
      const rate = Math.round(((imgFile.size - res.newSize) / imgFile.size) * 100);

      updateTestStatus(id, 'success', {
        timeTakenMs: timeTaken,
        originalSize: imgFile.size,
        newSize: res.newSize,
        rate,
        speedMBs: parseFloat(speed.toFixed(2))
      });
      addLog(`[PASS] WebP Compression test completed in ${timeTaken}ms (Saved ${rate}%, Speed: ${speed.toFixed(1)} MB/s).`);
    } catch (e: any) {
      updateTestStatus(id, 'failed', { error: e.message || e });
      addLog(`[FAIL] WebP Compression test failed: ${e.message}`);
    }
  };

  const runImageTestJpeg = async () => {
    const id = 'img-jpeg';
    updateTestStatus(id, 'running');
    addLog("Running JPEG compression test...");
    
    try {
      const imgFile = await generateMockImageFile();
      
      const start = performance.now();
      const res = await processImage(imgFile, { quality: 0.8, format: 'image/jpeg' });
      const timeTaken = Math.round(performance.now() - start);
      
      const speed = (imgFile.size / (1024 * 1024)) / (timeTaken / 1000);
      const rate = Math.round(((imgFile.size - res.newSize) / imgFile.size) * 100);

      updateTestStatus(id, 'success', {
        timeTakenMs: timeTaken,
        originalSize: imgFile.size,
        newSize: res.newSize,
        rate,
        speedMBs: parseFloat(speed.toFixed(2))
      });
      addLog(`[PASS] JPEG Compression test completed in ${timeTaken}ms (Saved ${rate}%).`);
    } catch (e: any) {
      updateTestStatus(id, 'failed', { error: e.message || e });
      addLog(`[FAIL] JPEG Compression test failed: ${e.message}`);
    }
  };

  const runImageTestTarget = async () => {
    const id = 'img-target';
    updateTestStatus(id, 'running');
    addLog("Testing optimized Image Target Size loop (Short-circuit test target = 50 KB)...");
    
    try {
      const imgFile = await generateMockImageFile();
      
      const start = performance.now();
      const res = await processImage(imgFile, { quality: 0.8, targetSizeKB: 50 });
      const timeTaken = Math.round(performance.now() - start);
      
      const rate = Math.round(((imgFile.size - res.newSize) / imgFile.size) * 100);

      updateTestStatus(id, 'success', {
        timeTakenMs: timeTaken,
        originalSize: imgFile.size,
        newSize: res.newSize,
        rate
      });
      addLog(`[PASS] Target Size search loop finished in ${timeTaken}ms. Output size: ${formatBytes(res.newSize)} (Target was 50 KB).`);
    } catch (e: any) {
      updateTestStatus(id, 'failed', { error: e.message || e });
      addLog(`[FAIL] Target Size check failed: ${e.message}`);
    }
  };

  const runPdfMergeTest = async () => {
    const id = 'pdf-merge';
    updateTestStatus(id, 'running');
    addLog("Creating mock PDF documents using pdf-lib...");
    
    try {
      const pdf1 = await generateMockPdfFile('file1.pdf');
      const pdf2 = await generateMockPdfFile('file2.pdf');
      
      addLog("Executing pdf-lib merge pipeline...");
      const start = performance.now();
      const mergedBlob = await mergePdfs([pdf1, pdf2]);
      const timeTaken = Math.round(performance.now() - start);
      
      updateTestStatus(id, 'success', {
        timeTakenMs: timeTaken,
        originalSize: pdf1.size + pdf2.size,
        newSize: mergedBlob.size,
        rate: 0
      });
      addLog(`[PASS] PDF Merging completed in ${timeTaken}ms (Output size: ${formatBytes(mergedBlob.size)}).`);
    } catch (e: any) {
      updateTestStatus(id, 'failed', { error: e.message || e });
      addLog(`[FAIL] PDF Merging failed: ${e.message}`);
    }
  };

  const runPdfSignTest = async () => {
    const id = 'pdf-sign';
    updateTestStatus(id, 'running');
    addLog("Executing digital document signing test...");
    
    try {
      const pdf = await generateMockPdfFile('document.pdf');
      
      const start = performance.now();
      const signedBlob = await signPdfDocument(pdf, 'Approved Digitally via Diagnostics Suite');
      const timeTaken = Math.round(performance.now() - start);
      
      updateTestStatus(id, 'success', {
        timeTakenMs: timeTaken,
        originalSize: pdf.size,
        newSize: signedBlob.size
      });
      addLog(`[PASS] PDF Digital signing finished in ${timeTaken}ms.`);
    } catch (e: any) {
      updateTestStatus(id, 'failed', { error: e.message || e });
      addLog(`[FAIL] PDF Sign tool failed: ${e.message}`);
    }
  };

  const runAudioWasmTest = async () => {
    const id = 'audio-wasm';
    updateTestStatus(id, 'running');
    addLog("Generating mock WAV audio track (1 second sine wave)...");
    
    try {
      const wavFile = generateMockAudioFile();
      addLog(`Mock audio track: ${formatBytes(wavFile.size)}`);
      
      addLog("Initializing WASM FFmpeg context & compiling wave stream into MP3...");
      const start = performance.now();
      const res = await compressAudio(
        wavFile, 
        { bitrate: '64k', format: 'mp3', duration: 1.0 }, 
        (ffmpegMsg) => addLog(`[FFmpeg-WASM] ${ffmpegMsg}`),
        () => {}
      );
      const timeTaken = Math.round(performance.now() - start);
      const rate = Math.round(((wavFile.size - res.blob.size) / wavFile.size) * 100);

      updateTestStatus(id, 'success', {
        timeTakenMs: timeTaken,
        originalSize: wavFile.size,
        newSize: res.blob.size,
        rate
      });
      addLog(`[PASS] Audio WASM compilation completed in ${timeTaken}ms (Saved ${rate}%).`);
    } catch (e: any) {
      updateTestStatus(id, 'failed', { error: e.message || e });
      addLog(`[FAIL] Audio WASM compilation failed: ${e.message}`);
    }
  };

  const runVideoNativeTest = async () => {
    const id = 'video-native';
    updateTestStatus(id, 'running');
    addLog("Generating animated canvas stream for native video compressor...");
    
    try {
      const mockVid = await generateMockVideoFile();
      addLog(`Captured mock video clip size: ${formatBytes(mockVid.size)}`);

      addLog("Running offscreen native recording compiler at 4.0x acceleration rate...");
      const start = performance.now();
      const res = await compressVideoNative(mockVid, {
        bitrateKbps: 800,
        playbackRate: 4.0,
        removeAudio: true,
        onProgress: () => {},
        onLog: (m) => addLog(`[Native-Engine] ${m}`)
      });
      const timeTaken = Math.round(performance.now() - start);
      const rate = Math.round(((mockVid.size - res.blob.size) / mockVid.size) * 100);

      updateTestStatus(id, 'success', {
        timeTakenMs: timeTaken,
        originalSize: mockVid.size,
        newSize: res.blob.size,
        rate
      });
      addLog(`[PASS] Video Native compilation completed in ${timeTaken}ms (Saved ${rate}%).`);
    } catch (e: any) {
      updateTestStatus(id, 'failed', { error: e.message || e });
      addLog(`[FAIL] Video Native compressor failed: ${e.message}`);
    }
  };

  const runVideoWasmTest = async () => {
    const id = 'video-wasm';
    updateTestStatus(id, 'running');
    addLog("Testing Video WebAssembly compression on mock WebM container...");
    
    try {
      const mockVid = await generateMockVideoFile();
      
      addLog("Executing FFmpeg-WASM encoding using 'fast' preset...");
      const start = performance.now();
      const res = await compressVideo(
        mockVid,
        {
          crf: 28,
          scale: 'no-scale',
          preset: 'fast',
          removeAudio: true,
          format: 'mp4',
          duration: 1.5 // Pass duration to skip 'ffmpeg -i' dry-run
        },
        (m) => addLog(`[FFmpeg-WASM] ${m}`),
        () => {}
      );
      const timeTaken = Math.round(performance.now() - start);
      const rate = Math.round(((mockVid.size - res.blob.size) / mockVid.size) * 100);

      updateTestStatus(id, 'success', {
        timeTakenMs: timeTaken,
        originalSize: mockVid.size,
        newSize: res.blob.size,
        rate
      });
      addLog(`[PASS] Video WASM compression completed in ${timeTaken}ms (Saved ${rate}%).`);
    } catch (e: any) {
      updateTestStatus(id, 'failed', { error: e.message || e });
      addLog(`[FAIL] Video WASM compressor failed: ${e.message}`);
    }
  };

  return (
    <div className="tool-layout">
      <div className="tool-layout__header">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <ActivityIcon className="w-6 h-6 text-sky-500 animate-pulse" /> Diagnostics & Benchmarks
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Automated in-browser performance checks and integration validation of all core compilers.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onGoHome} className="h-9">
          Go Dashboard
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* System parameters */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] shadow-sm">
            <CardHeader className="p-4 bg-[var(--bg-color)]/30 border-b border-[var(--border-color)]">
              <CardTitle className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                <InfoIcon className="w-4 h-4 text-sky-500" /> Host Environment Specs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5 text-xs">
              <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-2">
                <span className="text-[var(--text-secondary)] font-semibold flex items-center gap-1"><CpuIcon className="w-3.5 h-3.5" /> Hardware CPU</span>
                <span className="font-bold text-[var(--text-primary)]">{systemInfo.cores}</span>
              </div>
              <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-2">
                <span className="text-[var(--text-secondary)] font-semibold flex items-center gap-1">Device Memory</span>
                <span className="font-bold text-[var(--text-primary)]">{systemInfo.memory}</span>
              </div>
              <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-2">
                <span className="text-[var(--text-secondary)] font-semibold flex items-center gap-1">SharedArrayBuffer</span>
                <span className={`font-bold ${systemInfo.sab.includes('Not') ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {systemInfo.sab}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[var(--text-secondary)] font-semibold block">Browser User Agent</span>
                <p className="text-[10px] text-[var(--text-secondary)] font-mono leading-relaxed bg-[var(--bg-color)] p-2 rounded border border-[var(--border-color)] truncate" title={systemInfo.ua}>
                  {systemInfo.ua}
                </p>
              </div>

              <div className="pt-2">
                <Button
                  onClick={runAllDiagnostics}
                  disabled={isRunning}
                  className="w-full font-bold rounded-full py-5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-colors shadow flex items-center justify-center gap-1.5"
                >
                  <PlayIcon className="w-3.5 h-3.5" /> {isRunning ? "Diagnostics Running..." : "Execute Automated Benchmarks"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Benchmarks table list */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-[var(--border-color)] bg-[var(--surface-color)] shadow-sm overflow-hidden">
            <CardHeader className="p-4 bg-[var(--bg-color)]/30 border-b border-[var(--border-color)]">
              <CardTitle className="text-sm font-bold text-[var(--text-primary)] flex items-center justify-between">
                <span>Compiler Integration Checks</span>
                {isRunning && <span className="text-[11px] text-sky-500 animate-pulse font-normal">Active tests...</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold border-b border-[var(--border-color)] uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3.5 pl-4">Tool Module</th>
                      <th className="p-3.5">Speed (ms)</th>
                      <th className="p-3.5">Rate (% saved)</th>
                      <th className="p-3.5">Bandwidth</th>
                      <th className="p-3.5 text-right pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]/40">
                    {testResults.map((test) => (
                      <tr key={test.id} className="hover:bg-[var(--bg-color)]/20 transition-colors">
                        <td className="p-3.5 pl-4">
                          <span className="block font-bold text-[var(--text-primary)]">{test.name}</span>
                          <span className="text-[10px] text-[var(--text-secondary)] block mt-0.5">{test.category} Engine</span>
                        </td>
                        <td className="p-3.5 font-mono text-[var(--text-primary)]">
                          {test.status === 'success' && test.timeTakenMs ? `${test.timeTakenMs} ms` : '-'}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {test.status === 'success' && test.rate !== undefined ? `-${test.rate}%` : '-'}
                        </td>
                        <td className="p-3.5 font-mono text-[var(--text-secondary)]">
                          {test.status === 'success' && test.speedMBs ? `${test.speedMBs} MB/s` : '-'}
                        </td>
                        <td className="p-3.5 text-right pr-4">
                          {test.status === 'idle' && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-secondary)] bg-[var(--bg-color)] px-2 py-0.5 rounded font-bold uppercase tracking-wider">Idle</span>
                          )}
                          {test.status === 'running' && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-sky-500 bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">Running</span>
                          )}
                          {test.status === 'success' && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                              <CheckCircle className="w-3.5 h-3.5" /> Pass
                            </span>
                          )}
                          {test.status === 'failed' && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-rose-600 bg-rose-50 dark:text-rose-450 dark:bg-rose-950/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider" title={test.error}>
                              <XCircleIcon className="w-3.5 h-3.5" /> Fail
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Real-time details console logs */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Diagnostics Event Log Output</label>
            <pre className="w-full bg-zinc-950 text-zinc-350 p-4 rounded-xl font-mono text-[11px] h-60 overflow-y-auto shadow-inner border border-zinc-800 leading-relaxed">
              {logs.length === 0 ? (
                <div className="text-zinc-600 italic">Logs will appear here once diagnostics are running...</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className={`pb-1 break-all ${log.includes('[FAIL]') ? 'text-rose-400' : log.includes('[PASS]') ? 'text-emerald-400' : ''}`}>
                    {log}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
