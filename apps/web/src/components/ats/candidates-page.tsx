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
import { atsApi, atsDate, readAts } from "./client";
import { AtsListPage } from "./list-page";
import type { AtsPageProps } from "./list-page";

export function CandidatesPage({ workspaceId, page, onPage }: AtsPageProps) {
  const resumesDialog = useMemo(() => createDialogHandle<{ id: string; name: string }>(), []);
  const { data, isError } = useQuery({
    queryFn: async () =>
      readAts(
        await atsApi.candidates.$get({ param: { workspaceId }, query: { page: String(page) } }),
      ),
    queryKey: ["ats", workspaceId, "candidates", page],
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
        page={page}
        pageSize={data?.pageSize ?? 20}
        total={data?.total ?? 0}
        onPage={onPage}
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
