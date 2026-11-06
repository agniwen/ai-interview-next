import type { ReactNode } from "react";
import { Group, GroupSeparator, GroupText } from "@/components/ui/group";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function TableFilters({ children, actions }: { children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-slot="table-filters">
      {children}
      {actions}
    </div>
  );
}

export function TableFilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Group className="[&>[data-slot=select-trigger][data-disabled]]:shadow-xs/5 [&>[data-slot=select-trigger][data-disabled]]:before:shadow-[0_1px_--theme(--color-black/4%)] dark:[&>[data-slot=select-trigger][data-disabled]]:before:shadow-[0_-1px_--theme(--color-white/6%)]">
      <GroupText aria-hidden="true" className="bg-background dark:bg-input/32">
        {label}
      </GroupText>
      <GroupSeparator />
      {children}
    </Group>
  );
}

export function TableFilterSelect<Value extends string | number>({
  label,
  options,
  value,
  onChange,
  triggerClassName,
}: {
  label: string;
  options: { label: string; value: Value }[];
  value: Value;
  onChange: (value: Value) => void;
  triggerClassName?: string;
}) {
  return (
    <TableFilterGroup label={label}>
      <Select
        items={options}
        value={value}
        onValueChange={(next) => next !== null && onChange(next)}
      >
        <SelectTrigger aria-label={label} className={cn("w-fit", triggerClassName)}>
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectPopup>
      </Select>
    </TableFilterGroup>
  );
}
