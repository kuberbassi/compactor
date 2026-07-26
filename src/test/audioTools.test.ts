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
});
