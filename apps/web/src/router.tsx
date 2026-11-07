import { createRouteMask, createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { getContext } from "./integrations/tanstack-query/root-provider";
import { skeletonMinVisibleMs } from "@/hooks/use-skeleton-phase";

const applicationDetailMask = createRouteMask({
  from: "/w/$workspaceId/hub/applications/overlay/$id",
  params: true,
  routeTree,
  search: true,
  to: "/w/$workspaceId/hub/applications/$id",
  unmaskOnReload: true,
});

const resumeProcessingMask = createRouteMask({
  from: "/w/$workspaceId/hub/resumes/overlay/$id",
  params: true,
  routeTree,
  search: true,
  to: "/w/$workspaceId/hub/resumes/$id",
  unmaskOnReload: true,
});

export function getRouter() {
  const context = getContext();

  const router = createTanStackRouter({
    context,
    defaultPendingMinMs: skeletonMinVisibleMs,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    routeMasks: [applicationDetailMask, resumeProcessingMask],
    routeTree,
    scrollRestoration: true,
  });

  setupRouterSsrQueryIntegration({ queryClient: context.queryClient, router });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
