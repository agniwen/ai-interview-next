import { QuestionSetSkeleton } from "@/components/skeletons/components/question-set-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function QuestionSetEditorPageSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label={m.ats_loading()}
      className="mx-auto flex w-full min-w-0 max-w-4xl flex-1 flex-col gap-6 pt-2 md:pt-4"
    >
      <div className="flex flex-col gap-2">
        <Skeleton aria-hidden="true" className="h-8 w-48" />
        <Skeleton aria-hidden="true" className="h-5 w-2/3" />
      </div>
      <QuestionSetSkeleton />
    </div>
  );
}
