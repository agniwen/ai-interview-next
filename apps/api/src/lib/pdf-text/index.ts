import type { ResumeMediaType } from "../resume-file";

export type PdfTextExtractor = (
  document: Uint8Array,
  mediaType?: ResumeMediaType,
) => Promise<{ text: string }>;
