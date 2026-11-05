import { useQuery } from "@tanstack/react-query";
import { IconUsers } from "@tabler/icons-react";
import * as m from "@/paraglide/messages";
import { atsApi, atsDate, readAts } from "./client";
import { AtsListPage } from "./list-page";
import type { AtsPageProps } from "./list-page";

export function CandidatesPage({ workspaceId, page, onPage }: AtsPageProps) {
  const { data, isError } = useQuery({
    queryFn: async () =>
      readAts(
        await atsApi.candidates.$get({ param: { workspaceId }, query: { page: String(page) } }),
      ),
    queryKey: ["ats", workspaceId, "candidates", page],
  });
  return (
    <AtsListPage
      title={m.ats_candidates()}
      icon={IconUsers}
      headings={[m.ats_name(), m.ats_employer(), m.ats_contact(), m.ats_date()]}
      rows={data?.rows.map((row) => ({
        cells: [
          row.name,
          row.latestEmployer ?? "—",
          row.email ?? row.phoneNormalized ?? "—",
          atsDate(row.createdAt),
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
  );
}
