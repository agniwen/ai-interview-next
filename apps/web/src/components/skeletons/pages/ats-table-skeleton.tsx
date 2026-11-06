import type { ReactNode } from "react";
import { SkulletProvider } from "skullet/react";
import * as m from "@/paraglide/messages";

export function AtsTableSkeleton({ children }: { children: ReactNode }) {
  return (
    <SkulletProvider>
      <div
        aria-busy="true"
        aria-label={m.ats_loading()}
        className="[--skullet-base:var(--color-muted)] [--skullet-highlight:rgb(255_255_255/0.6)] dark:[--skullet-highlight:rgb(255_255_255/0.04)]"
      >
        <div aria-hidden="true" inert>
          {children}
        </div>
      </div>
    </SkulletProvider>
  );
}
