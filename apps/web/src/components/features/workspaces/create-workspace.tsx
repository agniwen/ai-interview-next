import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";
import { authData, useWorkspaceAction } from "@/lib/workspaces/actions";
import { WorkspaceFeedback } from "./workspace-feedback";
import * as m from "@/paraglide/messages";

/**
 * 创建工作区的名称表单，通过工作区操作层提交并展示错误。
 * Workspace-name form submitting creation through workspace actions and displaying errors.
 */
export function CreateWorkspace() {
  const [name, setName] = useState("");
  const action = useWorkspaceAction<string>();
  const navigate = useNavigate();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        action.mutate(
          async () => {
            const workspace = authData(
              await authClient.organization.create({
                keepCurrentActiveOrganization: true,
                name: name.trim(),
                slug: crypto.randomUUID(),
              }),
            );
            return workspace.id;
          },
          {
            onSuccess: (workspaceId) => {
              void navigate({ params: { workspaceId }, to: "/w/$workspaceId/agent" });
            },
          },
        );
      }}
    >
      <Field>
        <FieldLabel htmlFor="workspace-name">{m.ws_name()}</FieldLabel>
        <Input
          id="workspace-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </Field>
      <WorkspaceFeedback error={action.error} />
      <Button type="submit" disabled={action.isPending || !name.trim()}>
        {action.isPending && <Spinner />}
        {m.ws_create()}
      </Button>
    </form>
  );
}
