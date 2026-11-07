import { IconArrowLeft } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useCanGoBack, useLocation, useRouter } from "@tanstack/react-router";
import { lazy } from "react";
import { PageHeader, PageHeaderContent } from "@/components/layout/page-header";
import { QuestionSetSkeleton } from "@/components/skeletons/components/question-set-skeleton";
import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import * as m from "@/paraglide/messages";
import { questionSetQuery } from "./client";
import type { QuestionSetListSearch } from "./list-search";

const FormSetEditor = lazy(async () => {
  const { FormSetEditor: Editor } = await import("./form-editor");
  return { default: Editor };
});

const ConversationSetEditor = lazy(async () => {
  const { ConversationSetEditor: Editor } = await import("./conversation-editor");
  return { default: Editor };
});

/**
 * 题套新建与编辑页面，按题套类型加载对应编辑器，并处理加载、错误与返回导航。
 * Question-set create/edit page selecting the editor by type and handling loading, errors and return navigation.
 */
export function QuestionSetEditorPage({
  id,
  workspaceId,
  search,
}: {
  id: string;
  workspaceId: string;
  search: QuestionSetListSearch;
}) {
  const isNew = id === "new";
  const router = useRouter();
  const masked = useLocation({ select: (location) => Boolean(location.maskedLocation) });
  const canGoBack = useCanGoBack();
  const backToList = masked && canGoBack;
  const { data, isPending, isFetching, refetch } = useQuery({
    ...questionSetQuery(workspaceId, id),
    enabled: !isNew,
  });
  const phase = useSkeletonPhase(!isNew && isPending);
  const kind = data?.content.kind ?? search.kind;
  const createLabel =
    kind === "form" ? m.question_sets_create_form() : m.question_sets_create_conversation();
  const editLabel =
    kind === "form" ? m.question_sets_edit_form() : m.question_sets_edit_conversation();
  const CreateEditor = kind === "form" ? FormSetEditor : ConversationSetEditor;
  const onSuccess = () => {
    if (backToList && (!isNew || search.page === 1)) {
      router.history.back();
    } else {
      void router.navigate({
        params: { workspaceId },
        replace: true,
        search: { ...search, kind, page: isNew ? 1 : search.page },
        to: "/w/$workspaceId/hub/questions",
      });
    }
  };

  let content;
  if (phase === "skeleton") {
    content = <QuestionSetSkeleton />;
  } else if (phase === "ready") {
    if (isNew) {
      content = <CreateEditor key={kind} workspaceId={workspaceId} onSuccess={onSuccess} />;
    } else if (data) {
      content =
        data.content.kind === "form" ? (
          <FormSetEditor
            record={{ ...data, content: data.content }}
            workspaceId={workspaceId}
            onSuccess={onSuccess}
          />
        ) : (
          <ConversationSetEditor
            record={{ ...data, content: data.content }}
            workspaceId={workspaceId}
            onSuccess={onSuccess}
          />
        );
    } else {
      content = (
        <div className="flex flex-col items-start gap-4">
          <Alert variant="error">
            <AlertDescription>{m.ats_error()}</AlertDescription>
          </Alert>
          <Button
            variant="outline"
            loading={isFetching}
            onClick={() => {
              void refetch();
            }}
          >
            {m.ats_retry()}
          </Button>
        </div>
      );
    }
  }

  return (
    <>
      <PageHeaderContent>
        <Button
          size="sm"
          variant="ghost"
          onClick={backToList ? () => router.history.back() : undefined}
          render={
            backToList ? undefined : (
              <Link to="/w/$workspaceId/hub/questions" params={{ workspaceId }} search={search} />
            )
          }
        >
          <IconArrowLeft aria-hidden="true" data-icon="inline-start" />
          {m.question_sets_back()}
        </Button>
      </PageHeaderContent>
      <div className="mx-auto flex w-full min-w-0 max-w-4xl flex-1 flex-col gap-6 pt-2 md:pt-4">
        <PageHeader
          title={isNew ? createLabel : editLabel}
          description={
            kind === "form"
              ? m.question_sets_all_required_help()
              : m.question_sets_conversation_help()
          }
        />
        <SkeletonSuspense fallback={<QuestionSetSkeleton />}>{content}</SkeletonSuspense>
      </div>
    </>
  );
}
