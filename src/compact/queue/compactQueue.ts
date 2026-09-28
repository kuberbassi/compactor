import { fileIdentity } from '../../utils/batch';

export type CompactJobStatus = 'pending' | 'processing' | 'complete' | 'failed' | 'cancelled';

export interface CompactQueueResult {
  blob: Blob;
  url: string;
  name: string;
  originalSize: number;
  newSize: number;
}

export interface CompactQueueJob {
  id: string;
  file: File;
  status: CompactJobStatus;
  progress: number;
  result?: CompactQueueResult;
  error?: string;
}

let sequence = 0;

export const createCompactJob = (file: File): CompactQueueJob => ({
  id: `${fileIdentity(file)}:${sequence++}`,
  file,
  status: 'pending',
  progress: 0,
});

export const appendCompactJobs = (current: CompactQueueJob[], incoming: File[]) => {
  const identities = new Set(current.map(job => fileIdentity(job.file)));
  const added: CompactQueueJob[] = [];
  let skipped = 0;

  for (const file of incoming) {
    const identity = fileIdentity(file);
    if (identities.has(identity)) {
      skipped += 1;
      continue;
    }
    identities.add(identity);
    added.push(createCompactJob(file));
  }

  return { jobs: [...current, ...added], added: added.length, skipped };
};

export const moveCompactJob = (jobs: CompactQueueJob[], from: number, to: number) => {
  if (from === to || from < 0 || to < 0 || from >= jobs.length || to >= jobs.length) return jobs;
  const reordered = [...jobs];
  const [job] = reordered.splice(from, 1);
  reordered.splice(to, 0, job);
  return reordered;
};

export const releaseCompactResult = (job?: CompactQueueJob) => {
  if (job?.result?.url) URL.revokeObjectURL(job.result.url);
};

export const summarizeCompactJobs = (jobs: CompactQueueJob[]) => {
  const completed = jobs.filter(job => job.status === 'complete' && job.result);
  return {
    completed: completed.length,
    failed: jobs.filter(job => job.status === 'failed').length,
    cancelled: jobs.filter(job => job.status === 'cancelled').length,
    originalSize: completed.reduce((total, job) => total + (job.result?.originalSize ?? 0), 0),
    outputSize: completed.reduce((total, job) => total + (job.result?.newSize ?? 0), 0),
  };
};
