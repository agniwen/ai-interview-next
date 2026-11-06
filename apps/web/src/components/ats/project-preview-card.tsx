import { MessageResponse } from "@/components/ai-elements/message-response";
import { useQuery } from "@tanstack/react-query";
import { ProjectPreviewSkeleton } from "@/components/skeletons/components/project-preview-skeleton";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import * as m from "@/paraglide/messages";
import { atsDate, projectDetailsQuery } from "./client";
import { RecordPreviewCard } from "./record-preview-card";

function ProjectPreviewContent({ id, workspaceId }: { id: string; workspaceId: string }) {
  const { data, isPending } = useQuery(projectDetailsQuery(workspaceId, id));
  const phase = useSkeletonPhase(isPending);
  if (phase === "skeleton") {
    return <ProjectPreviewSkeleton />;
  }
  if (phase === "pending") {
    return null;
  }
  if (!data) {
    return <output>{m.ats_error()}</output>;
  }
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div className="min-w-0">
          <dt className="text-muted-foreground">{m.ats_date()}</dt>
          <dd>{atsDate(data.createdAt, "short")}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">{m.ats_project_job_count()}</dt>
          <dd>{data.jobCount}</dd>
        </div>
      </dl>
      {data.description && (
        <div className="flex min-w-0 flex-col gap-1.5 border-t pt-3">
          <h4 className="text-xs font-medium text-muted-foreground">
            {m.ats_project_description()}
          </h4>
          <MessageResponse className="text-sm">{data.description}</MessageResponse>
        </div>
      )}
    </>
  );
}

export function ProjectPreviewCard({
  id,
  title,
  workspaceId,
}: {
  id: string;
  title: string;
  workspaceId: string;
}) {
  return (
    <RecordPreviewCard title={title}>
      <ProjectPreviewContent id={id} workspaceId={workspaceId} />
    </RecordPreviewCard>
  );
}
