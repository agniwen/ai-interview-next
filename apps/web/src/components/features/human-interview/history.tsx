import { LocalTime } from "@/components/local-time";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
} from "@/components/ui/accordion";
import { evaluationConclusionLabel } from "../interviews/evaluation-status";
import { ParticipantAvatar } from "./participants";
import { MeetingMarkdown } from "./markdown";
import type { HumanMeeting } from "./client";
import * as m from "@/paraglide/messages";

export function MeetingHistory({
  history,
  children,
  showTimeline = true,
}: {
  history: HumanMeeting["materials"]["history"];
  children: ReactNode;
  showTimeline?: boolean;
}) {
  const ids = history.map((entry) => `${entry.roundId}-${entry.author.id}`);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  return (
    <div className={showTimeline ? "grid gap-8 md:grid-cols-[10rem_minmax(0,1fr)]" : undefined}>
      {showTimeline && (
        <nav aria-label={m.meeting_history()} className="hidden md:block">
          <div className="sticky top-0 flex flex-col gap-4 border-l pl-4 text-sm">
            <a href="#meeting-resume" className="text-muted-foreground hover:text-foreground">
              {m.meeting_resume()}
            </a>
            {history.map((entry, index) => (
              <a
                key={ids[index]}
                href={`#history-${ids[index]}`}
                onClick={() =>
                  setCollapsed((values) => values.filter((value) => value !== ids[index]))
                }
                className="flex flex-col gap-1"
              >
                <span>{entry.label}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.author.name} · {evaluationConclusionLabel(entry.content.conclusion)}
                </span>
              </a>
            ))}
          </div>
        </nav>
      )}
      <div className="min-w-0">
        <section id="meeting-resume">{children}</section>
        <h2 className="mb-2 text-lg font-semibold">{m.meeting_history()}</h2>
        {!history.length && (
          <p className="py-4 text-sm text-muted-foreground">{m.meeting_history_empty()}</p>
        )}
        <Accordion
          multiple
          value={ids.filter((id) => !collapsed.includes(id))}
          onValueChange={(values) => setCollapsed(ids.filter((id) => !values.includes(id)))}
        >
          {history.map((entry, index) => (
            <AccordionItem key={ids[index]} value={ids[index]} id={`history-${ids[index]}`}>
              <AccordionTrigger className="text-base">
                <span className="flex flex-wrap items-baseline gap-3">
                  <span>{entry.label}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    <LocalTime value={entry.submittedAt} />
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionPanel>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <ParticipantAvatar
                    name={entry.author.name}
                    image={entry.author.image}
                    className="size-5"
                  />
                  <span>{entry.author.name}</span>
                  <span className="ml-3">
                    {evaluationConclusionLabel(entry.content.conclusion)}
                  </span>
                </div>
                <MeetingMarkdown>{entry.content.overall}</MeetingMarkdown>
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
