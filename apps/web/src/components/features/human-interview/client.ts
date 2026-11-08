import { createCoreClient } from "@ai-interview/core-client";
import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { atsKeys } from "../ats/query-keys";
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

export async function enterCandidateMeeting(token: string) {
  const response = await createCoreClient({ baseUrl: "" }).api["candidate-interviews"][
    ":token"
  ].meeting.entered.$post({ json: { version: 1 }, param: { token } });
  const result = await response.json();
  if ("error" in result) {
    throw new Error(result.error);
  }
  return result;
}

export async function enterInterviewerMeeting(workspaceId: string, id: string) {
  const response = await meetingApi.entered.$post({
    json: { version: 1 },
    param: { id, workspaceId },
  });
  const result = await response.json();
  if ("error" in result) {
    throw new Error(result.error);
  }
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
