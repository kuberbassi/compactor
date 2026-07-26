/**
 * 100% Client-Side Audio Joiner Utility
 * Merges multiple audio files sequentially into a single seamless audio track.
 */

function encodeWAV(samples: Float32Array, sampleRate: number, numChannels: number = 2): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + samples.length * 2, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  /* fmt sub-chunk */
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
  view.setUint16(32, numChannels * 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  /* data sub-chunk */
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, samples.length * 2, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function joinAudioFiles(
  files: File[],
  onProgress?: (progress: number) => void
): Promise<{ url: string; blob: Blob; duration: number; totalSize: number }> {
  if (files.length === 0) throw new Error('No audio files provided for joining.');

  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

  try {
    const decodedBuffers: AudioBuffer[] = [];
    let totalLengthSamples = 0;
    let targetSampleRate = 44100;

    for (let i = 0; i < files.length; i++) {
      onProgress?.(Math.round(((i + 1) / files.length) * 60));
      const arrayBuffer = await files[i].arrayBuffer();
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);
      decodedBuffers.push(decoded);
      totalLengthSamples += decoded.length;
      if (i === 0) targetSampleRate = decoded.sampleRate;
    }

    // Create interleaved stereo output buffer
    const mergedLeft = new Float32Array(totalLengthSamples);
    const mergedRight = new Float32Array(totalLengthSamples);
    let sampleOffset = 0;

    for (let i = 0; i < decodedBuffers.length; i++) {
      const buffer = decodedBuffers[i];
      const left = buffer.getChannelData(0);
      const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;

      mergedLeft.set(left, sampleOffset);
      mergedRight.set(right, sampleOffset);

      sampleOffset += buffer.length;
    }

    onProgress?.(80);

    // Interleave left and right for stereo WAV encoding
    const interleaved = new Float32Array(totalLengthSamples * 2);
    for (let i = 0; i < totalLengthSamples; i++) {
      interleaved[i * 2] = mergedLeft[i];
      interleaved[i * 2 + 1] = mergedRight[i];
    }

    onProgress?.(95);

    const wavBlob = encodeWAV(interleaved, targetSampleRate, 2);
    const url = URL.createObjectURL(wavBlob);
    const totalDuration = totalLengthSamples / targetSampleRate;

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
