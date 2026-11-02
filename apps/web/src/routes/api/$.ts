import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      ANY: ({ request }) => env.API.fetch(request),
    },
  },
});
