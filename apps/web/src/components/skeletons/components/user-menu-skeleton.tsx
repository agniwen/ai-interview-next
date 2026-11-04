import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";

export function UserMenuSkeleton({
  className,
  iconOnly,
  collapsed,
}: {
  className?: string;
  iconOnly: boolean;
  collapsed: boolean;
}) {
  return (
    <output
      aria-label={m.auth_loading()}
      aria-busy="true"
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg px-2.5 sm:h-8",
        iconOnly && "size-9 justify-center p-0 sm:size-8",
        className,
      )}
    >
      <Skeleton
        aria-hidden="true"
        className={cn("size-6 shrink-0 rounded-full", iconOnly && "size-4.5 sm:size-4")}
      />
      {!iconOnly && !collapsed && (
        <Skeleton aria-hidden="true" className="ml-2 h-4 w-16 max-w-full" />
      )}
    </output>
  );
}
