declare module 'soundtouchjs' {
  export class SoundTouch {
    constructor(sampleRate?: number);
    pitchSemitones: number;
    tempo: number;
    rate: number;
  }
  export class SimpleFilter {
    constructor(source: any, pipe: SoundTouch);
    extract(target: Float32Array, numFrames: number): number;
  }
  export class WebAudioBufferSource {
    constructor(buffer: AudioBuffer);
  }
}
