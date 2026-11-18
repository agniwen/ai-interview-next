import { createQueryKeys } from "@lukemorales/query-key-factory";
import { IconRefresh } from "@tabler/icons-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { z } from "zod";
import { AtsTable } from "@/components/features/ats/list-page";
import { TableFilters, TableFilterSelect } from "@/components/layout/table-filters";
import { VirtualListTable } from "@/components/layout/virtual-list-table";
import type { virtualListFeatures } from "@/components/layout/virtual-list-table";
import { LocalTime } from "@/components/local-time";
import { AccountUsageSkeleton } from "@/components/skeletons/components/account-usage-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Frame } from "@/components/ui/frame";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import { workspaceApi } from "@/lib/workspaces/client";
import * as m from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

const stageLabel = {
  application_evaluation: m.usage_application_evaluation,
  interview_evaluation: m.usage_interview_evaluation,
  interview_realtime: m.usage_interview_realtime,
  interview_reconciliation: m.usage_interview_reconciliation,
  resume_avatar: m.usage_resume_avatar,
  resume_ocr: m.usage_resume_ocr,
  resume_structure: m.usage_resume_structure,
};

const providerLabel = { dashscope: "DashScope", deepseek: "DeepSeek", openai: "OpenAI" };

const stages = Object.keys(stageLabel) as (keyof typeof stageLabel)[];
const periods = ["7d", "30d", "90d"] as const;

export const usageSearch = z.object({
  model: z.string().trim().min(1).max(200).optional().catch(undefined),
  period: z.enum(periods).optional().catch(undefined),
  stage: z.enum(stages).optional().catch(undefined),
  status: z.enum(["normal", "retry"]).optional().catch(undefined),
});

export type UsageFilters = z.output<typeof usageSearch>;

const usageKeys = createQueryKeys("model-usage", {
  mine: (workspaceId: string, filters: UsageFilters) => [workspaceId, filters],
});

async function loadUsage(
  workspaceId: string,
  filters: UsageFilters,
  page: number,
  signal: AbortSignal,
) {
  const response = await workspaceApi.api.usage[":workspaceId"].me.$get(
    { param: { workspaceId }, query: { ...filters, page: String(page) } },
    { init: { signal } },
  );
  if (!response.ok) {
    throw new Error(m.usage_load_error());
  }
  return response.json();
}

type UsageData = Awaited<ReturnType<typeof loadUsage>>;
type UsageRow = UsageData["rows"][number];
interface UsageTotals {
  pages: number;
  tokens: number;
}

function number(value: number) {
  return new Intl.NumberFormat(getLocale()).format(value);
}

function UsageSummary({ label, value }: { label: string; value: UsageTotals }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-3.5 sm:px-4">
      <dt className="mb-2 text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-base font-semibold tabular-nums sm:text-lg">
        {m.usage_tokens({ count: number(value.tokens) })}
      </dd>
      <dd className="text-xs text-muted-foreground tabular-nums">
        {m.usage_pages({ count: number(value.pages) })}
      </dd>
    </div>
  );
}

function UsageMeasurement({ row }: { row: UsageRow }) {
  if (row.pages !== null) {
    return <span className="tabular-nums">{m.usage_pages({ count: number(row.pages) })}</span>;
  }
  const audio = row.inputAudioTokens !== null || row.outputAudioTokens !== null;
  return (
    <div className="flex flex-col gap-0.5 text-xs tabular-nums">
      <span>
        {m.usage_input_output({
          input: number(row.inputTokens ?? 0),
          output: number(row.outputTokens ?? 0),
        })}
      </span>
      {row.cachedInputTokens !== null && (
        <span className="text-muted-foreground">
          {m.usage_cached({ count: number(row.cachedInputTokens) })}
        </span>
      )}
      {audio && (
        <span className="text-muted-foreground">
          {m.usage_audio({
            input: number(row.inputAudioTokens ?? 0),
            output: number(row.outputAudioTokens ?? 0),
          })}
        </span>
      )}
    </div>
  );
}

const usageColumn = createColumnHelper<typeof virtualListFeatures, UsageRow>();
const columnWidths = ["28%", "24%", "29%", "19%"];

function usageColumns(locale: ReturnType<typeof getLocale>) {
  return usageColumn.columns([
    usageColumn.display({
      cell: ({ row: { original: row } }) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium">{stageLabel[row.stage]()}</span>
          <span
            className="truncate text-xs text-muted-foreground"
            title={row.filename ?? undefined}
          >
            {row.filename ?? "—"}
          </span>
        </div>
      ),
      header: m.usage_stage({}, { locale }),
      id: "stage",
    }),
    usageColumn.display({
      cell: ({ row: { original: row } }) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate" title={row.model}>
            {row.model}
          </span>
          <span className="text-xs text-muted-foreground">{providerLabel[row.provider]}</span>
        </div>
      ),
      header: m.usage_model({}, { locale }),
      id: "model",
    }),
    usageColumn.display({
      cell: ({ row: { original: row } }) => (
        <div className="flex flex-col items-start gap-1">
          <UsageMeasurement row={row} />
          {row.retry && <Badge variant="warning">{m.usage_retry()}</Badge>}
        </div>
      ),
      header: m.usage_measurement({}, { locale }),
      id: "measurement",
    }),
    usageColumn.display({
      cell: ({ row: { original: row } }) => (
        <LocalTime value={row.occurredAt} className="text-xs text-muted-foreground" />
      ),
      header: m.usage_time({}, { locale }),
      id: "time",
    }),
  ]);
}

function UsageFilterBar({
  filters,
  models,
  onChange,
  refreshing,
  refresh,
}: {
  filters: UsageFilters;
  models: string[];
  onChange: (filters: UsageFilters) => void;
  refreshing: boolean;
  refresh: () => Promise<unknown>;
}) {
  const all = { label: m.usage_filter_all(), value: "" as const };
  const active = Object.values(filters).some(Boolean);
  return (
    <TableFilters>
      <TableFilterSelect
        label={m.usage_filter_stage()}
        value={filters.stage ?? ""}
        options={[all, ...stages.map((stage) => ({ label: stageLabel[stage](), value: stage }))]}
        onChange={(stage) => onChange({ ...filters, stage: stage || undefined })}
      />
      <TableFilterSelect
        label={m.usage_model()}
        value={filters.model ?? ""}
        options={[all, ...models.map((model) => ({ label: model, value: model }))]}
        onChange={(model) => onChange({ ...filters, model: model || undefined })}
        triggerClassName="max-w-48"
      />
      <TableFilterSelect<"" | "normal" | "retry">
        label={m.ats_status()}
        value={filters.status ?? ""}
        options={[
          all,
          { label: m.usage_normal(), value: "normal" },
          { label: m.usage_retry(), value: "retry" },
        ]}
        onChange={(status) => onChange({ ...filters, status: status || undefined })}
      />
      <TableFilterSelect
        label={m.usage_filter_period()}
        value={filters.period ?? ""}
        options={[
          all,
          ...periods.map((period) => ({
            label: m.usage_filter_days({ days: period.slice(0, -1) }),
            value: period,
          })),
        ]}
        onChange={(period) => onChange({ ...filters, period: period || undefined })}
      />
      {active && (
        <Button variant="outline" onClick={() => onChange({})}>
          {m.usage_filter_reset()}
        </Button>
      )}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label={m.ats_refresh()}
              disabled={refreshing}
              onClick={refresh}
            >
              <IconRefresh aria-hidden="true" />
            </Button>
          }
        />
        <TooltipPopup>{m.ats_refresh()}</TooltipPopup>
      </Tooltip>
    </TableFilters>
  );
}

export function AccountUsage({
  workspaceId,
  filters,
  onFiltersChange,
}: {
  workspaceId: string;
  filters: UsageFilters;
  onFiltersChange: (filters: UsageFilters) => void;
}) {
  const usage = useInfiniteQuery({
    ...usageKeys.mine(workspaceId, filters),
    getNextPageParam: ({ page, pageSize, total }: UsageData) =>
      page * pageSize < total ? page + 1 : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => loadUsage(workspaceId, filters, pageParam, signal),
  });
  const phase = useSkeletonPhase(usage.isPending);
  const locale = getLocale();
  const columns = useMemo(() => usageColumns(locale), [locale]);
  const rows = useMemo(() => usage.data?.pages.flatMap((page) => page.rows) ?? [], [usage.data]);
  const data = usage.data?.pages[0];
  const models = data?.models ?? [];
  const filtered = Object.values(filters).some(Boolean);

  return (
    <section aria-labelledby="model-usage-title" className="flex min-w-0 flex-col gap-4">
      <div className="space-y-1 px-1">
        <h2 id="model-usage-title" className="text-base font-semibold">
          {m.usage_title()}
        </h2>
        <p className="text-sm text-muted-foreground">{m.usage_description()}</p>
      </div>
      <UsageFilterBar
        filters={filters}
        models={
          filters.model && !models.includes(filters.model) ? [filters.model, ...models] : models
        }
        onChange={onFiltersChange}
        refreshing={usage.isFetching}
        refresh={usage.refetch}
      />
      {phase === "skeleton" && <AccountUsageSkeleton />}
      {phase === "ready" && usage.isError && !usage.isFetchNextPageError && (
        <Alert variant="error">
          <AlertDescription>{m.usage_load_error()}</AlertDescription>
        </Alert>
      )}
      {phase === "ready" && data && (
        <>
          <dl className="grid grid-cols-3 gap-3">
            <UsageSummary label={m.usage_total()} value={data.summary.total} />
            <UsageSummary label={m.usage_normal()} value={data.summary.normal} />
            <UsageSummary label={m.usage_retry()} value={data.summary.retry} />
          </dl>
          {data.summary.breakdown.length > 0 && (
            <details className="min-w-0">
              <summary className="cursor-pointer px-1 text-sm font-medium">
                {m.usage_breakdown()}
              </summary>
              <div className="pt-3">
                <AtsTable
                  headings={[
                    m.usage_filter_stage(),
                    m.usage_model(),
                    m.usage_measurement(),
                    m.ats_status(),
                  ]}
                  rows={data.summary.breakdown.map((group) => ({
                    cells: [
                      stageLabel[group.stage](),
                      group.model,
                      group.stage === "resume_ocr"
                        ? m.usage_pages({ count: number(group.pages) })
                        : m.usage_tokens({ count: number(group.tokens) }),
                      group.retry ? m.usage_retry() : m.usage_normal(),
                    ],
                    id: JSON.stringify([group.stage, group.provider, group.model, group.retry]),
                  }))}
                />
              </div>
            </details>
          )}
          {rows.length > 0 ? (
            <Frame>
              <VirtualListTable
                key={JSON.stringify([workspaceId, filters])}
                className="min-w-[43rem]"
                scrollAreaClassName="h-[min(40rem,66dvh)] sm:h-[40rem]"
                columns={columns}
                columnWidths={columnWidths}
                data={rows}
                hasNextPage={usage.hasNextPage}
                isFetching={usage.isFetching}
                isFetchingNextPage={usage.isFetchingNextPage}
                isFetchNextPageError={usage.isFetchNextPageError}
                label={m.usage_records()}
                loadingLabel={m.ats_loading()}
                loadMore={usage.fetchNextPage}
                retryLabel={m.ats_retry()}
                total={data.total}
                variant="card"
              />
            </Frame>
          ) : (
            <p className="rounded-xl border px-4 py-6 text-center text-sm text-muted-foreground">
              {filtered ? m.usage_empty_filtered() : m.usage_empty()}
            </p>
          )}
        </>
      )}
    </section>
  );
}
