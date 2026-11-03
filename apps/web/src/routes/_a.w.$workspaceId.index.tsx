import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_a/w/$workspaceId/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/w/$workspaceId/agent", params });
  },
});
