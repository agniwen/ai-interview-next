import { IconSparkles } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";
import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";

export function Reasoning({
  title,
  duration,
  streaming = false,
  children,
  defaultOpen = false,
}: {
  title: string;
  duration?: string;
  streaming?: boolean;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <TraceCollapsible defaultOpen={defaultOpen}>
      <TraceCollapsibleTrigger>
        <TraceLine status={streaming ? "running" : undefined}>
          <TraceIcon>{streaming ? <Spinner /> : <IconSparkles />}</TraceIcon>
          <TraceTitle>{title}</TraceTitle>
          {duration && <TraceDescription>{duration}</TraceDescription>}
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>{children}</TraceCollapsibleContent>
    </TraceCollapsible>
  );
}
