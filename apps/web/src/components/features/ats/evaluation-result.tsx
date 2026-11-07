import {
  IconAlertTriangle,
  IconBriefcase,
  IconFileText,
  IconQuestionMark,
  IconSparkles,
  IconThumbUp,
  IconX,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";
import type { ApplicationDetail } from "./application-detail-page";

type ApplicationEvaluationResult = ApplicationDetail["evaluations"][number]["result"];
type QualitativeEvaluation = Extract<ApplicationEvaluationResult, { version: 3 }>;
type EvidenceKind = "matching" | "risk";

function RecommendationBadge({ level }: { level: QualitativeEvaluation["recommendationLevel"] }) {
  const {
    icon: Icon,
    label,
    variant,
  } = (
    {
      highly_recommended: {
        icon: IconSparkles,
        label: m.ats_evaluation_highly_recommended,
        variant: "info",
      },
      not_recommended: { icon: IconX, label: m.ats_evaluation_not_recommended, variant: "error" },
      recommended: { icon: IconThumbUp, label: m.ats_evaluation_recommended, variant: "success" },
      undecided: { icon: IconQuestionMark, label: m.ats_evaluation_undecided, variant: "warning" },
    } as const
  )[level];
  return (
    <Badge variant={variant} className="w-fit">
      <Icon aria-hidden="true" />
      {label()}
    </Badge>
  );
}

function EvaluationEvidence({
  kind,
  points,
}: {
  kind: EvidenceKind;
  points: QualitativeEvaluation["detailedOverall"]["risks"];
}) {
  const Icon = kind === "matching" ? IconThumbUp : IconAlertTriangle;
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <h4
        className={cn(
          "flex flex-wrap items-center gap-2 text-base font-semibold",
          kind === "matching" ? "text-success-foreground" : "text-warning-foreground",
        )}
      >
        <Icon aria-hidden="true" className="size-4.5 shrink-0" />
        {kind === "matching" ? m.ats_evaluation_strengths() : m.ats_evaluation_risks()}
        <Badge variant={kind === "matching" ? "success" : "warning"}>{points.length}</Badge>
      </h4>
      {points.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">
          {kind === "matching" ? m.ats_evaluation_no_matches() : m.ats_evaluation_no_risks()}
        </p>
      ) : (
        <ul className="flex min-w-0 flex-col gap-5">
          {points.map((point, index) => (
            <li key={index} className="flex min-w-0 flex-col gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <h5
                  className={cn(
                    "w-fit max-w-full rounded-md px-2 py-0.5 text-sm leading-6 font-semibold wrap-anywhere",
                    kind === "matching" ? "bg-success/8" : "bg-warning/8",
                  )}
                >
                  {point.point}
                </h5>
                <p className="text-sm leading-6 wrap-anywhere">{point.content}</p>
              </div>
              <dl className="grid min-w-0 gap-3 @min-[32rem]/evaluation:grid-cols-2 @min-[32rem]/evaluation:gap-5">
                <div className="flex min-w-0 flex-col gap-1 border-s-2 border-border ps-3">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <IconBriefcase aria-hidden="true" className="size-3.5 shrink-0" />
                    {m.ats_evaluation_requirement()}
                  </dt>
                  <dd className="text-sm leading-6 whitespace-pre-wrap text-muted-foreground wrap-anywhere">
                    {point.jobRequirement}
                  </dd>
                </div>
                <div className="flex min-w-0 flex-col gap-1 border-s-2 border-border ps-3">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <IconFileText aria-hidden="true" className="size-3.5 shrink-0" />
                    {m.ats_evaluation_evidence()}
                  </dt>
                  <dd className="text-sm leading-6 text-muted-foreground wrap-anywhere">
                    {point.resumeEvidence === null ? (
                      <span>{m.ats_evaluation_missing_evidence()}</span>
                    ) : (
                      <blockquote className="whitespace-pre-wrap">
                        {point.resumeEvidence}
                      </blockquote>
                    )}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function EvaluationResult({ result }: { result: ApplicationEvaluationResult }) {
  return (
    <div className="@container/evaluation flex min-w-0 flex-col gap-6">
      <div className="flex min-w-0 flex-col gap-3">
        <RecommendationBadge level={result.recommendationLevel} />
        <p className="text-base leading-7 font-semibold wrap-anywhere">{result.conciseOverall}</p>
        <p className="text-sm leading-6 whitespace-pre-wrap text-muted-foreground wrap-anywhere">
          {result.detailedOverall.judgment}
        </p>
      </div>
      <Separator />
      <EvaluationEvidence kind="matching" points={result.detailedOverall.matchingEvidence} />
      <Separator />
      <EvaluationEvidence kind="risk" points={result.detailedOverall.risks} />
    </div>
  );
}
