import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { HumanInterviewPreparation } from "../src/components/features/candidate-interview/human-preparation";
import { MeetingError } from "../src/components/features/human-interview/error";
import { loginSearch } from "../src/lib/workspaces/client";
import * as m from "../src/paraglide/messages";

const interview = {
  admissionDeadline: "2026-11-09T03:00:00Z",
  candidateName: "Candidate",
  jobDescription: "Public requirements",
  jobTitle: "Engineer",
  label: "Technical interview",
  scheduledAt: "2026-11-09T02:00:00Z",
  sequence: 1,
  startedAt: null,
  workspaceName: "Hiring team",
};

afterEach(() => vi.restoreAllMocks());

it("keeps the appointment visible before admission and disables preparation until the window opens", () => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-09T01:45:00Z"));
  const html = renderToStaticMarkup(<HumanInterviewPreparation interview={interview} />);
  expect(html).toContain("Engineer");
  expect(html).toContain("Public requirements");
  expect(html).toContain(m.meeting_too_early());
  expect(html).toMatch(/<button[^>]* disabled=""/u);
});

it("opens preparation within ten minutes and explains expired admission", () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-09T01:51:00Z"));
  const ready = renderToStaticMarkup(<HumanInterviewPreparation interview={interview} />);
  expect(ready).not.toContain(m.meeting_too_early());
  expect(ready).not.toMatch(/<button[^>]* disabled=""/u);
  clock.mockReturnValue(Date.parse("2026-11-09T03:01:00Z"));
  const expired = renderToStaticMarkup(<HumanInterviewPreparation interview={interview} />);
  expect(expired).toContain(m.meeting_closed());
  expect(expired).toMatch(/<button[^>]* disabled=""/u);
});

it("distinguishes assignment denial from a retryable connection failure", () => {
  expect(
    renderToStaticMarkup(<MeetingError error={new Error("INTERVIEW_MEETING_FORBIDDEN")} />),
  ).toContain(m.meeting_forbidden());
  expect(
    renderToStaticMarkup(<MeetingError error={new Error("INTERVIEW_CONNECTION_FAILED")} />),
  ).toContain(m.meeting_join_error());
});

it("retains an interviewer meeting through sign-in without allowing external redirects", () => {
  expect(loginSearch.parse({ next: "/meet/workspace/round" }).next).toBe("/meet/workspace/round");
  expect(loginSearch.parse({ next: "//example.com/meet/workspace/round" }).next).toBeUndefined();
  expect(
    loginSearch.parse({ next: "https://example.com/meet/workspace/round" }).next,
  ).toBeUndefined();
});
