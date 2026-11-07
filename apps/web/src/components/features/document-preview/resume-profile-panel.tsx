import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import { useQuery } from "@tanstack/react-query";
import { atsKeys } from "@/components/features/ats/query-keys";
import { atsApi, readResumeProfile } from "@/components/features/ats/client";
import { ResumeProfileSkeleton } from "@/components/skeletons/components/resume-profile-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import * as m from "@/paraglide/messages";
import { ResumeProfileDocument } from "./resume-profile-document";

function isParsing(status: string | null | undefined) {
  return status === "queued" || status === "running";
}

export function ResumeProfilePanel({ id, workspaceId }: { id: string; workspaceId: string }) {
  const { data, isError, isPending, refetch } = useQuery({
    queryFn: () => readResumeProfile({ id, workspaceId }),
    queryKey: atsKeys.resumes(workspaceId)._ctx.profile(id).queryKey,
    refetchInterval: ({ state: { data: result } }) =>
      isParsing(result?.parseStatus) ? 5000 : false,
  });

  const phase = useSkeletonPhase(isPending);
  if (phase === "skeleton") {
    return <ResumeProfileSkeleton />;
  }
  if (phase === "pending") {
    return null;
  }
  if (data?.profile?.version === 1) {
    const avatarSrc =
      data.hasAvatar && data.resumeId
        ? atsApi.resumes[":id"].avatar.$path({ param: { id: data.resumeId, workspaceId } })
        : undefined;
    return <ResumeProfileDocument avatarSrc={avatarSrc} profile={data.profile} />;
  }
  if (isError) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-start gap-3 p-5">
        <Alert variant="error">
          <AlertDescription>{m.resume_parse_load_error()}</AlertDescription>
        </Alert>
        <Button onClick={() => refetch()} size="sm" variant="outline">
          {m.ats_retry()}
        </Button>
      </div>
    );
  }
  const status = data?.parseStatus;
  let message = m.resume_profile_empty();
  if (isParsing(status)) {
    message = m.resume_profile_processing();
  } else if (status === "failed") {
    message = m.resume_profile_failed();
  }
  return (
    <output className="mx-auto block max-w-xl p-6 text-center text-sm text-muted-foreground">
      {message}
    </output>
  );
}
