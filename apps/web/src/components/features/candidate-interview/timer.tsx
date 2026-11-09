import { useEffect, useState } from "react";
import { IconClockHour3 } from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";

export function InterviewTimer({
  startedAt,
  variant = "card",
}: {
  startedAt: string | null;
  variant?: "card" | "ghost";
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const elapsed = startedAt ? Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000)) : 0;
  const minutes = Math.floor(elapsed / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (elapsed % 60).toString().padStart(2, "0");
  return (
    <Card
      aria-label={m.candidate_elapsed()}
      className={cn(
        "inline-flex h-8 flex-row items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium tabular-nums before:rounded-[calc(var(--radius-lg)-1px)]",
        variant === "ghost" && "border-transparent bg-transparent shadow-none before:hidden",
      )}
    >
      <IconClockHour3 aria-hidden="true" className="size-3.5 text-muted-foreground" />
      <span>
        {minutes}:{seconds}
      </span>
    </Card>
  );
}
