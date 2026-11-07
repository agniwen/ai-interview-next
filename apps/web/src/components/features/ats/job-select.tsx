import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxCollection,
  ComboboxChips,
  ComboboxChip,
  ComboboxEmpty,
  ComboboxChipsInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxStatus,
} from "@/components/ui/combobox";
import * as m from "@/paraglide/messages";
import { atsApi, readAts } from "./client";
import { atsKeys } from "./query-keys";

export interface JobOption {
  id: string;
  title: string;
}

async function readJobOptions(
  workspaceId: string,
  page: number,
  search: string,
  signal: AbortSignal,
) {
  return readAts(
    await atsApi.jobs.$get(
      {
        param: { workspaceId },
        query: { page: String(page), pageSize: "20", search },
      },
      { init: { signal } },
    ),
  );
}

type JobPage = Awaited<ReturnType<typeof readJobOptions>>;

export function JobSelect({
  id,
  disabled,
  onChange,
  value,
  workspaceId,
}: {
  id: string;
  disabled?: boolean;
  onChange: (value: JobOption[]) => void;
  value: JobOption[];
  workspaceId: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useInfiniteQuery({
    enabled: open,
    getNextPageParam: (page: JobPage) =>
      page.page * page.pageSize < page.total ? page.page + 1 : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      readJobOptions(workspaceId, pageParam, debouncedSearch, signal),
    queryKey: atsKeys.jobs(workspaceId)._ctx.picker(debouncedSearch).queryKey,
  });
  const pending = search !== debouncedSearch || query.isPending;
  const rows = pending ? [] : (query.data?.pages.flatMap((page) => page.rows) ?? []);
  return (
    <Combobox
      multiple
      disabled={disabled}
      filter={null}
      isItemEqualToValue={(item, selected) => item.id === selected.id}
      items={rows}
      itemToStringLabel={(row) => row.title}
      itemToStringValue={(row) => row.id}
      onInputValueChange={(input, details) => {
        if (details.reason === "input-change" || details.reason === "clear-press") {
          setSearch(input.trim());
        }
      }}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setSearch("");
        }
      }}
      onValueChange={onChange}
      value={value}
    >
      <ComboboxChips>
        {value.map((row) => (
          <ComboboxChip
            key={row.id}
            removeProps={{ "aria-label": `${m.question_sets_unbind_job()} ${row.title}` }}
          >
            {row.title}
          </ComboboxChip>
        ))}
        <ComboboxChipsInput id={id} maxLength={200} placeholder={m.ats_select_job()} />
      </ComboboxChips>
      <ComboboxPopup className="w-(--anchor-width)">
        {!pending && !query.isError && <ComboboxEmpty>{m.ats_empty_jobs()}</ComboboxEmpty>}
        <ComboboxList>
          <ComboboxCollection>
            {(row: JobOption) => (
              <ComboboxItem key={row.id} value={row}>
                {row.title}
              </ComboboxItem>
            )}
          </ComboboxCollection>
        </ComboboxList>
        {(pending || query.isFetchingNextPage) && (
          <ComboboxStatus>{m.ats_loading()}</ComboboxStatus>
        )}
        {query.hasNextPage && !query.isError && !pending && (
          <ComboboxStatus>
            <Button
              size="sm"
              variant="ghost"
              loading={query.isFetchingNextPage}
              onClick={() => query.fetchNextPage()}
            >
              {m.ats_load_more()}
            </Button>
          </ComboboxStatus>
        )}
        {query.isError && (
          <ComboboxStatus>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())}
            >
              {m.ats_retry()}
            </Button>
          </ComboboxStatus>
        )}
      </ComboboxPopup>
    </Combobox>
  );
}
