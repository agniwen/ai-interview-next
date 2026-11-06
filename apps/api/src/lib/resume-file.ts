export const resumeFileExtension = /\.(?:pdf|jpe?g|png)$/iu;

export type ResumeImageType = "image/jpeg" | "image/png";
export type ResumeMediaType = "application/pdf" | ResumeImageType;

export function resumeMediaType(filename: string): ResumeMediaType {
  const extension = filename.trim().split(".").at(-1)?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }
  return extension === "png" ? "image/png" : "application/pdf";
}

export function matchesResumeMediaType(bytes: Uint8Array, mediaType: ResumeMediaType): boolean {
  if (mediaType === "application/pdf") {
    return new TextDecoder().decode(bytes.subarray(0, 1024)).includes("%PDF-");
  }
  if (mediaType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
    (byte, index) => bytes[index] === byte,
  );
}
