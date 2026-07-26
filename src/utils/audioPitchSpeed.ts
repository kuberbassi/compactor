/**
 * 100% Client-Side Pitch & Speed Modifier Utility
 * Adjusts pitch (-12 to +12 semitones) and tempo/speed (0.5x to 2.0x).
 */

function encodeWAV(samples: Float32Array, sampleRate: number, numChannels: number = 2): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + samples.length * 2, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);

  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
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
    onProgress?.(20);
    const originalBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const sampleRate = originalBuffer.sampleRate;

    // Calculate playback rate ratio considering semitone pitch shift and speed multiplier
    // pitchSemitones: 2^(semitones/12)
    const pitchFactor = Math.pow(2, pitchSemitones / 12);
    const effectiveRate = pitchFactor * speedRatio;

    // Length of output buffer based on effective speed ratio
    const outputLength = Math.max(1, Math.floor(originalBuffer.length / effectiveRate));
    const offlineCtx = new OfflineAudioContext(
      originalBuffer.numberOfChannels,
      outputLength,
      sampleRate
    );

    onProgress?.(50);

    const source = offlineCtx.createBufferSource();
    source.buffer = originalBuffer;
    source.playbackRate.value = effectiveRate;
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    onProgress?.(80);

    const left = renderedBuffer.getChannelData(0);
    const right = renderedBuffer.numberOfChannels > 1 ? renderedBuffer.getChannelData(1) : left;

    const interleaved = new Float32Array(renderedBuffer.length * 2);
    for (let i = 0; i < renderedBuffer.length; i++) {
      interleaved[i * 2] = left[i];
      interleaved[i * 2 + 1] = right[i];
    }

    const wavBlob = encodeWAV(interleaved, sampleRate, 2);
    const url = URL.createObjectURL(wavBlob);

    onProgress?.(100);

    return {
      url,
      blob: wavBlob,
      duration: renderedBuffer.duration,
    };
  } finally {
    await audioCtx.close();
  }
}
