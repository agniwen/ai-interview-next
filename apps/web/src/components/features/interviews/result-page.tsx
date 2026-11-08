import { useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { ResultSection, ResultSectionStack } from "./result-section";
import { InterviewResultSkeleton } from "@/components/skeletons/pages/interview-result-skeleton";
import {
  IconArrowLeft,
  IconClipboardText,
  IconMessageCircle,
  IconListDetails,
  IconStar,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useCanGoBack, useLocation, useRouter } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/local-time";
import { UserColumn } from "@/components/user-column";
import { PageHeaderContent } from "@/components/layout/page-header";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import * as m from "@/paraglide/messages";
import { resultQuery } from "./client";
import type { InterviewResult } from "./client";
import { InterviewRuntimeLog, RuntimeBadge } from "./runtime-log";
import { InterviewEvaluationSection } from "./evaluation-section";

function ResultHeader({ data }: { data: InterviewResult }) {
  const { round } = data;
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-5">
      <div className="min-w-0">
        <p className="mb-2 text-sm text-muted-foreground">
          {data.candidate.name} · {m.interviews_round({ number: round.sequence })}
          {round.label ? ` · ${round.label}` : ""}
        </p>
        <h1 className="text-2xl font-medium tracking-tight">{m.interviews_result()}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {round.kind === "ai" ? m.interviews_ai() : m.interviews_human()}
          {round.endedAt && (
            <>
              {" "}
              · {m.interviews_finished_at()} <LocalTime value={round.endedAt} />
            </>
          )}
        </p>
      </div>
      <RuntimeBadge data={data} />
    </header>
  );
}

function ResultTranscript({ data }: { data: InterviewResult }) {
  const { turns } = data;
  return (
    <ResultSection icon={IconMessageCircle} title={m.interviews_transcript()}>
      <div className="flex flex-col gap-5">
        {turns.length ? (
          turns.map((turn) => (
            <div
              id={`turn-${turn.id}`}
              key={turn.id}
              tabIndex={-1}
              className="scroll-mt-24 rounded-lg outline-none target:bg-accent focus:bg-accent"
            >
              <div className="mb-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {turn.role === "user" ? data.candidate.name : m.candidate_session_interviewer()}
                </span>
                <LocalTime value={new Date(turn.at).toISOString()} format="time" />
              </div>
              <p className="whitespace-pre-wrap wrap-anywhere text-sm leading-7">{turn.text}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{m.interviews_no_transcript()}</p>
        )}
      </div>
    </ResultSection>
  );
}

function ResultSummary({ data }: { data: InterviewResult }) {
  const { plan, progress } = data;
  const total = plan?.questions.reduce((sum, question) => sum + question.points.length, 0) ?? 0;
  const answered = progress?.answers.filter((answer) => answer.status === "answered").length ?? 0;
  return (
    <ResultSection icon={IconClipboardText} title={m.interviews_summary()}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {plan && (
          <Badge variant={answered === total ? "success" : "warning"}>
            {m.interviews_coverage({ answered, total })}
          </Badge>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4">
        <div>
          <dt className="text-xs text-muted-foreground">{m.interviews_start()}</dt>
          <dd className="mt-1.5 text-sm">
            <LocalTime value={data.round.startedAt} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{m.interviews_finished_at()}</dt>
          <dd className="mt-1.5 text-sm">
            <LocalTime value={data.round.endedAt} />
          </dd>
        </div>
      </dl>
      <p className="mt-5 border-t border-border/60 pt-5 whitespace-pre-wrap text-sm leading-7">
        {progress?.summary ||
          (progress && !progress.finalized
            ? m.interviews_report_pending()
            : m.interviews_no_report())}
      </p>
      {progress?.endReason === "candidate_requested" && (
        <Badge variant="outline" className="mt-4">
          {m.interviews_candidate_ended()}
        </Badge>
      )}
      {plan && answered < total && (
        <p className="mt-3 text-xs leading-6 text-muted-foreground">
          {m.interviews_partial_help()}
        </p>
      )}
      {data.reportStatus === "failed" && (
        <Alert variant="warning" className="mt-4">
          <AlertDescription>{m.interviews_event_report_failed()}</AlertDescription>
        </Alert>
      )}
    </ResultSection>
  );
}

function ResultCollection({
  data,
  onEvidence,
}: {
  data: InterviewResult;
  onEvidence: (id: string) => void;
}) {
  const { plan, progress } = data;
  const answers = new Map(progress?.answers.map((answer) => [answer.pointId, answer]));
  const asked = new Set(progress?.asked.map((question) => question.questionId));
  const labels = {
    answered: m.interviews_answered,
    declined: m.interviews_declined,
    insufficient: m.interviews_insufficient,
    unknown: m.interviews_unknown,
  };
  return (
    plan && (
      <ResultSection icon={IconListDetails} title={m.interviews_collection()}>
        <div className="divide-y divide-border/60">
          {plan.questions.map((question, index) => (
            <article key={question.id} className="py-6 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs tabular-nums">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-medium leading-6">{question.content}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {asked.has(question.id) ? m.interviews_asked() : m.interviews_not_asked()}
                  </p>
                </div>
              </div>
              <div className="mt-5 divide-y">
                {question.points.map((point) => {
                  const answer = answers.get(point.id);
                  return (
                    <div key={point.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h4 className="text-sm font-medium leading-6">{point.label}</h4>
                        <Badge variant={answer?.status === "answered" ? "success" : "secondary"}>
                          {answer ? labels[answer.status]() : m.interviews_missing()}
                        </Badge>
                      </div>
                      {answer && (
                        <>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                            {answer.summary}
                          </p>
                          <details className="mt-3">
                            <summary className="cursor-pointer text-xs text-muted-foreground">
                              {m.interviews_evidence()}
                            </summary>
                            <div className="mt-3 flex flex-col gap-2">
                              {answer.evidence.map((item, i) => (
                                <blockquote
                                  key={`${item.turnId}-${i}`}
                                  className="border-l-2 pl-3 text-sm leading-6"
                                >
                                  <a
                                    className="underline decoration-border underline-offset-4 hover:decoration-current"
                                    href={`#turn-${item.turnId}`}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      onEvidence(item.turnId);
                                    }}
                                  >
                                    {item.quote}
                                  </a>
                                </blockquote>
                              ))}
                            </div>
                          </details>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </ResultSection>
    )
  );
}

function ResultFeedback({ data }: { data: InterviewResult }) {
  const { feedback } = data;
  return (
    <ResultSection icon={IconMessageCircle} title={m.interviews_feedback()}>
      <div>
        {feedback.length ? (
          <div className="divide-y">
            {feedback.map((item) => (
              <article
                id={`feedback-${item.id}`}
                key={item.id}
                className="scroll-mt-24 py-5 first:pt-0 last:pb-0"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <UserColumn user={item.author} />
                  <LocalTime value={item.createdAt} className="text-xs text-muted-foreground" />
                </div>
                <div className="prose prose-sm max-w-none wrap-anywhere dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.body}</ReactMarkdown>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{m.interviews_no_feedback()}</p>
        )}
      </div>
    </ResultSection>
  );
}

function CandidateFeedback({ data }: { data: InterviewResult }) {
  const feedback = data.round.candidateFeedback;
  if (!feedback) {
    return null;
  }
  return (
    <ResultSection icon={IconStar} title={m.candidate_feedback_open()}>
      <p className="text-sm">{m.candidate_feedback_rating({ rating: feedback.rating })}</p>
      {feedback.comment && (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{feedback.comment}</p>
      )}
    </ResultSection>
  );
}

export function InterviewResultContent({ data }: { data: InterviewResult }) {
  const split = useMediaQuery("min-xl");
  const [view, setView] = useState("overview");
  function showEvidence(id: string) {
    if (!split) {
      setView("transcript");
    }
    requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(`#turn-${CSS.escape(id)}`);
      element?.scrollIntoView({ block: "center" });
      element?.focus({ preventScroll: true });
    });
  }
  if (data.round.kind === "human") {
    return (
      <>
        <ResultHeader data={data} />
        <div className="grid gap-8 md:grid-cols-[13rem_minmax(0,1fr)]">
          <aside className="flex flex-col gap-3 md:sticky md:top-6 md:self-start">
            <h2 className="text-xs text-muted-foreground">{m.interviews_feedback()}</h2>
            {data.feedback.map((feedback) => (
              <a
                key={feedback.id}
                href={`#feedback-${feedback.id}`}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
              >
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primary" />
                {feedback.author.name}
              </a>
            ))}
            <LocalTime value={data.round.scheduledAt} className="text-xs text-muted-foreground" />
          </aside>
          <ResultSectionStack>
            <InterviewEvaluationSection data={data} />
            <ResultFeedback data={data} />
            <CandidateFeedback data={data} />
          </ResultSectionStack>
        </div>
      </>
    );
  }
  return (
    <>
      <ResultHeader data={data} />
      <div
        className={cn("grid min-w-0 gap-8", split && "grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]")}
      >
        <Tabs
          value={split && view === "transcript" ? "overview" : view}
          onValueChange={setView}
          className="min-w-0 gap-6"
        >
          <TabsList variant="underline" className="w-full justify-start">
            <TabsTab value="overview">{m.interviews_overview()}</TabsTab>
            <TabsTab value="questions">{m.interviews_collection()}</TabsTab>
            {!split && <TabsTab value="transcript">{m.interviews_transcript()}</TabsTab>}
          </TabsList>
          <TabsPanel value="overview">
            <ResultSectionStack>
              <InterviewEvaluationSection data={data} />
              <ResultSummary data={data} />
              <CandidateFeedback data={data} />
              <ResultFeedback data={data} />
              <InterviewRuntimeLog data={data} />
            </ResultSectionStack>
          </TabsPanel>
          <TabsPanel value="questions">
            <ResultCollection data={data} onEvidence={showEvidence} />
          </TabsPanel>
          {!split && (
            <TabsPanel value="transcript">
              <ResultTranscript data={data} />
            </TabsPanel>
          )}
        </Tabs>
        {split && (
          <div className="min-w-0 border-l border-border/60 pl-8">
            <ResultTranscript data={data} />
          </div>
        )}
      </div>
    </>
  );
}

export function InterviewResultPage({
  workspaceId,
  id,
  roundId,
}: {
  workspaceId: string;
  id: string;
  roundId: string;
}) {
  const query = useQuery(resultQuery(workspaceId, roundId));
  const phase = useSkeletonPhase(query.isPending);
  const router = useRouter();
  const masked = useLocation({ select: (location) => Boolean(location.maskedLocation) });
  const canGoBack = useCanGoBack();
  const back = masked && canGoBack;
  return (
    <>
      <PageHeaderContent>
        <Button
          variant="ghost"
          size="sm"
          onClick={back ? () => router.history.back() : undefined}
          render={
            back ? undefined : (
              <Link
                to="/w/$workspaceId/hub/applications/$id"
                params={{ id, workspaceId }}
                search={{ page: 1, pageSize: 20, search: "", tab: "interviews" }}
              />
            )
          }
        >
          <IconArrowLeft aria-hidden="true" />
          {m.interviews_back()}
        </Button>
      </PageHeaderContent>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10">
        {phase === "skeleton" && <InterviewResultSkeleton />}
        {phase === "ready" && query.data && <InterviewResultContent data={query.data} />}
        {query.isError && (
          <div role="alert" className="rounded-xl border p-6">
            <p className="mb-3">{m.ats_error()}</p>
            <Button variant="outline" onClick={() => query.refetch()}>
              {m.ats_retry()}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
