import { PDFDocument } from 'pdf-lib';

/**
 * Strips all identifying metadata (Title, Author, Subject, Keywords, Creator, Producer, Dates) from a PDF
 */
export const removePdfMetadata = async (file: File): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  pdf.setTitle('');
  pdf.setAuthor('');
  pdf.setSubject('');
  pdf.setKeywords([]);
  pdf.setProducer('');
  pdf.setCreator('');
  pdf.setCreationDate(new Date(0));
  pdf.setModificationDate(new Date(0));
  const pdfBytes = await pdf.save({ useObjectStreams: true });
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
};

