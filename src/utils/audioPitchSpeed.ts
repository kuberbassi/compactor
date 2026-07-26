/**
 * 100% Client-Side Granular Pitch Shifter & Time Stretcher Engine
 * - Independent Pitch Transposition (-12 to +12 semitones) without changing speed/duration
 * - Independent Speed / Tempo Control (0.5x to 2.0x) without altering pitch
 */

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

/**
 * Granular Pitch Shift & Time Stretch Algorithm for 1 Channel
 */
export function pitchShiftAndStretchChannel(
  inputChannel: Float32Array,
  sampleRate: number,
  pitchSemitones: number,
  speedRatio: number
): Float32Array {
  // If no pitch shift and no speed change, return original array copy
  if (pitchSemitones === 0 && speedRatio === 1.0) {
    return new Float32Array(inputChannel);
  }

  const pitchFactor = Math.pow(2, pitchSemitones / 12);
  const outputLength = Math.max(1, Math.floor(inputChannel.length / speedRatio));
  const output = new Float32Array(outputLength);

  const grainSize = Math.floor(sampleRate * 0.05); // 50ms grain size
  const hopSizeInput = Math.floor(grainSize / 2); // 50% overlap
  const hopSizeOutput = Math.floor(hopSizeInput / speedRatio);

  // Pre-calculate Hanning window for smooth overlap-add
  const window = new Float32Array(grainSize);
  for (let i = 0; i < grainSize; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / grainSize));
  }

  let inputIdx = 0;
  let outputIdx = 0;

  while (
    outputIdx + grainSize < outputLength &&
    inputIdx + Math.ceil(grainSize * pitchFactor) < inputChannel.length
  ) {
    for (let i = 0; i < grainSize; i++) {
      const readPos = inputIdx + i * pitchFactor;
      const basePos = Math.floor(readPos);
      const frac = readPos - basePos;

      const s1 = inputChannel[basePos] || 0;
      const s2 = inputChannel[basePos + 1] || 0;
      const sample = s1 + frac * (s2 - s1);

      output[outputIdx + i] += sample * window[i];
    }

    inputIdx += hopSizeInput;
    outputIdx += hopSizeOutput;
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

    onProgress?.(35);

    const processedChannels: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      const inputCh = originalBuffer.getChannelData(ch);
      const processedCh = pitchShiftAndStretchChannel(inputCh, sampleRate, pitchSemitones, speedRatio);
      processedChannels.push(processedCh);
      onProgress?.(35 + Math.round(((ch + 1) / numChannels) * 45));
    }

    const outputLength = processedChannels[0].length;
    const interleaved = new Float32Array(outputLength * (numChannels > 1 ? 2 : 1));

    if (numChannels === 1) {
      interleaved.set(processedChannels[0]);
    } else {
      const left = processedChannels[0];
      const right = processedChannels[1];
      for (let i = 0; i < outputLength; i++) {
        interleaved[i * 2] = left[i];
        interleaved[i * 2 + 1] = right[i];
      }
    }

    onProgress?.(90);

    const wavBlob = encodeWAV(interleaved, sampleRate, numChannels > 1 ? 2 : 1);
    const url = URL.createObjectURL(wavBlob);
    const duration = outputLength / sampleRate;

    onProgress?.(100);

    return {
      url,
      blob: wavBlob,
      duration,
    };
  } finally {
    await audioCtx.close();
  }
}
