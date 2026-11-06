import type { ReactNode } from "react";
import { Skeleton } from "skullet/react";
import * as m from "@/paraglide/messages";

export function AtsTableSkeleton({ children }: { children: ReactNode }) {
  return (
    <Skeleton
      className="[--skullet-base:var(--color-muted)] [--skullet-highlight:rgb(255_255_255/0.6)] dark:[--skullet-highlight:rgb(255_255_255/0.04)]"
      label={m.ats_loading()}
      loading
    >
      {children}
    </Skeleton>
  );
}
