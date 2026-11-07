import { IconArrowUp } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Composer,
  ComposerActionGroup,
  ComposerActions,
  ComposerInput,
  ComposerSubmit,
  getComposerText,
} from "@/components/ui/composer";
import type { ComposerValue } from "@/components/ui/composer";
import * as m from "@/paraglide/messages";
import { atsApi, readAts } from "./client";
import { atsKeys } from "./query-keys";

/**
 * 招聘记录的人工反馈输入框，提交文本后刷新该记录的评价与反馈数据。
 * Human feedback composer for an application; refreshes its evaluation and feedback data after submission.
 */
export function ApplicationEvaluationComposer({
  applicationId,
  workspaceId,
}: {
  applicationId: string;
  workspaceId: string;
}) {
  const [value, setValue] = useState<ComposerValue>([]);
  const client = useQueryClient();
  const send = useMutation({
    mutationFn: async (body: string) =>
      readAts(
        await atsApi.applications[":id"].feedback.$post({
          json: { body, version: 1 },
          param: { id: applicationId, workspaceId },
        }),
      ),
    async onSuccess() {
      setValue([]);
      await client.invalidateQueries({ queryKey: atsKeys.applications(workspaceId).queryKey });
    },
  });

  return (
    <div className="flex flex-col gap-2">
      {send.isError && (
        <Alert variant="error">
          <AlertDescription>{m.ats_error()}</AlertDescription>
        </Alert>
      )}
      <Composer
        layout="adaptive"
        className="rounded-[14px] border-border/70 bg-background shadow-xs/5 transition-[border-color,border-radius,box-shadow] duration-150 [--composer-max-height:160px] before:shadow-none! has-[[data-slot=composer-input]:focus-visible]:border-foreground/12 has-[[data-slot=composer-input]:focus-visible]:shadow-[0_4px_20px_-4px_rgb(0_0_0/0.06)] has-[[data-slot=composer-input]:focus-visible]:ring-0 dark:bg-muted/35"
        disabled={send.isPending}
        submitDisabled={getComposerText(value).length > 30_000}
        submitOnEnter="desktop"
        value={value}
        onValueChange={setValue}
        onSubmit={(next) => send.mutate(getComposerText(next))}
      >
        <ComposerInput
          aria-label={m.ats_evaluation_write()}
          placeholder={m.ats_evaluation_placeholder()}
          render={<textarea maxLength={30_000} />}
        />
        <ComposerActions>
          <ComposerActionGroup align="end">
            <ComposerSubmit
              render={
                <Button aria-label={m.agent_send()} size="icon-sm" loading={send.isPending} />
              }
            >
              <IconArrowUp aria-hidden="true" />
            </ComposerSubmit>
          </ComposerActionGroup>
        </ComposerActions>
      </Composer>
    </div>
  );
}
