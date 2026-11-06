import { queryOptions } from "@tanstack/react-query";
import { workspaceApi } from "@/lib/workspaces/client";
import { getLocale } from "@/paraglide/runtime";
import * as m from "@/paraglide/messages";
import { atsKeys } from "./query-keys";

export const atsApi = workspaceApi.api.ats[":workspaceId"];

export function getResumeCandidateDisplay(
  workspaceId: string,
  {
    candidateAvatarResumeId,
    candidateName,
  }: {
    candidateAvatarResumeId: string | null;
    candidateName: string | null;
  },
) {
  if (!candidateName && !candidateAvatarResumeId) {
    return null;
  }
  return {
    image: candidateAvatarResumeId
      ? atsApi.resumes[":id"].avatar.$path({ param: { id: candidateAvatarResumeId, workspaceId } })
      : undefined,
    name: candidateName ?? "—",
  };
}

interface AtsResponse {
  ok: boolean;
  json: () => Promise<unknown>;
}

export function readAts<T extends AtsResponse>(
  response: T,
): ReturnType<Exclude<T, { ok: false }>["json"]> {
  if (!response.ok) {
    throw new Error(m.ats_error());
  }
  return response.json() as ReturnType<Exclude<T, { ok: false }>["json"]>;
}

export async function readResumeProfile(param: { id: string; workspaceId: string }) {
  return readAts(await atsApi.uploads[":id"].profile.$get({ param }));
}

export function jobDetailsQuery(workspaceId: string, id: string) {
  return queryOptions({
    queryFn: async ({ signal }) =>
      readAts(await atsApi.jobs[":id"].$get({ param: { id, workspaceId } }, { init: { signal } })),
    queryKey: atsKeys.jobs(workspaceId)._ctx.detail(id).queryKey,
    staleTime: 30_000,
  });
}

export function projectDetailsQuery(workspaceId: string, id: string) {
  return queryOptions({
    queryFn: async ({ signal }) =>
      readAts(
        await atsApi.projects[":id"].$get({ param: { id, workspaceId } }, { init: { signal } }),
      ),
    queryKey: atsKeys.projects(workspaceId)._ctx.detail(id).queryKey,
    staleTime: 30_000,
  });
}

export function atsDate(value: string | Date, timeStyle?: "short") {
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeStyle }).format(
    new Date(value),
  );
}

export function atsStatus(status: string | null) {
  switch (status) {
    case "waiting": {
      return m.ats_waiting();
    }
    case "queued": {
      return m.ats_queued();
    }
    case "running": {
      return m.ats_running();
    }
    case "succeeded": {
      return m.ats_ready();
    }
    case "skipped": {
      return m.ats_skipped();
    }
    case "upload_failed":
    case "failed": {
      return m.ats_failed();
    }
    default: {
      return "—";
    }
  }
}
