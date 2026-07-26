declare module 'soundtouchjs' {
  export class SoundTouch {
    constructor(sampleRate?: number);
    pitchSemitones: number;
    tempo: number;
    rate: number;
  }
  export class SimpleFilter {
    constructor(source: any, pipe: SoundTouch, onEnd?: () => void);
    extract(target: Float32Array, numFrames: number): number;
  }
  export class WebAudioBufferSource {
    constructor(buffer: AudioBuffer);
  }
  export class PitchShifter {
    constructor(context: AudioContext, buffer: AudioBuffer, bufferSize: number, onEnd?: () => void);
    pitchSemitones: number;
    tempo: number;
    rate: number;
    percentagePlayed: number;
    duration: number;
    timePlayed: number;
    connect(node: AudioNode): void;
    disconnect(): void;
    on(event: string, callback: (detail: any) => void): void;
    off(event?: string): void;
  }
}
