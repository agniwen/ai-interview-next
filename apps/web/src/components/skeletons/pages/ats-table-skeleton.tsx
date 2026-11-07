import type { ReactNode } from "react";
import { SkulletProvider } from "skullet/react";
import * as m from "@/paraglide/messages";

/**
 * ATS 表格的 Skullet 容器，从传入样本内容生成骨架，并在加载时隐藏交互与无障碍内容。
 * ATS Skullet container generating skeletons from supplied sample content while hiding loading-time interaction and accessibility content.
 */
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
