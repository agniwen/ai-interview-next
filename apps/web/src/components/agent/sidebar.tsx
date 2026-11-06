import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import { SessionListSkeleton } from "@/components/skeletons/components/session-list-skeleton";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { IconCheck, IconX, IconPlus, IconTrash, IconDots, IconPencil } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { ChatSummary } from "@ai-interview/agent";
import { SidebarPageContent } from "@/components/layout/sidebar-page";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  useSidebar,
} from "@/components/ui/sidebar";
import { Menu, MenuTrigger, MenuPopup, MenuItem } from "@/components/ui/menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getLocale } from "@/paraglide/runtime";
import { Button } from "@/components/ui/button";
import * as m from "@/paraglide/messages";

function SessionTitleEditor({
  session,
  save,
  close,
}: {
  session: ChatSummary;
  save: (title: string) => Promise<boolean>;
  close: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // 菜单完成焦点恢复后再聚焦编辑框，避免恢复过程抢走焦点。
    // Focus after the menu restores focus so it cannot steal focus from the editor.
    const frame = requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const [title, setTitle] = useState(session.title);
  const [saving, setSaving] = useState(false);
  async function submit() {
    const next = title.trim();
    if (!next || next === session.title) {
      close();
      return;
    }
    setSaving(true);
    if (await save(next)) {
      close();
    }
    setSaving(false);
  }
  return (
    <form
      className="flex h-8 items-center gap-0.5 rounded-lg bg-sidebar-accent px-1"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Input
        ref={input}
        aria-label={m.agent_rename()}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        maxLength={100}
        readOnly={saving}
        unstyled
        className="min-w-0 flex-1 text-sm [&_input]:h-8 [&_input]:px-1"
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) {
            if (event.key === "Enter") {
              event.preventDefault();
            }
            return;
          }
          if (event.key === "Escape" && !saving) {
            event.preventDefault();
            close();
          }
        }}
      />
      <Button
        type="submit"
        variant="ghost"
        size="icon-xs"
        disabled={saving || !title.trim()}
        aria-label={m.agent_save()}
      >
        <IconCheck />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={saving}
        onClick={close}
        aria-label={m.agent_cancel()}
      >
        <IconX />
      </Button>
    </form>
  );
}

export function AgentSidebar({
  workspaceId,
  sessions,
  selected,
  loading,
  error,
  retry,
  rename,
  remove,
}: {
  workspaceId: string;
  sessions: ChatSummary[];
  selected?: string;
  loading: boolean;
  error: boolean;
  retry: () => void;
  rename: (session: ChatSummary, title: string) => Promise<boolean>;
  remove: (session: ChatSummary) => void;
}) {
  const { setOpenMobile } = useSidebar();
  const [editing, setEditing] = useState<string>();
  const phase = useSkeletonPhase(loading && sessions.length === 0);
  const pendingRename = useRef<string | undefined>(undefined);
  return (
    <SidebarPageContent>
      <div className="flex min-h-0 flex-1 flex-col">
        <SidebarGroup className="shrink-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={m.agent_new()}
                render={<Link to="/w/$workspaceId/agent" params={{ workspaceId }} search={{}} />}
                onClick={() => setOpenMobile(false)}
              >
                <IconPlus />
                <span>{m.agent_new()}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <div className="flex min-h-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="px-4">{m.agent_chats()}</SidebarGroupLabel>
          <ScrollArea
            className="min-h-0 flex-1"
            viewportClassName="focus-visible:ring-0 focus-visible:ring-offset-0"
            overscrollContain
            scrollFade
          >
            <SidebarGroup>
              <SidebarMenu>
                {phase === "ready" &&
                  sessions
                    .filter((session) => !session.trashed)
                    .map((session) => (
                      <SidebarMenuItem key={session.id} className="group/session">
                        {editing === session.id ? (
                          <SessionTitleEditor
                            session={session}
                            save={(title) => rename(session, title)}
                            close={() => setEditing(undefined)}
                          />
                        ) : (
                          <>
                            <SidebarMenuButton
                              isActive={session.id === selected}
                              render={
                                <Link
                                  to="/w/$workspaceId/agent/$sessionId"
                                  params={{ sessionId: session.id, workspaceId }}
                                />
                              }
                              onClick={() => setOpenMobile(false)}
                              className="pr-16"
                              title={session.title}
                            >
                              <span>{session.title}</span>
                            </SidebarMenuButton>
                            <time
                              dateTime={new Date(session.lastSentAt).toISOString()}
                              className="pointer-events-none absolute top-2 right-2 text-[11px] tabular-nums text-muted-foreground/65 transition-opacity group-hover/session:opacity-0 group-focus-within/session:opacity-0 max-md:hidden"
                            >
                              {new Intl.DateTimeFormat(getLocale(), {
                                day: "numeric",
                                month: "numeric",
                              }).format(session.lastSentAt)}
                            </time>
                            <Menu
                              onOpenChangeComplete={(open) => {
                                if (!open && pendingRename.current === session.id) {
                                  setEditing(session.id);
                                  pendingRename.current = undefined;
                                }
                              }}
                            >
                              <MenuTrigger
                                render={
                                  <SidebarMenuAction
                                    className="top-1 right-1 size-6 rounded-md"
                                    showOnHover
                                    aria-label={m.agent_actions()}
                                  />
                                }
                              >
                                <IconDots />
                              </MenuTrigger>
                              <MenuPopup align="start" side="right">
                                <MenuItem
                                  onClick={() => {
                                    pendingRename.current = session.id;
                                  }}
                                >
                                  <IconPencil />
                                  {m.agent_rename()}
                                </MenuItem>
                                <MenuItem variant="destructive" onClick={() => remove(session)}>
                                  <IconTrash />
                                  {m.agent_move_trash()}
                                </MenuItem>
                              </MenuPopup>
                            </Menu>
                          </>
                        )}
                      </SidebarMenuItem>
                    ))}
              </SidebarMenu>
              {phase === "skeleton" ? (
                <SessionListSkeleton />
              ) : (
                phase === "ready" &&
                !sessions.some((session) => !session.trashed) && (
                  <p className="px-2 py-4 text-xs text-muted-foreground">{m.agent_no_chats()}</p>
                )
              )}
              {phase === "ready" && error && (
                <Button variant="ghost" size="sm" onClick={retry}>
                  {m.agent_retry()}
                </Button>
              )}
            </SidebarGroup>
          </ScrollArea>
        </div>
      </div>
    </SidebarPageContent>
  );
}
