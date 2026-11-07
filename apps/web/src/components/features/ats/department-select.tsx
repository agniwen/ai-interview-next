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
import * as m from "@/paraglide/messages";
import { atsApi, readAts } from "./client";
import { atsKeys } from "./query-keys";

export interface DepartmentOption {
  id: string;
  name: string;
}

async function readDepartmentOptions(
  workspaceId: string,
  page: number,
  search: string,
  signal: AbortSignal,
) {
  return readAts(
    await atsApi.departments.$get(
      {
        param: { workspaceId },
        query: { page: String(page), pageSize: "20", search },
      },
      { init: { signal } },
    ),
  );
}

type DepartmentPage = Awaited<ReturnType<typeof readDepartmentOptions>>;

/**
 * 工作区部门的搜索选择器，内部加载分页选项，调用方持有选中部门。
 * Searchable workspace department picker; loads paginated options while the caller owns selection.
 */
export function DepartmentSelect({
  id,
  onChange,
  value,
  workspaceId,
}: {
  id: string;
  onChange: (value: DepartmentOption | null) => void;
  value: DepartmentOption | null;
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
    getNextPageParam: (page: DepartmentPage) =>
      page.page * page.pageSize < page.total ? page.page + 1 : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      readDepartmentOptions(workspaceId, pageParam, debouncedSearch, signal),
    queryKey: atsKeys.departments(workspaceId)._ctx.options(debouncedSearch).queryKey,
  });
  const pending = search !== debouncedSearch || query.isPending;
  const rows = pending ? [] : (query.data?.pages.flatMap((page) => page.rows) ?? []);
  return (
    <Combobox
      filter={null}
      isItemEqualToValue={(item, selected) => item.id === selected.id}
      items={rows}
      itemToStringLabel={(row) => row.name}
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
      <ComboboxInput
        id={id}
        className="w-full"
        maxLength={200}
        placeholder={m.ats_select_department()}
        showClear
      />
      <ComboboxPopup className="w-(--anchor-width)">
        {!pending && !query.isError && <ComboboxEmpty>{m.ats_empty_departments()}</ComboboxEmpty>}
        <ComboboxList>
          <ComboboxCollection>
            {(row: DepartmentOption) => (
              <ComboboxItem key={row.id} value={row}>
                {row.name}
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
