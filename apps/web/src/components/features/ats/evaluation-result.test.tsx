import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import * as m from "@/paraglide/messages";
import type { ApplicationDetail } from "./application-detail-page";
import { EvaluationResult } from "./evaluation-result";

type Result = ApplicationDetail["evaluations"][number]["result"];
const current: Extract<Result, { version: 3 }> = {
  conciseOverall: "Relevant API experience",
  detailedOverall: {
    judgment: "Confirm team leadership before proceeding.",
    matchingEvidence: [
      {
        content: "The candidate has directly relevant experience.",
        jobRequirement: "Build reliable APIs",
        point: "API development",
        resumeEvidence: "Built the order service API",
      },
    ],
    risks: [
      {
        content: "Confirm whether the candidate mentored engineers.",
        jobRequirement: "Mentor junior engineers",
        point: "Team leadership",
        resumeEvidence: null,
      },
    ],
  },
  recommendationLevel: "undecided",
  version: 3,
};
it("renders conclusions with matching evidence and open questions", () => {
  const html = renderToStaticMarkup(<EvaluationResult result={current} />);
  expect(html).toContain(current.conciseOverall);
  expect(html).toContain(m.ats_evaluation_strengths());
  expect(html).toContain(m.ats_evaluation_risks());
  expect(html).toContain("Build reliable APIs");
  expect(html).toContain("Built the order service API");
  expect(html).toContain("Confirm whether the candidate mentored engineers.");
  expect(html).toContain(m.ats_evaluation_missing_evidence());
});

it("explains empty evidence sections without inventing points", () => {
  const html = renderToStaticMarkup(
    <EvaluationResult
      result={{
        ...current,
        detailedOverall: { ...current.detailedOverall, matchingEvidence: [], risks: [] },
      }}
    />,
  );
  expect(html).toContain(m.ats_evaluation_no_matches());
  expect(html).toContain(m.ats_evaluation_no_risks());
  expect(html).not.toContain("<li");
});
