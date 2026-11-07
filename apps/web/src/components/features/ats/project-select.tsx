import { useQuery } from "@tanstack/react-query";
import { TableFilterGroup } from "@/components/layout/table-filters";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as m from "@/paraglide/messages";
import { atsKeys } from "./query-keys";
import { atsApi, readAts } from "./client";

export function ProjectSelect({
  filter = false,
  onChange,
  value,
  workspaceId,
}: {
  filter?: boolean;
  onChange: (value: string | null) => void;
  value: string | null;
  workspaceId: string;
}) {
  const options = useQuery({
    queryFn: async () => readAts(await atsApi.projects.options.$get({ param: { workspaceId } })),
    queryKey: atsKeys.projects(workspaceId)._ctx.options.queryKey,
  });
  const defaultLabel = filter ? m.ats_all_projects() : m.ats_no_project();
  const items = [
    { label: defaultLabel, value: "" },
    ...(options.data?.rows.map(({ id, title }) => ({ label: title, value: id })) ?? []),
  ];
  return (
    <Select
      disabled={!value && items.length === 1}
      items={items}
      onValueChange={(next) => onChange(next || null)}
      value={value ?? ""}
    >
      <SelectTrigger aria-label={m.ats_project()} className={filter ? "w-36" : "w-full"}>
        <SelectValue placeholder={defaultLabel} />
      </SelectTrigger>
      <SelectPopup>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectPopup>
    </Select>
  );
}

export function ProjectFilter(props: Omit<Parameters<typeof ProjectSelect>[0], "filter">) {
  return (
    <TableFilterGroup label={m.ats_project()}>
      <ProjectSelect {...props} filter />
    </TableFilterGroup>
  );
}
