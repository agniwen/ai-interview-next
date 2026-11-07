import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";

/**
 * 账号入口的加载占位，按顶栏、侧栏及折叠形式匹配用户菜单尺寸。
 * Account-entry placeholder matching header, sidebar and collapsed user-menu layouts.
 */
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
