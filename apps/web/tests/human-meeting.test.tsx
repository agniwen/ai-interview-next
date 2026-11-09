import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { HumanInterviewPreparation } from "../src/components/features/candidate-interview/human-preparation";
import { MeetingError } from "../src/components/features/human-interview/error";
import { MeetingCandidateMaterials } from "../src/components/features/human-interview/materials";
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
  workspaceName: "Hiring team",
};

afterEach(() => vi.restoreAllMocks());

it("keeps the appointment and device controls visible before joining is available", () => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-09T01:45:00Z"));
  const html = renderToStaticMarkup(
    <HumanInterviewPreparation interview={interview} onStart={vi.fn()} />,
  );
  expect(html).toContain("Engineer");
  expect(html).toContain("Public requirements");
  expect(html).not.toContain(interview.workspaceName);
  expect(html).toContain(m.meeting_too_early());
  expect(html).toContain(m.meeting_mic_enabled());
  expect(html).toContain(m.meeting_camera_disabled());
  expect(html).toMatch(/<button[^>]* disabled=""/u);
});

it("opens admission within ten minutes and explains expired admission", () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-09T01:51:00Z"));
  const page = <HumanInterviewPreparation interview={interview} onStart={vi.fn()} />;
  const ready = renderToStaticMarkup(page);
  expect(ready).not.toContain(m.meeting_too_early());
  expect(ready).toContain(m.meeting_enter_room());
  expect(ready).not.toMatch(/<button[^>]* disabled=""/u);
  clock.mockReturnValue(Date.parse("2026-11-09T03:01:00Z"));
  const expired = renderToStaticMarkup(page);
  expect(expired).toContain(m.meeting_closed());
  expect(expired).toMatch(/<button[^>]* disabled=""/u);
});

it("shows the original resume in interviewer preparation instead of the job description", () => {
  const url = "/api/interviews/workspace/round/meeting/resumes/resume";
  const html = renderToStaticMarkup(
    <HumanInterviewPreparation
      interview={interview}
      interviewerMaterials={
        <MeetingCandidateMaterials
          materials={{
            history: [],
            resumes: [
              {
                documentUrl: url,
                filename: "original.png",
                id: "resume",
                markdown: "Extracted resume text",
                parsedProfile: null,
                pdfObjectKey: "original",
              },
            ],
          }}
          showTimeline={false}
        />
      }
      onStart={vi.fn()}
    />,
  );
  expect(html).toContain(m.meeting_materials());
  expect(html).toContain(`src="${url}"`);
  expect(html).toContain("original.png");
  expect(html).not.toContain(interview.jobDescription);
  expect(html).not.toContain("Extracted resume text");
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

it("renders previous evaluations with author, verdict, markdown and timeline navigation", async () => {
  const { MeetingHistory } = await import("../src/components/features/human-interview/history");
  const html = renderToStaticMarkup(
    <MeetingHistory
      history={[
        {
          author: { id: "reviewer", image: null, name: "Earlier interviewer" },
          content: {
            conclusion: "pass",
            overall: "**Evidence from the previous round**",
            version: 1,
          },
          kind: "human",
          label: "Technical round",
          roundId: "previous",
          sequence: 1,
          submittedAt: "2026-11-08T02:00:00Z",
        },
      ]}
    >
      <div>Resume preview</div>
    </MeetingHistory>,
  );
  expect(html).toContain("Resume preview");
  expect(html).toContain("Earlier interviewer");
  expect(html).toContain("Technical round");
  expect(html).toContain("<strong>Evidence from the previous round</strong>");
  expect(html).toContain('href="#history-previous-reviewer"');
});
