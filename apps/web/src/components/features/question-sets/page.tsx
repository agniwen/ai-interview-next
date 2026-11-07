import { IconListCheck } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { lazy, useMemo } from "react";
import { FormQuestionSetSkeleton } from "@/components/skeletons/components/form-question-set-skeleton";
import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCreateHandle as createDialogHandle,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import * as m from "@/paraglide/messages";
import { atsDate } from "../ats/client";
import { AtsListPage } from "../ats/list-page";
import type { AtsPageProps } from "../ats/list-page";
import { questionSetQuery, questionSetsQuery } from "./client";
import type { QuestionSetListSearch } from "./list-search";

const FormSetEditor = lazy(async () => {
  const { FormSetEditor: Editor } = await import("./form-editor");
  return { default: Editor };
});

function EditFormSet({
  id,
  workspaceId,
  onSuccess,
}: {
  id: string;
  workspaceId: string;
  onSuccess: () => void;
}) {
  const { data, isPending, isFetching, refetch } = useQuery(questionSetQuery(workspaceId, id));
  const phase = useSkeletonPhase(isPending);
  if (phase === "pending") {
    return null;
  }
  if (phase === "skeleton") {
    return (
      <DialogPanel>
        <FormQuestionSetSkeleton />
      </DialogPanel>
    );
  }
  if (!data) {
    return (
      <DialogPanel className="flex flex-col gap-4">
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
          {m.ats_refresh()}
        </Button>
      </DialogPanel>
    );
  }
  // 此步骤只提供表单编辑，按已建立的内容类型选择对应界面。
  // This step provides form editing only; select the UI using the established content kind.
  if (data.content.kind === "conversation") {
    return <DialogPanel>{m.question_sets_conversation_readonly()}</DialogPanel>;
  }
  return (
    <FormSetEditor
      record={{ ...data, content: data.content }}
      workspaceId={workspaceId}
      onSuccess={onSuccess}
    />
  );
}

export function QuestionSetsPage({
  workspaceId,
  query,
  onQueryChange,
}: AtsPageProps<QuestionSetListSearch>) {
  const dialog = useMemo(() => createDialogHandle<{ id: string }>(), []);
  const { data, isError, refetch } = useQuery(questionSetsQuery(workspaceId, query));
  const isForm = query.kind === "form";

  return (
    <AtsListPage
      title={m.question_sets_title()}
      description={m.question_sets_help()}
      icon={IconListCheck}
      navigation={
        <SegmentedControl render={<nav aria-label={m.question_sets_kind()} />}>
          {(["form", "conversation"] as const).map((kind) => (
            <SegmentedControlItem
              key={kind}
              data-checked={query.kind === kind ? "" : undefined}
              aria-current={query.kind === kind ? "page" : undefined}
              render={
                <Link
                  to="/w/$workspaceId/hub/questions"
                  params={{ workspaceId }}
                  search={{ ...query, kind, page: 1 }}
                />
              }
            >
              {kind === "form" ? m.question_sets_form() : m.question_sets_conversation()}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      }
      action={
        isForm ? (
          <DialogTrigger handle={dialog} render={<Button variant="outline" />}>
            {m.question_sets_create_form()}
          </DialogTrigger>
        ) : undefined
      }
      hasRowActions={isForm}
      headings={[
        m.question_sets_name(),
        m.question_sets_count_heading(),
        m.interviewer_agents_updated_at(),
      ]}
      rows={data?.rows.map((row) => ({
        action: isForm ? (
          <DialogTrigger
            handle={dialog}
            payload={{ id: row.id }}
            aria-label={m.question_sets_edit_named({ name: row.name })}
            render={<Button size="sm" variant="outline" />}
          >
            {m.ats_edit()}
          </DialogTrigger>
        ) : undefined,
        cells: [
          <div key="name" className="flex min-w-48 max-w-lg flex-col gap-1">
            <span className="truncate font-medium">{row.name}</span>
            {row.description && (
              <span className="line-clamp-2 whitespace-normal text-muted-foreground wrap-anywhere">
                {row.description}
              </span>
            )}
          </div>,
          row.questionCount,
          atsDate(row.updatedAt, "short"),
        ],
        id: row.id,
      }))}
      empty={m.question_sets_empty()}
      error={isError}
      query={query}
      searchPlaceholder={m.question_sets_search()}
      total={data?.total ?? 0}
      onQueryChange={onQueryChange}
      onRefresh={refetch}
    >
      <Dialog handle={dialog}>
        {({ payload }) => (
          <DialogPopup className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {payload ? m.question_sets_edit_form() : m.question_sets_create_form()}
              </DialogTitle>
              <DialogDescription>{m.question_sets_all_required_help()}</DialogDescription>
            </DialogHeader>
            <SkeletonSuspense
              fallback={
                <DialogPanel>
                  <FormQuestionSetSkeleton />
                </DialogPanel>
              }
            >
              {payload ? (
                <EditFormSet
                  key={payload.id}
                  id={payload.id}
                  workspaceId={workspaceId}
                  onSuccess={() => dialog.close()}
                />
              ) : (
                <FormSetEditor
                  workspaceId={workspaceId}
                  onSuccess={() => {
                    dialog.close();
                    if (query.page !== 1) {
                      onQueryChange({ page: 1 });
                    }
                  }}
                />
              )}
            </SkeletonSuspense>
          </DialogPopup>
        )}
      </Dialog>
    </AtsListPage>
  );
}
