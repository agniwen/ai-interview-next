import { useHydrated } from "@tanstack/react-router";
import { deviceTimeZone, formatLocalDateTime, localDateTime } from "@/lib/date-time";
import type { DateTimeFormat, DateTimeValue } from "@/lib/date-time";
import { cn } from "@/lib/utils";
import { getLocale } from "@/paraglide/runtime";
import * as m from "@/paraglide/messages";

/**
 * 将时间值显示为设备本地时间；水合前保留占位，避免使用服务器时区。
 * Displays a value in device-local time, retaining a placeholder before hydration to avoid using the server zone.
 */
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

/**
 * 显示当前设备的时区说明，水合前保留空白占位。
 * Displays the current device's time-zone label, retaining a blank placeholder before hydration.
 */
export function LocalTimeZone({
  className,
  format = "label",
}: {
  className?: string;
  format?: "label" | "name";
}) {
  const hydrated = useHydrated();
  const zone = format === "name" ? deviceTimeZone() : m.time_zone_local({ zone: deviceTimeZone() });
  return (
    <span className={cn("wrap-anywhere", className)} aria-busy={!hydrated}>
      {hydrated ? zone : "\u00A0"}
    </span>
  );
}
