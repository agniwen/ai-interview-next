import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import * as m from "@/paraglide/messages";
import { AgentEvaluationMessage } from "./agent-evaluation-message";
import type { ApplicationDetail } from "./application-detail-page";

function evaluation(id: string): ApplicationDetail["evaluations"][number] {
  return {
    applicationId: "application",
    createdAt: "2026-11-07T10:00:00Z",
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

function renderMessage(
  versions: ApplicationDetail["evaluations"],
  evaluationStatus: ApplicationDetail["application"]["evaluationStatus"] = "succeeded",
) {
  return renderToStaticMarkup(
    <AgentEvaluationMessage
      application={{ closedAt: null, evaluationStatus }}
      versions={versions}
      onReevaluate={() => {}}
      reevaluating={false}
    />,
  );
}

function button(html: string, label: string) {
  return html.match(/<button\b[^>]*>/gu)?.find((tag) => tag.includes(`aria-label="${label}"`));
}

it("shows only the latest version and disables forward navigation at the newest version", () => {
  const html = renderMessage([evaluation("OLDER_RESULT"), evaluation("NEWEST_RESULT")]);
  expect(html).toContain("NEWEST_RESULT");
  expect(html).not.toContain("OLDER_RESULT");
  expect(html).toContain(m.ats_evaluation_version({ current: 2, total: 2 }));
  expect(button(html, m.ats_evaluation_previous_version())).not.toContain(' disabled=""');
  expect(button(html, m.ats_evaluation_next_version())).toContain(' disabled=""');
  expect(button(html, m.ats_evaluation_regenerate())).not.toContain(' disabled=""');
});

it("disables both arrows for one version or no completed evaluation", () => {
  for (const versions of [[], [evaluation("ONLY_RESULT")]]) {
    const html = renderMessage(versions);
    expect(button(html, m.ats_evaluation_previous_version())).toContain(' disabled=""');
    expect(button(html, m.ats_evaluation_next_version())).toContain(' disabled=""');
  }
});

it("retains the completed result while regenerating or after failure", () => {
  const versions = [evaluation("RETAINED_RESULT")];
  const pending = renderMessage(versions, "running");
  expect(pending).toContain("RETAINED_RESULT");
  expect(pending).toContain(m.ats_evaluation_processing());
  expect(button(pending, m.ats_evaluation_regenerate())).toContain(' disabled=""');
  const failed = renderMessage(versions, "failed");
  expect(failed).toContain("RETAINED_RESULT");
  expect(failed).toContain(m.ats_evaluation_failed());
  expect(button(failed, m.ats_evaluation_regenerate())).not.toContain(' disabled=""');
});
