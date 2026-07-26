/**
 * 100% Client-Side Studio-Grade Audio Pitch & Speed Engine
 * Powered by Rubber Band Library (WASM) for highest quality artifact-free audio DSP.
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

function encodeWAV(samples: Float32Array, sampleRate: number, numChannels: number = 2): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF header */
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + samples.length * 2, true);
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

  /* data sub-chunk */
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function pitchShiftAndStretchChannel(
  inputChannel: Float32Array,
  _sampleRate: number,
  pitchSemitones: number,
  speedRatio: number
): Float32Array {
  const pitchFactor = Math.pow(2, pitchSemitones / 12);
  const effectiveRate = pitchFactor * speedRatio;
  const outputLength = Math.max(1, Math.floor(inputChannel.length / speedRatio));
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const readPos = i * effectiveRate;
    const basePos = Math.floor(readPos);
    const frac = readPos - basePos;
    if (basePos + 1 < inputChannel.length) {
      output[i] = inputChannel[basePos] + frac * (inputChannel[basePos + 1] - inputChannel[basePos]);
    } else if (basePos < inputChannel.length) {
      output[i] = inputChannel[basePos];
    }
  }

  return output;
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
    onProgress?.(15);
    const originalBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const sampleRate = originalBuffer.sampleRate;
    const numChannels = originalBuffer.numberOfChannels;

    onProgress?.(30);

    let outputSamples: Float32Array;
    let finalDuration = originalBuffer.duration / speedRatio;

    try {
      // ── RUBBER BAND WASM HIGH QUALITY ENGINE ──
      const rb = await getRubberBand();
      const pitchScale = Math.pow(2, pitchSemitones / 12);
      const timeRatio = 1 / speedRatio;

      const rbOptions =
        RubberBandOption.RubberBandOptionProcessOffline |
        RubberBandOption.RubberBandOptionPitchHighQuality |
        RubberBandOption.RubberBandOptionEngineFiner;

      const state = rb.rubberband_new(sampleRate, numChannels, rbOptions, timeRatio, pitchScale);
      const totalSamples = originalBuffer.length;
      rb.rubberband_set_expected_input_duration(state, totalSamples);

      const inputPcm = new Float32Array(totalSamples * numChannels);
      if (numChannels === 1) {
        inputPcm.set(originalBuffer.getChannelData(0));
      } else {
        const ch0 = originalBuffer.getChannelData(0);
        const ch1 = originalBuffer.getChannelData(1);
        for (let i = 0; i < totalSamples; i++) {
          inputPcm[i * 2] = ch0[i];
          inputPcm[i * 2 + 1] = ch1[i];
        }
      }

      const inPtr = rb.malloc(inputPcm.length * 4);
      rb.memWrite(inPtr, inputPcm);

      rb.rubberband_process(state, inPtr, totalSamples, 1);
      onProgress?.(70);

      const avail = rb.rubberband_available(state);
      const outPtr = rb.malloc(avail * numChannels * 4);
      const retrieved = rb.rubberband_retrieve(state, outPtr, avail);

      outputSamples = rb.memReadF32(outPtr, retrieved * numChannels);
      finalDuration = retrieved / sampleRate;

      rb.free(inPtr);
      rb.free(outPtr);
      rb.rubberband_delete(state);
    } catch (err) {
      console.warn('Rubber Band WASM processing fallback to OfflineAudioContext:', err);

      // Fallback: OfflineAudioContext Native DSP
      const pitchFactor = Math.pow(2, pitchSemitones / 12);
      const effectiveRate = pitchFactor * speedRatio;
      const outputLength = Math.max(1, Math.floor(originalBuffer.length / speedRatio));

      const offlineCtx = new OfflineAudioContext(numChannels, outputLength, sampleRate);
      const source = offlineCtx.createBufferSource();
      source.buffer = originalBuffer;
      source.playbackRate.value = effectiveRate;
      source.connect(offlineCtx.destination);
      source.start(0);

      const renderedBuffer = await offlineCtx.startRendering();
      const left = renderedBuffer.getChannelData(0);
      const right = numChannels > 1 ? renderedBuffer.getChannelData(1) : left;

      outputSamples = new Float32Array(renderedBuffer.length * numChannels);
      if (numChannels === 1) {
        outputSamples.set(left);
      } else {
        for (let i = 0; i < renderedBuffer.length; i++) {
          outputSamples[i * 2] = left[i];
          outputSamples[i * 2 + 1] = right[i];
        }
      }
      finalDuration = renderedBuffer.duration;
    }

    onProgress?.(90);

    // Peak normalization
    let maxPeak = 0;
    for (let i = 0; i < outputSamples.length; i++) {
      const absVal = Math.abs(outputSamples[i]);
      if (absVal > maxPeak) maxPeak = absVal;
    }
    if (maxPeak > 0.95) {
      const scale = 0.95 / maxPeak;
      for (let i = 0; i < outputSamples.length; i++) {
        outputSamples[i] *= scale;
      }
    }

    const wavBlob = encodeWAV(outputSamples, sampleRate, numChannels);
    const url = URL.createObjectURL(wavBlob);

    onProgress?.(100);

    return {
      url,
      blob: wavBlob,
      duration: finalDuration,
    };
  } finally {
    await audioCtx.close();
  }
}
