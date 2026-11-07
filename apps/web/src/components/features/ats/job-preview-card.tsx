import { useQuery } from "@tanstack/react-query";
import { MessageResponse } from "@/components/ai-elements/message-response";
import { JobPreviewSkeleton } from "@/components/skeletons/components/job-preview-skeleton";
import { RecordPreviewCard } from "./record-preview-card";
import { ProjectPreviewCard } from "./project-preview-card";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import * as m from "@/paraglide/messages";
import { jobDetailsQuery } from "./client";

function JobPreviewContent({ id, workspaceId }: { id: string; workspaceId: string }) {
  const { data, isPending } = useQuery(jobDetailsQuery(workspaceId, id));
  const phase = useSkeletonPhase(isPending);
  if (phase === "skeleton") {
    return <JobPreviewSkeleton />;
  }
  if (phase === "pending") {
    return null;
  }
  if (!data) {
    return <output>{m.ats_error()}</output>;
  }

  return (
    <>
      {(data.department || data.projectTitle) && (
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
          {data.department && (
            <div className="min-w-0">
              <dt className="text-muted-foreground">{m.ats_department()}</dt>
              <dd className="wrap-anywhere">{data.department}</dd>
            </div>
          )}
          {data.projectId && data.projectTitle && (
            <div className="min-w-0">
              <dt className="text-muted-foreground">{m.ats_project()}</dt>
              <dd>
                <ProjectPreviewCard
                  id={data.projectId}
                  title={data.projectTitle}
                  workspaceId={workspaceId}
                />
              </dd>
            </div>
          )}
        </dl>
      )}
      {data.requirements.trim() && (
        <div className="flex min-w-0 flex-col gap-1.5 border-t pt-3">
          <h4 className="text-xs font-medium text-muted-foreground">{m.ats_requirements()}</h4>
          <MessageResponse className="text-sm">{data.requirements}</MessageResponse>
        </div>
      )}
      {data.internalCriteria && (
        <div className="flex min-w-0 flex-col gap-1.5 border-t pt-3">
          <h4 className="text-xs font-medium text-muted-foreground">{m.ats_internal_criteria()}</h4>
          <MessageResponse className="text-sm">{data.internalCriteria}</MessageResponse>
        </div>
      )}
    </>
  );
}

export function JobPreviewCard({
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
      <JobPreviewContent id={id} workspaceId={workspaceId} />
    </RecordPreviewCard>
  );
}
