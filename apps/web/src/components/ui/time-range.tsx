import { LocalTime, LocalTimeZone } from "@/components/local-time";
import type { DateRange } from "@daypicker/react";
import { enUS, ja, ko, zhCN } from "@daypicker/react/locale";
import { IconArrowRight, IconCalendarEvent } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { WheelPicker, WheelPickerWrapper } from "@/components/ui/wheel-picker";
import {
  Drawer,
  DrawerPopup,
  DrawerTrigger,
  DrawerHeader,
  DrawerTitle,
  DrawerPanel,
  DrawerFooter,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useState } from "react";
import { getLocale } from "@/paraglide/runtime";
import * as m from "@/paraglide/messages";

export type TimeRangeValue = DateRange | undefined;
const calendarLocales = { en: enUS, ja, ko, "zh-CN": zhCN };
const hours = Array.from({ length: 24 }, (_, value) => ({
  label: String(value).padStart(2, "0"),
  value,
}));
const minutes = Array.from({ length: 60 }, (_, value) => ({
  label: String(value).padStart(2, "0"),
  value,
}));

function withTime(date: Date | undefined, time: Date | undefined, defaultHour: number) {
  if (!date) {
    return undefined;
  }
  const next = new Date(date);
  next.setHours(time?.getHours() ?? defaultHour, time?.getMinutes() ?? 0, 0, 0);
  return next;
}

function TimeFields({
  label,
  value,
  onChange,
  compact,
}: {
  compact: boolean;
  label: string;
  value: Date;
  onChange: (value: Date) => void;
}) {
  function updateTime(hour: number, minute: number) {
    const next = new Date(value);
    next.setHours(hour, minute, 0, 0);
    onChange(next);
  }
  return (
    <div className="flex min-w-0 flex-col gap-2" role="group" aria-label={label}>
      <span className="text-center text-sm font-medium">{label}</span>
      <div
        aria-hidden="true"
        className="grid grid-cols-2 gap-2 text-center text-xs text-muted-foreground"
      >
        <span>{m.time_range_hour()}</span>
        <span>{m.time_range_minute()}</span>
      </div>
      <div data-base-ui-swipe-ignore>
        <WheelPickerWrapper className="gap-2">
          <WheelPicker
            aria-label={`${label} · ${m.time_range_hour()}`}
            infinite
            options={hours}
            value={value.getHours()}
            visibleCount={compact ? 8 : 12}
            onValueChange={(hour) => updateTime(hour, value.getMinutes())}
          />
          <WheelPicker
            aria-label={`${label} · ${m.time_range_minute()}`}
            infinite
            options={minutes}
            value={value.getMinutes()}
            visibleCount={compact ? 8 : 12}
            onValueChange={(minute) => updateTime(value.getHours(), minute)}
          />
        </WheelPickerWrapper>
      </div>
    </div>
  );
}

export function TimeRange({
  id,
  value,
  onChange,
  disabled,
  startLabel,
  endLabel,
  invalid = false,
}: {
  id?: string;
  value: TimeRangeValue;
  onChange: (value: TimeRangeValue) => void;
  disabled?: boolean;
  startLabel: string;
  endLabel: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const mobile = useMediaQuery("max-sm");
  const locale = getLocale();
  function changeOpen(nextOpen: boolean) {
    if (nextOpen) {
      setDraft(value);
    }
    setOpen(nextOpen);
  }
  const triggerContent = (
    <>
      <IconCalendarEvent aria-hidden="true" className="shrink-0 text-muted-foreground" />
      <span className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-1.5">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-normal text-muted-foreground">{startLabel}</span>
          {value?.from ? (
            <>
              <span className="text-xs">
                <LocalTime value={value.from} format="date" />
              </span>
              <span className="text-base tabular-nums">
                <LocalTime value={value.from} format="time" />
              </span>
            </>
          ) : (
            <span className="whitespace-normal text-sm font-normal text-muted-foreground">
              {m.time_range_start_placeholder()}
            </span>
          )}
        </span>
        <IconArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-normal text-muted-foreground">{endLabel}</span>
          {value?.to ? (
            <>
              <span className="text-xs">
                <LocalTime value={value.to} format="date" />
              </span>
              <span className="text-base tabular-nums">
                <LocalTime value={value.to} format="time" />
              </span>
            </>
          ) : (
            <span className="whitespace-normal text-sm font-normal text-muted-foreground">
              {m.time_range_end_placeholder()}
            </span>
          )}
        </span>
        <LocalTimeZone className="col-span-3 text-xs font-normal text-muted-foreground" />
      </span>
    </>
  );
  const trigger = (
    <Button
      variant="outline"
      className="h-auto w-full justify-start gap-3 px-3 py-3 text-left sm:h-auto"
    />
  );
  const editor = (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-stretch sm:gap-4">
      <Calendar
        mode="range"
        locale={calendarLocales[locale]}
        selected={draft}
        defaultMonth={draft?.from}
        className="[--cell-size:--spacing(8.5)] sm:[--cell-size:--spacing(9)]"
        onSelect={(range) =>
          setDraft(
            range
              ? {
                  from: withTime(range.from, draft?.from, 9),
                  to: withTime(range.to, draft?.to, 10),
                }
              : undefined,
          )
        }
      />
      <div className="grid w-full grid-cols-2 gap-4 border-t pt-3 sm:w-44 sm:grid-cols-1 sm:gap-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
        {draft?.from ? (
          <TimeFields
            compact={!mobile}
            label={startLabel}
            value={draft.from}
            onChange={(from) => setDraft({ from, to: draft?.to })}
          />
        ) : (
          <p className="py-3 text-center text-sm text-muted-foreground">
            {m.time_range_start_placeholder()}
          </p>
        )}
        {draft?.to ? (
          <TimeFields
            compact={!mobile}
            label={endLabel}
            value={draft.to}
            onChange={(to) => setDraft({ from: draft?.from, to })}
          />
        ) : (
          <p className="py-3 text-center text-sm text-muted-foreground">
            {m.time_range_end_placeholder()}
          </p>
        )}
      </div>
    </div>
  );
  const actions = (
    <>
      <Button variant="ghost" className="max-sm:flex-1" onClick={() => setOpen(false)}>
        {m.time_range_cancel()}
      </Button>
      <Button
        variant="outline"
        className="max-sm:flex-1"
        disabled={!draft?.from || !draft.to}
        onClick={() => {
          onChange(draft);
          setOpen(false);
        }}
      >
        {m.time_range_confirm()}
      </Button>
    </>
  );
  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={changeOpen}>
        <DrawerTrigger id={id} disabled={disabled} aria-invalid={invalid} render={trigger}>
          {triggerContent}
        </DrawerTrigger>
        <DrawerPopup className="max-h-[calc(100dvh-1rem)]">
          <DrawerHeader className="px-4 pt-4 pb-3">
            <DrawerTitle className="text-base">{m.time_range_title()}</DrawerTitle>
          </DrawerHeader>
          <DrawerPanel className="px-4 pb-3" scrollFade={false}>
            {editor}
          </DrawerPanel>
          <DrawerFooter className="shrink-0 flex-row px-4 pt-3">{actions}</DrawerFooter>
        </DrawerPopup>
      </Drawer>
    );
  }
  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger id={id} disabled={disabled} aria-invalid={invalid} render={trigger}>
        {triggerContent}
      </PopoverTrigger>
      <PopoverPopup align="start" className="max-w-[calc(100vw-2rem)]">
        <div className="p-3">{editor}</div>
        <div className="flex justify-end gap-2 border-t p-2">{actions}</div>
      </PopoverPopup>
    </Popover>
  );
}
