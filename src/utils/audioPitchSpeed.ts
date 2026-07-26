/**
 * 100% Client-Side SOLA Pitch & Speed Engine
 * - Pitch Shift (-12 to +12 semitones) WITHOUT changing track speed/duration
 * - Speed Scaling (0.5x to 2.0x) WITHOUT altering musical pitch
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
 * SOLA (Synchronized Overlap-Add) Time-Scale Modification
 * Stretches or compresses audio duration by targetRatio while preserving pitch.
 */
function solaTimeScale(
  input: Float32Array,
  sampleRate: number,
  targetRatio: number
): Float32Array {
  if (Math.abs(targetRatio - 1.0) < 0.001) {
    return new Float32Array(input);
  }

  const outputLength = Math.max(1, Math.floor(input.length * targetRatio));
  const output = new Float32Array(outputLength);
  const weight = new Float32Array(outputLength);

  const N = Math.floor(sampleRate * 0.035); // 35ms frame size
  const L = Math.floor(sampleRate * 0.01); // 10ms search range
  const Sa = Math.floor(N / 2); // Analysis hop size (~17ms)
  const Ss = Math.max(1, Math.floor(Sa * targetRatio)); // Synthesis hop size

  // Pre-calculate Hanning window
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / N));
  }

  // Copy initial frame
  for (let i = 0; i < N && i < input.length && i < outputLength; i++) {
    output[i] = input[i] * win[i];
    weight[i] = win[i];
  }

  let inPos = Sa;
  let outPos = Ss;

  while (outPos + N < outputLength && inPos + N + L < input.length) {
    // Cross-correlation peak alignment
    let bestOffset = 0;
    let maxCorr = -Infinity;

    for (let offset = 0; offset < L; offset++) {
      let corr = 0;
      let energy = 0;
      for (let i = 0; i < N / 2; i++) {
        const s1 = output[outPos + i];
        const s2 = input[inPos + offset + i];
        corr += s1 * s2;
        energy += s2 * s2;
      }
      const normCorr = energy > 0 ? corr / Math.sqrt(energy) : 0;
      if (normCorr > maxCorr) {
        maxCorr = normCorr;
        bestOffset = offset;
      }
    }

    const alignedInPos = inPos + bestOffset;

    // Overlap-add frame
    for (let i = 0; i < N; i++) {
      const idx = outPos + i;
      if (idx < outputLength) {
        const sample = input[alignedInPos + i] * win[i];
        output[idx] += sample;
        weight[idx] += win[i];
      }
    }

    inPos += Sa;
    outPos += Ss;
  }

  // Normalize weights
  for (let i = 0; i < outputLength; i++) {
    if (weight[i] > 0.001) {
      output[i] /= weight[i];
    }
  }

  return output;
}

export function pitchShiftAndStretchChannel(
  inputChannel: Float32Array,
  sampleRate: number,
  pitchSemitones: number,
  speedRatio: number
): Float32Array {
  // 1. Calculate pitch factor
  const pitchFactor = Math.pow(2, pitchSemitones / 12);

  // Fast path: no changes
  if (pitchSemitones === 0 && Math.abs(speedRatio - 1.0) < 0.001) {
    return new Float32Array(inputChannel);
  }

  // Case A: Only Speed Change (pitchSemitones === 0) -> SOLA time scale (preserves original pitch)
  if (pitchSemitones === 0) {
    return solaTimeScale(inputChannel, sampleRate, 1 / speedRatio);
  }

  // Case B: Pitch Shift (with or without speed change)
  // Step 1: Resample input by pitchFactor (transposes pitch frequencies)
  const resampledLength = Math.max(1, Math.floor(inputChannel.length / pitchFactor));
  const resampled = new Float32Array(resampledLength);
  for (let i = 0; i < resampledLength; i++) {
    const readPos = i * pitchFactor;
    const basePos = Math.floor(readPos);
    const frac = readPos - basePos;
    if (basePos + 1 < inputChannel.length) {
      resampled[i] = inputChannel[basePos] + frac * (inputChannel[basePos + 1] - inputChannel[basePos]);
    } else if (basePos < inputChannel.length) {
      resampled[i] = inputChannel[basePos];
    }
  }

  // Step 2: SOLA time-stretch resampled signal to match target speed duration
  // Stretch ratio = pitchFactor / speedRatio
  const stretchRatio = pitchFactor / speedRatio;
  return solaTimeScale(resampled, sampleRate, stretchRatio);
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

    const processedChannels: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      const inputCh = originalBuffer.getChannelData(ch);
      const processedCh = pitchShiftAndStretchChannel(inputCh, sampleRate, pitchSemitones, speedRatio);
      processedChannels.push(processedCh);
      onProgress?.(30 + Math.round(((ch + 1) / numChannels) * 50));
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

    // Peak normalization to prevent clipping distortion
    let maxPeak = 0;
    for (let i = 0; i < interleaved.length; i++) {
      const absVal = Math.abs(interleaved[i]);
      if (absVal > maxPeak) maxPeak = absVal;
    }
    if (maxPeak > 0.95) {
      const scale = 0.95 / maxPeak;
      for (let i = 0; i < interleaved.length; i++) {
        interleaved[i] *= scale;
      }
    }

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
