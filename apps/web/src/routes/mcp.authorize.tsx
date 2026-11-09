import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth/client";
import { mcpKeys } from "@/lib/mcp/query-keys";
import { workspaceApi } from "@/lib/workspaces/client";
import * as m from "@/paraglide/messages";

const api = workspaceApi.api["mcp-management"];
const scopeLabels = {
  "applications:read": m.mcp_applications_read,
  "applications:write": m.mcp_applications_write,
  "candidates:read": m.mcp_candidates_read,
  "candidates:write": m.mcp_candidates_write,
  "jobs:read": m.mcp_jobs_read,
  "jobs:write": m.mcp_jobs_write,
  "organization:read": m.mcp_organization_read,
  "organization:write": m.mcp_organization_write,
  "resumes:read": m.mcp_resumes_read,
  "resumes:write": m.mcp_resumes_write,
};

type Scope = keyof typeof scopeLabels;

function ScopePicker({
  availableScopes,
  scopes,
  setScopes,
}: {
  availableScopes: Scope[];
  scopes: Scope[];
  setScopes: Dispatch<SetStateAction<Scope[]>>;
}) {
  return (
    <fieldset className="grid grid-cols-2 gap-3">
      <legend className="mb-3 text-sm font-medium">{m.mcp_scopes()}</legend>
      {availableScopes.map((scope) => (
        <div key={scope} className="flex items-center gap-2">
          <Checkbox
            id={scope}
            checked={scopes.includes(scope)}
            onCheckedChange={(checked) =>
              setScopes((current) =>
                checked ? [...current, scope] : current.filter((item) => item !== scope),
              )
            }
          />
          <Label htmlFor={scope}>{scopeLabels[scope]()}</Label>
        </div>
      ))}
    </fieldset>
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
  const availableScopes = context.data?.scopes.filter((scope) => requested.has(scope)) ?? [];
  const workspaces =
    context.data?.workspaces.map(({ id, name }) => ({ label: name, value: id })) ?? [];
  return (
    <>
      {(!clientId || context.isError || consent.isError) && (
        <p role="alert" className="text-sm text-destructive">
          {m.mcp_authorize_error()}
        </p>
      )}
      {context.data && (
        <>
          <div className="grid gap-1 text-sm">
            <span className="font-medium">
              {context.data.client.name ?? m.mcp_unnamed_client()}
            </span>
            <span className="break-all font-mono text-xs text-muted-foreground">{clientId}</span>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mcp-workspace">{m.mcp_select_workspace()}</Label>
            <Select
              items={workspaces}
              value={workspaceId}
              onValueChange={(value) => {
                setWorkspaceId(value);
                setScopes(availableScopes);
              }}
            >
              <SelectTrigger id="mcp-workspace" className="w-full">
                <SelectValue placeholder={m.mcp_select_workspace()} />
              </SelectTrigger>
              <SelectPopup>
                {workspaces.map(({ label, value }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            {workspaces.length === 0 && (
              <p className="text-sm text-muted-foreground">{m.mcp_no_workspace()}</p>
            )}
          </div>
          {workspaceId && (
            <ScopePicker availableScopes={availableScopes} scopes={scopes} setScopes={setScopes} />
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={consent.isPending}
              onClick={() => consent.mutate(false)}
            >
              {m.mcp_deny()}
            </Button>
            <Button
              disabled={consent.isPending || !workspaceId || scopes.length === 0}
              onClick={() => consent.mutate(true)}
            >
              {m.mcp_allow()}
            </Button>
          </div>
        </>
      )}
    </>
  );
}

function Authorize() {
  const hydrated = useHydrated();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (hydrated && !isPending && !session) {
      // 原样保留 OAuth 签名查询串，路由的搜索参数序列化可能改写其值。 / Preserve the signed OAuth query verbatim because router search serialization can rewrite its values.
      const next = window.location.pathname + window.location.search;
      window.location.replace(`/sign-in?${new URLSearchParams({ next })}`);
    }
  }, [hydrated, isPending, session]);
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-6 py-12"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <img alt="" className="size-8" src="/logo.png" />
        Sainoa
      </div>
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{m.mcp_authorize_title()}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{m.mcp_authorize_description()}</p>
      </div>
      {hydrated && session && (
        <ConsentForm oauthQuery={window.location.search.slice(1)} userId={session.user.id} />
      )}
    </main>
  );
}

export const Route = createFileRoute("/mcp/authorize")({
  component: Authorize,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
});
