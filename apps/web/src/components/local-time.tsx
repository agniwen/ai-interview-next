import { useHydrated } from "@tanstack/react-router";
import { deviceTimeZone, formatLocalDateTime, localDateTime } from "@/lib/date-time";
import type { DateTimeFormat, DateTimeValue } from "@/lib/date-time";
import { cn } from "@/lib/utils";
import { getLocale } from "@/paraglide/runtime";
import * as m from "@/paraglide/messages";

export function LocalTime({
  value,
  format = "dateTime",
  as: Tag = "time",
  className,
  emptyText = "—",
}: {
  value: DateTimeValue | null | undefined;
  format?: DateTimeFormat;
  as?: "time" | "span";
  className?: string;
  emptyText?: string;
}) {
  const hydrated = useHydrated();
  if (value === null || value === undefined) {
    return <Tag className={className}>{emptyText}</Tag>;
  }
  const locale = getLocale();
  const date = localDateTime(value, locale);
  return (
    <Tag
      className={className}
      dateTime={Tag === "time" ? date.toISOString() : undefined}
      aria-busy={!hydrated}
      title={hydrated ? `${date.format("lll [UTC]Z")} · ${deviceTimeZone()}` : undefined}
    >
      {/* SSR 与首次 hydration 使用相同占位，接管后才读取设备时区。
        SSR and the first hydration render share a placeholder; device-local text appears afterward. */}
      {hydrated ? formatLocalDateTime(value, locale, format) : "—"}
    </Tag>
  );
}

export function LocalTimeZone({ className }: { className?: string }) {
  const hydrated = useHydrated();
  return (
    <span className={cn("wrap-anywhere", className)} aria-busy={!hydrated}>
      {hydrated ? m.time_zone_local({ zone: deviceTimeZone() }) : "\u00A0"}
    </span>
  );
}
