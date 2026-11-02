import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { getContext } from "./integrations/tanstack-query/root-provider";
import { deLocalizeUrl, localizeUrl } from "./paraglide/runtime";

export function getRouter() {
  const context = getContext();

  const router = createTanStackRouter({
    context,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    rewrite: {
      input: ({ url }) => deLocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
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
