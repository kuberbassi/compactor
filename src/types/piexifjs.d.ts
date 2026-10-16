declare module 'piexifjs' {
  const piexif: any;
  export default piexif;
  export const version: string;
  export const remove: (jpeg: string) => string;
  export const insert: (exif: string, jpeg: string) => string;
  export const load: (data: string) => any;
  export const dump: (exifObj: any) => string;
  export const TAGS: any;
  export const ImageIFD: any;
  export const ExifIFD: any;
  export const GPSIFD: any;
  export const InteropIFD: any;
  export const GPSHelper: any;
}

