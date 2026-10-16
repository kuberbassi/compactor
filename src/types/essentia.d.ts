declare module 'essentia.js' {
  export interface VectorFloat {
    size(): number;
    get(index: number): number;
    set(index: number, value: number): void;
    push_back(value: number): void;
    resize(size: number, defaultValue: number): void;
    delete(): void;
  }

  export interface KeyExtractorResult {
    key: string;
    scale: string;
    strength: number;
  }

  export interface RhythmExtractorResult {
    bpm: number;
    ticks?: VectorFloat;
    confidence: number;
    estimates?: VectorFloat;
    bpmIntervals?: VectorFloat;
  }

  export class Essentia {
    constructor(wasmModule: unknown, isDebug?: boolean);
    arrayToVector(inputArray: Float32Array | number[]): VectorFloat;
    vectorToArray(inputVector: VectorFloat): Float32Array;
    KeyExtractor(
      audio: VectorFloat,
      averageDetuningCorrection?: boolean,
      frameSize?: number,
      hopSize?: number,
      hpcpSize?: number,
      maxFrequency?: number,
      maximumSpectralPeaks?: number,
      minFrequency?: number,
      pcpThreshold?: number,
      profileType?: string,
      sampleRate?: number,
      spectralPeaksThreshold?: number,
      tuningFrequency?: number,
      weightType?: string,
      windowType?: string
    ): KeyExtractorResult;
    RhythmExtractor2013(
      signal: VectorFloat,
      maxTempo?: number,
      method?: string,
      minTempo?: number
    ): RhythmExtractorResult;
    delete(): void;
    shutdown(): void;
  }

  export const EssentiaWASM: unknown;

  const essentiaPkg: {
    Essentia: typeof Essentia;
    EssentiaWASM: unknown;
    default?: {
      Essentia: typeof Essentia;
      EssentiaWASM: unknown;
    };
  };

  export default essentiaPkg;
}
