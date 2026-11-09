import { createCoreClient } from "@ai-interview/core-client";
import { z } from "zod";

export const workspaceApi = createCoreClient({ baseUrl: "" });

export const loginSearch = z.object({
  error: z.string().optional(),
  next: z
    .string()
    .regex(/^\/(?:w\/|invite\/|meet\/|mcp\/authorize(?:[?#]|$)|(?:workspaces|account)(?:[?#]|$))/u)
    .optional()
    .catch(undefined),
});
