import { getLocale } from "@/paraglide/runtime";

export function TimeDisplay({
  value,
  as: Tag = "time",
  emptyText = "—",
  options,
}: {
  value: string | number | Date | null | undefined;
  as?: "span" | "time";
  emptyText?: string;
  options?: string;
}) {
  return (
    <Tag>
      {value === null || value === undefined
        ? emptyText
        : new Intl.DateTimeFormat(getLocale(), {
            dateStyle: "short",
            timeStyle: options ? undefined : "short",
          }).format(new Date(value))}
    </Tag>
  );
}
