export type PdfTextExtractor = (pdf: Uint8Array) => Promise<{ text: string }>;
