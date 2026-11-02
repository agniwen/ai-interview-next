import type { RecruitingBoardStageView } from "@/components/home/support/recruiting-board";

export function matchesDemoPipeline(pipeline: RecruitingBoardStageView, view: string): boolean {
  const stage = view.replace(/^all:/u, "");
  return stage === "all" || stage === pipeline || stage === `${pipeline.split(":")[0]}:all`;
}
