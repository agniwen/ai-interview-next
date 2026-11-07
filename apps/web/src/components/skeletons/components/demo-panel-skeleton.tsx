import { Skeleton } from "@/components/ui/skeleton";

/**
 * 首页演示切换延迟加载面板时的局部占位，不包含外层演示窗口。
 * Local placeholder for lazy-loaded homepage demo panels, excluding the outer demo window.
 */
export function DemoPanelSkeleton({ className }: { className: string }) {
  return <Skeleton aria-hidden="true" className={className} />;
}
