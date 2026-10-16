/**
 * Client-side audio key and BPM analysis.
 *
 * BPM: Powered by `web-audio-beat-detector` (spectral tempo-gram peak clustering)
 * KEY: Multi-Band HPCP (Harmonic Pitch Class Profile) with:
 *      - 8192-point FFT & Spectral Peak Picking with Parabolic Interpolation
 *      - 36-bin Sub-Semitone Tuning Drift Estimation (A=440Hz reference)
 *      - Bass Chromagram (40Hz-260Hz) Tonic Root Discrimination
 *      - Ensemble Key Profiles (Krumhansl-Schmuckler, Temperley, Shaath)
 *      - Relative Major/Minor & Dominant Fifth Disambiguation
 */

import { analyze as analyzeBeat } from 'web-audio-beat-detector';

export interface AudioAnalysisResult {
  bpm: number;
  key: string;
  camelot: string;
  mode: 'Major' | 'Minor';
  confidence: number;
  duration: number;
  sampleRate: number;
}

// ── KEY PROFILES (12 pitch classes, C to B) ──────────────────────────────────
// Krumhansl-Schmuckler
const KRUMHANSL_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KRUMHANSL_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// Temperley (CBMS)
const TEMPERLEY_MAJOR = [5.0, 2.0, 3.5, 2.0, 4.5, 4.0, 2.0, 4.5, 2.0, 3.5, 1.5, 4.0];
const TEMPERLEY_MINOR = [5.0, 2.0, 3.5, 4.5, 2.0, 4.0, 2.0, 4.5, 3.5, 2.0, 1.5, 4.0];

// Shaath DJ Profiles (tuned for modern electronic, pop, and dance music)
const SHAATH_MAJOR = [5.0, 1.5, 3.5, 2.0, 4.5, 3.5, 2.0, 4.5, 2.0, 3.5, 1.5, 3.5];
const SHAATH_MINOR = [5.0, 2.0, 3.5, 4.5, 2.0, 3.5, 2.0, 4.5, 3.5, 2.0, 2.0, 3.5];

const MAJOR_KEY_NAMES = ['C Major', 'D♭ Major', 'D Major', 'E♭ Major', 'E Major', 'F Major', 'F♯ Major', 'G Major', 'A♭ Major', 'A Major', 'B♭ Major', 'B Major'];
const MINOR_KEY_NAMES = ['C Minor', 'C♯ Minor', 'D Minor', 'E♭ Minor', 'E Minor', 'F Minor', 'F♯ Minor', 'G Minor', 'G♯ Minor', 'A Minor', 'B♭ Minor', 'B Minor'];

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

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  return den === 0 ? 0 : num / den;
}

/**
 * Fast Radix-2 In-Place FFT
 */
function fftRadix2(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tempR = re[i]; re[i] = re[j]; re[j] = tempR;
      const tempI = im[i]; im[i] = im[j]; im[j] = tempI;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wStepRe = Math.cos(angle);
    const wStepIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wRe = 1.0;
      let wIm = 0.0;
      for (let k = 0; k < halfLen; k++) {
        const pos = i + k;
        const match = pos + halfLen;
        const uRe = re[pos];
        const uIm = im[pos];
        const vRe = re[match] * wRe - im[match] * wIm;
        const vIm = re[match] * wIm + im[match] * wRe;
        re[pos] = uRe + vRe;
        im[pos] = uIm + vIm;
        re[match] = uRe - vRe;
        im[match] = uIm - vIm;
        const nWRe = wRe * wStepRe - wIm * wStepIm;
        wIm = wRe * wStepIm + wIm * wStepRe;
        wRe = nWRe;
      }
    }
  }
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
 * HPCP key detection with:
 * - 36-bin Sub-Semitone Tuning Drift Estimation & Correction (handles A=432Hz..446Hz)
 * - Spectral Flatness Transient/Drum Frame Suppression
 * - Soft Pitch-Class Kernel & Overtone Fifth De-biasing
 * - Bass Chromagram (40Hz-260Hz) & Structural Cadence (First/Last Section) Weighting
 * - Relative Major/Minor & Dominant/Subdominant Disambiguation
 */
export function detectKeyFrom44kBuffer(audioBuffer: AudioBuffer): { keyName: string; mode: 'Major' | 'Minor'; confidence: number } {
  const pcm = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate || 44100;
  const totalSamples = pcm.length;

  const fftSize = 8192; // ~5.38 Hz per bin at 44.1 kHz
  const numFrames = 140;
  const step = Math.max(fftSize >> 1, Math.floor((totalSamples - fftSize) / numFrames));

  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);
  const mags = new Float32Array(fftSize / 2);

  interface Peak {
    midiNote: number;
    freq: number;
    mag: number;
  }
  interface FramePeaks {
    peaks: Peak[];
    tonalWeight: number;
    positionRatio: number;
  }

  const frames: FramePeaks[] = [];
  const fineChroma = new Float32Array(36);

  const minBin = Math.max(2, Math.floor((40 * fftSize) / sampleRate));   // ~40 Hz
  const maxBin = Math.min(fftSize / 2 - 2, Math.floor((2400 * fftSize) / sampleRate)); // ~2400 Hz
  const numBins = Math.max(1, maxBin - minBin + 1);

  for (let wStart = 0; wStart + fftSize <= totalSamples; wStart += step) {
    // Check frame RMS to skip near-silent frames
    let sumSq = 0;
    for (let i = 0; i < fftSize; i++) {
      const sample = pcm[wStart + i];
      sumSq += sample * sample;
      const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
      re[i] = sample * hann;
      im[i] = 0;
    }
    const rms = Math.sqrt(sumSq / fftSize);
    if (rms < 1e-4) continue;

    fftRadix2(re, im);

    let magSum = 0;
    let logMagSum = 0;
    for (let k = minBin; k <= maxBin; k++) {
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      mags[k] = mag;
      magSum += mag;
      logMagSum += Math.log(mag + 1e-9);
    }

    // Spectral flatness in [0, 1]: low flatness = tonal/harmonic, high flatness = percussive/noise
    const arithMean = magSum / numBins;
    const geomMean = Math.exp(logMagSum / numBins);
    const flatness = arithMean > 1e-9 ? Math.min(1, geomMean / arithMean) : 1;
    // Suppress broadband drum/transient frames
    const tonalWeight = Math.pow(Math.max(0.1, 1 - flatness), 1.5);

    const frameMean = arithMean;
    const threshold = Math.max(0.0015, frameMean * 1.35);
    const framePeaks: Peak[] = [];

    for (let k = minBin; k <= maxBin; k++) {
      const mag = mags[k];
      if (mag > threshold && mag > mags[k - 1] && mag > mags[k + 1]) {
        const alpha = mags[k - 1];
        const beta = mags[k];
        const gamma = mags[k + 1];
        const denom = alpha - 2 * beta + gamma;
        const delta = denom === 0 ? 0 : (0.5 * (alpha - gamma)) / denom;
        const peakBin = k + delta;
        const freq = (peakBin * sampleRate) / fftSize;

        if (freq >= 40 && freq <= 2400) {
          const midiNote = 69 + 12 * Math.log2(freq / 440);
          const fineBin = ((Math.round(midiNote * 3) % 36) + 36) % 36;
          fineChroma[fineBin] += Math.log1p(100 * mag) * tonalWeight;
          framePeaks.push({ midiNote, freq, mag });
        }
      }
    }

    if (framePeaks.length > 0) {
      frames.push({
        peaks: framePeaks,
        tonalWeight,
        positionRatio: totalSamples > fftSize ? wStart / (totalSamples - fftSize) : 0.5,
      });
    }
  }

  // Estimate global sub-semitone tuning offset in [-0.5, 0.5] semitones using circular mean over 3 sub-bins
  let cosSum = 0;
  let sinSum = 0;
  for (let b = 0; b < 36; b++) {
    const subBin = b % 3; // 0 = on-pitch, 1 = +1/3 semitone, 2 = -1/3 semitone
    const angle = (2 * Math.PI * subBin) / 3;
    cosSum += fineChroma[b] * Math.cos(angle);
    sinSum += fineChroma[b] * Math.sin(angle);
  }
  const tuningOffsetSemitones =
    cosSum === 0 && sinSum === 0 ? 0 : (Math.atan2(sinSum, cosSum) / (2 * Math.PI)) * 1.0;

  // 12-bin full harmonic chromagram, sub-bass chromagram, and structural cadence chromagram
  const chroma = new Float32Array(12);
  const bassChroma = new Float32Array(12);
  const cadenceChroma = new Float32Array(12);

  for (let fIdx = 0; fIdx < frames.length; fIdx++) {
    const { peaks, tonalWeight, positionRatio } = frames[fIdx];
    const frameChroma = new Float32Array(12);
    const isCadenceSection = positionRatio <= 0.12 || positionRatio >= 0.80;

    for (let p = 0; p < peaks.length; p++) {
      const { midiNote, freq, mag } = peaks[p];
      const correctedMidi = midiNote - tuningOffsetSemitones;
      const nearestMidi = Math.round(correctedMidi);
      const fracDeviation = Math.abs(correctedMidi - nearestMidi);
      // Cosine window kernel to down-weight between-semitone noise
      const pitchKernel = Math.cos(Math.min(0.5, fracDeviation) * Math.PI);
      const pitchClass = ((nearestMidi % 12) + 12) % 12;

      const logWeight = Math.log1p(100 * mag) * tonalWeight * pitchKernel;
      const octave = (correctedMidi - 12) / 12;
      const harmonicWeight = Math.pow(0.72, Math.max(0, octave - 2.5));

      frameChroma[pitchClass] += logWeight * harmonicWeight;

      if (freq >= 40 && freq <= 260) {
        bassChroma[pitchClass] += Math.log1p(250 * mag) * tonalWeight * pitchKernel;
      }
    }

    // Slight overtone fifth de-biasing within each frame (a strong root produces a 3rd harmonic at +7 semitones)
    for (let pc = 0; pc < 12; pc++) {
      const fifthPc = (pc + 7) % 12;
      const cleanVal = Math.max(0, frameChroma[fifthPc] - frameChroma[pc] * 0.08);
      chroma[pc] += frameChroma[pc];
      if (isCadenceSection) {
        cadenceChroma[pc] += frameChroma[pc];
      }
      frameChroma[fifthPc] = cleanVal;
    }
  }

  // Normalize chromagrams
  const maxChroma = Math.max(...chroma, 1e-6);
  for (let i = 0; i < 12; i++) chroma[i] /= maxChroma;

  const maxBass = Math.max(...bassChroma, 1e-6);
  for (let i = 0; i < 12; i++) bassChroma[i] /= maxBass;

  const maxCadence = Math.max(...cadenceChroma, 1e-6);
  for (let i = 0; i < 12; i++) cadenceChroma[i] /= maxCadence;

  const majorScores: number[] = new Array(12);
  const minorScores: number[] = new Array(12);

  for (let root = 0; root < 12; root++) {
    const rotatedChroma: number[] = Array.from({ length: 12 }, (_, j) => chroma[(j + root) % 12]);
    const rotatedBass: number[] = Array.from({ length: 12 }, (_, j) => bassChroma[(j + root) % 12]);
    const rotatedCadence: number[] = Array.from({ length: 12 }, (_, j) => cadenceChroma[(j + root) % 12]);

    // Correlation with Major Profiles
    const krumMaj = pearsonCorrelation(rotatedChroma, KRUMHANSL_MAJOR);
    const tempMaj = pearsonCorrelation(rotatedChroma, TEMPERLEY_MAJOR);
    const shaathMaj = pearsonCorrelation(rotatedChroma, SHAATH_MAJOR);

    // Correlation with Minor Profiles
    const krumMin = pearsonCorrelation(rotatedChroma, KRUMHANSL_MINOR);
    const tempMin = pearsonCorrelation(rotatedChroma, TEMPERLEY_MINOR);
    const shaathMin = pearsonCorrelation(rotatedChroma, SHAATH_MINOR);

    // Bass tonic + dominant root support & structural cadence support
    const bassTonicWeight = rotatedBass[0] * 0.16 + rotatedBass[7] * 0.03;
    const cadenceTonicWeight = rotatedCadence[0] * 0.06;

    // Tonic triad coherence (root + 3rd + 5th energy vs competing relative root)
    const majTriadSupport = (rotatedChroma[0] + rotatedChroma[4] * 0.8 + rotatedChroma[7] * 0.6) * 0.04;
    const minTriadSupport = (rotatedChroma[0] + rotatedChroma[3] * 0.8 + rotatedChroma[7] * 0.6) * 0.04;

    let majScore =
      krumMaj * 0.34 + tempMaj * 0.33 + shaathMaj * 0.33 + bassTonicWeight + cadenceTonicWeight + majTriadSupport;
    let minScore =
      krumMin * 0.34 + tempMin * 0.33 + shaathMin * 0.33 + bassTonicWeight + cadenceTonicWeight + minTriadSupport;

    // Symmetric parallel major/minor 3rd discrimination
    majScore += Math.max(-0.12, Math.min(0.12, (rotatedChroma[4] - rotatedChroma[3]) * 0.12));
    minScore += Math.max(-0.12, Math.min(0.12, (rotatedChroma[3] - rotatedChroma[4]) * 0.12));

    majorScores[root] = majScore;
    minorScores[root] = minScore;
  }

  // Relative Major/Minor disambiguation:
  // Major key at `root` shares exact scale notes with Minor key at `(root + 9) % 12`.
  // When their scores are close, use bass root + cadence root comparison to break the tie cleanly.
  for (let majRoot = 0; majRoot < 12; majRoot++) {
    const relMinRoot = (majRoot + 9) % 12;
    if (Math.abs(majorScores[majRoot] - minorScores[relMinRoot]) < 0.08) {
      const majRootStrength = bassChroma[majRoot] * 0.65 + cadenceChroma[majRoot] * 0.35;
      const minRootStrength = bassChroma[relMinRoot] * 0.65 + cadenceChroma[relMinRoot] * 0.35;
      const diff = Math.max(-0.06, Math.min(0.06, (majRootStrength - minRootStrength) * 0.08));
      majorScores[majRoot] += diff;
      minorScores[relMinRoot] -= diff;
    }
  }

  let bestScore = -Infinity;
  let bestKeyIndex = 0;
  let bestMode: 'Major' | 'Minor' = 'Major';

  const allScores: number[] = [];
  for (let root = 0; root < 12; root++) {
    allScores.push(majorScores[root], minorScores[root]);
    if (majorScores[root] > bestScore) {
      bestScore = majorScores[root];
      bestKeyIndex = root;
      bestMode = 'Major';
    }
    if (minorScores[root] > bestScore) {
      bestScore = minorScores[root];
      bestKeyIndex = root;
      bestMode = 'Minor';
    }
  }

  const keyName = bestMode === 'Major' ? MAJOR_KEY_NAMES[bestKeyIndex] : MINOR_KEY_NAMES[bestKeyIndex];
  const rankedScores = allScores.sort((a, b) => b - a);
  const margin = Math.max(0, rankedScores[0] - (rankedScores[1] ?? rankedScores[0]));
  const confidence = Math.round(Math.max(1, Math.min(99, (margin / 0.22) * 100)));

  return { keyName, mode: bestMode, confidence };
}

/**
 * Multi-band onset autocorrelation + web-audio-beat-detector ensemble BPM estimator.
 * Supports full musical range (60-180 BPM) while preventing false half/double-time jumps.
 */
export async function estimateBpmFromAudioBuffer(mono44kBuffer: AudioBuffer): Promise<number> {
  const pcm = mono44kBuffer.getChannelData(0);
  const sampleRate = mono44kBuffer.sampleRate || 44100;
  const totalSamples = pcm.length;
  const duration = mono44kBuffer.duration || totalSamples / sampleRate;

  // Focus on the active body of the track (skipping quiet intros/outros on full-length tracks)
  const trimMargin = duration > 24 ? Math.floor(totalSamples * 0.1) : 0;
  const startSample = trimMargin;
  const endSample = Math.max(startSample + Math.min(totalSamples, sampleRate * 2), totalSamples - trimMargin);

  // Compute multi-band onset strength envelope at hopSize = 256 (~172.27 Hz)
  const hopSize = 256;
  const envRate = sampleRate / hopSize;
  const maxAnalysisSamples = Math.min(endSample - startSample, sampleRate * 60);
  const analysisStart = startSample + Math.floor((endSample - startSample - maxAnalysisSamples) / 2);
  const numHops = Math.floor(maxAnalysisSamples / hopSize);

  const fullOnset = new Float32Array(numHops);
  const bassOnset = new Float32Array(numHops);

  // Simple 1-pole low-pass filter (~160 Hz cutoff) for kick/bass pulse extraction
  const rc = 1 / (2 * Math.PI * 160);
  const dt = 1 / sampleRate;
  const lpAlpha = dt / (rc + dt);
  let lpState = 0;
  let prevFullEnergy = 0;
  let prevBassEnergy = 0;
  let sumFullOnset = 0;
  let sumBassOnset = 0;

  for (let h = 0; h < numHops; h++) {
    const base = analysisStart + h * hopSize;
    let fullE = 0;
    let bassE = 0;
    for (let i = 0; i < hopSize; i++) {
      const s = pcm[base + i] || 0;
      lpState += lpAlpha * (s - lpState);
      fullE += s * s;
      bassE += lpState * lpState;
    }
    fullE = Math.log1p(1000 * (fullE / hopSize));
    bassE = Math.log1p(2000 * (bassE / hopSize));

    const fDiff = Math.max(0, fullE - prevFullEnergy);
    const bDiff = Math.max(0, bassE - prevBassEnergy);
    fullOnset[h] = fDiff;
    bassOnset[h] = bDiff;
    sumFullOnset += fDiff;
    sumBassOnset += bDiff;
    prevFullEnergy = fullE;
    prevBassEnergy = bassE;
  }

  // Zero-mean the onset envelopes so autocorrelation measures true periodic pulse locking
  const meanFull = numHops > 0 ? sumFullOnset / numHops : 0;
  const meanBass = numHops > 0 ? sumBassOnset / numHops : 0;
  let varFull = 1e-9;
  let varBass = 1e-9;
  for (let h = 0; h < numHops; h++) {
    fullOnset[h] -= meanFull;
    bassOnset[h] -= meanBass;
    varFull += fullOnset[h] * fullOnset[h];
    varBass += bassOnset[h] * bassOnset[h];
  }
  const invStdFull = 1 / Math.sqrt(varFull / Math.max(1, numHops));
  const invStdBass = 1 / Math.sqrt(varBass / Math.max(1, numHops));
  for (let h = 0; h < numHops; h++) {
    fullOnset[h] *= invStdFull;
    bassOnset[h] *= invStdBass;
  }

  // Evaluate fractional-lag harmonic comb correlation at a candidate BPM (multiples 1x, 2x, 4x beat period)
  const scoreTempoCandidate = (bpm: number): number => {
    if (bpm < 55 || bpm > 185 || numHops < 64) return 0;
    const baseLag = (60 / bpm) * envRate;
    const multiples = [1, 2, 4];
    const multWeights = [0.55, 0.30, 0.15];
    let totalCorr = 0;

    for (let mIdx = 0; mIdx < multiples.length; mIdx++) {
      const exactLag = baseLag * multiples[mIdx];
      const lagInt = Math.floor(exactLag);
      const frac = exactLag - lagInt;
      if (lagInt < 4 || lagInt >= numHops - 4) continue;

      let sumFull = 0;
      let sumBass = 0;
      const count = numHops - lagInt - 2;
      for (let i = 0; i < count; i++) {
        const fInterp = fullOnset[i + lagInt] * (1 - frac) + fullOnset[i + lagInt + 1] * frac;
        const bInterp = bassOnset[i + lagInt] * (1 - frac) + bassOnset[i + lagInt + 1] * frac;
        sumFull += fullOnset[i] * fInterp;
        sumBass += bassOnset[i] * bInterp;
      }
      totalCorr += multWeights[mIdx] * ((sumFull / count) * 0.5 + (sumBass / count) * 0.5);
    }

    // Gentle perceptual tempo prior centered at 115 BPM to break exact 2x octave ties naturally
    const logDiff = Math.log2(bpm / 115);
    const prior = Math.exp(-(logDiff * logDiff) / (2 * 0.50 * 0.50));
    return totalCorr * (0.82 + 0.18 * prior);
  };

  // Run web-audio-beat-detector across representative windows & both tempo octaves
  const detectorCandidates: number[] = [];
  const windows: Array<{ offset: number; duration: number }> = [];
  if (duration > 40) {
    const winDur = Math.min(30, duration * 0.4);
    windows.push(
      { offset: duration * 0.2, duration: winDur },
      { offset: duration * 0.5, duration: winDur }
    );
  } else {
    windows.push({ offset: 0, duration });
  }

  for (const win of windows) {
    for (const tempoRange of [
      { minTempo: 60, maxTempo: 130 },
      { minTempo: 90, maxTempo: 180 },
    ]) {
      try {
        const res = await analyzeBeat(mono44kBuffer, win.offset, win.duration, {
          minTempo: tempoRange.minTempo,
          maxTempo: tempoRange.maxTempo,
        });
        if (res && Number.isFinite(res) && res > 0) {
          detectorCandidates.push(res);
        }
      } catch {
        // Segment may not have enough distinct beats; continue to other windows/fallback
      }
    }
  }

  // Expand octave equivalents (0.5x, 1x, 2x) within [60, 180]
  const candidatePool = new Set<number>();
  for (const raw of detectorCandidates) {
    for (const mult of [0.5, 1, 2]) {
      const scaled = Math.round(raw * mult);
      if (scaled >= 60 && scaled <= 180) {
        candidatePool.add(scaled);
      }
    }
  }

  // Also scan onset autocorrelation across all integer BPMs in [60, 180]
  let bestAutocorrBpm = 120;
  let bestAutocorrScore = -Infinity;
  for (let bpm = 60; bpm <= 180; bpm++) {
    const score = scoreTempoCandidate(bpm);
    if (score > bestAutocorrScore) {
      bestAutocorrScore = score;
      bestAutocorrBpm = bpm;
    }
  }

  if (candidatePool.size === 0) {
    return bestAutocorrScore > 0 ? bestAutocorrBpm : 120;
  }

  candidatePool.add(bestAutocorrBpm);

  let bestBpm = 120;
  let bestScore = -Infinity;
  for (const cand of candidatePool) {
    // Boost candidates directly returned by web-audio-beat-detector
    const directHits = detectorCandidates.filter(d => Math.abs(Math.round(d) - cand) <= 1).length;
    const octaveHits = detectorCandidates.filter(
      d => Math.abs(Math.round(d * 2) - cand) <= 1 || Math.abs(Math.round(d * 0.5) - cand) <= 1
    ).length;
    const consensusBoost = 1 + directHits * 0.12 + octaveHits * 0.05;
    const score = scoreTempoCandidate(cand) * consensusBoost;
    if (score > bestScore) {
      bestScore = score;
      bestBpm = cand;
    }
  }

  return bestBpm;
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

    // 1. Multi-window onset-verified BPM detection (60-180 BPM)
    const detectedBPM = await estimateBpmFromAudioBuffer(mono44kBuffer);

    // 2. Multi-band HPCP key detection
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
