import { linkOptions } from "@tanstack/react-router";
import type { QuestionSetListSearch } from "./list-search";

export function questionSetEditorLinkOptions(
  workspaceId: string,
  id: string,
  search: QuestionSetListSearch,
) {
  return linkOptions({
    mask: {
      params: { id, workspaceId },
      search,
      to: "/w/$workspaceId/hub/questions/$id",
    },
    params: { id, workspaceId },
    search,
    to: "/w/$workspaceId/hub/questions/overlay/$id",
    unmaskOnReload: true,
  });
}
