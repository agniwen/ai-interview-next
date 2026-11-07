import {
  applicationDetailLinkOptions,
  resumeDetailLinkOptions,
} from "@/components/features/ats/detail-navigation";
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
  const detail = router.buildLocation(applicationDetailLinkOptions(workspaceId, id, search));

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

it("uses the resume link's native mask and supports direct visits with filters", async () => {
  const router = routerAt("/w/example/hub/resumes");
  await router.load();
  const query = { page: 4, pageSize: 50, search: "项目", status: "succeeded" as const };
  const detail = router.buildLocation(resumeDetailLinkOptions(workspaceId, id, query));
  ok(detail.maskedLocation);
  expect(detail.maskedLocation.pathname).toBe(`/w/example/hub/resumes/${id}`);
  expect(detail.maskedLocation.search).toEqual(query);
  expect(
    router.matchRoutes(detail.pathname, detail.search).map((match) => match.routeId),
  ).toContain("/_a/w/$workspaceId/hub/resumes");
  const direct = routerAt(detail.maskedLocation.href);
  await direct.load();
  expect(direct.state.matches.at(-1)?.routeId).toBe("/_a/w/$workspaceId/hub/resumes_/$id");
  expect(direct.state.location.search).toEqual(query);
});

it.each(["evaluation", "interviews"] as const)(
  "preserves the %s tab and list filters in masked links and after refresh",
  async (tab) => {
    const router = routerAt(`${listPath}?page=2&pageSize=10&search=Engineer&status=open`);
    await router.load();
    const detail = router.buildLocation(
      applicationDetailLinkOptions(workspaceId, id, { ...search, tab }),
    );
    ok(detail.maskedLocation);
    expect(detail.search).toEqual({ ...search, tab });
    expect(detail.maskedLocation.search).toEqual({ ...search, tab });

    const refreshed = routerAt(detail.maskedLocation.href);
    await refreshed.load();
    expect(refreshed.state.matches.at(-1)?.search).toEqual({ ...search, tab });
    const next = refreshed.buildLocation(
      applicationDetailLinkOptions(workspaceId, id, { ...search, tab: "overview" }),
    );
    expect(next.search).toEqual(search);
  },
);

it("defaults absent or unsupported tabs to overview at the route boundary", () => {
  const router = routerAt(detailPath);
  for (const tab of [undefined, "unsupported"]) {
    const matches = router.matchRoutes(detailPath, { ...search, tab });
    expect(matches.at(-1)?.search).toEqual({ ...search, tab: "overview" });
  }
});
