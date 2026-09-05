import {
  flattenPdfForm,
  flattenPdfCompletely,
  watermarkPdfAdvanced,
  addPageNumbersToPdf,
  addVectorStampToPdf,
  cropPdfMargins,
  extractPdfMarkdown,
  protectPdfWithPassword,
  unlockPdfWithPassword
} from './pdf';
import { makeUniqueNames } from './batch';

export type PdfBatchOperation =
  | 'flatten-forms'
  | 'flatten-all'
  | 'watermark'
  | 'page-numbers'
  | 'stamps'
  | 'crop'
  | 'markdown'
  | 'protect'
  | 'unlock';

export interface BatchPdfJob {
  id: string;
  file: File;
  status: 'idle' | 'processing' | 'done' | 'error';
  progress: number;
  resultBlob?: Blob;
  resultUrl?: string;
  resultName?: string;
  outputSize?: number;
  error?: string;
  hasFormFields?: boolean;
}

export interface BatchPdfConfig {
  operation: PdfBatchOperation;
  watermark?: {
    text: string;
    position: 'diagonal' | 'header' | 'footer' | 'pattern';
    color: 'red' | 'blue' | 'black' | 'gray';
    opacity: number;
  };
  pageNumbers?: {
    position: 'top' | 'bottom';
  };
  stamp?: {
    preset: string;
    position: 'bottom-right' | 'bottom-left' | 'top-right' | 'center';
    targetPages: 'last-page' | 'first-page' | 'all-pages';
  };
  crop?: {
    marginPct: number;
  };
  password?: {
    userPassword: string;
  };
}

/**
 * Creates initial job descriptors from an array of files
 */
export const createPdfBatchJobs = (files: File[]): BatchPdfJob[] => {
  return files.map((file, idx) => ({
    id: `${file.name}-${file.size}-${idx}-${Date.now()}`,
    file,
    status: 'idle',
    progress: 0,
  }));
};

/**
 * Cleans up allocated object URLs to prevent browser memory leaks
 */
export const cleanupBatchJobs = (jobs: BatchPdfJob[]): void => {
  jobs.forEach(job => {
    if (job.resultUrl) {
      try {
        URL.revokeObjectURL(job.resultUrl);
      } catch {
        // Safe disposal
      }
    }
  });
};

/**
 * Executes a sequential batch of PDF operations with cancellation and memory bounds
 */
export const runPdfBatch = async (
  jobs: BatchPdfJob[],
  config: BatchPdfConfig,
  onJobUpdate: (updatedJob: BatchPdfJob) => void,
  abortSignal?: AbortSignal
): Promise<BatchPdfJob[]> => {
  const updatedJobs = [...jobs];

  for (let i = 0; i < updatedJobs.length; i++) {
    if (abortSignal?.aborted) {
      break;
    }

    const currentJob = { ...updatedJobs[i] };
    if (currentJob.status === 'done') {
      continue;
    }

    currentJob.status = 'processing';
    currentJob.progress = 10;
    currentJob.error = undefined;
    onJobUpdate(currentJob);

    try {
      let outputBlob: Blob;
      let outputExtension = '.pdf';

      switch (config.operation) {
        case 'flatten-forms': {
          outputBlob = await flattenPdfForm(currentJob.file);
          break;
        }
        case 'flatten-all': {
          outputBlob = await flattenPdfCompletely(currentJob.file, 'standard');
          break;
        }
        case 'watermark': {
          const wm = config.watermark || {
            text: 'CONFIDENTIAL',
            position: 'diagonal',
            color: 'red',
            opacity: 0.35,
          };
          outputBlob = await watermarkPdfAdvanced(currentJob.file, {
            text: wm.text,
            position: wm.position,
            color: wm.color,
            opacity: wm.opacity,
          });
          break;
        }
        case 'page-numbers': {
          const pn = config.pageNumbers || { position: 'bottom' };
          outputBlob = await addPageNumbersToPdf(currentJob.file, pn.position);
          break;
        }
        case 'stamps': {
          const st = config.stamp || {
            preset: 'APPROVED',
            position: 'bottom-right',
            targetPages: 'all-pages',
          };
          outputBlob = await addVectorStampToPdf(currentJob.file, {
            preset: (st.preset as any) || 'APPROVED',
            position: st.position,
            targetPages: st.targetPages,
          });
          break;
        }
        case 'crop': {
          const cr = config.crop || { marginPct: 5 };
          outputBlob = await cropPdfMargins(currentJob.file, cr.marginPct);
          break;
        }
        case 'markdown': {
          const mdText = await extractPdfMarkdown(currentJob.file);
          outputBlob = new Blob([mdText], { type: 'text/markdown;charset=utf-8' });
          outputExtension = '.md';
          break;
        }
        case 'protect': {
          const pwd = config.password?.userPassword || '123456';
          outputBlob = await protectPdfWithPassword(currentJob.file, pwd);
          break;
        }
        case 'unlock': {
          outputBlob = await unlockPdfWithPassword(
            currentJob.file,
            config.password?.userPassword
          );
          break;
        }
        default:
          throw new Error(`Unsupported batch operation: ${config.operation}`);
      }

      currentJob.progress = 100;
      currentJob.status = 'done';
      currentJob.resultBlob = outputBlob;
      currentJob.outputSize = outputBlob.size;

      // Revoke any previous URL
      if (currentJob.resultUrl) {
        try {
          URL.revokeObjectURL(currentJob.resultUrl);
        } catch {
          // Ignored
        }
      }
      currentJob.resultUrl = URL.createObjectURL(outputBlob);

      const baseName = currentJob.file.name.replace(/\.[^/.]+$/, '');
      currentJob.resultName = `${baseName}_${config.operation}${outputExtension}`;

      updatedJobs[i] = currentJob;
      onJobUpdate(currentJob);
    } catch (err: any) {
      currentJob.status = 'error';
      currentJob.progress = 0;
      currentJob.error = err?.message || 'Processing failed';
      updatedJobs[i] = currentJob;
      onJobUpdate(currentJob);
    }
  }

  // Ensure unique download filenames across all completed outputs
  const completedIndices = updatedJobs
    .map((j, idx) => (j.status === 'done' && j.resultName ? idx : -1))
    .filter(idx => idx !== -1);

  const rawNames = completedIndices.map(idx => updatedJobs[idx].resultName!);
  const uniqueNames = makeUniqueNames(rawNames);

  completedIndices.forEach((jobIdx, nameIdx) => {
    updatedJobs[jobIdx].resultName = uniqueNames[nameIdx];
  });

  return updatedJobs;
};
