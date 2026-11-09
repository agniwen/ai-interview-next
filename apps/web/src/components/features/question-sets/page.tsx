import { LocalTime } from "@/components/local-time";
import { questionSetEditorLinkOptions } from "./navigation";
import { IconListCheck } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import * as m from "@/paraglide/messages";
import { AtsListPage } from "../ats/list-page";
import type { AtsPageProps } from "../ats/list-page";
import { questionSetsQuery } from "./client";
import type { QuestionSetListSearch } from "./list-search";

/**
 * 题套列表，按表单题或沟通题分类查询，并提供新建和编辑入口。
 * Question-set list filtered by form or conversation type, with create and edit entry points.
 */
export function QuestionSetsPage({
  workspaceId,
  query,
  onQueryChange,
}: AtsPageProps<QuestionSetListSearch>) {
  const { data, isError, refetch } = useQuery(questionSetsQuery(workspaceId, query));
  const isForm = query.kind === "form";
  const createLabel = isForm
    ? m.question_sets_create_form()
    : m.question_sets_create_conversation();

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
        <Button
          variant="outline"
          render={<Link {...questionSetEditorLinkOptions(workspaceId, "new", query)} />}
        >
          {createLabel}
        </Button>
      }
      hasRowActions
      headings={[
        m.question_sets_name(),
        m.question_sets_count_heading(),
        m.question_sets_default_jobs(),
        m.interviewer_agents_updated_at(),
      ]}
      rows={data?.rows.map((row) => ({
        action: (
          <Button
            size="sm"
            variant="outline"
            aria-label={m.question_sets_edit_named({ name: row.name })}
            render={<Link {...questionSetEditorLinkOptions(workspaceId, row.id, query)} />}
          >
            {m.ats_edit()}
          </Button>
        ),
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
          <div key="jobs" className="flex max-w-lg flex-wrap items-center gap-1">
            {row.defaultAllJobs ? (
              <Badge variant="secondary">{m.question_sets_all_jobs()}</Badge>
            ) : (
              <>
                {row.defaultJobs.length === 0 && <span className="text-muted-foreground">—</span>}
                {row.defaultJobs.slice(0, 3).map((job) => (
                  <Badge key={job.id} variant="secondary" className="max-w-40">
                    <span className="truncate" title={job.title}>
                      {job.title}
                    </span>
                  </Badge>
                ))}
                {row.defaultJobs.length > 3 && (
                  <Badge
                    variant="secondary"
                    title={row.defaultJobs
                      .slice(3)
                      .map((job) => job.title)
                      .join("、")}
                  >
                    +{row.defaultJobs.length - 3}
                  </Badge>
                )}
              </>
            )}
          </div>,
          <LocalTime key="date" value={row.updatedAt} />,
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
    />
  );
}
