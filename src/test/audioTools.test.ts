import { describe, it, expect } from 'vitest';
import { analyzeAudioBPMAndKey, CAMELOT_MAP, detectKeyFrom44kBuffer, estimateBpmFromAudioBuffer } from '../utils/audioAnalysis';
import { joinAudioFiles } from '../utils/audioJoiner';
import { processPitchAndSpeed } from '../utils/audioPitchSpeed';
import { getActiveIntervals } from '../utils/ffmpeg/video';

describe('Audio Tools Utility Functions', () => {
  const synthesizeChordProgression = (chords: number[][], tuningFreq = 440): AudioBuffer => {
    const sampleRate = 44100;
    const secondsPerChord = 1.5;
    const data = new Float32Array(Math.round(chords.length * secondsPerChord * sampleRate));

    chords.forEach((chord, chordIndex) => {
      const start = Math.round(chordIndex * secondsPerChord * sampleRate);
      const end = Math.round((chordIndex + 1) * secondsPerChord * sampleRate);
      for (let sample = start; sample < end; sample++) {
        const time = sample / sampleRate;
        const localTime = (sample - start) / sampleRate;
        const envelope = Math.min(1, localTime / 0.02, (secondsPerChord - localTime) / 0.04);
        data[sample] = chord.reduce((sum, midi, noteIndex) => {
          const frequency = tuningFreq * 2 ** ((midi - 69) / 12);
          const level = noteIndex === 0 ? 0.30 : 0.20;
          return sum + Math.sin(2 * Math.PI * frequency * time) * level;
        }, 0) * Math.max(0, envelope);
      }
    });

    return {
      sampleRate,
      numberOfChannels: 1,
      length: data.length,
      duration: data.length / sampleRate,
      getChannelData: () => data,
    } as unknown as AudioBuffer;
  };

  const synthesizeKickPulse = (bpm: number, durationSec = 10): AudioBuffer => {
    const sampleRate = 44100;
    const data = new Float32Array(Math.round(durationSec * sampleRate));
    const beatPeriod = 60 / bpm;

    for (let beatTime = 0; beatTime < durationSec - 0.15; beatTime += beatPeriod) {
      const startSample = Math.round(beatTime * sampleRate);
      const hitSamples = Math.round(0.12 * sampleRate);
      for (let i = 0; i < hitSamples && startSample + i < data.length; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 28);
        const freq = 65 + 75 * Math.exp(-t * 40);
        data[startSample + i] += Math.sin(2 * Math.PI * freq * t) * env * 0.8;
      }
    }

    return {
      sampleRate,
      numberOfChannels: 1,
      length: data.length,
      duration: durationSec,
      getChannelData: () => data,
    } as unknown as AudioBuffer;
  };

  it('audioAnalysis exports analyzeAudioBPMAndKey function', () => {
    expect(typeof analyzeAudioBPMAndKey).toBe('function');
  });

  it('audioJoiner exports joinAudioFiles function', () => {
    expect(typeof joinAudioFiles).toBe('function');
  });

  it('audioPitchSpeed exports processPitchAndSpeed function', () => {
    expect(typeof processPitchAndSpeed).toBe('function');
  });

  it('pitchScale calculation is correct for +2 semitones', () => {
    const semitones = 2;
    const pitchScale = Math.pow(2, semitones / 12);
    expect(pitchScale).toBeCloseTo(1.1225, 3);
  });

  it('timeRatio is inverse of speedRatio', () => {
    const speedRatio = 2.0;
    const timeRatio = 1.0 / speedRatio;
    expect(timeRatio).toBeCloseTo(0.5, 5);
  });

  it('clamps invalid trim boundaries and drops empty ranges', () => {
    expect(getActiveIntervals(10, [
      { id: 'a', start: -2, end: 4, mode: 'keep' },
      { id: 'b', start: 8, end: 14, mode: 'keep' },
      { id: 'c', start: 7, end: 7, mode: 'keep' },
    ], 'keep-selected')).toEqual([{ start: 0, end: 4 }, { start: 8, end: 10 }]);
  });

  it('CAMELOT_MAP correctly maps G Minor to 6A and Bb Major / A# Major to 6B', () => {
    expect(CAMELOT_MAP['G Minor']).toBe('6A');
    expect(CAMELOT_MAP['B♭ Major']).toBe('6B');
    expect(CAMELOT_MAP['Bb Major']).toBe('6B');
    expect(CAMELOT_MAP['A# Major']).toBe('6B');
    expect(CAMELOT_MAP['C Major']).toBe('8B');
    expect(CAMELOT_MAP['A Minor']).toBe('8A');
  });

  it('distinguishes F-sharp major from its parallel minor', () => {
    const major = synthesizeChordProgression([
      [42, 58, 61], // F# major: bass F#, A#, C#
      [47, 63, 66], // B major
      [49, 65, 68], // C# major
      [42, 58, 61],
    ]);
    const result = detectKeyFrom44kBuffer(major);

    expect(result.keyName).toBe('F♯ Major');
    expect(result.mode).toBe('Major');
    expect(result.confidence).toBeGreaterThanOrEqual(1);
    expect(result.confidence).toBeLessThanOrEqual(99);
  });

  it('still recognizes F-sharp minor after removing the minor-mode bias', () => {
    const minor = synthesizeChordProgression([
      [42, 57, 61], // F# minor: bass F#, A, C#
      [47, 62, 66], // B minor
      [49, 64, 68], // C# minor
      [42, 57, 61],
    ]);

    expect(detectKeyFrom44kBuffer(minor).keyName).toBe('F♯ Minor');
  });

  it('accurately detects key even when audio is detuned to A=432Hz', () => {
    const detunedCMajor = synthesizeChordProgression([
      [36, 60, 64, 67], // C major
      [41, 65, 69, 72], // F major
      [43, 67, 71, 74], // G major
      [36, 60, 64, 67], // C major
    ], 432);

    expect(detectKeyFrom44kBuffer(detunedCMajor).keyName).toBe('C Major');
  });

  it('detects BPM above 120 BPM without halving fast dance/pop tempos', async () => {
    const fast128 = synthesizeKickPulse(128, 10);
    const detectedFast = await estimateBpmFromAudioBuffer(fast128);
    expect(Math.abs(detectedFast - 128)).toBeLessThanOrEqual(2);

    const slow88 = synthesizeKickPulse(88, 10);
    const detectedSlow = await estimateBpmFromAudioBuffer(slow88);
    expect(Math.abs(detectedSlow - 88)).toBeLessThanOrEqual(2);

    const rock144 = synthesizeKickPulse(144, 10);
    const detected144 = await estimateBpmFromAudioBuffer(rock144);
    expect(Math.abs(detected144 - 144)).toBeLessThanOrEqual(2);
  });

  it('accurately detects E Major (Camelot 12B)', () => {
    const eMajor = synthesizeChordProgression([
      [40, 64, 68, 71], // E major (bass E, G#, B)
      [45, 64, 69, 73], // A major
      [47, 66, 71, 75], // B major
      [40, 64, 68, 71], // E major
    ]);
    const res = detectKeyFrom44kBuffer(eMajor);
    expect(res.keyName).toBe('E Major');
    expect(res.mode).toBe('Major');
    expect(CAMELOT_MAP[res.keyName]).toBe('12B');
  });


  it('verifies AudioCompressOptions typing and options contract', async () => {
    const { parseMediaTagsFromFFmpegLog, buildAudioFilters } = await import('../utils/ffmpeg/audio');
    expect(typeof parseMediaTagsFromFFmpegLog).toBe('function');

    const sampleLog = `
      Input #0, mp3, from 'input_audio':
        Metadata:
          title           : Masterpiece Song
          artist          : Audio Producer
          album           : Album 2026
          date            : 2026
    `;
    const tags = parseMediaTagsFromFFmpegLog(sampleLog);
    expect(tags.title).toBe('Masterpiece Song');
    expect(tags.artist).toBe('Audio Producer');
    expect(tags.album).toBe('Album 2026');
    expect(tags.year).toBe('2026');

    const filters = buildAudioFilters({
      bitrate: '128k',
      format: 'mp3',
      removeSilence: true,
      noiseReduction: true,
      normalizeAudio: true,
      fadeInDuration: 5,
      fadeOutDuration: 5,
      channels: 'mono',
    }, 2);
    expect(filters[0]).toContain('silenceremove=');
    expect(filters).toContain('afftdn=nr=10:nf=-35');
    expect(filters).toContain('loudnorm=I=-16:TP=-1.5:LRA=11');
    expect(filters).toContain('afade=t=in:ss=0:d=2');
    expect(filters.slice(-4)).toEqual(['areverse', 'afade=t=in:ss=0:d=2', 'areverse', 'aformat=channel_layouts=mono']);
  });
});
