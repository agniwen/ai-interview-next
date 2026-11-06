import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import { ChatTranscriptSkeleton } from "@/components/skeletons/components/chat-transcript-skeleton";
import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { IconSparkles, IconPlayerPlay } from "@tabler/icons-react";
import type { AgentCommand, ChatSnapshot, ChatSummary } from "@ai-interview/agent";
import { agentClient } from "@/lib/agent/client";
import { agentSessionsQueryOptions } from "@/lib/agent/queries";
import { useChat } from "@/lib/agent/use-chat";
import { AgentSidebar } from "./sidebar";
import { Transcript } from "./transcript";
import { ChatQueue } from "./queue";
import { PageHeaderContent } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { PromptInput } from "@/components/ai-elements/prompt-input";
import { getComposerText } from "@/components/ui/composer";
import type { ComposerValue } from "@/components/ui/composer";
import * as m from "@/paraglide/messages";

function ChatBody({
  sessionId,
  snapshot,
  failed,
}: {
  sessionId?: string;
  snapshot?: ChatSnapshot;
  failed: boolean;
}) {
  const phase = useSkeletonPhase(Boolean(sessionId && !snapshot));
  if (phase === "skeleton") {
    return <ChatTranscriptSkeleton reconnecting={failed} />;
  }
  if (phase === "pending") {
    return null;
  }
  if (snapshot) {
    return <Transcript snapshot={snapshot} />;
  }
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-4 px-6 pb-7">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/50">
        <IconSparkles className="size-6" />
      </div>
      <h2 className="text-xl font-medium tracking-tight sm:text-2xl">{m.agent_empty()}</h2>
    </div>
  );
}

function ChatFeedback({
  failed,
  error,
  generationError,
}: {
  failed: boolean;
  error: string;
  generationError?: string | null;
}) {
  return (
    <>
      {failed && (
        <output className="mb-2 block text-xs text-muted-foreground">
          {m.agent_reconnecting()}
        </output>
      )}
      {(error || generationError) && (
        <p role="alert" className="mb-2 text-sm text-destructive-foreground">
          {error || m.agent_generation_failed()}
        </p>
      )}
    </>
  );
}

function ChatContent({
  workspaceId,
  sessionId,
  onSummary,
  onCreated,
  onRestore,
}: {
  workspaceId: string;
  sessionId?: string;
  onSummary: (summary: ChatSummary) => void;
  onCreated: (id: string) => Promise<void>;
  onRestore: () => void;
}) {
  const { snapshot, connected, failed, acceptSnapshot } = useChat(
    workspaceId,
    sessionId,
    onSummary,
  );
  const [commandBusy, setCommandBusy] = useState(false);
  const [value, setValue] = useState<ComposerValue>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<{ id: string; messageId: string; text: string } | null>(null);
  const api = agentClient(workspaceId);
  async function command(action: AgentCommand) {
    if (!sessionId) {
      return false;
    }
    setCommandBusy(true);
    setError("");
    try {
      acceptSnapshot(await api.command(sessionId, action));
    } catch {
      setError(m.agent_error());
      setCommandBusy(false);
      return false;
    }
    setCommandBusy(false);
    return true;
  }
  function act(action: AgentCommand) {
    void command(action);
  }
  async function submit(next: ComposerValue) {
    const text = getComposerText(next).trim();
    if (!text) {
      return;
    }
    setBusy(true);
    setError("");
    if (!pending.current || pending.current.text !== text) {
      pending.current = { id: crypto.randomUUID(), messageId: crypto.randomUUID(), text };
    }
    const submission = pending.current;
    try {
      if (sessionId) {
        await api.command(sessionId, { id: submission.messageId, text, type: "send" });
      } else {
        await api.create(submission.id, submission.messageId, text);
        await onCreated(submission.id);
      }
      setValue([]);
      pending.current = null;
    } catch (error_) {
      setError(
        error_ instanceof Error && error_.message === "AGENT_NOT_CONFIGURED"
          ? m.agent_not_configured()
          : m.agent_error(),
      );
    }
    setBusy(false);
  }
  const running = snapshot?.status === "running";
  const stopping = snapshot?.status === "stopping";
  return (
    <div
      className={
        sessionId
          ? "flex min-h-0 flex-1 flex-col"
          : "flex min-h-0 flex-1 flex-col justify-center pb-[14dvh]"
      }
    >
      <ChatBody sessionId={sessionId} snapshot={snapshot} failed={failed} />
      <div
        className={
          sessionId
            ? "mx-auto w-full max-w-3xl shrink-0 px-4 pb-[38px] md:px-6 md:pb-[42px]"
            : "mx-auto w-full max-w-xl shrink-0 px-4"
        }
      >
        <ChatFeedback failed={failed} error={error} generationError={snapshot?.error} />
        {snapshot?.summary.trashed ? (
          <div className="flex items-center justify-between rounded-xl border p-3 text-sm">
            <span>{m.agent_trashed()}</span>
            <Button size="sm" onClick={onRestore}>
              {m.agent_restore()}
            </Button>
          </div>
        ) : (
          <div className="relative">
            <PromptInput
              value={value}
              onValueChange={setValue}
              onSubmit={(next) => {
                void submit(next);
              }}
              label={m.agent_message()}
              placeholder={running ? m.agent_queue_placeholder() : m.agent_placeholder()}
              sendLabel={m.agent_send()}
              stopLabel={m.agent_stop()}
              running={running || stopping}
              onStop={() => act({ type: "stop" })}
              disabled={busy || stopping || (!!sessionId && !connected)}
              actions={
                snapshot?.status === "paused" ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    disabled={commandBusy || !connected}
                    onClick={() => act({ type: "resume" })}
                  >
                    <IconPlayerPlay />
                    {m.agent_resume()}
                  </Button>
                ) : null
              }
            >
              {!!snapshot?.queue.length && (
                <ChatQueue
                  items={snapshot.queue}
                  busy={commandBusy || stopping || !connected}
                  canSteer={running}
                  onReorder={(ids) => command({ ids, type: "reorder" })}
                  onEdit={(id, text) => command({ id, text, type: "edit" })}
                  onRemove={(id) => act({ id, type: "remove" })}
                  onSteer={(id) => act({ id, type: "steer" })}
                />
              )}
            </PromptInput>
            <p className="absolute inset-x-0 top-full mt-2 text-center text-xs leading-4 text-muted-foreground">
              {m.agent_disclaimer()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function AgentPage({ workspaceId, sessionId }: { workspaceId: string; sessionId?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const api = agentClient(workspaceId);
  const listKey = ["agent-sessions", workspaceId];
  const list = useQuery({
    ...agentSessionsQueryOptions(workspaceId),
    refetchInterval: 5000,
  });
  const [deleting, setDeleting] = useState<ChatSummary>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const summaryChanged = useCallback(
    (summary: ChatSummary) => {
      queryClient.setQueryData<{ sessions: ChatSummary[] }>(
        ["agent-sessions", workspaceId],
        (previous) => {
          if (!previous) {
            return previous;
          }
          const current = previous.sessions.find((item) => item.id === summary.id);
          if (
            current &&
            current.title === summary.title &&
            current.lastSentAt === summary.lastSentAt &&
            current.trashed === summary.trashed
          ) {
            return previous;
          }
          return {
            sessions: [
              ...previous.sessions.filter((item) => item.id !== summary.id),
              summary,
              // 仅排序新建数组，不修改查询缓存。Sort only the new array, preserving the query cache.
              // oxlint-disable-next-line unicorn/no-array-sort
            ].sort((a, b) => b.lastSentAt - a.lastSentAt),
          };
        },
      );
    },
    [queryClient, workspaceId],
  );
  async function manage(id: string, command?: AgentCommand) {
    setBusy(true);
    setError("");
    try {
      await (command ? api.command(id, command) : api.remove(id));
      await queryClient.invalidateQueries({ queryKey: listKey });
      if (
        id === sessionId &&
        (!command || command.type === "trash" || command.type === "restore")
      ) {
        await navigate({
          params: { workspaceId },
          search: {},
          to: "/w/$workspaceId/agent",
        });
      }
      setDeleting(undefined);
      setBusy(false);
      return true;
    } catch {
      setError(m.agent_error());
      setBusy(false);
      return false;
    }
  }
  return (
    <>
      <PageHeaderContent>
        <IconSparkles className="size-4 shrink-0 text-muted-foreground" />
        <h1 className="truncate text-sm font-medium">
          {list.data?.sessions.find((item) => item.id === sessionId)?.title ?? m.workspace_agent()}
        </h1>
      </PageHeaderContent>
      <AgentSidebar
        workspaceId={workspaceId}
        sessions={list.data?.sessions ?? []}
        selected={sessionId}
        loading={list.isPending}
        error={list.isError}
        retry={() => {
          void list.refetch();
        }}
        rename={(session, title) => manage(session.id, { title, type: "rename" })}
        remove={(session) => {
          if (session.trashed) {
            setDeleting(session);
          } else {
            void manage(session.id, { type: "trash" });
          }
        }}
      />
      {error && (
        <p role="alert" className="px-6 py-2 text-sm text-destructive-foreground">
          {error}
        </p>
      )}
      <ChatContent
        key={`${workspaceId}:${sessionId ?? "new"}`}
        workspaceId={workspaceId}
        sessionId={sessionId}
        onSummary={summaryChanged}
        onCreated={async (id) => {
          await queryClient.invalidateQueries({ queryKey: listKey });
          await navigate({
            params: { sessionId: id, workspaceId },
            to: "/w/$workspaceId/agent/$sessionId",
          });
        }}
        onRestore={() => {
          if (sessionId) {
            void manage(sessionId, { type: "restore" });
          }
        }}
      />
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
                  void manage(deleting.id);
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
