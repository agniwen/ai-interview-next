import type { interviewSession } from "@ai-interview/db/schema";
import { AccessToken, LiveKitAPI, TrackSource, ServerError } from "livekit-server-sdk";
import { z } from "zod";

export const meetingRoomConfiguration = z.object({
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  LIVEKIT_URL: z.url({ protocol: /^wss?$/u }),
});
export const interviewRoomConfiguration = meetingRoomConfiguration.extend({
  INTERVIEW_AGENT_API_URL: z.url({ protocol: /^https?$/u }),
  LIVEKIT_AGENT_NAME: z.string().min(1),
});
export type InterviewRoomConfiguration = z.output<typeof interviewRoomConfiguration>;

export async function dispatchHumanTranscription(
  config: InterviewRoomConfiguration,
  session: typeof interviewSession.$inferSelect,
) {
  const api = new LiveKitAPI({
    apiKey: config.LIVEKIT_API_KEY,
    failover: false,
    host: config.LIVEKIT_URL,
    requestTimeout: 8,
    secret: config.LIVEKIT_API_SECRET,
  });
  const dispatches = await api.agentDispatch.listDispatch(session.roomName);
  if (dispatches.some((dispatch) => dispatch.agentName === config.LIVEKIT_AGENT_NAME)) {
    return;
  }
  const contextUrl = new URL(
    `/api/interview-sessions/${session.interviewRoundId}/transcription`,
    config.INTERVIEW_AGENT_API_URL,
  ).toString();
  await api.agentDispatch.createDispatch(session.roomName, config.LIVEKIT_AGENT_NAME, {
    metadata: JSON.stringify({
      contextToken: session.contextToken,
      contextUrl,
      mode: "human_transcription",
      version: 1,
    }),
  });
}

/** 供应商协议只存在于此边界，候选人只能获得所属房间的媒体权限。
 * Vendor protocols stay at this boundary; candidates receive media grants for their own room only. */
export async function connectInterviewRoom(
  config: InterviewRoomConfiguration,
  session: typeof interviewSession.$inferSelect,
) {
  const api = new LiveKitAPI({
    apiKey: config.LIVEKIT_API_KEY,
    host: config.LIVEKIT_URL,
    secret: config.LIVEKIT_API_SECRET,
  });
  await api.room.createRoom({ name: session.roomName });
  const dispatches = await api.agentDispatch.listDispatch(session.roomName);
  if (!dispatches.some((dispatch) => dispatch.agentName === config.LIVEKIT_AGENT_NAME)) {
    const contextUrl = new URL(
      `/api/interview-sessions/${session.interviewRoundId}/context`,
      config.INTERVIEW_AGENT_API_URL,
    ).toString();
    await api.agentDispatch.createDispatch(session.roomName, config.LIVEKIT_AGENT_NAME, {
      // 服务端调度元数据不会进入浏览器令牌，提示词和私有材料通过专属上下文接口读取。
      // Server dispatch metadata never enters browser tokens; prompts and private materials come from the dedicated context endpoint.
      metadata: JSON.stringify({ contextToken: session.contextToken, contextUrl, version: 1 }),
    });
  }
  const token = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
    identity: `candidate-${session.interviewRoundId}`,
    name: session.content.candidate.name,
    ttl: "15m",
  });
  token.addGrant({
    canPublish: true,
    canPublishData: true,
    canPublishSources: [TrackSource.MICROPHONE, TrackSource.CAMERA],
    canSubscribe: true,
    canUpdateOwnMetadata: false,
    room: session.roomName,
    roomJoin: true,
  });
  return {
    participantToken: await token.toJwt(),
    serverUrl: config.LIVEKIT_URL,
    version: 1 as const,
  };
}

export async function closeInterviewRoom(
  config: z.output<typeof meetingRoomConfiguration>,
  roomName: string,
) {
  const api = new LiveKitAPI({
    apiKey: config.LIVEKIT_API_KEY,
    host: config.LIVEKIT_URL,
    secret: config.LIVEKIT_API_SECRET,
  });
  try {
    await api.room.deleteRoom(roomName);
  } catch (error) {
    // 已关闭的房间视为清理完成，允许重试正式结束。
    // An already-closed room counts as cleaned up, allowing completion retries.
    if (!(error instanceof ServerError && error.code === "not_found")) {
      throw error;
    }
  }
}

export async function connectHumanMeeting(
  config: z.output<typeof meetingRoomConfiguration>,
  session: { roomName: string; startedAt: Date | null },
  participant: { identity: string; name: string; role: "candidate" | "interviewer" },
) {
  // 真人会议使用默认房间配置，由首位参会者入场时自动创建。
  // Human meetings use default room settings, so the first participant creates the room on join.
  const token = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
    attributes: { role: participant.role },
    identity: participant.identity,
    name: participant.name,
    ttl: "5m",
  });
  token.addGrant({
    canPublish: true,
    canPublishData: true,
    canPublishSources: [
      TrackSource.MICROPHONE,
      TrackSource.CAMERA,
      TrackSource.SCREEN_SHARE,
      TrackSource.SCREEN_SHARE_AUDIO,
    ],
    canSubscribe: true,
    canUpdateOwnMetadata: false,
    room: session.roomName,
    roomJoin: true,
  });
  return {
    participantToken: await token.toJwt(),
    serverUrl: config.LIVEKIT_URL,
    startedAt: session.startedAt,
    version: 1 as const,
  };
}
