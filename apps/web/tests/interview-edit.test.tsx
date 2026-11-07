import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import { EditInterviewForm } from "@/components/features/interviews/create-form";
import { interviewKeys } from "@/components/features/interviews/client";
import * as m from "@/paraglide/messages";

it.each(["human", "ai"] as const)("initializes the %s editor from saved selections", (kind) => {
  const client = new QueryClient();
  const roundId = "saved-round";
  const workspaceId = "workspace";
  client.setQueryData(interviewKeys.workspace(workspaceId)._ctx.edit(roundId).queryKey, {
    agent: kind === "ai" ? { id: "agent", name: "Saved Agent" } : null,
    round: {
      admissionDeadline: kind === "human" ? "2027-01-01T02:00:00.000Z" : null,
      assignments:
        kind === "ai"
          ? [
              {
                email: "reviewer@example.com",
                id: "reviewer",
                image: null,
                name: "Saved Reviewer",
                role: "reviewer",
              },
            ]
          : [
              {
                email: "alpha@example.com",
                id: "person-a",
                image: null,
                name: "Person Alpha",
                role: "interviewer",
              },
              {
                email: "beta@example.com",
                id: "person-b",
                image: null,
                name: "Person Beta",
                role: "interviewer",
              },
            ],
      id: roundId,
      kind,
      label: "Saved label",
      questionSelection: {
        conversationQuestionSetIds: kind === "ai" ? ["second", "first"] : [],
        formQuestionSetIds: [],
        version: 1,
      },
      scheduledAt: kind === "human" ? "2027-01-01T01:00:00.000Z" : null,
      sequence: 1,
      status: "scheduled",
    },
    sets: [
      { id: "first", name: "First set", questionCount: 1 },
      { id: "second", name: "Second set", questionCount: 2 },
    ],
    version: 1,
  });
  const markup = renderToString(
    <QueryClientProvider client={client}>
      <EditInterviewForm
        workspaceId={workspaceId}
        applicationId="application"
        roundId={roundId}
        onClose={() => {}}
      />
    </QueryClientProvider>,
  );
  const typeOptions = markup.match(/<[^>]*data-slot="radio"[^>]*>/gu) ?? [];
  expect(typeOptions).toHaveLength(2);
  expect(typeOptions.every((option) => option.includes('data-disabled=""'))).toBe(true);
  expect(markup).toContain(m.interviews_edit());
  expect(markup).toContain('value="Saved label"');
  if (kind === "human") {
    expect(markup).toContain("Person Alpha");
    expect(markup).toContain("Person Beta");
    expect(markup).toContain(m.interviews_time_range());
    expect(markup).not.toContain(m.interviews_reviewer());
  } else {
    expect(markup).toContain("Saved Agent");
    expect(markup).toContain("Saved Reviewer");
    expect(markup.indexOf("Second set")).toBeLessThan(markup.indexOf("First set"));
    expect(markup).not.toContain(m.interviews_time_range());
    expect(markup).not.toContain(m.interviews_defaults_help());
  }
  client.clear();
});
