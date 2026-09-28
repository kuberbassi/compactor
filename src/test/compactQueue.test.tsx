import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appendCompactJobs, moveCompactJob, releaseCompactResult, summarizeCompactJobs } from '../compact/queue/compactQueue';
import { useCompactQueue, type CompactQueueAdapter } from '../compact/queue/useCompactQueue';

const file = (name: string, size = 3) => new File([new Uint8Array(size)], name, { type: 'image/png', lastModified: 1 });
const output = (name: string) => ({ blob: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' }), name, originalSize: 3, newSize: 8 });

describe('compact queue rules', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => `blob:${Math.random()}`) });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  });

  it('skips duplicate files, preserves order, and supports reordering', () => {
    const first = file('one.png');
    const next = appendCompactJobs([], [first, first, file('two.png')]);
    expect(next.added).toBe(2);
    expect(next.skipped).toBe(1);
    expect(moveCompactJob(next.jobs, 1, 0).map(job => job.file.name)).toEqual(['two.png', 'one.png']);
  });

  it('summarizes partial results and releases only an owned result URL', () => {
    const jobs = appendCompactJobs([], [file('one.png'), file('two.png')]).jobs;
    jobs[0] = { ...jobs[0], status: 'complete', result: { ...output('one-small.png'), url: 'blob:owned' } };
    jobs[1] = { ...jobs[1], status: 'failed', error: 'broken' };
    expect(summarizeCompactJobs(jobs)).toEqual({ completed: 1, failed: 1, cancelled: 0, originalSize: 3, outputSize: 8 });
    releaseCompactResult(jobs[0]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:owned');
  });

  it('continues after failure, retries, creates unique names, and records successful outputs', async () => {
    let failSecond = true;
    const adapter: CompactQueueAdapter<{ quality: number }> = {
      accepts: () => true,
      process: vi.fn(async input => {
        if (input.name === 'two.png' && failSecond) throw new Error('broken image');
        return output('optimized.png');
      }),
    };
    const onComplete = vi.fn();
    const { result } = renderHook(() => useCompactQueue(adapter, { quality: 80 }, onComplete));
    act(() => result.current.addFiles([file('one.png'), file('two.png'), file('three.png')]));
    await act(async () => { await result.current.run(); });

    expect(result.current.jobs.map(job => job.status)).toEqual(['complete', 'failed', 'complete']);
    expect(result.current.jobs[0].result?.name).toBe('optimized.png');
    expect(result.current.jobs[2].result?.name).toBe('optimized (1).png');
    expect(onComplete).toHaveBeenCalledWith(2);

    failSecond = false;
    await act(async () => { await result.current.retry(result.current.jobs[1].id); });
    await waitFor(() => expect(result.current.jobs[1].status).toBe('complete'));
    expect(onComplete).toHaveBeenLastCalledWith(1);
  });

  it('replaces a finished batch when new files are added', async () => {
    const adapter: CompactQueueAdapter<Record<string, never>> = { accepts: () => true, process: vi.fn(async input => output(`${input.name}.out.png`)) };
    const { result } = renderHook(() => useCompactQueue(adapter, {}));
    act(() => result.current.addFiles([file('old.png')]));
    await act(async () => { await result.current.run(); });
    await waitFor(() => expect(result.current.jobs[0].status).toBe('complete'));
    act(() => result.current.addFiles([file('new.png')]));
    expect(result.current.jobs.map(job => job.file.name)).toEqual(['new.png']);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('cancels jobs that have not started without discarding the active result', async () => {
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });
    const adapter: CompactQueueAdapter<Record<string, never>> = {
      accepts: () => true,
      process: vi.fn(async input => {
        if (input.name === 'one.png') await firstGate;
        return output(`${input.name}.out.png`);
      }),
    };
    const { result } = renderHook(() => useCompactQueue(adapter, {}));
    act(() => result.current.addFiles([file('one.png'), file('two.png')]));
    let runPromise!: Promise<void>;
    act(() => { runPromise = result.current.run(); });
    await waitFor(() => expect(result.current.jobs[0].status).toBe('processing'));
    act(() => result.current.cancel());
    releaseFirst();
    await act(async () => { await runPromise; });
    expect(result.current.jobs.map(job => job.status)).toEqual(['complete', 'cancelled']);
  });

  it('terminates an active adapter job and leaves the queue recoverable', async () => {
    let rejectActive!: (error: Error) => void;
    const active = new Promise<never>((_, reject) => { rejectActive = reject; });
    const adapter: CompactQueueAdapter<Record<string, never>> = {
      accepts: () => true,
      process: vi.fn(() => active),
      cancelActive: vi.fn(() => rejectActive(new Error('terminated'))),
    };
    const { result } = renderHook(() => useCompactQueue(adapter, {}));
    act(() => result.current.addFiles([file('one.png'), file('two.png')]));
    let runPromise!: Promise<void>;
    act(() => { runPromise = result.current.run(); });
    await waitFor(() => expect(result.current.jobs[0].status).toBe('processing'));
    act(() => result.current.cancel());
    await act(async () => { await runPromise; });
    expect(adapter.cancelActive).toHaveBeenCalledOnce();
    expect(result.current.jobs.map(job => job.status)).toEqual(['cancelled', 'cancelled']);
    expect(result.current.processing).toBe(false);
  });

  it('cancels active work and suppresses late results after unmount', async () => {
    let finish!: (value: ReturnType<typeof output>) => void;
    const active = new Promise<ReturnType<typeof output>>(resolve => { finish = resolve; });
    const adapter: CompactQueueAdapter<Record<string, never>> = {
      accepts: () => true,
      process: vi.fn(() => active),
      cancelActive: vi.fn(),
    };
    const onComplete = vi.fn();
    const { result, unmount } = renderHook(() => useCompactQueue(adapter, {}, onComplete));
    act(() => result.current.addFiles([file('one.png')]));
    let runPromise!: Promise<void>;
    act(() => { runPromise = result.current.run(); });
    await waitFor(() => expect(result.current.jobs[0].status).toBe('processing'));
    unmount();
    expect(adapter.cancelActive).toHaveBeenCalledOnce();
    finish(output('late.png'));
    await act(async () => { await runPromise; });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
