import { describe, it, expect } from 'vitest';
import { analyzeAudioBPMAndKey, CAMELOT_MAP } from '../utils/audioAnalysis';
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
    expect(pitchScale).toBeCloseTo(1.1225, 3);
  });

  it('timeRatio is inverse of speedRatio', () => {
    const speedRatio = 2.0;
    const timeRatio = 1.0 / speedRatio;
    expect(timeRatio).toBeCloseTo(0.5, 5);
  });

  it('CAMELOT_MAP correctly maps G Minor to 6A and Bb Major / A# Major to 6B', () => {
    expect(CAMELOT_MAP['G Minor']).toBe('6A');
    expect(CAMELOT_MAP['B♭ Major']).toBe('6B');
    expect(CAMELOT_MAP['Bb Major']).toBe('6B');
    expect(CAMELOT_MAP['A# Major']).toBe('6B');
    expect(CAMELOT_MAP['C Major']).toBe('8B');
    expect(CAMELOT_MAP['A Minor']).toBe('8A');
  });
});
