import { LocalTime } from "@/components/local-time";

/**
 * 首页演示的时间显示适配层，委托共用 LocalTime 使用设备时区格式化。
 * Homepage-demo time adapter delegating device-local formatting to shared LocalTime.
 */
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
