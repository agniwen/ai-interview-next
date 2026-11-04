import { Skeleton } from "@/components/ui/skeleton";

export function SettingsGroupSkeleton({
  rows = 3,
  avatar = false,
}: {
  rows?: number;
  avatar?: boolean;
}) {
  return (
    <div aria-hidden="true" className="flex min-w-0 flex-col gap-3">
      <Skeleton className="mx-1 h-5 w-24" />
      <div className="divide-y rounded-xl bg-muted px-4">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex min-h-16 items-center justify-between gap-8 py-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton
              className={avatar && index === 0 ? "size-12 rounded-full" : "h-8 w-32 max-w-1/2"}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
