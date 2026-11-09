import { IconQuestionMark, IconSparkles, IconThumbUp, IconX } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import * as m from "@/paraglide/messages";
import type { ApplicationDetail } from "./application-detail-page";

type RecommendationLevel =
  ApplicationDetail["evaluations"][number]["result"]["recommendationLevel"];

const recommendations = {
  highly_recommended: {
    icon: IconSparkles,
    label: m.ats_evaluation_highly_recommended,
    variant: "info",
  },
  not_recommended: { icon: IconX, label: m.ats_evaluation_not_recommended, variant: "error" },
  recommended: { icon: IconThumbUp, label: m.ats_evaluation_recommended, variant: "success" },
  undecided: { icon: IconQuestionMark, label: m.ats_evaluation_undecided, variant: "warning" },
} as const;

const summaryLevels = ["recommended", "not_recommended", "undecided"] as const;

export function RecommendationBadge({
  level,
  summary = false,
}: {
  level: RecommendationLevel;
  summary?: boolean;
}) {
  const displayLevel = summary && level === "highly_recommended" ? "recommended" : level;
  const { icon, label, variant } = recommendations[displayLevel];
  const Icon = summary ? IconSparkles : icon;
  return (
    <Badge className="w-fit" variant={variant}>
      <Icon aria-hidden="true" />
      {summary ? (
        <span className="inline-grid text-center">
          {summaryLevels.map((summaryLevel) => (
            <span
              aria-hidden={summaryLevel !== displayLevel}
              className="col-start-1 row-start-1 aria-hidden:invisible"
              key={summaryLevel}
            >
              {recommendations[summaryLevel].label()}
            </span>
          ))}
        </span>
      ) : (
        label()
      )}
    </Badge>
  );
}
