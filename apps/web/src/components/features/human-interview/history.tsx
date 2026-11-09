import { LocalTime } from "@/components/local-time";
import { EvaluationResult } from "@/components/features/ats/evaluation-result";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { evaluationConclusionLabel } from "../interviews/evaluation-status";
import { ParticipantAvatar } from "./participants";
import { MeetingMarkdown } from "./markdown";
import type { HumanMeeting } from "./client";
import * as m from "@/paraglide/messages";

export function MeetingHistory({
  history,
  resumeEvaluation,
  children,
  showTimeline = true,
}: {
  history: HumanMeeting["materials"]["history"];
  resumeEvaluation?: HumanMeeting["materials"]["resumeEvaluation"];
  children: ReactNode;
  showTimeline?: boolean;
}) {
  const entries = history.map<{
    body: ReactNode;
    date: string | null;
    id: string;
    summary: string;
    title: string;
  }>((entry) => ({
    body: (
      <>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <ParticipantAvatar
            name={entry.author.name}
            image={entry.author.image}
            className="size-5"
          />
          <span>{entry.author.name}</span>
          <span className="ms-2">{evaluationConclusionLabel(entry.content.conclusion)}</span>
        </div>
        <MeetingMarkdown>{entry.content.overall}</MeetingMarkdown>
      </>
    ),
    date: entry.submittedAt,
    id: `history-${entry.roundId}-${entry.author.id}`,
    summary: evaluationConclusionLabel(entry.content.conclusion),
    title: entry.label,
  }));
  if (resumeEvaluation) {
    entries.unshift({
      body: <EvaluationResult result={resumeEvaluation.result} />,
      date: resumeEvaluation.createdAt,
      id: "meeting-resume-evaluation",
      summary: "",
      title: m.meeting_resume_evaluation(),
    });
  }

  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [activeId, setActiveId] = useState("meeting-resume");
  const content = (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <section id="meeting-resume" data-meeting-material>
        {children}
      </section>
      {!showTimeline && <h2 className="mb-2 text-lg font-semibold">{m.meeting_history()}</h2>}
      {!entries.length && (
        <p className="py-4 text-sm text-muted-foreground">{m.meeting_history_empty()}</p>
      )}
      <Accordion
        className={cn(showTimeline && "max-md:space-y-4")}
        multiple
        value={entries.map(({ id }) => id).filter((id) => !collapsed.includes(id))}
        onValueChange={(values) =>
          setCollapsed(entries.map(({ id }) => id).filter((id) => !values.includes(id)))
        }
      >
        {entries.map((entry) => (
          <AccordionItem
            key={entry.id}
            value={entry.id}
            id={entry.id}
            data-meeting-material
            className={cn(
              showTimeline &&
                "py-2 max-md:rounded-2xl max-md:border-0 max-md:bg-muted/70 max-md:p-1",
            )}
          >
            <div className={cn(showTimeline && "md:sticky md:top-0 md:z-10 md:bg-background")}>
              <AccordionTrigger
                className={cn(
                  "text-base",
                  showTimeline &&
                    "items-center rounded-lg px-4 py-3 text-lg font-semibold hover:bg-muted/50",
                )}
              >
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span>{entry.title}</span>
                  <LocalTime
                    className="text-xs font-normal text-muted-foreground"
                    value={entry.date}
                  />
                </span>
              </AccordionTrigger>
            </div>
            <AccordionPanel
              className={cn(showTimeline && "px-4 pt-2 max-md:rounded-xl max-md:bg-card")}
            >
              {entry.body}
            </AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );

  if (!showTimeline) {
    return content;
  }

  return (
    <ScrollArea
      className="min-h-0 flex-1"
      overscrollContain
      scrollFade
      viewportClassName="[container-type:size]"
      viewportProps={{
        "aria-label": m.meeting_materials(),
        onScroll: (event) => {
          const viewport = event.currentTarget;
          const top = viewport.getBoundingClientRect().top + 24;
          const atEnd = viewport.scrollTop >= viewport.scrollHeight - viewport.clientHeight - 1;
          let currentId = "meeting-resume";
          for (const section of viewport.querySelectorAll<HTMLElement>("[data-meeting-material]")) {
            if (!atEnd && section.getBoundingClientRect().top > top) {
              break;
            }
            currentId = section.id;
          }
          setActiveId(currentId);
        },
        tabIndex: 0,
      }}
    >
      <div className="grid w-full gap-6 px-3 pt-3 pb-8 md:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_15rem]">
        <aside className="sticky top-3 hidden h-[calc(100cqh-1.5rem)] min-w-0 self-start md:flex md:items-center">
          <nav aria-label={m.meeting_history()} className="max-h-full w-full overflow-y-auto p-1">
            <ol className="flex flex-col gap-1">
              {[{ id: "meeting-resume", summary: "", title: m.meeting_resume() }, ...entries].map(
                ({ id, title, summary }) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      aria-current={activeId === id ? "location" : undefined}
                      className="relative flex min-w-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring aria-[current=location]:bg-secondary"
                      onClick={(event) => {
                        event.preventDefault();
                        setActiveId(id);
                        setCollapsed((values) => values.filter((value) => value !== id));
                        requestAnimationFrame(() => {
                          document
                            .querySelector(`#${CSS.escape(id)}`)
                            ?.scrollIntoView({ block: "start" });
                        });
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-3 shrink-0 rounded-full border-2 border-background",
                          activeId === id ? "bg-primary" : "bg-muted-foreground/40",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium" title={title}>
                        {title}
                      </span>
                      {summary && (
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {summary}
                        </span>
                      )}
                    </a>
                  </li>
                ),
              )}
            </ol>
          </nav>
        </aside>
        {content}
      </div>
    </ScrollArea>
  );
}
