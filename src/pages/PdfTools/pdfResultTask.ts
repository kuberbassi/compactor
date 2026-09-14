export interface PdfResultTask {
  blob: Blob;
  name: string;
}

export const errorMessage = (error: unknown, fallback?: string) => {
  const message = error instanceof Error
    ? error.message
    : error === undefined || error === null ? '' : String(error);
  return message || fallback || String(error);
};
