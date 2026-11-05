import { WorkspaceSettingsPageSkeleton } from "@/components/skeletons/pages/workspace-settings-page-skeleton";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";
import { authData, useWorkspaceAction } from "@/lib/workspaces/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  ListItem,
  ListContent,
  ListTitle,
  ListDescription,
  ListActions,
} from "@/components/ui/list";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { Group, GroupSeparator } from "@/components/ui/group";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogPopup,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogClose,
} from "@/components/ui/alert-dialog";
import { WorkspaceFeedback } from "./workspace-feedback";
import { CreateWorkspaceModal } from "./create-workspace-modal";
import { AutoSaveInput } from "@/components/settings/auto-save-input";
import { SettingsGroup, SettingsRow } from "@/components/settings/settings-group";
import * as m from "@/paraglide/messages";

const roles = ["member", "admin", "owner"] as const;
type Role = (typeof roles)[number];

function roleLabel(role: string) {
  const labels = { admin: m.ws_admin(), member: m.ws_member(), owner: m.ws_owner() };
  const known = roles.find((value) => value === role);
  return known ? labels[known] : role;
}

function RoleSelect({
  value,
  owner,
  disabled,
  onChange,
  size = "sm",
}: {
  value: string;
  owner: boolean;
  disabled: boolean;
  onChange: (role: Role) => void;
  size?: "sm" | "default";
}) {
  const items = roles
    .filter((role) => owner || role !== "owner")
    .map((role) => ({ label: roleLabel(role), value: role }));
  return (
    <Select<Role>
      value={roles.find((role) => role === value) ?? null}
      items={items}
      disabled={disabled}
      onValueChange={(role) => {
        if (role) {
          onChange(role);
        }
      }}
    >
      <SelectTrigger size={size} className="w-auto min-w-0" aria-label={m.ws_change_role()}>
        <SelectValue />
      </SelectTrigger>
      <SelectPopup>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectPopup>
    </Select>
  );
}

export function WorkspaceSettings({
  workspaceId,
  name: originalName,
  role,
}: {
  workspaceId: string;
  name: string;
  role: string;
}) {
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const action = useWorkspaceAction();
  const rename = useWorkspaceAction();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const details = useQuery({
    queryFn: async () => {
      const data = authData(
        await authClient.organization.getFullOrganization({
          query: { organizationId: workspaceId },
        }),
      );
      return {
        ...data,
        invitations: data.invitations.filter(
          (invitation) =>
            invitation.status === "pending" && new Date(invitation.expiresAt) > new Date(),
        ),
      };
    },
    queryKey: ["workspace-details", workspaceId],
  });
  const owner = role === "owner";
  const manage = owner || role === "admin";
  if (details.isPending) {
    return <WorkspaceSettingsPageSkeleton />;
  }
  if (details.error || !details.data) {
    return <WorkspaceFeedback error={details.error ?? new Error(m.ws_unavailable())} />;
  }
  const { members, invitations } = details.data;
  const self = members.find((item) => item.userId === session?.user.id);
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-2 md:py-4">
      <div className="flex flex-col gap-2">
        <h2 className="break-words text-2xl font-semibold tracking-tight">{details.data.name}</h2>
        <p className="text-sm text-muted-foreground">{m.ws_settings_description()}</p>
      </div>
      <WorkspaceFeedback error={action.error} />
      <SettingsGroup title={m.ws_general()}>
        <SettingsRow title={m.ws_name()} stackOnMobile>
          <AutoSaveInput
            id="workspace-rename"
            label={m.ws_name()}
            value={originalName}
            disabled={!manage}
            onSave={(name) =>
              rename.mutateAsync(async () =>
                authData(
                  await authClient.organization.update({
                    data: { name },
                    organizationId: workspaceId,
                  }),
                ),
              )
            }
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={m.ws_members()}>
        {members.map((member) => (
          <ListItem key={member.id}>
            <ListContent>
              <ListTitle>{member.user.name}</ListTitle>
              <ListDescription>{member.user.email}</ListDescription>
            </ListContent>
            <ListActions>
              {manage && (owner || member.role !== "owner") ? (
                <RoleSelect
                  value={member.role}
                  owner={owner}
                  disabled={action.isPending}
                  onChange={(nextRole) =>
                    action.mutate(async () =>
                      authData(
                        await authClient.organization.updateMemberRole({
                          memberId: member.id,
                          organizationId: workspaceId,
                          role: nextRole,
                        }),
                      ),
                    )
                  }
                />
              ) : (
                <Badge variant="secondary">{roleLabel(member.role)}</Badge>
              )}
              {owner && self && member.userId !== self.userId && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={action.isPending}
                  onClick={() =>
                    action.mutate(async () => {
                      authData(
                        await authClient.organization.updateMemberRole({
                          memberId: member.id,
                          organizationId: workspaceId,
                          role: "owner",
                        }),
                      );
                      authData(
                        await authClient.organization.updateMemberRole({
                          memberId: self.id,
                          organizationId: workspaceId,
                          role: "member",
                        }),
                      );
                    })
                  }
                >
                  {m.ws_transfer()}
                </Button>
              )}
              {manage &&
                member.userId !== session?.user.id &&
                (owner || member.role !== "owner") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate(async () =>
                        authData(
                          await authClient.organization.removeMember({
                            memberIdOrEmail: member.id,
                            organizationId: workspaceId,
                          }),
                        ),
                      )
                    }
                  >
                    {m.ws_remove()}
                  </Button>
                )}
            </ListActions>
          </ListItem>
        ))}
      </SettingsGroup>
      {manage && (
        <SettingsGroup title={m.ws_invite()}>
          <ListItem className="block">
            <form
              className="flex min-w-0 items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                action.mutate(async () => {
                  const invitation = authData(
                    await authClient.organization.inviteMember({
                      email,
                      organizationId: workspaceId,
                      role: inviteRole,
                    }),
                  );
                  setLink(new URL(`/invite/${invitation.id}`, window.location.origin).href);
                  setCopied(false);
                });
              }}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Label htmlFor="invite-email">{m.ws_email()}</Label>
                <Group className="w-full min-w-0" aria-label={m.ws_invite()}>
                  <Input
                    className="min-w-0 flex-1"
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                  <GroupSeparator />
                  <RoleSelect
                    value={inviteRole}
                    owner={owner}
                    disabled={action.isPending}
                    onChange={setInviteRole}
                    size="default"
                  />
                </Group>
              </div>
              <Button type="submit" disabled={action.isPending} aria-label={m.ws_generate_invite()}>
                <span className="sm:hidden">{m.ws_invite_short()}</span>
                <span className="hidden sm:inline">{m.ws_generate_invite()}</span>
              </Button>
            </form>
          </ListItem>
          {link && (
            <ListItem className="block">
              <Field>
                <FieldLabel htmlFor="invitation-link">{m.ws_invitation_link()}</FieldLabel>
                <div className="flex w-full min-w-0 gap-2">
                  <Input id="invitation-link" value={link} readOnly className="min-w-0 flex-1" />
                  <Button
                    variant="outline"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate(async () => {
                        await navigator.clipboard.writeText(link);
                        setCopied(true);
                      })
                    }
                  >
                    {copied ? m.ws_copied() : m.ws_copy()}
                  </Button>
                </div>
              </Field>
            </ListItem>
          )}
          {invitations.map((invitation) => (
            <ListItem key={invitation.id}>
              <ListContent>
                <ListTitle>{invitation.email}</ListTitle>
              </ListContent>
              <ListActions>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setLink(new URL(`/invite/${invitation.id}`, window.location.origin).href);
                    setCopied(false);
                  }}
                >
                  {m.ws_invitation_link()}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={action.isPending}
                  onClick={() =>
                    action.mutate(async () =>
                      authData(
                        await authClient.organization.cancelInvitation({
                          invitationId: invitation.id,
                        }),
                      ),
                    )
                  }
                >
                  {m.ws_revoke()}
                </Button>
              </ListActions>
            </ListItem>
          ))}
        </SettingsGroup>
      )}

      <SettingsGroup title={m.ws_other_workspaces()}>
        <ListItem className="flex-row items-center gap-4">
          <ListContent>
            <ListDescription className="break-normal">{m.ws_create_context()}</ListDescription>
          </ListContent>
          <ListActions>
            <CreateWorkspaceModal />
          </ListActions>
        </ListItem>
      </SettingsGroup>

      <SettingsGroup title={m.ws_access()}>
        <ListItem>
          <ListContent>
            <ListTitle>{m.ws_membership()}</ListTitle>
            <ListDescription>{m.ws_leave_description()}</ListDescription>
          </ListContent>
          <ListActions>
            <Button
              variant="outline"
              disabled={action.isPending}
              onClick={() =>
                action.mutate(async () => {
                  authData(await authClient.organization.leave({ organizationId: workspaceId }));
                  await navigate({ search: { choose: true }, to: "/workspaces" });
                })
              }
            >
              {m.ws_leave()}
            </Button>
          </ListActions>
        </ListItem>
        {owner && (
          <ListItem>
            <ListContent>
              <ListTitle>{m.ws_data()}</ListTitle>
              <ListDescription>{m.ws_delete_data_description()}</ListDescription>
            </ListContent>
            <ListActions>
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button variant="destructive-outline" disabled={action.isPending} />}
                >
                  {m.ws_delete()}
                </AlertDialogTrigger>
                <AlertDialogPopup>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{m.ws_delete_title()}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {m.ws_delete_description({ name: details.data.name })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogClose
                      render={<Button variant="outline" disabled={action.isPending} />}
                    >
                      {m.ws_cancel()}
                    </AlertDialogClose>
                    <Button
                      variant="destructive"
                      disabled={action.isPending}
                      onClick={() =>
                        action.mutate(async () => {
                          authData(
                            await authClient.organization.delete({ organizationId: workspaceId }),
                          );
                          await navigate({ search: { choose: true }, to: "/workspaces" });
                        })
                      }
                    >
                      {action.isPending && <Spinner />}
                      {m.ws_delete()}
                    </Button>
                  </AlertDialogFooter>
                  <WorkspaceFeedback error={action.error} />
                </AlertDialogPopup>
              </AlertDialog>
            </ListActions>
          </ListItem>
        )}
      </SettingsGroup>
    </div>
  );
}
