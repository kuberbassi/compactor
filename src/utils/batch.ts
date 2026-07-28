export type CompressionPreset = 'light' | 'balanced' | 'maximum';

export interface DownloadableResult {
  url: string;
  name: string;
  blob?: Blob;
}

export const fileIdentity = (file: File): string =>
  `${file.name.toLocaleLowerCase()}:${file.size}:${file.lastModified}`;

export const appendUniqueFiles = (current: File[], incoming: File[]): File[] => {
  const seen = new Set(current.map(fileIdentity));
  return [
    ...current,
    ...incoming.filter(file => {
      const key = fileIdentity(file);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  ];
};

export const makeUniqueNames = (names: string[]): string[] => {
  const used = new Set<string>();
  return names.map(name => {
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const extension = dot > 0 ? name.slice(dot) : '';
    let candidate = name;
    let suffix = 1;
    while (used.has(candidate.toLocaleLowerCase())) {
      candidate = `${base} (${suffix++})${extension}`;
    }
    used.add(candidate.toLocaleLowerCase());
    return candidate;
  });
};

export const downloadAll = (results: DownloadableResult[]): void => {
  const names = makeUniqueNames(results.map(result => result.name));
  results.forEach((result, index) => {
    window.setTimeout(() => {
      const anchor = document.createElement('a');
      anchor.href = result.url;
      anchor.download = names[index];
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }, index * 180);
  });
};

export const shareResult = async (result: DownloadableResult): Promise<boolean> => {
  if (!result.blob || !navigator.share) return false;
  const file = new File([result.blob], result.name, { type: result.blob.type });
  if (navigator.canShare && !navigator.canShare({ files: [file] })) return false;
  await navigator.share({ files: [file], title: result.name });
  return true;
};

export const getSizeSummary = (
  items: Array<{ originalSize: number; newSize: number }>
) => {
  const originalSize = items.reduce((total, item) => total + item.originalSize, 0);
  const newSize = items.reduce((total, item) => total + item.newSize, 0);
  const savedSize = Math.max(0, originalSize - newSize);
  const savedPercent = originalSize > 0 ? Math.round((savedSize / originalSize) * 100) : 0;
  return { originalSize, newSize, savedSize, savedPercent };
};

export const loadSetting = <T>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved === null ? fallback : JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
};

export const saveSetting = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Settings persistence must never block compression.
  }
};

export const isEditableShortcutTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  return Boolean(element?.closest('input, textarea, select, [contenteditable="true"]'));
};
