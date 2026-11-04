import { WorkspacesPageSkeleton } from "@/components/skeletons/pages/workspaces-page-skeleton";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { workspaceSessionQueryOptions } from "@/lib/workspaces/session-query";

export const Route = createFileRoute("/_a")({
  pendingComponent: WorkspacesPageSkeleton,
  beforeLoad: async ({ context, location }) => {
    const workspaceSession = await context.queryClient.fetchQuery(workspaceSessionQueryOptions);
    if (!workspaceSession) {
      throw redirect({ to: "/sign-in", search: { next: location.href } });
    }
    return { workspaceSession };
  },
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
});
