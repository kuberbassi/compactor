/**
 * 100% Client-Side Audio Pitch & Speed Engine
 * Driven natively by Rubber Band Library WebAssembly (C++ DSP Engine).
 *
 * CRITICAL: The Rubber Band C API uses float** (pointer-to-channel-pointers),
 * NOT interleaved audio. We must build a proper pointer array in WASM memory.
 *
 * Correct offline flow:
 *   1. rubberband_new()                  – create state
 *   2. rubberband_set_expected_input_duration()
 *   3. rubberband_study(final=1)         – full analysis pass
 *   4. rubberband_calculate_stretch()    – finalize offline analysis (MANDATORY)
 *   5. rubberband_process(final=1)       – processing pass
 *   6. loop: rubberband_retrieve()       – collect all output
 *   7. rubberband_delete()               – cleanup
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

/**
 * Allocate WASM de-interleaved channel buffers and build a float** pointer array.
 * Rubber Band C API expects float** — a pointer to an array of per-channel float* pointers.
 *
 * Memory layout in WASM32:
 *   ptrArrayPtr → [ ptr_ch0 (4 bytes) | ptr_ch1 (4 bytes) | ... ]
 *   ptr_ch0    → [ f32 | f32 | ... ]  (channel 0 samples)
 *   ptr_ch1    → [ f32 | f32 | ... ]  (channel 1 samples)
 *
 * Returns [ptrArrayPtr, channelPtrs[]] — caller must free all.
 */
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

/**
 * Allocate uninitialized output channel buffers and a float** pointer array.
 */
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

/**
 * Free a pointer array and all its channel buffers.
 */
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

  // Short-circuit: nothing to do
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

    // pitchScale: 2^(semitones/12) — pure frequency ratio, no speed change
    // timeRatio: output_samples / input_samples — independent of pitch
    //   > 1 means slower, < 1 means faster
    const pitchScale = Math.pow(2, pitchSemitones / 12);
    const timeRatio = 1.0 / speedRatio;

    const rbOptions =
      RubberBandOption.RubberBandOptionProcessOffline    | // offline = highest quality, pre-analysis
      RubberBandOption.RubberBandOptionStretchPrecise    | // precise time-stretch (not elastic)
      RubberBandOption.RubberBandOptionTransientsCrisp   | // sharp transients (drums, plucks)
      RubberBandOption.RubberBandOptionPitchHighQuality  | // high-quality pitch estimation
      RubberBandOption.RubberBandOptionFormantPreserved  | // prevent chipmunk effect on voices
      RubberBandOption.RubberBandOptionEngineFiner;        // use the newer, better R3 engine

    const state = rb.rubberband_new(sampleRate, numChannels, rbOptions, timeRatio, pitchScale);
    rb.rubberband_set_expected_input_duration(state, totalSamples);

    onProgress?.(25);

    // Extract each channel as a separate Float32Array (de-interleaved, as RB requires)
    const inputChannels: Float32Array[] = Array.from({ length: numChannels }, (_, c) =>
      new Float32Array(originalBuffer.getChannelData(c))
    );

    // ── PHASE 1: STUDY ──────────────────────────────────────────────────────────
    // Offline mode: full analysis pass of the entire audio before processing.
    // Pass final=1 to signal this is the complete input.
    const [studyPtrArray, studyChannelPtrs] = allocChannelPtrs(rb, inputChannels);
    rb.rubberband_study(state, studyPtrArray, totalSamples, 1);
    freeChannelPtrs(rb, studyPtrArray, studyChannelPtrs);

    onProgress?.(40);

    // ── PHASE 2: CALCULATE STRETCH ──────────────────────────────────────────────
    // MANDATORY in offline mode: finalizes the internal stretch map from the study data.
    // Without this call, the processor uses a default map → wrong output length + artifacts.
    rb.rubberband_calculate_stretch(state);

    onProgress?.(50);

    // ── PHASE 3: PROCESS ────────────────────────────────────────────────────────
    // Full processing pass. Pass final=1 again.
    const [processPtrArray, processChannelPtrs] = allocChannelPtrs(rb, inputChannels);
    rb.rubberband_process(state, processPtrArray, totalSamples, 1);
    freeChannelPtrs(rb, processPtrArray, processChannelPtrs);

    onProgress?.(70);

    // ── PHASE 4: RETRIEVE ───────────────────────────────────────────────────────
    // Collect all output samples. In offline mode all samples should be available
    // after process(), but we loop to be safe with large files.
    const outputChannelArrays: Float32Array[] = Array.from({ length: numChannels }, () => new Float32Array(0));
    const CHUNK = 65536; // retrieve in 64k-sample chunks

    let avail = rb.rubberband_available(state);
    while (avail > 0) {
      const toRead = Math.min(avail, CHUNK);
      const [outPtrArray, outChannelPtrs] = allocOutputChannelPtrs(rb, numChannels, toRead);
      const retrieved = rb.rubberband_retrieve(state, outPtrArray, toRead);

      if (retrieved > 0) {
        for (let c = 0; c < numChannels; c++) {
          const chunk = rb.memReadF32(outChannelPtrs[c], retrieved);
          const combined = new Float32Array(outputChannelArrays[c].length + retrieved);
          combined.set(outputChannelArrays[c]);
          combined.set(chunk, outputChannelArrays[c].length);
          outputChannelArrays[c] = combined;
        }
      }

      freeChannelPtrs(rb, outPtrArray, outChannelPtrs);
      avail = rb.rubberband_available(state);
    }

    // ── LATENCY TRIM ────────────────────────────────────────────────────────────
    // Rubber Band introduces latency (pre-roll). Trim leading latency samples to
    // keep audio perfectly aligned with the original start position.
    const latency = rb.rubberband_get_latency(state);
    const outputChannels = outputChannelArrays.map((ch) =>
      latency > 0 && latency < ch.length ? ch.slice(latency) : ch
    );

    rb.rubberband_delete(state);

    onProgress?.(90);

    if (outputChannels[0].length === 0) {
      throw new Error('Rubber Band produced no output samples. The input may be too short.');
    }

    // ── PEAK NORMALIZATION ───────────────────────────────────────────────────────
    // Normalize so the loudest peak is at -0.5 dBFS (scale = 0.944)
    let maxPeak = 0;
    for (const ch of outputChannels) {
      for (let i = 0; i < ch.length; i++) {
        const absVal = Math.abs(ch[i]);
        if (absVal > maxPeak) maxPeak = absVal;
      }
    }
    if (maxPeak > 0 && maxPeak > 0.944) {
      const scale = 0.944 / maxPeak;
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
