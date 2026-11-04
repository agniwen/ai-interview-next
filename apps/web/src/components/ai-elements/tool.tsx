import { IconAlertCircle, IconCheck, IconClock, IconTool } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";

export type ToolStatus = "pending" | "running" | "completed" | "error";

const statusIcons = {
  completed: IconCheck,
  error: IconAlertCircle,
  pending: IconClock,
  running: IconTool,
};

export function Tool({
  title,
  status,
  statusLabel,
  children,
  defaultOpen = false,
}: {
  title: string;
  status: ToolStatus;
  statusLabel: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const StatusIcon = statusIcons[status];

  return (
    <TraceCollapsible defaultOpen={defaultOpen}>
      <TraceCollapsibleTrigger>
        <TraceLine status={status === "completed" ? undefined : status}>
          <TraceIcon>{status === "running" ? <Spinner /> : <StatusIcon />}</TraceIcon>
          <TraceTitle>{title}</TraceTitle>
          <Badge size="sm" variant={status === "error" ? "error" : "secondary"}>
            {statusLabel}
          </Badge>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>{children}</TraceCollapsibleContent>
    </TraceCollapsible>
  );
}
