/* oxlint-disable unicorn/no-array-sort -- ES2022 下只排序新建数组，不修改查询缓存。 / Sort only newly created arrays under ES2022, leaving query cache data intact. */
import type { ApplicationDetail } from "./application-detail-page";

/** AI 历史版本归入固定首条消息，成员评价随后按时间和 ID 稳定排列。 / Group AI versions into one fixed first message, then order member feedback by time and ID. */
export function evaluationMessages(
  evaluations: ApplicationDetail["evaluations"],
  feedback: ApplicationDetail["feedback"],
) {
  const versions = [...evaluations].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const following = feedback
    .map((message) => ({ ...message, kind: "user" as const }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return [{ id: "ai-evaluation", kind: "ai" as const, versions }, ...following];
}
