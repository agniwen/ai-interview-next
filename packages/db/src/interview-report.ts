/** 题目及采集点在开场前固定；语音实现只负责提供对话和证据。
 * Freeze questions and collection points before greeting; voice implementations supply conversation and evidence. */
export interface InterviewPlan {
  version: 1;
  questions: {
    id: string;
    code: string;
    content: string;
    points: { id: string; label: string }[];
  }[];
}

export interface InterviewTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: number;
  interrupted: boolean;
  speakerName?: string | null;
}

export interface InterviewEvidence {
  turnId: string;
  quote: string;
}

export interface InterviewProgress {
  version: 1;
  revision: number;
  answers: {
    pointId: string;
    status: "answered" | "declined" | "unknown" | "insufficient";
    summary: string;
    evidence: InterviewEvidence[];
  }[];
  asked: { questionId: string; evidence: InterviewEvidence[] }[];
  summary: string;
  endReason: "completed" | "candidate_requested" | "interrupted" | null;
  finalized: boolean;
  usage: { inputTokens: number; cachedInputTokens: number; outputTokens: number };
}

export interface CandidateInterviewFeedback {
  version: 1;
  rating: number;
  comment: string;
  submittedAt: string;
}

export const interviewEventKinds = [
  "agent_started",
  "agent_resumed",
  "agent_ready",
  "agent_closed",
  "system_error",
  "candidate_connected",
  "candidate_disconnected",
  "candidate_left",
  "room_reconnecting",
  "room_reconnected",
  "room_disconnected",
  "realtime_reconnecting",
  "realtime_reconnected",
  "realtime_rotated",
  "realtime_failed",
  "interview_ended",
  "report_ready",
  "report_failed",
] as const;

export interface InterviewEventContent {
  version: 1;
  kind: (typeof interviewEventKinds)[number];
  reason: string | null;
  attempt: number | null;
  recoverable: boolean | null;
}

export interface InterviewEventInput {
  id: string;
  runId: string;
  at: number;
  content: InterviewEventContent;
}
