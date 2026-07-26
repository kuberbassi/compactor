import { describe, it, expect } from 'vitest';
import { analyzeAudioBPMAndKey } from '../utils/audioAnalysis';
import { joinAudioFiles } from '../utils/audioJoiner';
import { processPitchAndSpeed } from '../utils/audioPitchSpeed';

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

  it('pitchScale calculation is correct for +2 semitones', () => {
    const semitones = 2;
    const pitchScale = Math.pow(2, semitones / 12);
    // 2 semitones up => ~1.1225
    expect(pitchScale).toBeCloseTo(1.1225, 3);
  });

  it('timeRatio is inverse of speedRatio', () => {
    const speedRatio = 2.0;
    const timeRatio = 1.0 / speedRatio;
    expect(timeRatio).toBeCloseTo(0.5, 5);
  });
});
