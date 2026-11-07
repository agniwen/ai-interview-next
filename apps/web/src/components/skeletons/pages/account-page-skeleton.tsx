import { Skeleton } from "@/components/ui/skeleton";
import { AccountSettingsSkeleton } from "../components/account-settings-skeleton";

/**
 * 账号设置页面的整体占位，组合页标题和账号内容骨架。
 * Full account-page placeholder combining the heading and account-content skeleton.
 */
export function AccountPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-2 md:py-4">
      <div aria-hidden="true" className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <AccountSettingsSkeleton />
    </div>
  );
}
