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
      <div className="w-48">
        <ChoicePicker
          ariaLabel={m.ats_creator()}
          id={id}
          kind="member"
          workspaceId={workspaceId}
          pinnedOptions={[all, me]}
          excludeId={session?.user.id}
          value={selected}
          onChange={(choice) => onChange(choice?.id || undefined)}
        />
      </div>
    </TableFilterGroup>
  );
}
