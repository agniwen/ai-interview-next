import { LocalTime } from "@/components/local-time";
import { IconBriefcase } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import * as m from "@/paraglide/messages";
import { atsKeys } from "./query-keys";
import { atsApi, readAts } from "./client";
import { AtsListPage } from "./list-page";
import type { AtsPageProps } from "./list-page";
import { listParams } from "./list-search";
import type { JobListSearch } from "./list-search";
import { ProjectPreviewCard } from "./project-preview-card";
import { ProjectFilter } from "./project-select";
import { jobEditorLinkOptions } from "./job-navigation";

export function JobsPage({ workspaceId, query, onQueryChange }: AtsPageProps<JobListSearch>) {
  const { data, isError, refetch } = useQuery({
    queryFn: async ({ signal }) =>
      readAts(
        await atsApi.jobs.$get(
          { param: { workspaceId }, query: listParams(query) },
          { init: { signal } },
        ),
      ),
    queryKey: atsKeys.jobs(workspaceId)._ctx.list(query).queryKey,
  });
  return (
    <AtsListPage
      title={m.ats_job()}
      icon={IconBriefcase}
      action={
        <Button
          variant="outline"
          render={<Link {...jobEditorLinkOptions(workspaceId, "new", query)} />}
        >
          {m.ats_create_job()}
        </Button>
      }
      filters={
        <ProjectFilter
          onChange={(projectId) => onQueryChange({ page: 1, projectId: projectId ?? undefined })}
          value={query.projectId ?? null}
          workspaceId={workspaceId}
        />
      }
      hasRowActions
      headings={[m.ats_job(), m.ats_project(), m.ats_date()]}
      rows={data?.rows.map((row) => ({
        action: (
          <Button
            size="sm"
            variant="outline"
            render={<Link {...jobEditorLinkOptions(workspaceId, row.id, query)} />}
          >
            {m.ats_edit()}
          </Button>
        ),
        cells: [
          row.title,
          row.projectId && row.projectTitle ? (
            <ProjectPreviewCard
              key="project"
              id={row.projectId}
              title={row.projectTitle}
              workspaceId={workspaceId}
            />
          ) : (
            "—"
          ),
          <LocalTime key="date" value={row.createdAt} format="date" />,
        ],
        id: row.id,
      }))}
      empty={m.ats_empty_jobs()}
      error={isError}
      query={query}
      searchPlaceholder={m.ats_search_jobs()}
      total={data?.total ?? 0}
      onQueryChange={onQueryChange}
      onRefresh={refetch}
    />
  );
}
