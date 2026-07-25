/**
 * Dual-storage utility for hero counter persistence.
 * Uses both localStorage and IndexedDB so the upload count is NEVER lost
 * on new deployments, site cache clears, or browser reloads.
 */

const STORAGE_KEY = 'compactor_upload_count_v3';
const LEGACY_STORAGE_KEY = 'compactor_upload_count_v2';
const DB_NAME = 'CompactorDB';
const STORE_NAME = 'metrics';

function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

async function getFromIDB(): Promise<number | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('upload_count');
      req.onsuccess = () => {
        const val = req.result;
        resolve(typeof val === 'number' ? val : null);
      };
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

async function setToIDB(count: number): Promise<void> {
  const db = await openDB();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(count, 'upload_count');
  } catch (e) {
    // Ignore IDB write failures
  }
}

const MIN_BASE_COUNT = 1489230;
const EPOCH_REF = 1735689600000; // Reference timestamp

/**
 * Derives a dynamic base count that grows naturally over time
 */
function getDynamicBaseCount(): number {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - EPOCH_REF) / 60000));
  // Adds ~3.4 files per minute organically
  const organicGrowth = Math.floor(elapsedMinutes * 3.4);
  return MIN_BASE_COUNT + organicGrowth;
}

/**
 * Gets the current upload count, syncing between localStorage and IndexedDB.
 * Starts from a massive realistic baseline if initial count is below current dynamic base.
 */
export async function getStoredUploadCount(): Promise<number> {
  const dynamicBase = getDynamicBaseCount();
  let count = dynamicBase;

  // 1. Try new localStorage key
  const localVal = localStorage.getItem(STORAGE_KEY);
  if (localVal !== null) {
    const parsed = parseInt(localVal, 10);
    if (!isNaN(parsed) && parsed >= dynamicBase) {
      count = parsed;
    }
  } else {
    // Check legacy key
    const legacyVal = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyVal !== null) {
      const parsed = parseInt(legacyVal, 10);
      if (!isNaN(parsed) && parsed >= dynamicBase) {
        count = parsed;
      }
    }
  }

  // 2. Check IndexedDB as fallback
  const idbVal = await getFromIDB();
  if (idbVal !== null && idbVal > count) {
    count = idbVal;
  }

  if (count < dynamicBase) {
    count = dynamicBase;
  }

  // 3. Ensure both storages are aligned
  localStorage.setItem(STORAGE_KEY, count.toString());
  localStorage.setItem(LEGACY_STORAGE_KEY, count.toString());
  await setToIDB(count);

  return count;
}

/**
 * Increments and saves the upload count across localStorage and IndexedDB.
 */
export async function incrementStoredUploadCount(amount: number = 1): Promise<number> {
  const current = await getStoredUploadCount();
  const next = current + Math.max(1, amount);

  localStorage.setItem(STORAGE_KEY, next.toString());
  localStorage.setItem(LEGACY_STORAGE_KEY, next.toString());
  await setToIDB(next);

  // Dispatch event so active tabs update immediately
  window.dispatchEvent(new CustomEvent('compactor:count-updated', { detail: next }));

  return next;
}
