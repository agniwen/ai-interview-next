import { createDatabase } from "@ai-interview/db";
import { Hono } from "hono";
import { z } from "zod";
import type { ApiBindings } from "../../env";
import { matchesResumeMediaType } from "../../lib/resume-file";
import { findExternalUpload } from "../ats/external-resumes";
import { resumeFiles, resumeObjectStore } from "../ats/storage";

const localUploadPath = "/api/mcp-files";
const encoder = new TextEncoder();

function uploadKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign", "verify"],
  );
}

export function externalResumeStorage(env: ApiBindings) {
  const storage = resumeObjectStore(env);
  if (resumeFiles(env).capabilities.signedUpload.supported) {
    return storage;
  }
  return {
    ...storage,
    async signUpload(objectKey: string) {
      const id = objectKey.slice(objectKey.lastIndexOf("/") + 1);
      const expires = Math.floor(Date.now() / 1000) + 900;
      const url = new URL(`${localUploadPath}/${id}`, env.BETTER_AUTH_URL);
      const signature = await crypto.subtle.sign(
        "HMAC",
        await uploadKey(env.BETTER_AUTH_SECRET),
        encoder.encode(`sainoa-resume-upload:${id}:${expires}`),
      );
      url.searchParams.set("expires", String(expires));
      url.searchParams.set(
        "signature",
        btoa(String.fromCodePoint(...new Uint8Array(signature)))
          .replaceAll("+", "-")
          .replaceAll("/", "_")
          .replace(/[=]+$/u, ""),
      );
      return url.href;
    },
  };
}

const signedUpload = z.object({
  expires: z.coerce.number().int().positive(),
  signature: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
});

export const mcpFileRoutes = new Hono<{ Bindings: ApiBindings }>().put("/:id", async (c) => {
  const input = signedUpload.safeParse(c.req.query());
  const id = c.req.param("id");
  if (!input.success || input.data.expires < Math.floor(Date.now() / 1000)) {
    return c.json({ error: "UPLOAD_EXPIRED", version: 1 as const }, 403);
  }
  const { expires, signature } = input.data;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await uploadKey(c.env.BETTER_AUTH_SECRET),
    Uint8Array.from(
      atob(signature.replaceAll("-", "+").replaceAll("_", "/")),
      (char) => char.codePointAt(0) ?? 0,
    ),
    encoder.encode(`sainoa-resume-upload:${id}:${expires}`),
  );
  if (!valid) {
    return c.json({ error: "UPLOAD_EXPIRED", version: 1 as const }, 403);
  }
  const upload = await findExternalUpload(createDatabase(c.env.AUTH_DB), id);
  if (upload?.file.status !== "waiting") {
    return c.json({ error: "UPLOAD_UNAVAILABLE", version: 1 as const }, 404);
  }
  if (
    c.req.header("content-type") !== "application/pdf" ||
    Number(c.req.header("content-length")) !== upload.file.size
  ) {
    return c.json({ error: "INVALID_PDF", version: 1 as const }, 400);
  }
  const bytes = await c.req.arrayBuffer();
  if (
    bytes.byteLength !== upload.file.size ||
    !matchesResumeMediaType(new Uint8Array(bytes), "application/pdf")
  ) {
    return c.json({ error: "INVALID_PDF", version: 1 as const }, 400);
  }
  await resumeObjectStore(c.env).write(upload.file.objectKey, bytes, "application/pdf");
  return c.body(null, 204);
});
