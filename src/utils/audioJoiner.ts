/**
 * 100% Client-Side Audio Joiner Utility
 * Merges multiple audio files sequentially into a single seamless audio track.
 *
 * Handles mismatched sample rates by resampling each file to the target rate
 * (the highest sample rate among all input files) using OfflineAudioContext.
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
  view.setUint16(20, 1, true);           // PCM
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
 * Resample an AudioBuffer to a target sample rate using OfflineAudioContext.
 * Returns a new AudioBuffer at the target rate.
 */
async function resampleBuffer(
  sourceBuffer: AudioBuffer,
  targetSampleRate: number
): Promise<AudioBuffer> {
  if (sourceBuffer.sampleRate === targetSampleRate) return sourceBuffer;

  const targetLength = Math.round(sourceBuffer.duration * targetSampleRate);
  const offlineCtx = new OfflineAudioContext(
    sourceBuffer.numberOfChannels,
    targetLength,
    targetSampleRate
  );

  const bufferSource = offlineCtx.createBufferSource();
  bufferSource.buffer = sourceBuffer;
  bufferSource.connect(offlineCtx.destination);
  bufferSource.start(0);

  return offlineCtx.startRendering();
}

export async function joinAudioFiles(
  files: File[],
  onProgress?: (progress: number) => void
): Promise<{ url: string; blob: Blob; duration: number; totalSize: number }> {
  if (files.length === 0) throw new Error('No audio files provided for joining.');

  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

  try {
    // Decode all files
    const decodedBuffers: AudioBuffer[] = [];
    for (let i = 0; i < files.length; i++) {
      onProgress?.(Math.round(((i + 0.5) / files.length) * 50));
      const arrayBuffer = await files[i].arrayBuffer();
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);
      decodedBuffers.push(decoded);
    }

    onProgress?.(50);

    // Use the highest sample rate among all files as the target
    // (downsampling loses quality; upsampling to max ensures no data is lost)
    const targetSampleRate = Math.max(...decodedBuffers.map((b) => b.sampleRate));
    const targetChannels = Math.max(...decodedBuffers.map((b) => b.numberOfChannels));

    // Resample all buffers to target rate (no-op if already matching)
    const resampledBuffers: AudioBuffer[] = [];
    for (let i = 0; i < decodedBuffers.length; i++) {
      onProgress?.(50 + Math.round(((i + 0.5) / decodedBuffers.length) * 35));
      const resampled = await resampleBuffer(decodedBuffers[i], targetSampleRate);
      resampledBuffers.push(resampled);
    }

    onProgress?.(85);

    // Calculate total length
    const totalLength = resampledBuffers.reduce((acc, b) => acc + b.length, 0);

    // Merge into per-channel arrays
    const mergedChannels: Float32Array[] = Array.from({ length: targetChannels }, () =>
      new Float32Array(totalLength)
    );

    let sampleOffset = 0;
    for (const buf of resampledBuffers) {
      for (let c = 0; c < targetChannels; c++) {
        // If this file has fewer channels, duplicate the last available channel
        const srcChannel = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1));
        mergedChannels[c].set(srcChannel, sampleOffset);
      }
      sampleOffset += buf.length;
    }

    onProgress?.(95);

    const wavBlob = encodeWAV(mergedChannels, targetSampleRate);
    const url = URL.createObjectURL(wavBlob);
    const totalDuration = totalLength / targetSampleRate;

    onProgress?.(100);

    return {
      url,
      blob: wavBlob,
      duration: totalDuration,
      totalSize: wavBlob.size,
    };
  } finally {
    await audioCtx.close();
  }
}
