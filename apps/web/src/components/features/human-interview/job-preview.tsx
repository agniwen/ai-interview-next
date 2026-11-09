import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from "@/components/ui/preview-card";
import type { HumanMeeting } from "./client";
import { MeetingMarkdown } from "./markdown";
import * as m from "@/paraglide/messages";

export function MeetingJobPreview({
  title,
  job,
}: {
  title: string;
  job: HumanMeeting["materials"]["job"];
}) {
  const [open, setOpen] = useState(false);
  return (
    <PreviewCard open={open} onOpenChange={setOpen}>
      <PreviewCardTrigger
        aria-expanded={open}
        delay={200}
        onClick={() => setOpen(true)}
        render={<Button size="sm" variant="ghost" className="max-w-full justify-start px-2" />}
      >
        <span className="truncate">{title}</span>
      </PreviewCardTrigger>
      <PreviewCardPopup
        align="start"
        className="max-h-[min(24rem,calc(var(--available-height)-2px))] w-96 max-w-(--available-width) text-wrap"
        panelClassName="flex flex-col gap-3"
      >
        <h3 className="font-semibold wrap-anywhere">{title}</h3>
        <section className="flex flex-col gap-1.5 border-t pt-3">
          <h4 className="text-xs font-medium text-muted-foreground">{m.meeting_job()}</h4>
          <MeetingMarkdown>{job.requirements || "—"}</MeetingMarkdown>
        </section>
        <section className="flex flex-col gap-1.5 border-t pt-3">
          <h4 className="text-xs font-medium text-muted-foreground">{m.meeting_criteria()}</h4>
          <MeetingMarkdown>{job.internalCriteria || "—"}</MeetingMarkdown>
        </section>
      </PreviewCardPopup>
    </PreviewCard>
  );
}
