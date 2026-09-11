import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg } from './ffmpeg/core';

export async function joinAudioFiles(
  files: File[],
  onProgress?: (progress: number) => void,
): Promise<{ url: string; blob: Blob; duration: number; totalSize: number }> {
  if (files.length === 0) throw new Error('No audio files provided for joining.');

  const ffmpeg = await getFFmpeg(undefined, onProgress);
  const inputNames = files.map((file, index) => {
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'audio';
    return `join_input_${index}.${extension}`;
  });
  const outputName = 'joined_audio.wav';

  try {
    await ffmpeg.deleteFile(outputName).catch(() => undefined);
    for (let index = 0; index < files.length; index += 1) {
      await ffmpeg.writeFile(inputNames[index], await fetchFile(files[index]));
      onProgress?.(Math.round(((index + 1) / files.length) * 20));
    }

    const args: string[] = [];
    inputNames.forEach(name => args.push('-i', name));
    const normalizedInputs = inputNames.map((_, index) =>
      `[${index}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a${index}]`,
    );
    const concatInputs = inputNames.map((_, index) => `[a${index}]`).join('');
    args.push(
      '-filter_complex',
      `${normalizedInputs.join(';')};${concatInputs}concat=n=${files.length}:v=0:a=1[outa]`,
      '-map', '[outa]',
      '-c:a', 'pcm_s16le',
      '-ar', '48000',
      '-ac', '2',
      outputName,
    );

    await ffmpeg.exec(args);
    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data as BlobPart], { type: 'audio/wav' });
    const duration = Math.max(0, (blob.size - 44) / (48000 * 2 * 2));
    onProgress?.(100);
    return { url: URL.createObjectURL(blob), blob, duration, totalSize: blob.size };
  } finally {
    await Promise.all(inputNames.map(name => ffmpeg.deleteFile(name).catch(() => undefined)));
    await ffmpeg.deleteFile(outputName).catch(() => undefined);
  }
}
