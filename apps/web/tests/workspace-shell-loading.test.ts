import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/_a";
import { workspaceSessionQueryOptions } from "@/lib/workspaces/session-query";
import { getWorkspaceSession } from "@/lib/workspaces/session.functions";

vi.mock("@/lib/workspaces/session.functions", () => ({
  getWorkspaceSession: vi.fn().mockResolvedValue({ lastWorkspaceId: null, workspaces: [] }),
}));

describe("workspace shell navigation", () => {
  it("reuses the session across Agent, Hub and chat navigation", async () => {
    vi.mocked(getWorkspaceSession).mockClear();
    const queryClient = new QueryClient();
    const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
    const authenticated = createRoute({
      beforeLoad: Route.options.beforeLoad,
      getParentRoute: () => root,
      id: "authenticated",
    });
    const agent = createRoute({ getParentRoute: () => authenticated, path: "/agent" });
    const hub = createRoute({ getParentRoute: () => authenticated, path: "/hub" });
    const router = createRouter({
      context: { queryClient },
      history: createMemoryHistory({ initialEntries: ["/agent"] }),
      routeTree: root.addChildren([authenticated.addChildren([agent, hub])]),
    });
    await router.load();
    router.history.push("/hub");
    await router.load();
    router.history.push("/agent?session=chat");
    await router.load();
    expect(getWorkspaceSession).toHaveBeenCalledTimes(1);
    await queryClient.invalidateQueries({ queryKey: workspaceSessionQueryOptions.queryKey });
    await router.invalidate();
    expect(getWorkspaceSession).toHaveBeenCalledTimes(2);
    queryClient.clear();
  });
});
