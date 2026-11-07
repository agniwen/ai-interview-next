import { useInfiniteQuery } from "@tanstack/react-query";
import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { InterviewListSkeleton } from "@/components/skeletons/components/interview-list-skeleton";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import * as m from "@/paraglide/messages";
import { roundsQuery } from "./client";
import { InterviewForm, EditInterviewForm } from "./create-form";
import { InterviewRoundCard } from "./round-card";

export function ApplicationInterviews({
  workspaceId,
  applicationId,
  closed,
}: {
  workspaceId: string;
  applicationId: string;
  closed: boolean;
}) {
  const query = useInfiniteQuery(roundsQuery(workspaceId, applicationId));
  const phase = useSkeletonPhase(query.isPending);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  if (editingId) {
    return (
      <EditInterviewForm
        workspaceId={workspaceId}
        applicationId={applicationId}
        roundId={editingId}
        onClose={() => setEditingId(null)}
      />
    );
  }
  if (creating) {
    return (
      <InterviewForm
        workspaceId={workspaceId}
        applicationId={applicationId}
        onClose={() => setCreating(false)}
      />
    );
  }
  const rows = query.data?.pages.flatMap((page) => page.rows) ?? [];
  return (
    <section className="flex min-w-0 flex-col gap-4">
      {phase === "skeleton" && <InterviewListSkeleton />}
      {query.isError && (
        <Alert variant="error">
          <AlertDescription>
            {m.ats_error()}{" "}
            <Button variant="outline" onClick={() => query.refetch()}>
              {m.ats_retry()}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {phase === "ready" && query.data && rows.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{m.interviews_empty()}</EmptyTitle>
            <EmptyDescription>
              {closed ? m.interviews_closed() : m.interviews_empty_help()}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {phase === "ready" &&
        rows.map((row) => (
          <InterviewRoundCard
            key={row.id}
            round={row}
            onEdit={() => setEditingId(row.id)}
            workspaceId={workspaceId}
            applicationId={applicationId}
          />
        ))}
      {query.hasNextPage && (
        <Button
          variant="outline"
          loading={query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
        >
          {m.ats_load_more()}
        </Button>
      )}
      <Button
        variant="outline"
        className="w-48 max-w-full self-center"
        disabled={closed || !query.data || rows.length > 0}
        onClick={() => setCreating(true)}
      >
        <IconPlus aria-hidden="true" />
        {m.interviews_create()}
      </Button>
      {rows.length > 0 && (
        <p className="text-xs text-muted-foreground">{m.interviews_next_round_help()}</p>
      )}
    </section>
  );
}
