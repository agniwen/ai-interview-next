import { useQuery } from "@tanstack/react-query";
import { LocalTime, LocalTimeZone } from "@/components/local-time";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CandidateInterviewSkeleton } from "@/components/skeletons/pages/candidate-interview-skeleton";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import * as m from "@/paraglide/messages";
import { candidateInterviewQuery } from "./client";

export function CandidateInterviewEntry({ token }: { token: string }) {
  const query = useQuery(candidateInterviewQuery(token));
  const phase = useSkeletonPhase(query.isPending);
  const interview = query.data;
  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 p-6"
    >
      <p className="text-sm font-medium">Sainoa</p>
      {phase === "skeleton" && <CandidateInterviewSkeleton />}
      {phase === "ready" && query.isError && (
        <Alert variant="error">
          <AlertDescription>
            {m.candidate_interview_load_error()}{" "}
            <Button variant="outline" onClick={() => query.refetch()}>
              {m.ats_retry()}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {phase === "ready" && query.data === null && (
        <Card>
          <CardHeader>
            <CardTitle>{m.candidate_interview_unavailable()}</CardTitle>
            <CardDescription>{m.candidate_interview_unavailable_help()}</CardDescription>
          </CardHeader>
        </Card>
      )}
      {phase === "ready" && interview && (
        <Card>
          <CardHeader>
            <CardDescription>{interview.workspaceName}</CardDescription>
            <CardTitle>{interview.jobTitle}</CardTitle>
            <CardDescription>
              {m.interviews_round({ number: interview.sequence })}
              {interview.label ? ` · ${interview.label}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm">
              {interview.kind === "ai" ? m.interviews_ai() : m.interviews_human()}
            </p>
            {interview.kind === "human" && (
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">{m.interviews_start()}</dt>
                  <dd>
                    <LocalTime value={interview.scheduledAt} format="dateTime" />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{m.interviews_deadline()}</dt>
                  <dd>
                    <LocalTime value={interview.admissionDeadline} format="dateTime" />
                  </dd>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  <dt className="sr-only">{m.time_zone()}</dt>
                  <dd>
                    <LocalTimeZone />
                  </dd>
                </div>
              </dl>
            )}
            <p className="text-sm text-muted-foreground">{m.candidate_interview_entry_ready()}</p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
