import type { TrimSegment } from '../components/Common/TrimTimeline';

export interface NativeCompressOptions {
  bitrateKbps: number; // e.g. 3000 for 3 Mbps
  scale?: string; // e.g. '1280:720', '854:480', '640:360' or 'no-scale'
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
 * Merges overlapping or contiguous time intervals
 */
const mergeIntervals = (intervals: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> => {
  if (intervals.length <= 1) return intervals;
  const merged: Array<{ start: number; end: number }> = [];
  let current = { ...intervals[0] };
  for (let i = 1; i < intervals.length; i++) {
    const next = intervals[i];
    if (next.start <= current.end) {
      current.end = Math.max(current.end, next.end);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  return merged;
};

/**
 * Calculates active intervals to record from trim timeline
 */
const getActiveIntervals = (
  duration: number,
  segments?: TrimSegment[],
  compileMode?: 'keep-selected' | 'cut-selected'
): Array<{ start: number; end: number }> => {
  if (!segments || segments.length === 0 || !compileMode) {
    return [{ start: 0, end: duration }];
  }
  const rawIntervals = segments
    .filter(seg => {
      const isKeep = seg.mode === 'keep';
      return compileMode === 'keep-selected' ? isKeep : !isKeep;
    })
    .map(seg => ({ start: seg.start, end: seg.end }))
    .sort((a, b) => a.start - b.start);

  if (rawIntervals.length === 0) return [];
  return mergeIntervals(rawIntervals);
};

/**
 * Native hardware-accelerated compressor that streams frames through MediaRecorder
 * at exact 1.0x speed, preserving 100% of content, exact video duration, and audio sync.
 */
export const compressVideoNative = async (
  file: File,
  options: NativeCompressOptions
): Promise<NativeCompressResult> => {
  const { bitrateKbps, scale, removeAudio, segments, compileMode, onProgress, onLog, signal } = options;

  onLog(`Initializing Native Browser Compressor for "${file.name}"...`);

  // 1. Determine video duration first
  const fileUrl = URL.createObjectURL(file);
  const duration = await new Promise<number>((resolve, reject) => {
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = fileUrl;
    tempVideo.onloadedmetadata = () => {
      resolve(tempVideo.duration);
    };
    tempVideo.onerror = () => {
      reject(new Error("Unable to read video metadata. File may be unsupported or corrupted."));
    };
  });

  const intervals = getActiveIntervals(duration, segments, compileMode);
  if (intervals.length === 0) {
    URL.revokeObjectURL(fileUrl);
    throw new Error("No video portions selected to keep. Adjust your trim settings.");
  }

  const totalDurationToRecord = intervals.reduce((acc, curr) => acc + (curr.end - curr.start), 0);
  onLog(`Trim configuration ready: ${intervals.length} zone(s) to process, total content duration: ${totalDurationToRecord.toFixed(2)}s.`);
  intervals.forEach((interval, idx) => {
    onLog(`  Zone ${idx + 1}: ${interval.start.toFixed(2)}s -> ${interval.end.toFixed(2)}s (${(interval.end - interval.start).toFixed(2)}s)`);
  });

  return new Promise((resolve, reject) => {
    // 2. Offscreen Video Player Element
    const video = document.createElement('video');
    video.src = fileUrl;
    video.playsInline = true;
    video.muted = true; // Muted to prevent loudspeaker playback; audio captured via AudioContext
    video.playbackRate = 1.0; // STRICT 1.0x to ensure 100% video content duration accuracy
    video.style.position = 'fixed';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    document.body.appendChild(video);

    let mediaRecorder: MediaRecorder | null = null;
    let audioContext: AudioContext | null = null;
    let canvasAnimId: number | null = null;
    let checkInterval: number | null = null;
    let progressInterval: number | null = null;
    const chunks: Blob[] = [];
    let isCleanedUp = false;

    let targetStream: MediaStream | null = null;

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;

      if (checkInterval !== null) clearInterval(checkInterval);
      if (progressInterval !== null) clearInterval(progressInterval);
      if (canvasAnimId !== null) cancelAnimationFrame(canvasAnimId);

      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }

      if (targetStream) {
        targetStream.getTracks().forEach(track => track.stop());
      }

      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
      URL.revokeObjectURL(fileUrl);
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
        onLog(`Loaded metadata: ${video.videoWidth}x${video.videoHeight}px @ ${video.duration.toFixed(1)}s total.`);

        let videoTrack: MediaStreamTrack;
        let canvasElement: HTMLCanvasElement | null = null;

        // Check if resolution scaling is requested
        const needsScaling = scale && scale !== 'no-scale' && scale.includes(':');
        if (needsScaling) {
          const [targetW, targetH] = scale.split(':').map(n => parseInt(n, 10));
          if (targetW > 0 && targetH > 0) {
            onLog(`Resolution scaling enabled: Converting output to ${targetW}x${targetH}px...`);
            canvasElement = document.createElement('canvas');
            canvasElement.width = targetW;
            canvasElement.height = targetH;
            const ctx = canvasElement.getContext('2d')!;

            const renderFrame = () => {
              if (video.readyState >= 2) {
                ctx.drawImage(video, 0, 0, targetW, targetH);
              }
              if (!isCleanedUp) {
                canvasAnimId = requestAnimationFrame(renderFrame);
              }
            };
            renderFrame();

            const canvasStream = canvasElement.captureStream(30);
            videoTrack = canvasStream.getVideoTracks()[0];
          } else {
            const rawStream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream();
            videoTrack = rawStream.getVideoTracks()[0];
          }
        } else {
          const rawStream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream();
          videoTrack = rawStream.getVideoTracks()[0];
        }

        if (!videoTrack) {
          throw new Error("Unable to capture video stream from offscreen player.");
        }

        // 3. Audio routing via Web Audio API (if audio requested)
        const tracksToRecord: MediaStreamTrack[] = [videoTrack];

        if (!removeAudio) {
          try {
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioContext.createMediaElementSource(video);
            const destination = audioContext.createMediaStreamDestination();
            source.connect(destination);

            const audioTrack = destination.stream.getAudioTracks()[0];
            if (audioTrack) {
              tracksToRecord.push(audioTrack);
              onLog("Isolated audio pipeline connected successfully.");
            }
          } catch {
            onLog("Warning: Could not isolate audio routing. Proceeding with silent video track capture.");
          }
        }

        targetStream = new MediaStream(tracksToRecord);

        // 4. Codec determination
        const candidateCodecs = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm;codecs=h264,opus',
          'video/mp4;codecs=avc1,mp4a.40.2',
          'video/mp4',
          'video/webm'
        ];

        let selectedMimeType = '';
        for (const codec of candidateCodecs) {
          if (MediaRecorder.isTypeSupported(codec)) {
            selectedMimeType = codec;
            break;
          }
        }

        onLog(`Selected encoding profile: ${selectedMimeType || 'Browser default container'}. Target Bitrate: ${bitrateKbps} Kbps.`);

        const recorderOptions: MediaRecorderOptions = {
          videoBitsPerSecond: bitrateKbps * 1000,
          audioBitsPerSecond: 128000
        };
        if (selectedMimeType) {
          recorderOptions.mimeType = selectedMimeType;
        }

        mediaRecorder = new MediaRecorder(targetStream, recorderOptions);

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          onLog("Media stream recording complete. Finalizing output file...");
          const finalMime = selectedMimeType.split(';')[0] || (selectedMimeType.includes('mp4') ? 'video/mp4' : 'video/webm');
          let finalBlob = new Blob(chunks, { type: finalMime });

          // Rare Special Case: If full video (no trim cuts) and recorded stream size is >= original input file
          const isFullVideo = Math.abs(totalDurationToRecord - duration) < 1.0;
          if (isFullVideo && finalBlob.size >= file.size) {
            onLog("Special rare case: Native stream recording size exceeds original video file. Retaining original file.");
            finalBlob = file;
          }

          const url = URL.createObjectURL(finalBlob);

          const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
          const ext = finalBlob === file ? (file.name.split('.').pop() || 'mp4') : (finalMime.includes('mp4') ? 'mp4' : 'webm');
          const newName = `${originalNameWithoutExt}_native_compressed.${ext}`;

          cleanup();
          resolve({
            blob: finalBlob,
            url,
            name: newName,
            originalSize: file.size,
            newSize: finalBlob.size
          });
        };

        // 5. Playback and Recording State Machine
        let currentIntervalIdx = 0;
        let isSeekingBetweenIntervals = false;

        video.currentTime = intervals[0].start;

        video.onseeked = () => {
          if (!mediaRecorder) return;

          if (mediaRecorder.state === 'inactive') {
            onLog(`Starting MediaRecorder capture (Rate: 1.0x real-time content precision)...`);
            mediaRecorder.start(200);
            if (audioContext && audioContext.state === 'suspended') {
              audioContext.resume();
            }
            video.play().catch(reject);
          } else if (isSeekingBetweenIntervals) {
            isSeekingBetweenIntervals = false;
            if (mediaRecorder.state === 'paused') {
              mediaRecorder.resume();
            }
            video.play().catch(reject);
          }
        };

        // Interval boundary monitor loop
        checkInterval = window.setInterval(() => {
          if (isSeekingBetweenIntervals || !mediaRecorder) return;

          const currTime = video.currentTime;
          const currentInterval = intervals[currentIntervalIdx];

          if (currTime >= currentInterval.end - 0.05) {
            currentIntervalIdx++;

            if (currentIntervalIdx < intervals.length) {
              const nextInterval = intervals[currentIntervalIdx];
              onLog(`Segment cut reached. Advancing to keep zone ${currentIntervalIdx + 1} (${nextInterval.start.toFixed(2)}s)...`);

              isSeekingBetweenIntervals = true;
              if (mediaRecorder.state === 'recording') {
                mediaRecorder.pause();
              }
              video.pause();
              video.currentTime = nextInterval.start;
            } else {
              // Reached end of all intervals
              video.pause();
              if (mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
              }
            }
          }
        }, 30);

        // Progress Reporter
        progressInterval = window.setInterval(() => {
          let recordedSoFar = 0;
          for (let i = 0; i < currentIntervalIdx; i++) {
            recordedSoFar += (intervals[i].end - intervals[i].start);
          }
          if (currentIntervalIdx < intervals.length) {
            const segProgress = video.currentTime - intervals[currentIntervalIdx].start;
            recordedSoFar += Math.max(0, segProgress);
          }
          const progressPct = Math.min(99.9, (recordedSoFar / totalDurationToRecord) * 100);
          onProgress(progressPct);
        }, 100);

      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Offscreen video playback failed. The file format may be unsupported by your browser."));
    };
  });
};

