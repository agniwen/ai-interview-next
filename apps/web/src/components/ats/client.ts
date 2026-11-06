import { workspaceApi } from "@/lib/workspaces/client";
import { getLocale } from "@/paraglide/runtime";
import * as m from "@/paraglide/messages";

export const atsApi = workspaceApi.api.ats[":workspaceId"];

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
