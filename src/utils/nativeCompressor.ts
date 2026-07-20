import type { TrimSegment } from '../components/Common/TrimTimeline';

export interface NativeCompressOptions {
  bitrateKbps: number; // e.g. 2000 for 2 Mbps
  playbackRate: number; // e.g. 4.0x
  removeAudio: boolean;
  segments?: TrimSegment[];
  compileMode?: 'keep-selected' | 'cut-selected';
  onProgress: (progress: number) => void;
  onLog: (msg: string) => void;
  signal?: AbortSignal;
}

export interface NativeCompressResult {
  blob: Blob;
  url: string;
  name: string;
  originalSize: number;
  newSize: number;
}

/**
 * Native hardware-accelerated compressor that handles files of any size (up to 10GB+)
 * by streaming frames through MediaRecorder and seeking dynamically to trim.
 */
export const compressVideoNative = async (
  file: File,
  options: NativeCompressOptions
): Promise<NativeCompressResult> => {
  const { bitrateKbps, playbackRate, removeAudio, segments, compileMode, onProgress, onLog, signal } = options;

  onLog(`Initializing Native Browser Compressor for "${file.name}"...`);
  
  // 1. Calculate active intervals based on trim timeline segments
  let intervals: Array<{ start: number; end: number }> = [];
  const duration = await new Promise<number>((resolve) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      resolve(video.duration);
      URL.revokeObjectURL(video.src);
    };
  });

  if (segments && segments.length > 0 && compileMode) {
    const activeSegs = segments.filter(seg => {
      const isKeep = seg.mode === 'keep';
      return compileMode === 'keep-selected' ? isKeep : !isKeep;
    });

    intervals = activeSegs.map(seg => ({ start: seg.start, end: seg.end }));
  } else {
    intervals = [{ start: 0, end: duration }];
  }

  // Sort intervals by start time
  intervals.sort((a, b) => a.start - b.end);

  if (intervals.length === 0) {
    throw new Error("No portions selected to keep. Adjust your trim settings.");
  }

  onLog(`Trim timeline configured: ${intervals.length} segments to keep.`);
  intervals.forEach((interval, idx) => {
    onLog(`  Segment ${idx + 1}: ${interval.start.toFixed(2)}s to ${interval.end.toFixed(2)}s`);
  });

  return new Promise((resolve, reject) => {
    // 2. Load video in an offscreen player
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = removeAudio;
    video.playsInline = true;
    video.style.position = 'fixed';
    video.style.top = '-9999px';
    document.body.appendChild(video);

    let stream: MediaStream;
    let mediaRecorder: MediaRecorder;
    const chunks: Blob[] = [];
    let currentIntervalIndex = 0;
    let progressInterval: number;
    let checkInterval: number;

    const cleanup = () => {
      document.body.removeChild(video);
      clearInterval(progressInterval);
      clearInterval(checkInterval);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      URL.revokeObjectURL(video.src);
    };

    if (signal) {
      if (signal.aborted) {
        cleanup();
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      signal.addEventListener('abort', () => {
        cleanup();
        reject(new DOMException("Aborted", "AbortError"));
      });
    }

    video.onloadedmetadata = () => {
      try {
        onLog(`Video metadata loaded. Resolution: ${video.videoWidth}x${video.videoHeight}. Duration: ${video.duration.toFixed(1)}s.`);
        
        // 3. Set up Web Audio API to prevent double audio playback
        if (!removeAudio) {
          try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioContext.createMediaElementSource(video);
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 0; // Mute speakers
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            onLog("Web Audio capture pipeline initialized successfully.");
          } catch (audioErr) {
            onLog("Warning: Could not isolate audio routing. Compressing with direct speaker play.");
          }
        }

        // 4. Capture stream from video element
        const captureStream = (video as any).captureStream || (video as any).mozCaptureStream;
        if (!captureStream) {
          throw new Error("Your browser does not support MediaStream capture from video elements.");
        }
        
        stream = captureStream.call(video);
        onLog("MediaStream captured from offscreen video element.");

        // Clean audio tracks if user requested mute
        if (removeAudio) {
          stream.getAudioTracks().forEach(track => {
            stream.removeTrack(track);
            track.stop();
          });
        }

        // 5. Determine encoder mimeType
        let mimeType = 'video/webm;codecs=vp9,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm;codecs=vp8,opus';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = ''; // Let browser choose
        }

        onLog(`Recorder codec configured: ${mimeType || 'Default browser codec'}. Target Bitrate: ${bitrateKbps} Kbps.`);

        // 6. Initialize MediaRecorder
        const recorderOptions: MediaRecorderOptions = {
          videoBitsPerSecond: bitrateKbps * 1000,
          audioBitsPerSecond: 128000
        };
        if (mimeType) {
          recorderOptions.mimeType = mimeType;
        }

        mediaRecorder = new MediaRecorder(stream, recorderOptions);
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          onLog("Media recording completed. Assembling final compression container...");
          const finalBlob = new Blob(chunks, { type: mimeType || 'video/webm' });
          const url = URL.createObjectURL(finalBlob);
          
          const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
          const newName = `${originalNameWithoutExt}_native_compressed.webm`;
          
          cleanup();
          resolve({
            blob: finalBlob,
            url,
            name: newName,
            originalSize: file.size,
            newSize: finalBlob.size
          });
        };

        // 7. Start Playback and Recording Loop
        video.currentTime = intervals[0].start;
        video.playbackRate = playbackRate;

        video.onseeked = () => {
          if (mediaRecorder.state === 'inactive') {
            onLog(`Starting MediaRecorder capture at playback acceleration: ${playbackRate}x.`);
            mediaRecorder.start(200);
            video.play().catch(reject);
          }
        };

        checkInterval = window.setInterval(() => {
          const currentTime = video.currentTime;
          const currentInterval = intervals[currentIntervalIndex];

          if (currentTime >= currentInterval.end) {
            currentIntervalIndex++;
            
            if (currentIntervalIndex < intervals.length) {
              const nextInterval = intervals[currentIntervalIndex];
              onLog(`Segment boundary reached. Seeking playhead from ${currentTime.toFixed(1)}s to next keep zone at ${nextInterval.start.toFixed(1)}s...`);
              
              video.pause();
              video.currentTime = nextInterval.start;
              video.play().catch(reject);
            } else {
              video.pause();
              mediaRecorder.stop();
            }
          }
        }, 50);

        const totalDurationToRecord = intervals.reduce((acc, curr) => acc + (curr.end - curr.start), 0);
        
        progressInterval = window.setInterval(() => {
          let recordedSoFar = 0;
          for (let i = 0; i < currentIntervalIndex; i++) {
            recordedSoFar += (intervals[i].end - intervals[i].start);
          }
          const currentSegmentProgress = video.currentTime - intervals[currentIntervalIndex].start;
          recordedSoFar += Math.max(0, currentSegmentProgress);

          const progressPct = Math.min(99, (recordedSoFar / totalDurationToRecord) * 100);
          onProgress(progressPct);
        }, 100);

      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Video playback error. The file might be corrupted or in an unsupported format."));
    };
  });
};
