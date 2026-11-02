import type { ComposerPart, ComposerValue } from "./composer-document";

export const COMPOSER_CLIPBOARD_TYPE = "application/x-coss-composer";

export function parseComposerClipboard(raw: string): ComposerValue | null {
  if (!raw || raw.length > 100_000) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length > 1000) {
      return null;
    }
    const parts: ComposerPart[] = [];
    for (const part of value) {
      if (!part || typeof part !== "object") {
        return null;
      }
      if (part.type === "text" && typeof part.text === "string") {
        parts.push({ text: part.text, type: "text" });
        continue;
      }
      if (
        (part.type !== "mention" && part.type !== "action") ||
        typeof part.id !== "string" ||
        typeof part.label !== "string" ||
        typeof part.trigger !== "string"
      ) {
        return null;
      }
      parts.push({
        id: part.id,
        label: part.label,
        trigger: part.trigger,
        type: part.type,
        ...(typeof part.kind === "string" ? { kind: part.kind } : {}),
        ...(typeof part.data === "string" ? { data: part.data } : {}),
        ...(typeof part.text === "string" ? { text: part.text } : {}),
      });
    }
    return parts;
  } catch {
    return null;
  }
}
