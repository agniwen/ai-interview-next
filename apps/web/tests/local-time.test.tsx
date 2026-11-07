import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import { LocalTime } from "@/components/local-time";
import { formatLocalDateTime } from "@/lib/date-time";

const instant = "2026-11-07T01:17:00.000Z";
const probeCode = `
  import { createElement } from "react";
  import { renderToString } from "react-dom/server";
  import { LocalTime, LocalTimeZone } from "./src/components/local-time";
  import { TimeRange } from "./src/components/ui/time-range";
  import { deviceTimeZone, formatLocalDateTime, localDateTime } from "./src/lib/date-time";
  const instant = "2026-11-07T01:17:00.000Z";
  const times = ["2026-03-08T06:30:00Z", "2026-03-08T07:30:00Z", "2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z"];
  console.log(JSON.stringify({
    version: 1,
    zone: deviceTimeZone(),
    date: formatLocalDateTime(instant, "zh-CN", "date"),
    time: formatLocalDateTime(instant, "en", "time"),
    chineseTime: formatLocalDateTime(instant, "zh-CN", "time"),
    dateInput: formatLocalDateTime(new Date(instant), "en", "time"),
    numberInput: formatLocalDateTime(new Date(instant).getTime(), "en", "time"),
    saved: localDateTime(instant, "en").toDate().toISOString(),
    transitions: times.map((value) => localDateTime(value, "en").format("HH:mm Z")),
    timeMarkup: renderToString(createElement(LocalTime, { value: instant })),
    zoneMarkup: renderToString(createElement(LocalTimeZone)),
    rangeMarkup: renderToString(createElement(TimeRange, {
      value: { from: new Date(instant), to: new Date("2026-11-07T02:17:00.000Z") },
      startLabel: "Start", endLabel: "Deadline", onChange: () => {},
    })),
  }));
`;
interface TimeProbe {
  version: 1;
  zone: string;
  date: string;
  time: string;
  chineseTime: string;
  dateInput: string;
  numberInput: string;
  saved: string;
  transitions: string[];
  timeMarkup: string;
  zoneMarkup: string;
  rangeMarkup: string;
}

function inZone(zone: string): TimeProbe {
  return JSON.parse(
    execFileSync("bun", ["--eval", probeCode], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf-8",
      env: { ...process.env, TZ: zone },
      timeout: 10_000,
    }),
  );
}

it.each([
  ["Asia/Shanghai", "2026年11月7日", "09:17"],
  ["Asia/Tokyo", "2026年11月7日", "10:17"],
  ["America/Los_Angeles", "2026年11月6日", "17:17"],
])("uses device time in %s independently of the interface language", (zone, date, time) => {
  expect(inZone(zone)).toMatchObject({
    chineseTime: time,
    date,
    dateInput: time,
    numberInput: time,
    saved: instant,
    time,
    zone,
  });
});

it("renders the same SSR time and range markup regardless of the server time zone", () => {
  const utc = inZone("UTC");
  const pacific = inZone("America/Los_Angeles");
  const shanghai = inZone("Asia/Shanghai");
  expect(utc.timeMarkup).toContain('dateTime="2026-11-07T01:17:00.000Z"');
  expect(utc.timeMarkup).toContain('aria-busy="true">—</time>');
  expect(utc.timeMarkup).toBe(pacific.timeMarkup);
  expect(utc.timeMarkup).toBe(shanghai.timeMarkup);
  expect(utc.zoneMarkup).toBe(pacific.zoneMarkup);
  expect(utc.zoneMarkup).toBe(shanghai.zoneMarkup);
  expect(utc.rangeMarkup).toBe(pacific.rangeMarkup);
  expect(utc.rangeMarkup).toBe(shanghai.rangeMarkup);
});

it("displays saved instants with the correct offsets across both daylight-saving transitions", () => {
  expect(inZone("America/New_York").transitions).toEqual([
    "01:30 -05:00",
    "03:30 -04:00",
    "01:30 -04:00",
    "01:30 -05:00",
  ]);
});

it("keeps locale selection isolated between formatting calls", () => {
  const english = formatLocalDateTime(instant, "en", "date");
  expect(formatLocalDateTime(instant, "zh-CN", "date")).toContain("年");
  expect(formatLocalDateTime(instant, "ko", "date")).toContain("년");
  expect(formatLocalDateTime(instant, "ja", "date")).toContain("年");
  expect(formatLocalDateTime(instant, "en", "date")).toBe(english);
});

it("keeps missing time values empty instead of treating them as the current time", () => {
  expect(renderToString(<LocalTime value={null} />)).toBe("<time>—</time>");
  expect(renderToString(<LocalTime as="span" value={undefined} emptyText="Empty" />)).toBe(
    "<span>Empty</span>",
  );
});
