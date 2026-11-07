import { questionSetEditorLinkOptions } from "@/components/features/question-sets/navigation";
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

it.each([
  { id: "new", kind: "form" },
  { id: "new", kind: "conversation" },
  { id: "set-id", kind: "form" },
  { id: "set-id", kind: "conversation" },
] as const)(
  "opens $kind editor $id with a standalone URL and retained list filters",
  async ({ id, kind }) => {
    const search = { kind, page: 3, pageSize: 50, search: "项目" };
    const listPath = "/w/example/hub/questions";
    const router = routerAt(listPath);
    await router.load();
    const editor = router.buildLocation(questionSetEditorLinkOptions("example", id, search));
    ok(editor.maskedLocation);
    expect(editor.maskedLocation.pathname).toBe(`${listPath}/${id}`);
    expect(editor.maskedLocation.search).toEqual(search);
    expect(
      router.matchRoutes(editor.pathname, editor.search).map((match) => match.routeId),
    ).toContain("/_a/w/$workspaceId/hub/questions");

    const direct = routerAt(editor.maskedLocation.href);
    await direct.load();
    expect(direct.state.matches.at(-1)?.routeId).toBe("/_a/w/$workspaceId/hub/questions_/$id");
    expect(direct.state.location.search).toEqual(search);
    expect(direct.state.matches.map((match) => match.routeId)).not.toContain(
      "/_a/w/$workspaceId/hub/questions",
    );
  },
);
