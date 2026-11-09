import { createCoreClient } from "@ai-interview/core-client";
import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { atsKeys } from "../ats/query-keys";
import { candidateInterviewQuery } from "../candidate-interview/client";
import { interviewKeys, interviewsApi } from "../interviews/client";

const meetingApi = interviewsApi[":id"].meeting;

async function readMeeting(workspaceId: string, id: string, signal: AbortSignal) {
  const response = await meetingApi.$get({ param: { id, workspaceId } }, { init: { signal } });
  const result = await response.json();
  if ("error" in result) {
    throw new Error(result.error);
  }
  return result;
}

export function meetingQuery(workspaceId: string, id: string) {
  return queryOptions({
    queryFn: ({ signal }) => readMeeting(workspaceId, id, signal),
    queryKey: interviewKeys.workspace(workspaceId)._ctx.meeting(id).queryKey,
    refetchInterval: 15_000,
    retry: false,
  });
}

export type HumanMeeting = Awaited<ReturnType<typeof readMeeting>>;

export async function joinInterviewerMeeting(workspaceId: string, id: string) {
  const response = await meetingApi.$post({ json: { version: 1 }, param: { id, workspaceId } });
  const result = await response.json();
  if ("error" in result) {
    throw new Error(result.error);
  }
  return result;
}

export async function joinCandidateMeeting(token: string) {
  const response = await createCoreClient({ baseUrl: "" }).api["candidate-interviews"][
    ":token"
  ].meeting.$post({ json: { version: 1 }, param: { token } });
  const result = await response.json();
  if ("error" in result) {
    throw new Error(result.error);
  }
  return result;
}

export type MeetingConnection = Awaited<ReturnType<typeof joinCandidateMeeting>>;

export class MeetingEnteredError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MeetingEnteredError";
    this.status = status;
  }
}

export async function enterCandidateMeeting(client: QueryClient, token: string) {
  const response = await createCoreClient({ baseUrl: "" }).api["candidate-interviews"][
    ":token"
  ].meeting.entered.$post({ json: { version: 1 }, param: { token } });
  const result = await response.json();
  if ("error" in result) {
    throw new MeetingEnteredError(result.error ?? "INTERVIEW_CONNECTION_FAILED", response.status);
  }
  void client.invalidateQueries({ queryKey: candidateInterviewQuery(token).queryKey });
  return result;
}

export type MeetingEntry = Awaited<ReturnType<typeof enterCandidateMeeting>>;

export async function enterInterviewerMeeting(
  client: QueryClient,
  { workspaceId, id, applicationId }: HumanMeeting["round"],
) {
  const response = await meetingApi.entered.$post({
    json: { version: 1 },
    param: { id, workspaceId },
  });
  const result = await response.json();
  if ("error" in result) {
    throw new MeetingEnteredError(result.error ?? "INTERVIEW_CONNECTION_FAILED", response.status);
  }
  void Promise.all([
    client.invalidateQueries({ queryKey: interviewKeys.workspace(workspaceId).queryKey }),
    client.invalidateQueries({
      queryKey: atsKeys.applications(workspaceId)._ctx.detail(applicationId).queryKey,
    }),
  ]);
  return result;
}

export function endMeetingMutation(
  client: QueryClient,
  workspaceId: string,
  id: string,
  applicationId: string,
) {
  return mutationOptions({
    mutationFn: async () => {
      const response = await meetingApi.end.$post({
        json: { version: 1 },
        param: { id, workspaceId },
      });
      const result = await response.json();
      if ("error" in result) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: interviewKeys.workspace(workspaceId).queryKey }),
        client.invalidateQueries({
          queryKey: atsKeys.applications(workspaceId)._ctx.detail(applicationId).queryKey,
        }),
      ]);
    },
  });
}
