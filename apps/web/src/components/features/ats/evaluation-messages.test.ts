import { expect, it } from "vitest";
import { evaluationMessages } from "./evaluation-messages";
import type { ApplicationDetail } from "./application-detail-page";

function ai(id: string, createdAt: string): ApplicationDetail["evaluations"][number] {
  return {
    applicationId: "application",
    createdAt,
    id,
    internalCriteriaSnapshot: "",
    jobRequirementsSnapshot: "APIs",
    result: {
      conciseOverall: id,
      detailedOverall: { judgment: id, matchingEvidence: [], risks: [] },
      recommendationLevel: "recommended",
      version: 3,
    },
    resumeId: "resume",
    workspaceId: "workspace",
  };
}
function human(id: string, createdAt: string): ApplicationDetail["feedback"][number] {
  return { authorId: id, authorImage: null, authorName: id, body: id, createdAt, id };
}

it("keeps one fixed AI message with all versions before chronological member feedback", () => {
  const evaluations = [ai("second", "2026-11-07T12:00:00Z"), ai("first", "2026-11-07T10:00:00Z")];
  const feedback = [
    human("later", "2026-11-07T13:00:00Z"),
    human("early", "2026-11-07T09:00:00Z"),
    human("middle", "2026-11-07T11:00:00Z"),
  ];
  const messages = evaluationMessages(evaluations, feedback);
  expect(messages.map(({ id }) => id)).toEqual(["ai-evaluation", "early", "middle", "later"]);
  expect(messages[0]).toMatchObject({ kind: "ai", versions: [evaluations[1], evaluations[0]] });
  expect(evaluations.map(({ id }) => id)).toEqual(["second", "first"]);
  expect(feedback.map(({ id }) => id)).toEqual(["later", "early", "middle"]);
});

it("retains member feedback while the first AI evaluation is pending and uses IDs to break time ties", () => {
  expect(
    evaluationMessages(
      [],
      [human("b", "2026-11-07T10:00:00Z"), human("a", "2026-11-07T10:00:00Z")],
    ).map(({ id }) => id),
  ).toEqual(["ai-evaluation", "a", "b"]);
  expect(evaluationMessages([], [])[0]).toEqual({ id: "ai-evaluation", kind: "ai", versions: [] });
});

it("adds a new version to the fixed message without appending another AI message", () => {
  const first = ai("first", "2026-11-07T10:00:00Z");
  const second = ai("second", "2026-11-07T11:00:00Z");
  const feedback = [human("member", "2026-11-07T10:30:00Z")];
  const before = evaluationMessages([first], feedback);
  const after = evaluationMessages([second, first], feedback);
  expect(after.map(({ id }) => id)).toEqual(before.map(({ id }) => id));
  expect(after[0]).toMatchObject({ versions: [first, second] });
  expect(after[1]).toEqual(before[1]);
});

it("orders versions with identical timestamps by ID", () => {
  const first = ai("a", "2026-11-07T10:00:00Z");
  const second = ai("b", "2026-11-07T10:00:00Z");
  expect(evaluationMessages([second, first], [])[0]).toMatchObject({ versions: [first, second] });
});
