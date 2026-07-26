import { describe, it, expect } from 'vitest';
import { analyzeAudioBPMAndKey } from '../utils/audioAnalysis';
import { joinAudioFiles } from '../utils/audioJoiner';
import { processPitchAndSpeed, pitchShiftAndStretchChannel } from '../utils/audioPitchSpeed';

describe('Audio Tools Utility Functions', () => {
  it('audioAnalysis exports analyzeAudioBPMAndKey function', () => {
    expect(typeof analyzeAudioBPMAndKey).toBe('function');
  });

  it('audioJoiner exports joinAudioFiles function', () => {
    expect(typeof joinAudioFiles).toBe('function');
  });

  it('audioPitchSpeed exports processPitchAndSpeed function', () => {
    expect(typeof processPitchAndSpeed).toBe('function');
  });

  it('pitchShiftAndStretchChannel preserves duration when pitchSemitones > 0 and speedRatio = 1.0', () => {
    const sampleRate = 44100;
    const input = new Float32Array(sampleRate * 2); // 2 seconds
    for (let i = 0; i < input.length; i++) {
      input[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    }

    const output = pitchShiftAndStretchChannel(input, sampleRate, 2, 1.0);
    expect(Math.abs(output.length - input.length)).toBeLessThanOrEqual(5);
  });

  it('pitchShiftAndStretchChannel scales length when speedRatio = 2.0', () => {
    const sampleRate = 44100;
    const input = new Float32Array(sampleRate * 2); // 2 seconds
    for (let i = 0; i < input.length; i++) {
      input[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    }

    const output = pitchShiftAndStretchChannel(input, sampleRate, 0, 2.0);
    expect(Math.abs(output.length - Math.floor(input.length / 2.0))).toBeLessThanOrEqual(5);
  });
});
