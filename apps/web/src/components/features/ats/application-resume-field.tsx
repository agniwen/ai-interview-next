import { LocalTime } from "@/components/local-time";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxStatus,
} from "@/components/ui/combobox";
import { Field, FieldLabel } from "@/components/ui/field";
import { UserColumn } from "@/components/user-column";
import * as m from "@/paraglide/messages";
import { atsKeys } from "./query-keys";
import { atsApi, readAts } from "./client";

async function readResumeOptions(
  workspaceId: string,
  query: { offsetMinutes: string; page: string; search: string },
  signal: AbortSignal,
) {
  return readAts(
    await atsApi.applications["resume-options"].$get(
      { param: { workspaceId }, query },
      { init: { signal } },
    ),
  );
}

type ApplicationResumeOptions = Awaited<ReturnType<typeof readResumeOptions>>;
export type ApplicationResumeOption = ApplicationResumeOptions["rows"][number];

function ResumeOptionContent({ row }: { row: ApplicationResumeOption }) {
  const targetRoles = row.targetRoles.join(" · ");
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate font-medium text-sm" title={row.filename ?? undefined}>
        {row.filename ?? m.ats_unnamed_resume()}
      </span>
      <dl className="grid grid-cols-[auto_auto_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 text-xs">
        <div className="contents">
          <dt className="text-muted-foreground">{m.ats_candidate()}</dt>
          <dd className="col-span-3 truncate" title={row.candidateName ?? undefined}>
            {row.candidateName ?? "—"}
          </dd>
        </div>
        <div className="contents">
          <dt className="text-muted-foreground">{m.resume_profile_target_roles()}</dt>
          <dd className="col-span-3 truncate" title={targetRoles || undefined}>
            {targetRoles || "—"}
          </dd>
        </div>
        <div className="contents">
          <dt className="text-muted-foreground">{m.ats_date()}</dt>
          <dd className="whitespace-nowrap">
            <LocalTime value={row.createdAt} format="date" />
          </dd>
        </div>
        <div className="contents">
          <dt className="text-muted-foreground">{m.ats_creator()}</dt>
          <dd className="min-w-0">
            <UserColumn className="max-w-full gap-1.5 text-xs" user={row.creator} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * 创建招聘记录时选择工作区内的简历，管理搜索、日期筛选与追加加载，选中值由调用方持有。
 * Workspace resume picker for application creation; owns search, date filtering and pagination while the caller owns selection.
 */
export function ApplicationResumeField({
  onChange,
  value,
  workspaceId,
}: {
  onChange: (value: ApplicationResumeOption | null) => void;
  value: ApplicationResumeOption | null;
  workspaceId: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const [offsetMinutes, setOffsetMinutes] = useState(0);
  const query = useInfiniteQuery({
    enabled: open,
    getNextPageParam: (lastPage: ApplicationResumeOptions) => lastPage.nextPage ?? undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      readResumeOptions(
        workspaceId,
        {
          offsetMinutes: String(offsetMinutes),
          page: String(pageParam),
          search: debouncedSearch,
        },
        signal,
      ),
    queryKey: atsKeys.resumes(workspaceId)._ctx.options(debouncedSearch, offsetMinutes).queryKey,
  });
  const pending = search !== debouncedSearch || query.isPending;
  const rows = pending ? [] : (query.data?.pages.flatMap((page) => page.rows) ?? []);

  return (
    <Field>
      <FieldLabel htmlFor="ats-application-resume">{m.ats_resumes()}</FieldLabel>
      <Combobox
        filter={null}
        isItemEqualToValue={(item, selected) => item.id === selected.id}
        items={rows}
        itemToStringLabel={(row) => row.filename ?? m.ats_unnamed_resume()}
        itemToStringValue={(row) => row.id}
        onInputValueChange={(input, details) => {
          if (details.reason === "input-change" || details.reason === "clear-press") {
            setSearch(input.trim());
          }
        }}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (isOpen) {
            setOffsetMinutes(-new Date().getTimezoneOffset());
          } else {
            setSearch("");
          }
        }}
        onValueChange={onChange}
        value={value}
      >
        <ComboboxInput
          className="w-full"
          id="ats-application-resume"
          maxLength={200}
          placeholder={m.ats_search_resume()}
          showClear
        />
        <ComboboxPopup
          className="w-(--anchor-width)"
          onScrollCapture={(event) => {
            const viewport = event.target;
            if (
              viewport instanceof HTMLElement &&
              viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 64 &&
              query.hasNextPage &&
              !query.isFetching &&
              !query.isFetchNextPageError
            ) {
              void query.fetchNextPage();
            }
          }}
        >
          {!pending && !query.isError && (
            <ComboboxEmpty>
              {debouncedSearch ? m.ats_no_matching_resumes() : m.ats_no_completed_resumes()}
            </ComboboxEmpty>
          )}
          <ComboboxList>
            <ComboboxCollection>
              {(row: ApplicationResumeOption) => (
                <ComboboxItem className="py-1.5" key={row.id} value={row}>
                  <ResumeOptionContent row={row} />
                </ComboboxItem>
              )}
            </ComboboxCollection>
          </ComboboxList>
          {(pending || query.isFetchingNextPage) && (
            <ComboboxStatus>{m.ats_loading()}</ComboboxStatus>
          )}
          {query.isError && (
            <ComboboxStatus>
              <Button
                onClick={() =>
                  query.isFetchNextPageError ? query.fetchNextPage() : query.refetch()
                }
                size="sm"
                variant="ghost"
              >
                {m.ats_retry()}
              </Button>
            </ComboboxStatus>
          )}
        </ComboboxPopup>
      </Combobox>
    </Field>
  );
}
