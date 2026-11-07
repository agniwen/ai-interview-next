import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxInput,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxPopup,
  ComboboxList,
  ComboboxCollection,
  ComboboxItem,
  ComboboxEmpty,
  ComboboxStatus,
} from "@/components/ui/combobox";
import type { ComboboxPrimitive } from "@/components/ui/combobox";
import { UserColumn } from "@/components/user-column";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import * as m from "@/paraglide/messages";
import { choicesQuery } from "./client";
import type { Choice, ChoiceKind } from "./client";

const noExcluded: string[] = [];

function ChoiceInput({
  id,
  kind,
  multiple,
  value,
}: {
  id: string;
  kind: ChoiceKind;
  multiple?: boolean;
  value: Choice | readonly Choice[] | null | undefined;
}) {
  const selected: readonly Choice[] = Array.isArray(value) ? value : [];
  const person = value && "id" in value ? value : null;
  return multiple ? (
    <ComboboxChips>
      {selected.map((row) => (
        <ComboboxChip
          key={row.id}
          className="max-w-full"
          removeProps={{ "aria-label": `${m.interviews_remove()} ${row.name}` }}
        >
          {kind === "member" ? <UserColumn user={row} className="max-w-48" /> : row.name}
        </ComboboxChip>
      ))}
      <ComboboxChipsInput
        id={id}
        maxLength={200}
        className="min-w-24"
        placeholder={m.interviews_select()}
      />
    </ComboboxChips>
  ) : (
    <ComboboxInput
      id={id}
      className="w-full"
      maxLength={200}
      placeholder={m.interviews_select()}
      showClear
      startAddon={
        kind === "member" && person ? (
          <Avatar className="[--avatar-size:18px]">
            <AvatarImage alt="" referrerPolicy="no-referrer" src={person.image ?? undefined} />
            <AvatarFallback className="text-[10px]">
              {person.name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : undefined
      }
    />
  );
}

/**
 * 面试配置共用搜索选择器，按资源加载成员、Agent 或题套选项，支持单选和多选。
 * Shared interview configuration picker loading member, Agent or question-set options for single or multiple selection.
 */
export function ChoicePicker<Multiple extends boolean = false>({
  id,
  workspaceId,
  kind,
  value,
  onChange,
  disabled,
  multiple,
  excluded = noExcluded,
}: {
  id: string;
  workspaceId: string;
  kind: ChoiceKind;
  value: ComboboxPrimitive.Root.Props<Choice, Multiple>["value"];
  onChange: ComboboxPrimitive.Root.Props<Choice, Multiple>["onValueChange"];
  multiple?: Multiple;
  disabled?: boolean;
  excluded?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useInfiniteQuery({
    ...choicesQuery(workspaceId, kind, debouncedSearch),
    enabled: open,
  });
  const pending = search !== debouncedSearch || query.isPending;
  const rows = pending
    ? []
    : (query.data?.pages.flatMap((page) => page.rows).filter((row) => !excluded.includes(row.id)) ??
      []);
  const selected: readonly Choice[] = value && "id" in value ? [value] : (value ?? []);
  const items = [
    ...rows,
    ...selected.filter((person) => !rows.some((row) => row.id === person.id)),
  ];
  return (
    <Combobox<Choice, Multiple>
      multiple={multiple}
      items={items}
      filteredItems={rows}
      filter={null}
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      isItemEqualToValue={(a, b) => a.id === b.id}
      itemToStringLabel={(row) => row.name}
      itemToStringValue={(row) => row.id}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSearch("");
        }
      }}
      onInputValueChange={(text, details) => {
        if (
          details.reason === "input-change" ||
          details.reason === "clear-press" ||
          details.reason === "input-clear"
        ) {
          setSearch(text.trim());
        }
      }}
    >
      <ChoiceInput id={id} kind={kind} multiple={multiple} value={value} />
      <ComboboxPopup className="w-(--anchor-width)">
        {!pending && !query.isError && <ComboboxEmpty>{m.interviews_no_options()}</ComboboxEmpty>}
        <ComboboxList>
          <ComboboxCollection>
            {(row: Choice) => (
              <ComboboxItem key={row.id} value={row}>
                {kind === "member" ? (
                  <div className="flex min-w-0 items-center gap-2 py-0.5">
                    <UserColumn user={row} className="max-w-[45%] shrink-0" />
                    <span
                      className="min-w-0 truncate text-xs text-muted-foreground"
                      title={row.email}
                    >
                      {row.email}
                    </span>
                  </div>
                ) : (
                  row.name
                )}
                {row.questionCount !== undefined && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {m.question_sets_question_count({ count: row.questionCount })}
                  </span>
                )}
              </ComboboxItem>
            )}
          </ComboboxCollection>
        </ComboboxList>
        {(pending || query.isFetchingNextPage) && (
          <ComboboxStatus>{m.ats_loading()}</ComboboxStatus>
        )}
        {query.hasNextPage && !pending && !query.isError && (
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
