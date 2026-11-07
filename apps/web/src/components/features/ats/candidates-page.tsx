import { LocalTime } from "@/components/local-time";
import { useQuery } from "@tanstack/react-query";
import { IconMail, IconPhone, IconUsers } from "@tabler/icons-react";
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
import { atsApi, readAts } from "./client";
import { AtsListPage } from "./list-page";
import type { AtsPageProps } from "./list-page";
import { listParams } from "./list-search";

function CandidateContactLink({
  email,
  phoneNormalized,
}: {
  email: string | null;
  phoneNormalized: string | null;
}) {
  const contact = email || phoneNormalized;
  if (!contact) {
    return "—";
  }

  const Icon = email ? IconMail : IconPhone;
  return (
    <a
      className="inline-flex items-center gap-1.5 rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      href={email ? `mailto:${email}` : `tel:${contact}`}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      {contact}
    </a>
  );
}

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
        hasRowActions
        headings={[m.ats_name(), m.ats_employer(), m.ats_contact(), m.ats_date()]}
        rows={data?.rows.map((row) => ({
          action: (
            <DialogTrigger
              handle={resumesDialog}
              payload={{ id: row.id, name: row.name }}
              render={<Button size="sm" variant="outline" />}
            >
              {m.ats_view_candidate_resumes()}
            </DialogTrigger>
          ),
          cells: [
            row.name,
            row.latestEmployer ?? "—",
            <CandidateContactLink
              email={row.email}
              key="contact"
              phoneNormalized={row.phoneNormalized}
            />,
            <LocalTime key="date" value={row.createdAt} format="date" />,
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
