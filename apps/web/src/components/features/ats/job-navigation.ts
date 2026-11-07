import { linkOptions } from "@tanstack/react-router";
import type { JobListSearch } from "./list-search";

export function jobEditorLinkOptions(workspaceId: string, id: string, search: JobListSearch) {
  return linkOptions({
    mask: {
      params: { id, workspaceId },
      search,
      to: "/w/$workspaceId/hub/jobs/$id",
    },
    params: { id, workspaceId },
    search,
    to: "/w/$workspaceId/hub/jobs/overlay/$id",
    unmaskOnReload: true,
  });
}
