import { linkOptions } from "@tanstack/react-router";
import type { ApplicationListSearch, ResumeListSearch } from "./list-search";

export function applicationDetailLinkOptions(
  workspaceId: string,
  id: string,
  search: ApplicationListSearch,
) {
  return linkOptions({
    mask: {
      params: { id, workspaceId },
      search,
      to: "/w/$workspaceId/hub/applications/$id",
    },
    params: { id, workspaceId },
    search,
    to: "/w/$workspaceId/hub/applications/overlay/$id",
    unmaskOnReload: true,
  });
}

export function resumeDetailLinkOptions(workspaceId: string, id: string, search: ResumeListSearch) {
  return linkOptions({
    mask: {
      params: { id, workspaceId },
      search,
      to: "/w/$workspaceId/hub/resumes/$id",
    },
    params: { id, workspaceId },
    search,
    to: "/w/$workspaceId/hub/resumes/overlay/$id",
    unmaskOnReload: true,
  });
}
