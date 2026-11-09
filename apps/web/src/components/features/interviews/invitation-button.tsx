import { IconCheck, IconLink } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import * as m from "@/paraglide/messages";
import { createInvitationMutation } from "./client";

/**
 * 为轮次创建或取得邀请链接并复制到剪贴板，同时展示请求与复制反馈。
 * Creates or retrieves a round invitation link, copies it to the clipboard and reports request/copy feedback.
 */
export function InvitationButton({
  kind,
  workspaceId,
  roundId,
}: {
  kind: "ai" | "human";
  workspaceId: string;
  roundId: string;
}) {
  const client = useQueryClient();
  const invitation = useMutation(createInvitationMutation(client, workspaceId));
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="outline"
        size="sm"
        loading={invitation.isPending}
        onClick={async () => {
          setCopyError(false);
          setCopied(false);
          try {
            const { token } = await invitation.mutateAsync(roundId);
            const url = new URL(`/interview/${token}`, window.location.origin);
            if (kind === "human") {
              url.searchParams.set("kind", kind);
            }
            await navigator.clipboard.writeText(url.href);
            setCopied(true);
          } catch {
            setCopyError(true);
          }
        }}
      >
        {copied ? <IconCheck aria-hidden="true" /> : <IconLink aria-hidden="true" />}
        {copied ? m.interviews_invitation_copied() : m.interviews_copy_invitation()}
      </Button>
      {copyError && (
        <Alert variant="error">
          <AlertDescription>{m.interviews_invitation_error()}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
