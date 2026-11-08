import { describe, expect, it } from "vitest";
import { interviewRuntimeState } from "../src/components/features/interviews/runtime-log";
import type { InterviewResult } from "../src/components/features/interviews/client";

type Kind = InterviewResult["events"][number]["content"]["kind"];
function state(kinds: Kind[], status = "in_progress") {
  return interviewRuntimeState({
    events: kinds.map((kind) => ({
      content: {
        attempt: null,
        kind,
        reason: null,
        recoverable: null,
        version: 1,
      },
    })),
    round: { status },
  });
}

describe("interview runtime status", () => {
  it("keeps interruption distinct from formal completion", () => {
    expect(state(["agent_ready", "realtime_failed", "system_error"])).toBe("interrupted");
    expect(state(["agent_ready", "realtime_failed", "agent_closed"], "completed")).toBe(
      "completed",
    );
  });
  it("resumes only the recovered connection layer", () => {
    expect(state(["realtime_failed", "room_reconnected"])).toBe("interrupted");
    expect(state(["agent_ready", "room_disconnected", "realtime_reconnected"])).toBe("interrupted");
    expect(state(["agent_ready", "room_reconnecting"])).toBe("reconnecting");
    expect(state(["agent_ready", "room_reconnecting", "room_reconnected"])).toBe("active");
    expect(state(["realtime_failed", "agent_resumed", "candidate_connected", "agent_ready"])).toBe(
      "active",
    );
  });
  it("preserves an intentional leave through transport disconnect events", () => {
    expect(
      state(["agent_ready", "candidate_left", "room_disconnected", "candidate_disconnected"]),
    ).toBe("paused");
    expect(
      state(["agent_ready", "candidate_left", "candidate_disconnected", "candidate_connected"]),
    ).toBe("active");
  });
});
