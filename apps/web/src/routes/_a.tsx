import { createFileRoute, redirect } from "@tanstack/react-router";
import { getWorkspaceSession } from "@/lib/workspaces/session.functions";

export const Route = createFileRoute("/_a")({
  beforeLoad: async ({ location }) => {
    const workspaceSession = await getWorkspaceSession();
    if (!workspaceSession) {
      throw redirect({ to: "/sign-in", search: { next: location.href } });
    }
    return { workspaceSession };
  },
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
});
