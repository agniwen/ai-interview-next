import { useQuery } from "@tanstack/react-query";
import { IconUsers } from "@tabler/icons-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCreateHandle as createDialogHandle,
  DialogTrigger,
} from "@/components/ui/dialog";
import * as m from "@/paraglide/messages";
import { CandidateResumesDialog } from "./candidate-resumes-dialog";
import { atsKeys } from "./query-keys";
import { atsApi, atsDate, readAts } from "./client";
import { AtsListPage } from "./list-page";
import type { AtsPageProps } from "./list-page";
import { listParams } from "./list-search";

export function CandidatesPage({ workspaceId, query, onQueryChange }: AtsPageProps) {
  const resumesDialog = useMemo(() => createDialogHandle<{ id: string; name: string }>(), []);
  const { data, isError, refetch } = useQuery({
    queryFn: async ({ signal }) =>
      readAts(
        await atsApi.candidates.$get(
          { param: { workspaceId }, query: listParams(query) },
          { init: { signal } },
        ),
      ),
    queryKey: atsKeys.candidates(workspaceId)._ctx.list(query).queryKey,
  });
  return (
    <>
      <AtsListPage
        title={m.ats_candidates()}
        icon={IconUsers}
        headings={[m.ats_name(), m.ats_employer(), m.ats_contact(), m.ats_date(), m.ats_action()]}
        rows={data?.rows.map((row) => ({
          cells: [
            row.name,
            row.latestEmployer ?? "—",
            row.email ?? row.phoneNormalized ?? "—",
            atsDate(row.createdAt),
            <DialogTrigger
              handle={resumesDialog}
              key="resumes"
              payload={{ id: row.id, name: row.name }}
              render={<Button size="sm" variant="outline" />}
            >
              {m.ats_view_candidate_resumes()}
            </DialogTrigger>,
          ],
          id: row.id,
        }))}
        empty={m.ats_empty_candidates()}
        error={isError}
        query={query}
        searchPlaceholder={m.ats_search_candidates()}
        total={data?.total ?? 0}
        onQueryChange={onQueryChange}
        onRefresh={refetch}
      />
      <Dialog handle={resumesDialog}>
        {({ payload }) =>
          payload && (
            <CandidateResumesDialog
              id={payload.id}
              key={`${workspaceId}/${payload.id}`}
              name={payload.name}
              workspaceId={workspaceId}
            />
          )
        }
      </Dialog>
    </>
  );
}
