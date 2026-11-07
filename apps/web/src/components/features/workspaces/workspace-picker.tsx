import { workspaceKeys } from "@/lib/workspaces/query-keys";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import { InvitationCardSkeleton } from "@/components/skeletons/components/invitation-card-skeleton";
import { IconBuilding, IconBuildingOff } from "@tabler/icons-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
  EmptyContent,
} from "@/components/ui/empty";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { UserMenu } from "@/components/features/auth/user-menu";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { authClient } from "@/lib/auth/client";
import { authData } from "@/lib/workspaces/actions";
import { CreateWorkspaceModal } from "./create-workspace-modal";
import { WorkspaceFeedback } from "./workspace-feedback";
import * as m from "@/paraglide/messages";

function WorkspaceSelect({
  workspaces,
  value,
  onValueChange,
  className,
}: {
  workspaces: { id: string; name: string }[];
  value?: string | null;
  onValueChange: (workspaceId: string | null) => void;
  className?: string;
}) {
  return (
    <Select<string>
      value={value}
      items={workspaces.map((workspace) => ({ label: workspace.name, value: workspace.id }))}
      onValueChange={onValueChange}
    >
      <SelectTrigger className={className} aria-label={m.ws_choose()}>
        <SelectValue placeholder={m.ws_choose()} />
      </SelectTrigger>
      <SelectPopup>
        <SelectGroup>
          {workspaces.map((workspace) => (
            <SelectItem key={workspace.id} value={workspace.id}>
              {workspace.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectPopup>
    </Select>
  );
}

/**
 * 工作区选择入口，处理不可用工作区提示、选择后确认进入、创建和待处理邀请。
 * Workspace picker handling unavailable-workspace feedback, explicit entry confirmation, creation and pending invitations.
 */
export function WorkspacePicker({
  workspaces,
  unavailable = false,
}: {
  workspaces: { id: string; name: string; role: string }[];
  unavailable?: boolean;
}) {
  const navigate = useNavigate();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  let title = m.ws_choose();
  if (unavailable) {
    title = m.ws_unavailable();
  } else if (workspaces.length === 0) {
    title = m.ws_empty();
  }
  let description = m.ws_empty_description();
  if (workspaces.length > 0) {
    description = unavailable ? m.ws_choose_to_enter() : m.ws_choose_above();
  }
  const invitations = useQuery({
    queryFn: async () => {
      const pending = authData(await authClient.organization.listUserInvitations());
      return pending.filter(
        (invitation) =>
          invitation.status === "pending" && new Date(invitation.expiresAt) > new Date(),
      );
    },
    queryKey: workspaceKeys.invitations.queryKey,
  });
  const phase = useSkeletonPhase(invitations.isPending);

  return (
    <main id="main-content" className="flex flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-end gap-1 border-b px-4 md:px-6">
        <UserMenu iconOnly />
        <ThemeSwitcher />
        <LanguageSwitcher iconOnly />
        {!unavailable && workspaces.length > 0 && (
          <WorkspaceSelect
            workspaces={workspaces}
            className="min-w-0 flex-1 sm:max-w-64"
            onValueChange={(workspaceId) => {
              if (workspaceId) {
                void navigate({ params: { workspaceId }, to: "/w/$workspaceId/agent" });
              }
            }}
          />
        )}
      </header>
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {unavailable ? (
              <IconBuildingOff aria-hidden="true" />
            ) : (
              <IconBuilding aria-hidden="true" />
            )}
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {unavailable && workspaces.length > 0 && (
            <WorkspaceSelect
              workspaces={workspaces}
              value={selectedWorkspaceId}
              onValueChange={setSelectedWorkspaceId}
              className="w-full min-w-0"
            />
          )}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {unavailable && workspaces.length > 0 && (
              <Button
                disabled={!selectedWorkspaceId}
                onClick={() => {
                  if (selectedWorkspaceId) {
                    void navigate({
                      params: { workspaceId: selectedWorkspaceId },
                      to: "/w/$workspaceId/agent",
                    });
                  }
                }}
              >
                {m.ws_enter()}
              </Button>
            )}
            <CreateWorkspaceModal defaultOpen={workspaces.length === 0} />
          </div>
        </EmptyContent>
      </Empty>
      <section
        className="mx-auto flex w-full max-w-xl flex-col gap-4 px-6 pb-6"
        aria-label={m.ws_invitation()}
      >
        {phase === "ready" && <WorkspaceFeedback error={invitations.error} />}
        {phase === "skeleton" && <InvitationCardSkeleton />}
        {phase === "ready" &&
          invitations.data?.map((invitation) => (
            <Card key={invitation.id}>
              <CardHeader>
                <CardTitle>{invitation.organizationName}</CardTitle>
                <CardDescription>{m.ws_invitation()}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  render={
                    <Link to="/invite/$invitationId" params={{ invitationId: invitation.id }} />
                  }
                >
                  {m.ws_review_invitation()}
                </Button>
              </CardContent>
            </Card>
          ))}
      </section>
    </main>
  );
}
