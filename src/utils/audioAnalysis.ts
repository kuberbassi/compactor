/**
 * Client-side audio key and BPM analysis powered by Essentia.js (Music Technology Group UPF / WebAssembly).
 *
 * BPM: Powered by Essentia RhythmExtractor2013 (Degara beat tracking) with web-audio-beat-detector fallback.
 * KEY: Powered by Essentia KeyExtractor (multi-profile HPCP ensemble: Temperley, EDMA, and bass-band tonic verification).
 */

import { analyze as analyzeBeat } from 'web-audio-beat-detector';
import type { Essentia, VectorFloat, RhythmExtractorResult } from 'essentia.js';
import essentiaPkg from 'essentia.js';

export interface AudioAnalysisResult {
  bpm: number;
  key: string;
  camelot: string;
  mode: 'Major' | 'Minor';
  confidence: number;
  duration: number;
  sampleRate: number;
}

export const CAMELOT_MAP: Record<string, string> = {
  'C Major': '8B',  'A Minor': '8A',
  'G Major': '9B',  'E Minor': '9A',
  'D Major': '10B', 'B Minor': '10A',
  'A Major': '11B', 'F# Minor': '11A', 'F♯ Minor': '11A',
  'E Major': '12B', 'C# Minor': '12A', 'C♯ Minor': '12A',
  'B Major': '1B',  'G# Minor': '1A',  'G♯ Minor': '1A', 'Ab Minor': '1A', 'A♭ Minor': '1A',
  'F# Major': '2B', 'F♯ Major': '2B',  'Gb Major': '2B', 'G♭ Major': '2B', 'D# Minor': '2A', 'D♯ Minor': '2A', 'Eb Minor': '2A', 'E♭ Minor': '2A',
  'C# Major': '3B', 'C♯ Major': '3B',  'Db Major': '3B', 'D♭ Major': '3B', 'A# Minor': '3A', 'A♯ Minor': '3A', 'Bb Minor': '3A', 'B♭ Minor': '3A',
  'G# Major': '4B', 'G♯ Major': '4B',  'Ab Major': '4B', 'A♭ Major': '4B', 'F Minor': '4A',
  'D# Major': '5B', 'D♯ Major': '5B',  'Eb Major': '5B', 'E♭ Major': '5B', 'C Minor': '5A',
  'A# Major': '6B', 'A♯ Major': '6B',  'Bb Major': '6B', 'B♭ Major': '6B', 'G Minor': '6A',
  'F Major': '7B',  'D Minor': '7A',
};

const KEY_NAME_MAP: Record<string, string> = {
  c: 'C', 'c#': 'C♯', db: 'D♭',
  d: 'D', 'd#': 'D♯', eb: 'E♭',
  e: 'E',
  f: 'F', 'f#': 'F♯', gb: 'G♭',
  g: 'G', 'g#': 'G♯', ab: 'A♭',
  a: 'A', 'a#': 'A♯', bb: 'B♭',
  b: 'B',
};

let cachedEssentia: Essentia | null = null;

function getEssentia(): Essentia {
  if (!cachedEssentia) {
    const pkg = essentiaPkg as unknown as {
      Essentia?: new (wasm: unknown) => Essentia;
      EssentiaWASM?: unknown;
      default?: { Essentia?: new (wasm: unknown) => Essentia; EssentiaWASM?: unknown };
    };
    const EssentiaClass = pkg.Essentia || pkg.default?.Essentia;
    const wasm = pkg.EssentiaWASM || pkg.default?.EssentiaWASM;
    if (!EssentiaClass || !wasm) {
      throw new Error('Failed to load Essentia WASM engine');
    }
    cachedEssentia = new EssentiaClass(wasm);
  }
  return cachedEssentia;
}

/**
 * Resample any AudioBuffer to strictly 44,100 Hz Mono.
 */
async function resampleTo44100MonoBuffer(buffer: AudioBuffer): Promise<AudioBuffer> {
  const targetSampleRate = 44100;
  if (buffer.sampleRate === targetSampleRate && buffer.numberOfChannels === 1) {
    return buffer;
  }

  const targetLength = Math.round(buffer.duration * targetSampleRate);
  const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
  const source = offlineCtx.createBufferSource();

  if (buffer.numberOfChannels > 1) {
    const monoBuf = offlineCtx.createBuffer(1, buffer.length, buffer.sampleRate);
    const monoData = monoBuf.getChannelData(0);
    const ch0 = buffer.getChannelData(0);
    const ch1 = buffer.getChannelData(1);
    for (let i = 0; i < buffer.length; i++) {
      monoData[i] = (ch0[i] + ch1[i]) * 0.5;
    }
    source.buffer = monoBuf;
  } else {
    source.buffer = buffer;
  }

  source.connect(offlineCtx.destination);
  source.start(0);

  return offlineCtx.startRendering();
}

/**
 * Detect musical key from a 44.1kHz mono AudioBuffer using Essentia.js KeyExtractor.
 * Runs an ensemble across 'temperley', 'edma', and bass-band profiles for optimal tonic discrimination.
 */
export function detectKeyFrom44kBuffer(audioBuffer: AudioBuffer): {
  keyName: string;
  mode: 'Major' | 'Minor';
  confidence: number;
} {
  const pcm = audioBuffer.getChannelData(0);
  if (!pcm || pcm.length < 4096) {
    return { keyName: 'C Major', mode: 'Major', confidence: 10 };
  }

  let analysisPcm = pcm;
  const maxKeySamples = 44100 * 240; // 4 minutes max window
  if (pcm.length > maxKeySamples) {
    const start = Math.floor((pcm.length - maxKeySamples) / 2);
    analysisPcm = pcm.subarray(start, start + maxKeySamples);
  }

  const essentia = getEssentia();
  let vec: VectorFloat | null = null;
  try {
    vec = essentia.arrayToVector(analysisPcm);

    // Primary profile: 'temperley' (standard for modern pop/rock/electronic, excellent tonic root resolution)
    const resTemperley = essentia.KeyExtractor(vec, true, 4096, 4096, 12, 3500, 60, 25, 0.2, 'temperley', 44100);

    // Secondary profile: 'edma' (electronic dance music & acoustic)
    const resEdma = essentia.KeyExtractor(vec, true, 4096, 4096, 12, 3500, 60, 25, 0.2, 'edma', 44100);

    // Bass-band profile (25-450 Hz) for tonic bassline confirmation
    const resBass = essentia.KeyExtractor(vec, true, 4096, 4096, 12, 450, 60, 25, 0.2, 'temperley', 44100);

    const tempKeyNorm = KEY_NAME_MAP[resTemperley.key.toLowerCase()] || resTemperley.key;
    const edmaKeyNorm = KEY_NAME_MAP[resEdma.key.toLowerCase()] || resEdma.key;
    const bassKeyNorm = KEY_NAME_MAP[resBass.key.toLowerCase()] || resBass.key;

    const tempScale = resTemperley.scale.toLowerCase();
    const edmaScale = resEdma.scale.toLowerCase();

    let chosen = resTemperley;
    if (tempKeyNorm === edmaKeyNorm && tempScale === edmaScale) {
      chosen = resTemperley;
    } else if (bassKeyNorm === edmaKeyNorm && edmaScale === resBass.scale.toLowerCase()) {
      chosen = resEdma;
    } else if (bassKeyNorm === tempKeyNorm) {
      chosen = resTemperley;
    } else if (resEdma.strength > resTemperley.strength + 0.15) {
      chosen = resEdma;
    } else {
      chosen = resTemperley;
    }

    const cleanKey = KEY_NAME_MAP[chosen.key.toLowerCase()] || chosen.key;
    const mode: 'Major' | 'Minor' = chosen.scale.toLowerCase() === 'minor' ? 'Minor' : 'Major';
    const keyName = `${cleanKey} ${mode}`;

    const rawStrength = Number.isFinite(chosen.strength) ? chosen.strength : 0.7;
    const confidence = Math.round(Math.max(1, Math.min(99, Math.max(0.1, rawStrength) * 100)));

    return { keyName, mode, confidence };
  } finally {
    vec?.delete?.();
  }
}

/**
 * Estimate BPM from 44.1kHz mono AudioBuffer using Essentia RhythmExtractor2013 (degara method).
 * Falls back to web-audio-beat-detector if Essentia does not find clear periodic beats.
 */
export async function estimateBpmFromAudioBuffer(mono44kBuffer: AudioBuffer): Promise<number> {
  const pcm = mono44kBuffer.getChannelData(0);
  const totalSamples = pcm.length;
  const sampleRate = mono44kBuffer.sampleRate || 44100;
  const duration = mono44kBuffer.duration || totalSamples / sampleRate;

  let analysisPcm = pcm;
  const maxBpmSamples = 44100 * 180; // 3 minutes max window
  if (totalSamples > maxBpmSamples) {
    const start = Math.floor((totalSamples - maxBpmSamples) / 2);
    analysisPcm = pcm.subarray(start, start + maxBpmSamples);
  }

  const essentia = getEssentia();
  let vec: VectorFloat | null = null;
  let rhythm: RhythmExtractorResult | null = null;
  let detectedBpm: number | null = null;

  try {
    vec = essentia.arrayToVector(analysisPcm);
    // RhythmExtractor2013 with 'degara' method handles 40-208 BPM range accurately
    rhythm = essentia.RhythmExtractor2013(vec, 208, 'degara', 40);
    if (rhythm && Number.isFinite(rhythm.bpm) && rhythm.bpm >= 45 && rhythm.bpm <= 215) {
      detectedBpm = Math.round(rhythm.bpm);
    }
  } catch (err) {
    console.warn('Essentia RhythmExtractor2013 error, attempting fallback:', err);
  } finally {
    rhythm?.ticks?.delete?.();
    rhythm?.estimates?.delete?.();
    rhythm?.bpmIntervals?.delete?.();
    vec?.delete?.();
  }

  if (detectedBpm !== null && detectedBpm > 0) {
    return detectedBpm;
  }

  // Secondary fallback: web-audio-beat-detector
  try {
    const fallbackBpm = await analyzeBeat(mono44kBuffer, 0, Math.min(duration, 30), {
      minTempo: 60,
      maxTempo: 180,
    });
    if (fallbackBpm && Number.isFinite(fallbackBpm) && fallbackBpm > 0) {
      return Math.round(fallbackBpm);
    }
  } catch {
    // Ignore fallback error
  }

  return 120;
}

export interface LiveTransposedAudioInfo {
  root: string;
  mode: string;
  fullName: string;
  camelot: string;
  baseCamelot: string | null;
  currentBpm: number | null;
  exactBpm: number | null;
  hasDetectedKey: boolean;
}

const PITCH_TO_INDEX: Record<string, number> = {
  C: 0, 'C#': 1, 'C♯': 1, Db: 1, 'D♭': 1,
  D: 2, 'D#': 3, 'D♯': 3, Eb: 3, 'E♭': 3,
  E: 4,
  F: 5, 'F#': 6, 'F♯': 6, Gb: 6, 'G♭': 6,
  G: 7, 'G#': 8, 'G♯': 8, Ab: 8, 'A♭': 8,
  A: 9, 'A#': 10, 'A♯': 10, Bb: 10, 'B♭': 10,
  B: 11,
};

const MAJOR_ROOTS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const MINOR_ROOTS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'];

/**
 * Computes exact live musical key, scale mode, Camelot code, and BPM when pitch (semitones)
 * and playback speed ratio are adjusted in real time.
 */
export function transposeKeyAndBpm(
  baseKey: string | null | undefined,
  baseBpm: number | null | undefined,
  pitchSemitones: number,
  speedRatio: number
): LiveTransposedAudioInfo {
  const currentBpm =
    typeof baseBpm === 'number' && baseBpm > 0 ? Math.round(baseBpm * speedRatio) : null;
  const exactBpm =
    typeof baseBpm === 'number' && baseBpm > 0 ? Math.round(baseBpm * speedRatio * 10) / 10 : null;

  if (!baseKey || !baseKey.trim()) {
    const idx = (((0 + Math.round(pitchSemitones)) % 12) + 12) % 12;
    const root = MAJOR_ROOTS[idx];
    const fullName = `${root} Major`;
    return {
      root,
      mode: 'major',
      fullName,
      camelot: CAMELOT_MAP[fullName] || '8B',
      baseCamelot: null,
      currentBpm,
      exactBpm,
      hasDetectedKey: false,
    };
  }

  const parts = baseKey.trim().split(/\s+/);
  const rawRoot = parts[0] || 'C';
  const modeStr = parts[1] || 'Major';
  const isMinor = modeStr.toLowerCase() === 'minor';

  const baseIdx = PITCH_TO_INDEX[rawRoot] !== undefined ? PITCH_TO_INDEX[rawRoot] : 0;
  const targetIdx = (((baseIdx + Math.round(pitchSemitones)) % 12) + 12) % 12;
  const root = isMinor ? MINOR_ROOTS[targetIdx] : MAJOR_ROOTS[targetIdx];
  const fullName = `${root} ${isMinor ? 'Minor' : 'Major'}`;
  const camelot = CAMELOT_MAP[fullName] || '8B';
  const baseCamelot = CAMELOT_MAP[baseKey.trim()] || null;

  return {
    root,
    mode: isMinor ? 'minor' : 'major',
    fullName,
    camelot,
    baseCamelot,
    currentBpm,
    exactBpm,
    hasDetectedKey: true,
  };
}

export async function analyzeAudioBPMAndKey(file: File): Promise<AudioAnalysisResult> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

  try {
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const originalSampleRate = decodedBuffer.sampleRate;
    const duration = decodedBuffer.duration;

    // Resample strictly to 44.1kHz Mono AudioBuffer
    const mono44kBuffer = await resampleTo44100MonoBuffer(decodedBuffer);

    // 1. Essentia BPM detection (degara RhythmExtractor2013)
    const detectedBPM = await estimateBpmFromAudioBuffer(mono44kBuffer);

    // 2. Essentia Key detection (KeyExtractor ensemble)
    const keyInfo = detectKeyFrom44kBuffer(mono44kBuffer);
    const camelot = CAMELOT_MAP[keyInfo.keyName] || '8B';

    return {
      bpm: detectedBPM,
      key: keyInfo.keyName,
      camelot,
      mode: keyInfo.mode,
      confidence: keyInfo.confidence,
      duration,
      sampleRate: originalSampleRate,
    };
  } finally {
    await audioCtx.close();
  }
}
