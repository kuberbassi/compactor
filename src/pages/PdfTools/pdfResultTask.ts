export interface PdfResultTask {
  blob: Blob;
  name: string;
}

export const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
