import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function TrashListSkeleton() {
  return (
    <output aria-label={m.agent_loading()} aria-busy="true" className="block divide-y">
      {["first", "second", "third"].map((key) => (
        <div key={key} aria-hidden="true" className="flex items-center gap-3 p-4">
          <Skeleton className="size-4 shrink-0" />
          <Skeleton className="h-4 w-1/2" />
          <div className="ml-auto flex gap-3">
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
          </div>
        </div>
      ))}
    </output>
  );
}
