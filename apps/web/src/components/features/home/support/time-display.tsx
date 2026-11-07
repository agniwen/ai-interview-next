import { LocalTime } from "@/components/local-time";

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
    <LocalTime
      as={Tag}
      value={value}
      emptyText={emptyText}
      format={options ? "shortDate" : "dateTime"}
    />
  );
}
