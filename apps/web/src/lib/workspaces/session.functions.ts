import { createCoreClient } from "@ai-interview/core-client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const getWorkspaceSession = createServerFn({ method: "GET" }).handler(async () => {
  const { env } = await import("cloudflare:workers");
  const request = getRequest();
  const client = createCoreClient({
    baseUrl: new URL(request.url).origin,
    fetch: (input, init) =>
      env.API.fetch(
        new Request(input, {
          ...init,
          headers: { cookie: request.headers.get("cookie") ?? "" },
        }),
      ),
  });
  const result = await client.api.workspaces.$get();
  const response: Response = result;
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error("Unable to load workspaces");
  }
  return result.json();
});
