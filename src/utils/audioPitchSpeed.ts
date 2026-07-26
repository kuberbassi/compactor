/**
 * 100% Client-Side Audio Pitch & Speed Engine
 * Driven natively by Rubber Band Library WebAssembly (C++ DSP Engine).
 *
 * CRITICAL: The Rubber Band C API uses float** (pointer-to-channel-pointers),
 * NOT interleaved audio. We must build a proper pointer array in WASM memory.
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

function encodeWAV(
  channels: Float32Array[],
  sampleRate: number
): Blob {
  const numChannels = channels.length;
  const numSamples = channels[0].length;
  const buffer = new ArrayBuffer(44 + numSamples * numChannels * 2);
  const view = new DataView(buffer);

  /* RIFF header */
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + numSamples * numChannels * 2, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  /* fmt sub-chunk */
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);

  /* data sub-chunk (interleaved) */
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

/**
 * Build a float** pointer array in WASM memory.
 * Returns [ptrArrayPtr, channelPtrs[]]
 * The caller must free ptrArrayPtr and each element of channelPtrs.
 */
function allocChannelPtrs(
  rb: RubberBandInterface,
  channels: Float32Array[]
): [number, number[]] {
  const numChannels = channels.length;
  // Allocate WASM memory for each channel
  const channelPtrs: number[] = channels.map((ch) => {
    const ptr = rb.malloc(ch.length * 4); // float32 = 4 bytes
    rb.memWrite(ptr, ch);
    return ptr;
  });

  // Allocate a pointer array (4 bytes per pointer in WASM32)
  const ptrArrayPtr = rb.malloc(numChannels * 4);
  for (let c = 0; c < numChannels; c++) {
    // Write each channel pointer at offset c*4 within the array
    rb.memWritePtr(ptrArrayPtr + c * 4, channelPtrs[c]);
  }

  return [ptrArrayPtr, channelPtrs];
}

/**
 * Allocate output channel pointer arrays in WASM memory (uninitialized).
 * Returns [ptrArrayPtr, channelPtrs[]]
 */
function allocOutputChannelPtrs(
  rb: RubberBandInterface,
  numChannels: number,
  numSamples: number
): [number, number[]] {
  const channelPtrs: number[] = [];
  for (let c = 0; c < numChannels; c++) {
    channelPtrs.push(rb.malloc(numSamples * 4));
  }

  const ptrArrayPtr = rb.malloc(numChannels * 4);
  for (let c = 0; c < numChannels; c++) {
    rb.memWritePtr(ptrArrayPtr + c * 4, channelPtrs[c]);
  }

  return [ptrArrayPtr, channelPtrs];
}

export async function processPitchAndSpeed(
  file: File,
  options: { pitchSemitones: number; speedRatio: number },
  onProgress?: (progress: number) => void
): Promise<{ url: string; blob: Blob; duration: number }> {
  const { pitchSemitones, speedRatio } = options;
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

  try {
    onProgress?.(10);
    const originalBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const sampleRate = originalBuffer.sampleRate;
    const numChannels = originalBuffer.numberOfChannels;
    const totalSamples = originalBuffer.length;

    onProgress?.(20);

    // Rubber Band WASM Native C++ Engine
    const rb = await getRubberBand();

    // pitchScale: semitone shift expressed as frequency ratio
    // timeRatio: 1/speedRatio means output is stretched/compressed in time
    //   timeRatio > 1 => slower (more output samples)
    //   timeRatio < 1 => faster (fewer output samples)
    const pitchScale = Math.pow(2, pitchSemitones / 12);
    const timeRatio = 1.0 / speedRatio;

    const rbOptions =
      RubberBandOption.RubberBandOptionProcessOffline |
      RubberBandOption.RubberBandOptionStretchPrecise |
      RubberBandOption.RubberBandOptionPitchHighQuality |
      RubberBandOption.RubberBandOptionEngineFiner;

    const state = rb.rubberband_new(sampleRate, numChannels, rbOptions, timeRatio, pitchScale);
    rb.rubberband_set_expected_input_duration(state, totalSamples);

    onProgress?.(30);

    // Extract each channel as a separate Float32Array (de-interleaved)
    const inputChannels: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      inputChannels.push(new Float32Array(originalBuffer.getChannelData(c)));
    }

    // --- STUDY PHASE (offline mode requires study before process) ---
    // Build pointer array for study
    const [studyPtrArray, studyChannelPtrs] = allocChannelPtrs(rb, inputChannels);
    rb.rubberband_study(state, studyPtrArray, totalSamples, 1);

    // Free study buffers
    rb.free(studyPtrArray);
    studyChannelPtrs.forEach((p) => rb.free(p));

    onProgress?.(50);

    // --- PROCESS PHASE ---
    const [processPtrArray, processChannelPtrs] = allocChannelPtrs(rb, inputChannels);
    rb.rubberband_process(state, processPtrArray, totalSamples, 1);

    // Free process input buffers
    rb.free(processPtrArray);
    processChannelPtrs.forEach((p) => rb.free(p));

    onProgress?.(75);

    // --- RETRIEVE PHASE ---
    const avail = rb.rubberband_available(state);
    if (avail <= 0) {
      rb.rubberband_delete(state);
      throw new Error('Rubber Band: no output samples available after processing');
    }

    const [outPtrArray, outChannelPtrs] = allocOutputChannelPtrs(rb, numChannels, avail);
    const retrieved = rb.rubberband_retrieve(state, outPtrArray, avail);

    // Read back each output channel
    const outputChannels: Float32Array[] = outChannelPtrs.map((ptr) =>
      new Float32Array(rb.memReadF32(ptr, retrieved))
    );

    // Free output buffers and state
    rb.free(outPtrArray);
    outChannelPtrs.forEach((p) => rb.free(p));
    rb.rubberband_delete(state);

    onProgress?.(90);

    // Peak normalization across all channels
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
    const duration = retrieved / sampleRate;

    onProgress?.(100);

    return { url, blob: wavBlob, duration };
  } finally {
    await audioCtx.close();
  }
}
