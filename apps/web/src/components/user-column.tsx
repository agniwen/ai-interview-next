import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * 列表与详情共用的用户头像和名称单元，支持缺失头像的回退展示。
 * Shared user avatar/name cell for lists and details, including avatar fallback.
 */
export function UserColumn({
  className,
  user,
}: {
  className?: string;
  user: { image?: string | null; name: string } | null;
}) {
  if (!user) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span
      className={cn(
        "inline-flex max-w-48 min-w-0 items-center gap-2 align-middle text-sm",
        className,
      )}
    >
      <Avatar aria-hidden="true" className="ring-1 ring-foreground/10 [--avatar-size:18px]">
        <AvatarImage alt="" referrerPolicy="no-referrer" src={user.image ?? undefined} />
        <AvatarFallback className="text-[10px]">
          {user.name.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate" title={user.name}>
        {user.name}
      </span>
    </span>
  );
}
