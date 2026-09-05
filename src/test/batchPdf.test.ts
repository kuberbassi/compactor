import { describe, it, expect, vi } from 'vitest';

vi.mock('../utils/pdf', () => ({
  flattenPdfForm: vi.fn(async () => new Blob(['flattened'], { type: 'application/pdf' })),
  flattenPdfCompletely: vi.fn(async () => new Blob(['flattened-all'], { type: 'application/pdf' })),
  watermarkPdfAdvanced: vi.fn(async () => new Blob(['watermarked'], { type: 'application/pdf' })),
  addPageNumbersToPdf: vi.fn(async () => new Blob(['numbered'], { type: 'application/pdf' })),
  addVectorStampToPdf: vi.fn(async () => new Blob(['stamped'], { type: 'application/pdf' })),
  cropPdfMargins: vi.fn(async () => new Blob(['cropped'], { type: 'application/pdf' })),
  extractPdfMarkdown: vi.fn(async () => '# Extracted Content'),
  protectPdfWithPassword: vi.fn(async () => new Blob(['protected'], { type: 'application/pdf' })),
  unlockPdfWithPassword: vi.fn(async () => new Blob(['unlocked'], { type: 'application/pdf' })),
}));

import {
  createPdfBatchJobs,
  cleanupBatchJobs,
  runPdfBatch,
  type BatchPdfConfig
} from '../utils/batchPdf';

describe('batchPdf', () => {
  it('creates initial batch job descriptors for files', () => {
    const file1 = new File(['%PDF-1.4 mock content 1'], 'test1.pdf', { type: 'application/pdf' });
    const file2 = new File(['%PDF-1.4 mock content 2'], 'test2.pdf', { type: 'application/pdf' });

    const jobs = createPdfBatchJobs([file1, file2]);
    expect(jobs).toHaveLength(2);
    expect(jobs[0].file.name).toBe('test1.pdf');
    expect(jobs[0].status).toBe('idle');
    expect(jobs[0].progress).toBe(0);
    expect(jobs[1].file.name).toBe('test2.pdf');
  });

  it('safely cleans up allocated object URLs without throwing', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const jobs = createPdfBatchJobs([file]);
    jobs[0].resultUrl = 'blob:http://localhost:5173/mock-uuid';

    cleanupBatchJobs(jobs);
    expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost:5173/mock-uuid');
    revokeSpy.mockRestore();
  });

  it('respects abort signal for cancellation between batch items', async () => {
    const file1 = new File(['mock1'], 'doc1.pdf', { type: 'application/pdf' });
    const file2 = new File(['mock2'], 'doc2.pdf', { type: 'application/pdf' });
    const jobs = createPdfBatchJobs([file1, file2]);

    const controller = new AbortController();
    controller.abort(); // pre-aborted

    const config: BatchPdfConfig = { operation: 'flatten-forms' };
    const updates: any[] = [];
    const results = await runPdfBatch(jobs, config, (job) => updates.push(job), controller.signal);

    expect(results[0].status).toBe('idle');
    expect(results[1].status).toBe('idle');
    expect(updates).toHaveLength(0);
  });

  it('processes sequential batch jobs and produces unique output names', async () => {
    const file1 = new File(['mock1'], 'report.pdf', { type: 'application/pdf' });
    const file2 = new File(['mock2'], 'report.pdf', { type: 'application/pdf' });
    const jobs = createPdfBatchJobs([file1, file2]);

    const config: BatchPdfConfig = { operation: 'flatten-forms' };
    const updates: any[] = [];
    const results = await runPdfBatch(jobs, config, (job) => updates.push(job));

    expect(results[0].status).toBe('done');
    expect(results[1].status).toBe('done');
    expect(results[0].resultName).toBe('report_flatten-forms.pdf');
    expect(results[1].resultName).toBe('report_flatten-forms (1).pdf');
    expect(updates.length).toBeGreaterThanOrEqual(4);
  });
});

