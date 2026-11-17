import { IconSelector } from "@tabler/icons-react";
import { ComboboxTrigger } from "@/components/ui/combobox";
import { selectTriggerVariants } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useId } from "react";
import { choicesQuery } from "@/components/features/interviews/client";
import { ChoicePicker } from "@/components/features/interviews/choice-picker";
import { TableFilterGroup } from "@/components/layout/table-filters";
import { authClient } from "@/lib/auth/client";
import * as m from "@/paraglide/messages";

export function CreatorFilter({
  workspaceId,
  value,
  onChange,
}: {
  workspaceId: string;
  value?: string;
  onChange: (value: string | undefined) => void;
}) {
  const id = useId();
  const { data: session } = authClient.useSession();
  const all = { id: "", name: m.ats_all_people() };
  const me = { id: "me", name: m.ats_myself() };
  const lookupId = value && value !== me.id ? value : undefined;
  const { data } = useInfiniteQuery({
    ...choicesQuery(workspaceId, "member", lookupId ?? ""),
    enabled: lookupId !== undefined,
  });
  const defaultChoice = value === me.id ? me : all;
  const selected = lookupId
    ? (data?.pages[0]?.rows.find((member) => member.id === lookupId) ?? {
        id: lookupId,
        name: m.ats_creator(),
      })
    : defaultChoice;

  return (
    <TableFilterGroup label={m.ats_creator()}>
      <ChoicePicker
        ariaLabel={m.ats_creator()}
        id={id}
        kind="member"
        workspaceId={workspaceId}
        pinnedOptions={[all, me]}
        excludeId={session?.user.id}
        value={selected}
        onChange={(choice) => onChange(choice?.id || undefined)}
        trigger={
          <ComboboxTrigger
            aria-label={m.ats_creator()}
            className={cn(selectTriggerVariants(), "w-36")}
            data-slot="select-trigger"
          >
            <span className="truncate">{selected.name}</span>
            <IconSelector aria-hidden="true" />
          </ComboboxTrigger>
        }
      />
    </TableFilterGroup>
  );
}
