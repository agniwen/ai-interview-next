import { Skeleton } from "@/components/ui/skeleton";

export function DemoPanelSkeleton({ className }: { className: string }) {
  return <Skeleton aria-hidden="true" className={className} />;
}
