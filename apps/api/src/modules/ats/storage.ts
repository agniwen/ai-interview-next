import { FilesError, createFiles } from "files-sdk";
import { r2 } from "files-sdk/r2";
import type { ApiBindings } from "../../env";
import type { ResumeObjectStore } from "./contracts";

export function resumeFiles(env: ApiBindings) {
  return createFiles({
    adapter: r2({
      accessKeyId: env.RESUME_S3_ACCESS_KEY_ID,
      binding: env.RESUME_FILES,
      bucket: "sainoa-resumes",
      endpoint: env.RESUME_S3_ENDPOINT,
      secretAccessKey: env.RESUME_S3_SECRET_ACCESS_KEY,
    }),
  });
}

export function resumeObjectStore(env: ApiBindings, uploadPath = ""): ResumeObjectStore {
  const files = resumeFiles(env);
  return {
    async head(objectKey) {
      try {
        return await files.head(objectKey);
      } catch (error) {
        if (error instanceof FilesError && error.code === "NotFound") {
          return null;
        }
        throw error;
      }
    },
    async read(objectKey) {
      const file = await files.download(objectKey, { as: "stream" });
      return new Uint8Array(await new Response(file.stream()).arrayBuffer());
    },
    async signUpload(objectKey, contentType) {
      if (!files.capabilities.signedUpload.supported) {
        return `${uploadPath}/${objectKey.split("/").at(-1)}`;
      }
      const { url } = await files.signedUploadUrl(objectKey, { contentType, expiresIn: 900 });
      return url;
    },
    async write(objectKey, bytes, contentType) {
      await files.upload(objectKey, bytes, { contentType });
    },
  };
}
