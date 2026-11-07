import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import "dayjs/locale/ja";
import "dayjs/locale/ko";
import "dayjs/locale/zh-cn";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);

export type DateTimeValue = string | number | Date;
const formats = {
  date: "ll",
  dateTime: "lll",
  monthDay: "M/D",
  shortDate: "l",
  time: "HH:mm",
  weekdayDate: "ll ddd",
} as const;
export type DateTimeFormat = keyof typeof formats;

/** 每次按实例设置语言，避免 SSR 请求之间共享语言状态。
 * Set the locale per instance so SSR requests never share mutable locale state. */
export function localDateTime(value: DateTimeValue, locale: string) {
  return dayjs(value).local().locale(locale.toLowerCase());
}

export function formatLocalDateTime(value: DateTimeValue, locale: string, format: DateTimeFormat) {
  return localDateTime(value, locale).format(formats[format]);
}

export function deviceTimeZone() {
  return dayjs.tz.guess();
}
