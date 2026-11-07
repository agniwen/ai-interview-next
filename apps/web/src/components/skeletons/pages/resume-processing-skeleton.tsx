import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

/**
 * 简历处理详情页占位，预留流程图与步骤输出面板的位置。
 * Resume-processing page placeholder reserving flow-diagram and step-output areas.
 */
export function ResumeProcessingSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label={m.ats_loading()}
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-background"
    >
      <div aria-hidden="true" className="grid grid-cols-1 gap-19 md:grid-cols-3 md:gap-x-20">
        {[1, 2, 3].map((step) => (
          <Skeleton key={step} className="h-26 w-70 rounded-xl" />
        ))}
        <Skeleton className="md:col-start-2 h-26 w-70 rounded-xl" />
      </div>
    </div>
  );
}
