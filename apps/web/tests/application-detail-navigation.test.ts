import { ok } from "node:assert/strict";
import { createMemoryHistory } from "@tanstack/react-router";
import { expect, it, vi } from "vitest";
import { workspaceSessionQueryOptions } from "@/lib/workspaces/session-query";
import { getRouter } from "@/router";

vi.mock("cloudflare:workers", () => ({ env: {} }));

const workspaceId = "example";
const id = "eb5555dc-0987-49a2-857c-f7c146252772";
const listPath = "/w/example/hub/applications";
const detailPath = `${listPath}/${id}`;
const search = { page: 2, pageSize: 10, search: "Engineer", status: "open" } as const;

function routerAt(path: string) {
  const router = getRouter();
  router.update({
    context: router.options.context,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  router.options.context.queryClient.setQueryData(workspaceSessionQueryOptions.queryKey, () => ({
    lastWorkspaceId: workspaceId,
    workspaces: [{ id: workspaceId, name: "Example", role: "owner" }],
  }));
  return router;
}

it("builds a shareable detail URL and carries the list search through both routes", async () => {
  const listUrl = `${listPath}?page=2&pageSize=10&search=Engineer&status=open`;
  const router = routerAt(listUrl);
  await router.load();
  const detail = router.buildLocation({
    params: { id, workspaceId },
    search,
    to: "/w/$workspaceId/hub/applications/overlay/$id",
  });

  ok(detail.maskedLocation);
  expect(detail.maskedLocation.pathname).toBe(detailPath);
  expect(
    router.matchRoutes(detail.pathname, detail.search).map((match) => match.routeId),
  ).toContain("/_a/w/$workspaceId/hub/applications");
  expect(detail.search).toEqual(search);

  const directRouter = routerAt(detail.maskedLocation.href);
  await directRouter.load();
  expect(directRouter.state.matches.at(-1)?.routeId).toBe(
    "/_a/w/$workspaceId/hub/applications_/$id",
  );
  expect(directRouter.state.location.search).toEqual(search);
});
