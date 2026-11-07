import { LocalTime } from "@/components/local-time";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageResponse } from "@/components/ai-elements/message-response";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageAvatar, MessageContent, MessageHeader } from "@/components/ui/message";
import { authClient } from "@/lib/auth/client";
import * as m from "@/paraglide/messages";
import type { ApplicationDetail } from "./application-detail-page";
import { atsApi, readAts } from "./client";
import { evaluationMessages } from "./evaluation-messages";
import { AgentEvaluationMessage } from "./agent-evaluation-message";
import { atsKeys } from "./query-keys";

/**
 * 将人工反馈与分组的 AI 评价组合为时间线，并处理重新评价请求。
 * Combines human feedback and grouped AI evaluations into a timeline and handles reevaluation requests.
 */
export function ApplicationEvaluations({
  application,
  evaluations,
  feedback,
  workspaceId,
}: Pick<ApplicationDetail, "application" | "evaluations" | "feedback"> & { workspaceId: string }) {
  const { data: session } = authClient.useSession();
  const client = useQueryClient();
  const param = { id: application.id, workspaceId };
  const refresh = () =>
    client.invalidateQueries({ queryKey: atsKeys.applications(workspaceId).queryKey });
  const reevaluate = useMutation({
    mutationFn: async () => readAts(await atsApi.applications[":id"].reevaluate.$post({ param })),
    onSuccess: refresh,
  });
  const messages = evaluationMessages(evaluations, feedback);
  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label={m.ats_evaluation()}>
      {reevaluate.isError && (
        <Alert variant="error">
          <AlertDescription>{m.ats_error()}</AlertDescription>
        </Alert>
      )}
      <ul aria-label={m.ats_evaluation_messages()} className="flex min-w-0 flex-col gap-6 py-2">
        {messages.map((message) => {
          if (message.kind === "ai") {
            return (
              <li key={message.id} className="min-w-0">
                {/* 新版本到达时切换到最新版，普通刷新保留选中的版本。
                          Select the latest when a new version arrives; preserve selection on ordinary refreshes. */}
                <AgentEvaluationMessage
                  key={message.versions.at(-1)?.id ?? "pending"}
                  application={application}
                  versions={message.versions}
                  onReevaluate={() => reevaluate.mutate()}
                  reevaluating={reevaluate.isPending}
                />
              </li>
            );
          }
          const own = message.authorId === session?.user.id;
          return (
            <li key={message.id} className="min-w-0">
              <Message align={own ? "end" : "start"}>
                <MessageAvatar className="self-start">
                  <Avatar className="size-8">
                    <AvatarImage src={message.authorImage ?? undefined} alt="" />
                    <AvatarFallback>{message.authorName.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                </MessageAvatar>
                <MessageContent>
                  <MessageHeader className="flex-wrap gap-2">
                    <span>{message.authorName}</span>
                    <LocalTime value={message.createdAt} />
                  </MessageHeader>
                  <Bubble
                    align={own ? "end" : "start"}
                    variant={own ? "tinted" : "muted"}
                    className="max-w-full sm:max-w-[92%]"
                  >
                    <BubbleContent className="px-4 py-3">
                      <MessageResponse>{message.body}</MessageResponse>
                    </BubbleContent>
                  </Bubble>
                </MessageContent>
              </Message>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
