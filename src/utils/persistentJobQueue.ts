/**
 * Offline & recoverable job queue backed by IndexedDB.
 * Allows batch processing jobs to survive page refreshes, tab closures, and crash recovery.
 */

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface PersistentJob {
  id: string;
  tool: string; // e.g. "image-compress", "pdf-compress", "universal-converter"
  fileName: string;
  fileSize: number;
  fileBlob: Blob;
  settings?: Record<string, any>;
  status: JobStatus;
  progress: number;
  createdAt: number;
  updatedAt: number;
  resultBlob?: Blob;
  resultUrl?: string;
  errorMessage?: string;
}

const DB_NAME = "compactor_job_db";
const STORE_NAME = "persistent_jobs";
const DB_VERSION = 1;

const openDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported in this environment."));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("tool", "tool", { unique: false });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Saves a new job or updates an existing job in the queue.
 */
export const saveJob = async (job: PersistentJob): Promise<string> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const item = { ...job, updatedAt: Date.now() };
    const req = store.put(item);
    req.onsuccess = () => resolve(job.id);
    req.onerror = () => reject(req.error);
  });
};

/**
 * Retrieves all jobs, optionally filtered by tool name.
 */
export const getJobs = async (tool?: string): Promise<PersistentJob[]> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      let results: PersistentJob[] = req.result || [];
      if (tool) {
        results = results.filter((j) => j.tool === tool);
      }
      results.sort((a, b) => b.createdAt - a.createdAt);
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
};

/**
 * Updates the status, progress, and optionally result blob of a job.
 */
export const updateJobStatus = async (
  id: string,
  status: JobStatus,
  progress: number = 0,
  resultBlob?: Blob,
  errorMessage?: string
): Promise<void> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const job: PersistentJob = getReq.result;
      if (!job) return resolve();

      job.status = status;
      job.progress = progress;
      job.updatedAt = Date.now();
      if (resultBlob) job.resultBlob = resultBlob;
      if (errorMessage) job.errorMessage = errorMessage;

      const putReq = store.put(job);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
};

/**
 * Removes a job by ID.
 */
export const removeJob = async (id: string): Promise<void> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

/**
 * Clears all finished (completed or failed) jobs from storage.
 */
export const clearFinishedJobs = async (tool?: string): Promise<void> => {
  const allJobs = await getJobs(tool);
  const toDelete = allJobs.filter((j) => j.status === "completed" || j.status === "failed");
  await Promise.all(toDelete.map((j) => removeJob(j.id)));
};

/**
 * Recovers any interrupted or unfinished jobs for a specific tool.
 */
export const getUnfinishedJobs = async (tool: string): Promise<PersistentJob[]> => {
  const jobs = await getJobs(tool);
  return jobs.filter((j) => j.status === "queued" || j.status === "processing");
};
