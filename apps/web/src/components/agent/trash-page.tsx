import type { ChatSummary } from "@ai-interview/agent";
import { IconArrowLeft, IconMessage, IconRestore, IconTrash } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeaderContent } from "@/components/layout/page-header";
import {
  AlertDialog,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { agentClient } from "@/lib/agent/client";
import * as m from "@/paraglide/messages";

export function AgentTrashPage({ workspaceId }: { workspaceId: string }) {
  const api = agentClient(workspaceId);
  const queryClient = useQueryClient();
  const queryKey = ["agent-sessions", workspaceId];
  const list = useQuery({ gcTime: 0, queryFn: () => api.list(), queryKey });
  const [deleting, setDeleting] = useState<ChatSummary>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const sessions = list.data?.sessions.filter((session) => session.trashed) ?? [];

  async function update(id: string, restore: boolean) {
    setBusy(true);
    setError(false);
    try {
      await (restore ? api.command(id, { type: "restore" }) : api.remove(id));
      await queryClient.invalidateQueries({ queryKey });
      setDeleting(undefined);
    } catch {
      setError(true);
    }
    setBusy(false);
  }

  return (
    <>
      <PageHeaderContent>
        <Link
          to="/w/$workspaceId/account"
          params={{ workspaceId }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {m.account_title()}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{m.agent_trash()}</span>
      </PageHeaderContent>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 py-2 md:py-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label={m.account_back()}
            render={<Link to="/w/$workspaceId/account" params={{ workspaceId }} />}
          >
            <IconArrowLeft />
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{m.agent_trash()}</h1>
        </div>
        {(error || list.isError) && (
          <p role="alert" className="text-sm text-destructive-foreground">
            {m.agent_error()}
          </p>
        )}
        <ScrollArea className="max-h-[65dvh] rounded-xl border" overscrollContain>
          <div className="divide-y">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center gap-3 p-4">
                <IconMessage className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">{session.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={m.agent_restore()}
                  disabled={busy}
                  onClick={() => {
                    void update(session.id, true);
                  }}
                >
                  <IconRestore />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={m.agent_delete()}
                  disabled={busy}
                  onClick={() => setDeleting(session)}
                >
                  <IconTrash />
                </Button>
              </div>
            ))}
            {sessions.length === 0 && (
              <p className="p-10 text-center text-sm text-muted-foreground">
                {list.isPending ? m.agent_loading() : m.agent_no_trash()}
              </p>
            )}
          </div>
        </ScrollArea>
      </main>
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(undefined);
          }
        }}
      >
        <AlertDialogPopup>
          <div className="space-y-3 p-6">
            <AlertDialogTitle>{m.agent_delete()}</AlertDialogTitle>
            <AlertDialogDescription>{m.agent_delete_description()}</AlertDialogDescription>
          </div>
          <AlertDialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setDeleting(undefined)}>
              {m.agent_cancel()}
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (deleting) {
                  void update(deleting.id, false);
                }
              }}
            >
              {m.agent_delete()}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}
