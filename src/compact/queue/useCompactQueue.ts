import { useCallback, useEffect, useRef, useState } from 'react';
import { makeUniqueNames } from '../../utils/batch';
import { assertExportLooksValid } from '../../utils/exportValidation';
import {
  appendCompactJobs,
  moveCompactJob,
  releaseCompactResult,
  type CompactQueueJob,
  type CompactQueueResult,
} from './compactQueue';

export interface CompactQueueAdapter<TSettings> {
  accepts: (file: File) => boolean;
  process: (file: File, settings: TSettings, onProgress: (progress: number) => void) => Promise<Omit<CompactQueueResult, 'url'>>;
  cancelActive?: () => Promise<void> | void;
}

export function useCompactQueue<TSettings>(adapter: CompactQueueAdapter<TSettings>, settings: TSettings, onComplete?: (count: number) => void) {
  const [jobs, setJobs] = useState<CompactQueueJob[]>([]);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState('');
  const jobsRef = useRef(jobs);
  const cancelledRef = useRef(false);
  const mountedRef = useRef(true);
  const adapterRef = useRef(adapter);

  useEffect(() => { jobsRef.current = jobs; }, [jobs]);
  useEffect(() => { adapterRef.current = adapter; }, [adapter]);
  useEffect(() => () => {
    mountedRef.current = false;
    cancelledRef.current = true;
    void adapterRef.current.cancelActive?.();
    jobsRef.current.forEach(releaseCompactResult);
  }, []);

  const updateJob = useCallback((id: string, update: Partial<CompactQueueJob>) => {
    if (!mountedRef.current) return;
    setJobs(current => current.map(job => job.id === id ? { ...job, ...update } : job));
  }, []);

  const addFiles = useCallback((files: File[]) => {
    const accepted = files.filter(adapter.accepts);
    const rejected = files.length - accepted.length;
    const current = jobsRef.current;
    const finishedBatch = current.length > 0 && current.every(job => ['complete', 'failed', 'cancelled'].includes(job.status));
    if (finishedBatch) current.forEach(releaseCompactResult);
    const next = appendCompactJobs(finishedBatch ? [] : current, accepted);
    setJobs(next.jobs);
    setNotice([
      next.skipped ? `${next.skipped} duplicate ${next.skipped === 1 ? 'was' : 'were'} skipped.` : '',
      rejected ? `${rejected} unsupported ${rejected === 1 ? 'file was' : 'files were'} skipped.` : '',
    ].filter(Boolean).join(' '));
  }, [adapter]);

  const removeJob = useCallback((id: string) => {
    setJobs(current => {
      const removed = current.find(job => job.id === id);
      releaseCompactResult(removed);
      return current.filter(job => job.id !== id);
    });
  }, []);

  const moveJob = useCallback((from: number, to: number) => setJobs(current => moveCompactJob(current, from, to)), []);

  const run = useCallback(async (ids?: string[]) => {
    const selected = jobsRef.current.filter(job => ids ? ids.includes(job.id) : job.status !== 'complete');
    if (selected.length === 0) return;
    setProcessing(true);
    cancelledRef.current = false;
    let completed = 0;
    const usedNames = jobsRef.current
      .filter(job => job.status === 'complete' && !selected.some(selectedJob => selectedJob.id === job.id))
      .map(job => job.result?.name ?? '');

    for (let index = 0; index < selected.length; index += 1) {
      const job = selected[index];
      if (cancelledRef.current) {
        updateJob(job.id, { status: 'cancelled', progress: 0 });
        continue;
      }
      releaseCompactResult(job);
      updateJob(job.id, { status: 'processing', progress: 20, error: undefined, result: undefined });
      try {
        const processed = await adapter.process(job.file, settings, progress => {
          if (mountedRef.current) updateJob(job.id, { progress: Math.max(0, Math.min(99, progress)) });
        });
        if (!mountedRef.current) return;
        const uniqueName = makeUniqueNames([...usedNames, processed.name]).at(-1) ?? processed.name;
        await assertExportLooksValid(processed.blob, uniqueName);
        if (!mountedRef.current) return;
        usedNames.push(uniqueName);
        const result = { ...processed, name: uniqueName, url: URL.createObjectURL(processed.blob) };
        updateJob(job.id, { status: 'complete', progress: 100, result });
        completed += 1;
      } catch (error) {
        if (mountedRef.current) updateJob(job.id, {
          status: cancelledRef.current ? 'cancelled' : 'failed',
          progress: 0,
          error: cancelledRef.current ? undefined : error instanceof Error ? error.message : 'Processing failed. Please retry.',
        });
      }
    }
    if (mountedRef.current) {
      setProcessing(false);
      if (completed > 0) onComplete?.(completed);
    }
  }, [adapter, onComplete, settings, updateJob]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    void adapter.cancelActive?.();
  }, [adapter]);
  const retry = useCallback((id: string) => run([id]), [run]);
  const clear = useCallback(() => {
    cancelledRef.current = true;
    setJobs(current => { current.forEach(releaseCompactResult); return []; });
    setNotice('');
  }, []);

  return { jobs, processing, notice, addFiles, removeJob, moveJob, run, retry, cancel, clear };
}
