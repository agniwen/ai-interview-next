import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function SignInSessionSkeleton() {
  return (
    <output aria-label={m.auth_loading()} aria-busy="true" className="block">
      <Skeleton aria-hidden="true" className="h-11 w-full rounded-lg sm:h-10" />
    </output>
  );
}
