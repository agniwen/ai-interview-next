import { workspaceKeys } from "@/lib/workspaces/query-keys";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import { InvitationPageSkeleton } from "@/components/skeletons/pages/invitation-page-skeleton";
import { InvitationCardSkeleton } from "@/components/skeletons/components/invitation-card-skeleton";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";
import { authData, useWorkspaceAction } from "@/lib/workspaces/actions";
import { workspaceApi } from "@/lib/workspaces/client";
import { WorkspaceFeedback } from "@/components/workspaces/workspace-feedback";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/auth/user-menu";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/invite/$invitationId");

function Invitation() {
  const { invitationId } = routeApi.useParams();
  const navigate = useNavigate();
  const action = useWorkspaceAction();
  const invitation = useQuery({
    queryKey: workspaceKeys.invitations._ctx.detail(invitationId).queryKey,
    queryFn: async () =>
      authData(await authClient.organization.getInvitation({ query: { id: invitationId } })),
  });
  const phase = useSkeletonPhase(invitation.isPending);
  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 p-6"
    >
      <div className="flex justify-end">
        <UserMenu />
      </div>
      <WorkspaceFeedback error={(phase === "ready" ? invitation.error : null) ?? action.error} />
      {phase === "skeleton" && <InvitationCardSkeleton />}
      {phase === "ready" && invitation.data && (
        <Card>
          <CardHeader>
            <CardTitle>{m.ws_invitation()}</CardTitle>
            <CardDescription>
              {m.ws_invited_to({
                name: invitation.data.organizationName,
                email: invitation.data.email,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button
              disabled={action.isPending}
              onClick={() =>
                action.mutate(async () => {
                  const accepted = authData(
                    await authClient.organization.acceptInvitation({ invitationId }),
                  );
                  const response = await workspaceApi.api.workspaces[":workspaceId"].activate.$post(
                    { param: { workspaceId: accepted.member.organizationId } },
                  );
                  if (!response.ok) {
                    throw new Error(m.ws_activation_error());
                  }
                  await navigate({
                    to: "/w/$workspaceId/agent",
                    params: { workspaceId: accepted.member.organizationId },
                  });
                })
              }
            >
              {m.ws_accept()}
            </Button>
            <Button
              variant="outline"
              disabled={action.isPending}
              onClick={() =>
                action.mutate(async () => {
                  authData(await authClient.organization.rejectInvitation({ invitationId }));
                  await navigate({ to: "/workspaces", search: { choose: true } });
                })
              }
            >
              {m.ws_decline()}
            </Button>
          </CardContent>
        </Card>
      )}
      <Button variant="ghost" render={<Link to="/workspaces" search={{ choose: true }} />}>
        {m.ws_choose()}
      </Button>
    </main>
  );
}

export const Route = createFileRoute("/_a/invite/$invitationId")({
  pendingComponent: InvitationPageSkeleton,
  head: () => ({ meta: [{ title: `${m.ws_invitation()} — Sainoa` }] }),
  component: Invitation,
});
