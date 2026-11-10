import { useCallback, useEffect, useState } from "react";
import { IconAlertCircle } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { AuthPageLayout } from "@/components/features/auth/auth-page-layout";
import { McpConsentSkeleton } from "@/components/skeletons/components/mcp-consent-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Fieldset, FieldsetLegend } from "@/components/ui/fieldset";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import { authClient } from "@/lib/auth/client";
import { mcpKeys } from "@/lib/mcp/query-keys";
import { mcpScopeLabels } from "@/lib/mcp/scope-labels";
import { cn } from "@/lib/utils";
import { workspaceApi } from "@/lib/workspaces/client";
import * as m from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

const api = workspaceApi.api["mcp-management"];

type Scope = keyof typeof mcpScopeLabels;
interface ConsentTool {
  name: string;
  scopes: [Scope, ...Scope[]];
}

function ScopePicker({
  availableScopes,
  disabled,
  onScopeChange,
  scopes,
  tools,
}: {
  availableScopes: Scope[];
  disabled: boolean;
  onScopeChange: (scope: Scope, checked: boolean) => void;
  scopes: Scope[];
  tools: ConsentTool[];
}) {
  const permissionList = new Intl.ListFormat(getLocale());
  const visibleScopeCount = Math.min(availableScopes.length, 3);
  const [viewportHeight, setViewportHeight] = useState<number>();
  const measureScopes = useCallback(
    (list: HTMLDivElement) => {
      const rows = [...list.children].slice(0, visibleScopeCount);
      const updateHeight = () => {
        setViewportHeight(
          rows.reduce((height, row) => height + row.getBoundingClientRect().height, 0),
        );
      };

      updateHeight();
      const observer = new ResizeObserver(updateHeight);
      for (const row of rows) {
        observer.observe(row, { box: "border-box" });
      }
      return () => observer.disconnect();
    },
    [visibleScopeCount],
  );
  return (
    <Fieldset disabled={disabled} className="min-w-0">
      <FieldsetLegend className="mb-2.5 text-sm">{m.mcp_scopes()}</FieldsetLegend>
      <ScrollArea
        className="h-auto rounded-xl border bg-background"
        viewportClassName="h-auto"
        viewportProps={{ style: { maxHeight: viewportHeight } }}
        overscrollContain
        scrollbarGutter
      >
        <div className="divide-y" ref={measureScopes}>
          {availableScopes.map((scope) => (
            <div key={scope} className="flex min-w-0 flex-col gap-2 px-3 py-3.5 sm:px-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <Checkbox
                  id={scope}
                  checked={scopes.includes(scope)}
                  onCheckedChange={(checked) => onScopeChange(scope, checked)}
                />
                <Label className="wrap-anywhere min-w-0" htmlFor={scope}>
                  {mcpScopeLabels[scope]()}
                </Label>
              </div>
              <ul className="flex min-w-0 flex-wrap items-start gap-1.5 ps-6">
                {tools
                  .filter(({ scopes: [primary] }) => primary === scope)
                  .map(({ name, scopes: requiredScopes }) => {
                    const enabled = requiredScopes.every((required) => scopes.includes(required));
                    const additionalPermissions = requiredScopes
                      .slice(1)
                      .map((required) => mcpScopeLabels[required]());
                    return (
                      <li
                        key={name}
                        className={cn(
                          "flex min-w-0 max-w-full flex-col gap-0.5 rounded-md bg-muted px-2 py-1 text-xs",
                          !enabled && "text-muted-foreground",
                        )}
                      >
                        <code className="wrap-anywhere font-mono">{name}</code>
                        {additionalPermissions.length > 0 && (
                          <span className="wrap-anywhere text-muted-foreground">
                            {m.mcp_tool_requires({
                              permissions: permissionList.format(additionalPermissions),
                            })}
                          </span>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Fieldset>
  );
}

function ConsentActions({
  canAuthorize,
  onDecision,
  pendingAction,
}: {
  canAuthorize: boolean;
  onDecision: (accept: boolean) => void;
  pendingAction: boolean | undefined;
}) {
  const pending = pendingAction !== undefined;
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        variant="outline"
        aria-busy={pendingAction === false}
        disabled={pending}
        onClick={() => onDecision(false)}
      >
        {pendingAction === false && <Spinner />}
        {m.mcp_deny()}
      </Button>
      <Button
        aria-busy={pendingAction === true}
        disabled={pending || !canAuthorize}
        onClick={() => onDecision(true)}
      >
        {pendingAction === true && <Spinner />}
        {m.mcp_allow()}
      </Button>
    </div>
  );
}

function ConsentError() {
  return (
    <Alert variant="error">
      <IconAlertCircle aria-hidden="true" />
      <AlertDescription>{m.mcp_authorize_error()}</AlertDescription>
    </Alert>
  );
}

function ConsentForm({ oauthQuery, userId }: { oauthQuery: string; userId: string }) {
  const query = new URLSearchParams(oauthQuery);
  const clientId = query.get("client_id") ?? "";
  const requested = new Set(query.get("scope")?.split(" "));
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const context = useQuery({
    ...mcpKeys.context(clientId, userId),
    enabled: Boolean(clientId),
    retry: false,
    queryFn: async () => {
      const response = await api.context.$get({ query: { clientId } });
      if (!response.ok) {
        throw new Error(m.mcp_authorize_error());
      }
      return response.json();
    },
  });
  const phase = useSkeletonPhase(Boolean(clientId) && context.isPending);
  const consent = useMutation({
    mutationFn: async (accept: boolean) => {
      const response = await api.consent.$post({
        json: {
          accept,
          oauthQuery,
          scopes,
          version: 1,
          workspaceId: workspaceId ?? undefined,
        },
      });
      if (!response.ok) {
        throw new Error(m.mcp_authorize_error());
      }
      return response.json();
    },
    onSuccess: ({ url }) => window.location.assign(url),
  });
  if (phase === "skeleton") {
    return <McpConsentSkeleton />;
  }
  if (phase === "pending") {
    return null;
  }

  const { data } = context;
  if (!data) {
    return <ConsentError />;
  }

  const availableScopes = data.scopes.filter((scope) => requested.has(scope));
  const tools = data.tools.filter(({ scopes: required }) =>
    required.every((scope) => requested.has(scope)),
  );
  const workspaces = data.workspaces.map(({ id, name }) => ({ label: name, value: id }));
  const { mutate: handleDecision } = consent;
  return (
    <>
      {(context.isError || consent.isError) && <ConsentError />}
      <div className="grid min-w-0 gap-1 rounded-xl border bg-muted/40 px-4 py-3 text-sm">
        <span className="wrap-anywhere font-medium">
          {data.client.name ?? m.mcp_unnamed_client()}
        </span>
        <code className="wrap-anywhere font-mono text-xs text-muted-foreground">{clientId}</code>
      </div>
      <Field className="min-w-0">
        <FieldLabel htmlFor="mcp-workspace">{m.mcp_select_workspace()}</FieldLabel>
        <Select
          disabled={consent.isPending}
          items={workspaces}
          value={workspaceId}
          onValueChange={(value) => {
            setWorkspaceId(value);
            setScopes(availableScopes);
          }}
        >
          <SelectTrigger id="mcp-workspace" className="w-full min-w-0" size="lg">
            <SelectValue placeholder={m.mcp_select_workspace()} />
          </SelectTrigger>
          <SelectPopup
            alignItemWithTrigger={false}
            className="w-(--anchor-width) max-w-(--available-width)"
          >
            <SelectGroup>
              {workspaces.map(({ label, value }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectPopup>
        </Select>
        {workspaces.length === 0 && (
          <p className="text-sm text-muted-foreground">{m.mcp_no_workspace()}</p>
        )}
      </Field>
      <ScopePicker
        availableScopes={availableScopes}
        disabled={!workspaceId || consent.isPending}
        onScopeChange={(scope, checked) =>
          setScopes((current) =>
            checked ? [...current, scope] : current.filter((item) => item !== scope),
          )
        }
        scopes={scopes}
        tools={tools}
      />
      <ConsentActions
        canAuthorize={Boolean(workspaceId) && scopes.length > 0}
        onDecision={handleDecision}
        pendingAction={consent.isPending ? consent.variables : undefined}
      />
    </>
  );
}

function Authorize() {
  const hydrated = useHydrated();
  const { data: session, isPending } = authClient.useSession();
  const phase = useSkeletonPhase(!hydrated || isPending);

  useEffect(() => {
    if (hydrated && !isPending && !session) {
      // 原样保留 OAuth 签名查询串，路由的搜索参数序列化可能改写其值。 / Preserve the signed OAuth query verbatim because router search serialization can rewrite its values.
      const next = window.location.pathname + window.location.search;
      window.location.replace(`/sign-in?${new URLSearchParams({ next })}`);
    }
  }, [hydrated, isPending, session]);
  return (
    <AuthPageLayout contentClassName="max-w-lg">
      <div className="grid gap-2 text-center">
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
          {m.mcp_authorize_title()}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">{m.mcp_authorize_description()}</p>
      </div>
      {!session && phase === "skeleton" && <McpConsentSkeleton />}
      {hydrated && session && (
        <ConsentForm oauthQuery={window.location.search.slice(1)} userId={session.user.id} />
      )}
    </AuthPageLayout>
  );
}

export const Route = createFileRoute("/mcp/authorize")({
  component: Authorize,
  head: () => ({
    meta: [
      { title: `${m.mcp_authorize_title()} — Sainoa` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
