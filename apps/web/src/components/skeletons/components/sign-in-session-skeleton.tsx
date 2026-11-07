import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

/**
 * 登录页确认会话期间的操作区占位，避免认证状态未就绪时显示错误入口。
 * Sign-in action placeholder while resolving the session, avoiding a premature account action.
 */
export function SignInSessionSkeleton() {
  return (
    <output aria-label={m.auth_loading()} aria-busy="true" className="block">
      <Skeleton aria-hidden="true" className="h-11 w-full rounded-lg sm:h-10" />
    </output>
  );
}
