import { createFileRoute } from "@tanstack/react-router";
import { IconSparkle } from "@tabler/icons-react";
import { PageHeaderContent } from "@/components/layout/page-header";
import * as m from "@/paraglide/messages";

function AgentPage() {
  return (
    <>
      <PageHeaderContent>
        <IconSparkle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h1 className="truncate text-sm font-medium">{m.workspace_agent()}</h1>
      </PageHeaderContent>
      <div className="flex flex-1 items-center justify-center">
        <p className="text-center text-sm text-muted-foreground">
          {m.workspace_agent_placeholder()}
        </p>
      </div>
    </>
  );
}

export const Route = createFileRoute("/_workspace/agent")({
  head: () => ({ meta: [{ title: `${m.workspace_agent()} — Sainoa` }] }),
  component: AgentPage,
});
