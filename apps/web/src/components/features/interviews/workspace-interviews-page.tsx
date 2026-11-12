import { IconCalendarEvent } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { z } from "zod";
import { TableFilterSelect } from "@/components/layout/table-filters";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import * as m from "@/paraglide/messages";
import { readAts } from "../ats/client";
import { AtsListPage } from "../ats/list-page";
import type { AtsPageProps } from "../ats/list-page";
import { listParams, listSearch } from "../ats/list-search";
import { interviewKeys, interviewsApi } from "./client";
import { interviewFlowStatus, interviewKindLabel, interviewRoundStatusLabel } from "./round-labels";

const kinds = ["ai", "human"] as const;
const statuses = ["scheduled", "in_progress", "completed"] as const;

export const workspaceInterviewsSearch = listSearch.extend({
  kind: z.enum(kinds).optional().catch(undefined),
  status: z.enum(statuses).optional().catch(undefined),
});

export function WorkspaceInterviewsPage({
  workspaceId,
  query,
  onQueryChange,
}: AtsPageProps<z.output<typeof workspaceInterviewsSearch>>) {
  const { data, isError, refetch } = useQuery({
    queryFn: async ({ signal }) =>
      readAts(
        await interviewsApi.rounds.$get(
          { param: { workspaceId }, query: listParams(query) },
          { init: { signal } },
        ),
      ),
    queryKey: interviewKeys.workspace(workspaceId)._ctx.list(query).queryKey,
  });
  return (
    <AtsListPage
      title={m.interviews_title()}
      icon={IconCalendarEvent}
      hasRowActions
      filters={
        <>
          <TableFilterSelect
            label={m.interviews_type()}
            onChange={(kind) => onQueryChange({ kind: kind || undefined, page: 1 })}
            options={[
              { label: m.interviews_all_types(), value: "" },
              ...kinds.map((kind) => ({ label: interviewKindLabel(kind), value: kind })),
            ]}
            value={query.kind ?? ""}
          />
          <TableFilterSelect
            label={m.ats_status()}
            onChange={(status) => onQueryChange({ page: 1, status: status || undefined })}
            options={[
              { label: m.ats_all_statuses(), value: "" },
              ...statuses.map((status) => ({
                label: interviewFlowStatus(status).label(),
                value: status,
              })),
            ]}
            value={query.status ?? ""}
          />
        </>
      }
      headings={[
        m.ats_candidate(),
        m.ats_job(),
        m.interviews_title(),
        m.interviews_type(),
        m.interviews_interviewers(),
        m.interviews_scheduled_time(),
        m.ats_status(),
      ]}
      rows={data?.rows.map((row) => ({
        action: (
          <Button
            size="sm"
            variant="outline"
            render={
              <Link
                to="/w/$workspaceId/hub/applications/$id/result/$roundId"
                params={{ id: row.applicationId, roundId: row.id, workspaceId }}
                search={{ tab: "interviews" }}
              />
            }
          >
            {m.dashboard_interview_details()}
          </Button>
        ),
        cells: [
          row.candidateName,
          row.jobTitle,
          <div key="round" className="space-y-0.5">
            <div className="font-medium">
              {row.label || m.interviews_round({ number: row.sequence })}
            </div>
            {row.label && (
              <div className="text-xs text-muted-foreground">
                {m.interviews_round({ number: row.sequence })}
              </div>
            )}
          </div>,
          interviewKindLabel(row.kind),
          row.agentName ?? (row.interviewers.map(({ name }) => name).join(" · ") || "—"),
          row.scheduledAt ? (
            <LocalTime key="schedule" value={row.scheduledAt} format="dateTime" />
          ) : (
            "—"
          ),
          <Badge key="status" variant={interviewFlowStatus(row.status).variant}>
            {interviewRoundStatusLabel(row)}
          </Badge>,
        ],
        id: row.id,
      }))}
      empty={m.interviews_empty()}
      error={isError}
      query={query}
      searchPlaceholder={m.interviews_search()}
      total={data?.total ?? 0}
      onQueryChange={onQueryChange}
      onRefresh={refetch}
    />
  );
}
