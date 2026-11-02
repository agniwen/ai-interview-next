import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => env.API.fetch(request),
      POST: ({ request }) => env.API.fetch(request),
    },
  },
});
