import { jobEditorLinkOptions } from "@/components/features/ats/job-navigation";
import { ok } from "node:assert/strict";
import { createMemoryHistory } from "@tanstack/react-router";
import { expect, it, vi } from "vitest";
import { workspaceSessionQueryOptions } from "@/lib/workspaces/session-query";
import { getRouter } from "@/router";

vi.mock("cloudflare:workers", () => ({ env: {} }));

function routerAt(path: string) {
  const router = getRouter();
  router.update({
    context: router.options.context,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  router.options.context.queryClient.setQueryData(workspaceSessionQueryOptions.queryKey, () => ({
    lastWorkspaceId: "example",
    workspaces: [{ id: "example", name: "Example", role: "owner" }],
  }));
  return router;
}

it.each(["new", "job-id"])("opens job editor %s with masking and retained filters", async (id) => {
  const search = {
    page: 3,
    pageSize: 50,
    projectId: "00000000-0000-4000-8000-000000000001",
    search: "工程",
  };
  const listPath = "/w/example/hub/jobs";
  const router = routerAt(listPath);
  await router.load();
  const editor = router.buildLocation(jobEditorLinkOptions("example", id, search));
  ok(editor.maskedLocation);
  expect(editor.maskedLocation.pathname).toBe(`${listPath}/${id}`);
  expect(editor.maskedLocation.search).toEqual(search);
  expect(
    router.matchRoutes(editor.pathname, editor.search).map((match) => match.routeId),
  ).toContain("/_a/w/$workspaceId/hub/jobs");

  const direct = routerAt(editor.maskedLocation.href);
  await direct.load();
  expect(direct.state.matches.at(-1)?.routeId).toBe("/_a/w/$workspaceId/hub/jobs_/$id");
  expect(direct.state.location.search).toEqual(search);
  expect(direct.state.matches.map((match) => match.routeId)).not.toContain(
    "/_a/w/$workspaceId/hub/jobs",
  );
});
