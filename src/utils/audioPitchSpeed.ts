/**
 * 100% Client-Side Audio Pitch & Speed Engine
 * Driven natively by Rubber Band Library WebAssembly (C++ DSP Engine).
 *
 * Block-by-Block Chunked Processing:
 * Passes audio in optimal WASM memory blocks (4,096 samples per block)
 * to ensure Rubber Band never exceeds WASM stack/heap limits regardless of track length.
 */

import rubberbandWasmUrl from 'rubberband-wasm/dist/rubberband.wasm?url';
import { RubberBandInterface, RubberBandOption } from 'rubberband-wasm';

let rubberBandPromise: Promise<RubberBandInterface> | null = null;

async function getRubberBand(): Promise<RubberBandInterface> {
  if (!rubberBandPromise) {
    rubberBandPromise = (async () => {
      const resp = await fetch(rubberbandWasmUrl);
      const wasmBuffer = await resp.arrayBuffer();
      const wasmModule = await WebAssembly.compile(wasmBuffer);
      return RubberBandInterface.initialize(wasmModule);
    })();
  }
  return rubberBandPromise;
}

/**
 * Encode separate de-interleaved channel arrays into a standard WAV Blob.
 */
function encodeWAV(channels: Float32Array[], sampleRate: number): Blob {
  const numChannels = channels.length;
  const numSamples = channels[0].length;
  const buffer = new ArrayBuffer(44 + numSamples * numChannels * 2);
  const view = new DataView(buffer);

  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + numSamples * numChannels * 2, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, numSamples * numChannels * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function allocChannelPtrs(
  rb: RubberBandInterface,
  channels: Float32Array[]
): [number, number[]] {
  const channelPtrs: number[] = channels.map((ch) => {
    const ptr = rb.malloc(ch.length * 4); // sizeof(float) = 4
    rb.memWrite(ptr, ch);
    return ptr;
  });

  const ptrArrayPtr = rb.malloc(channels.length * 4); // sizeof(float*) = 4 in WASM32
  for (let c = 0; c < channels.length; c++) {
    rb.memWritePtr(ptrArrayPtr + c * 4, channelPtrs[c]);
  }

  return [ptrArrayPtr, channelPtrs];
}

function allocOutputChannelPtrs(
  rb: RubberBandInterface,
  numChannels: number,
  numSamples: number
): [number, number[]] {
  const channelPtrs: number[] = Array.from({ length: numChannels }, () =>
    rb.malloc(numSamples * 4)
  );

  const ptrArrayPtr = rb.malloc(numChannels * 4);
  for (let c = 0; c < numChannels; c++) {
    rb.memWritePtr(ptrArrayPtr + c * 4, channelPtrs[c]);
  }

  return [ptrArrayPtr, channelPtrs];
}

function freeChannelPtrs(rb: RubberBandInterface, ptrArrayPtr: number, channelPtrs: number[]): void {
  rb.free(ptrArrayPtr);
  channelPtrs.forEach((p) => rb.free(p));
}

export async function processPitchAndSpeed(
  file: File,
  options: { pitchSemitones: number; speedRatio: number },
  onProgress?: (progress: number) => void
): Promise<{ url: string; blob: Blob; duration: number }> {
  const { pitchSemitones, speedRatio } = options;

  if (pitchSemitones === 0 && speedRatio === 1.0) {
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    const url = URL.createObjectURL(blob);
    onProgress?.(100);
    return { url, blob, duration: 0 };
  }

  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

  try {
    onProgress?.(10);
    const originalBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const sampleRate = originalBuffer.sampleRate;
    const numChannels = originalBuffer.numberOfChannels;
    const totalSamples = originalBuffer.length;

    onProgress?.(20);

    const rb = await getRubberBand();

    const pitchScale = Math.pow(2, pitchSemitones / 12);
    const timeRatio = 1.0 / speedRatio;

    const rbOptions =
      RubberBandOption.RubberBandOptionProcessOffline    |
      RubberBandOption.RubberBandOptionStretchPrecise    |
      RubberBandOption.RubberBandOptionPitchHighQuality  |
      RubberBandOption.RubberBandOptionEngineFiner;

    const state = rb.rubberband_new(sampleRate, numChannels, rbOptions, timeRatio, pitchScale);
    rb.rubberband_set_expected_input_duration(state, totalSamples);

    onProgress?.(25);

    const inputChannels: Float32Array[] = Array.from({ length: numChannels }, (_, c) =>
      originalBuffer.getChannelData(c)
    );

    const BLOCK_SIZE = 8192; // Process in optimal 8,192-sample WASM blocks
    const numBlocks = Math.ceil(totalSamples / BLOCK_SIZE);

    // ── PHASE 1: STUDY (Block-by-Block) ───────────────────────────────────────
    for (let b = 0; b < numBlocks; b++) {
      const start = b * BLOCK_SIZE;
      const count = Math.min(BLOCK_SIZE, totalSamples - start);
      const isFinal = b === numBlocks - 1 ? 1 : 0;

      const blockChannels = inputChannels.map((ch) => ch.subarray(start, start + count));
      const [studyPtrArray, studyChannelPtrs] = allocChannelPtrs(rb, blockChannels);
      rb.rubberband_study(state, studyPtrArray, count, isFinal);
      freeChannelPtrs(rb, studyPtrArray, studyChannelPtrs);

      if (b % 10 === 0) {
        onProgress?.(25 + Math.round((b / numBlocks) * 25));
      }
    }

    onProgress?.(50);

    // ── PHASE 2: CALCULATE STRETCH ──────────────────────────────────────────
    rb.rubberband_calculate_stretch(state);

    onProgress?.(55);

    // ── PHASE 3: PROCESS & RETRIEVE (Block-by-Block) ─────────────────────────
    const outputBuffers: number[][] = Array.from({ length: numChannels }, () => []);

    for (let b = 0; b < numBlocks; b++) {
      const start = b * BLOCK_SIZE;
      const count = Math.min(BLOCK_SIZE, totalSamples - start);
      const isFinal = b === numBlocks - 1 ? 1 : 0;

      const blockChannels = inputChannels.map((ch) => ch.subarray(start, start + count));
      const [processPtrArray, processChannelPtrs] = allocChannelPtrs(rb, blockChannels);
      rb.rubberband_process(state, processPtrArray, count, isFinal);
      freeChannelPtrs(rb, processPtrArray, processChannelPtrs);

      // Drain available samples after processing block
      let avail = rb.rubberband_available(state);
      while (avail > 0) {
        const toRead = Math.min(avail, 16384);
        const [outPtrArray, outChannelPtrs] = allocOutputChannelPtrs(rb, numChannels, toRead);
        const retrieved = rb.rubberband_retrieve(state, outPtrArray, toRead);

        if (retrieved > 0) {
          for (let c = 0; c < numChannels; c++) {
            const chunk = rb.memReadF32(outChannelPtrs[c], retrieved);
            for (let i = 0; i < chunk.length; i++) {
              outputBuffers[c].push(chunk[i]);
            }
          }
        }
        freeChannelPtrs(rb, outPtrArray, outChannelPtrs);
        avail = rb.rubberband_available(state);
      }

      if (b % 10 === 0) {
        onProgress?.(55 + Math.round((b / numBlocks) * 35));
      }
    }

    // Convert output buffers to Float32Arrays
    const latency = rb.rubberband_get_latency(state);
    const outputChannels: Float32Array[] = outputBuffers.map((arr) => {
      const full = new Float32Array(arr);
      return latency > 0 && latency < full.length ? full.slice(latency) : full;
    });

    rb.rubberband_delete(state);

    onProgress?.(92);

    if (outputChannels[0].length === 0) {
      throw new Error('Rubber Band produced no output samples.');
    }

    // Peak normalization
    let maxPeak = 0;
    for (const ch of outputChannels) {
      for (let i = 0; i < ch.length; i++) {
        const absVal = Math.abs(ch[i]);
        if (absVal > maxPeak) maxPeak = absVal;
      }
    }
    if (maxPeak > 0.95) {
      const scale = 0.95 / maxPeak;
      for (const ch of outputChannels) {
        for (let i = 0; i < ch.length; i++) ch[i] *= scale;
      }
    }

    const wavBlob = encodeWAV(outputChannels, sampleRate);
    const url = URL.createObjectURL(wavBlob);
    const duration = outputChannels[0].length / sampleRate;

    onProgress?.(100);

    return { url, blob: wavBlob, duration };
  } finally {
    await audioCtx.close();
  }
}
