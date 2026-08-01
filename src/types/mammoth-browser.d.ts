declare module 'mammoth/mammoth.browser' {
  interface ConversionResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  interface BrowserInput {
    arrayBuffer: ArrayBuffer;
  }

  const mammoth: {
    extractRawText(input: BrowserInput): Promise<ConversionResult>;
    convertToHtml(input: BrowserInput): Promise<ConversionResult>;
  };

  export default mammoth;
}
