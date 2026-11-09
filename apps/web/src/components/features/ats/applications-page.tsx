import { LocalTime } from "@/components/local-time";
import { applicationDetailLinkOptions } from "./detail-navigation";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { IconListDetails } from "@tabler/icons-react";
import { InterviewFlowPreview } from "@/components/features/interviews/interview-flow-preview";
import { Button } from "@/components/ui/button";
import { TableFilterSelect } from "@/components/layout/table-filters";
import { DialogCreateHandle as createDialogHandle, DialogTrigger } from "@/components/ui/dialog";
import { UserColumn } from "@/components/user-column";
import * as m from "@/paraglide/messages";
import { ApplicationStatusBadge } from "./application-status-badge";
import { atsKeys } from "./query-keys";
import { atsApi, atsStatus, getResumeCandidateDisplay, readAts } from "./client";
import { CreateApplicationDialog } from "./create-application-dialog";
import { JobPreviewCard } from "./job-preview-card";
import { AtsListPage } from "./list-page";
import type { AtsPageProps } from "./list-page";
import { listParams, applicationStatuses } from "./list-search";
import type { ApplicationListSearch } from "./list-search";
import { ProjectFilter } from "./project-select";
import { RecommendationBadge } from "./recommendation-badge";

/**
 * 招聘记录列表，连接 URL 筛选与分页参数、列表查询和创建记录弹窗。
 * Application list connecting URL filters and pagination to queries and the creation dialog.
 */
export function ApplicationsPage({
  workspaceId,
  query,
  onQueryChange,
}: AtsPageProps<ApplicationListSearch>) {
  const createDialog = useMemo(() => createDialogHandle<string>(), []);
  const param = { workspaceId };
  const { data, isError, refetch } = useQuery({
    queryFn: async ({ signal }) =>
      readAts(
        await atsApi.applications.$get({ param, query: listParams(query) }, { init: { signal } }),
      ),
    queryKey: atsKeys.applications(workspaceId)._ctx.list(query).queryKey,
    refetchInterval: ({ state }) =>
      state.data?.rows.some(
        (row) => row.evaluationStatus === "queued" || row.evaluationStatus === "running",
      )
        ? 5000
        : false,
  });
  return (
    <AtsListPage
      title={m.ats_applications()}
      icon={IconListDetails}
      action={
        <DialogTrigger handle={createDialog} render={<Button variant="outline" />}>
          {m.ats_create_application()}
        </DialogTrigger>
      }
      filters={
        <>
          <ProjectFilter
            onChange={(projectId) => onQueryChange({ page: 1, projectId: projectId ?? undefined })}
            value={query.projectId ?? null}
            workspaceId={workspaceId}
          />
          <TableFilterSelect
            label={m.ats_status()}
            onChange={(status) => onQueryChange({ page: 1, status: status || undefined })}
            options={[
              { label: m.ats_all_statuses(), value: "" },
              ...applicationStatuses.map((status) => ({
                label: status === "open" ? m.ats_open() : m.ats_closed(),
                value: status,
              })),
            ]}
            value={query.status ?? ""}
          />
        </>
      }
      hasRowActions
      headings={[
        m.ats_candidate(),
        m.ats_job(),
        m.ats_evaluation(),
        m.ats_status(),
        m.ats_interview_flow(),
        m.ats_date(),
      ]}
      rows={data?.rows.map((row) => ({
        action: (
          <Button
            size="sm"
            variant="outline"
            render={<Link {...applicationDetailLinkOptions(workspaceId, row.id, query)} />}
          >
            {m.ats_view_application()}
          </Button>
        ),
        cells: [
          <UserColumn key="candidate" user={getResumeCandidateDisplay(workspaceId, row)} />,
          <JobPreviewCard
            id={row.jobId}
            key="job"
            title={row.jobTitle}
            workspaceId={workspaceId}
          />,
          row.evaluationRecommendation ? (
            <RecommendationBadge key="evaluation" level={row.evaluationRecommendation} summary />
          ) : (
            atsStatus(row.evaluationStatus === "succeeded" ? null : row.evaluationStatus)
          ),
          <ApplicationStatusBadge closedAt={row.closedAt} key="status" outcome={row.outcome} />,
          row.latestInterview ? (
            <InterviewFlowPreview
              applicationId={row.id}
              key="interview-flow"
              round={row.latestInterview}
              workspaceId={workspaceId}
            />
          ) : (
            "—"
          ),
          <LocalTime key="date" value={row.createdAt} format="date" />,
        ],
        id: row.id,
      }))}
      empty={m.ats_empty_applications()}
      error={isError}
      query={query}
      searchPlaceholder={m.ats_search_applications()}
      total={data?.total ?? 0}
      onQueryChange={onQueryChange}
      onRefresh={refetch}
    >
      <CreateApplicationDialog handle={createDialog} workspaceId={workspaceId} />
    </AtsListPage>
  );
}
