import { IconArrowLeft } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useCanGoBack, useLocation, useRouter } from "@tanstack/react-router";
import { lazy } from "react";
import { PageHeader, PageHeaderContent } from "@/components/layout/page-header";
import { JobFormSkeleton } from "@/components/skeletons/components/job-form-skeleton";
import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import * as m from "@/paraglide/messages";
import { jobDetailsQuery } from "./client";
import type { JobListSearch } from "./list-search";

const JobForm = lazy(async () => {
  const { JobForm: Editor } = await import("./job-form");
  return { default: Editor };
});

/**
 * 岗位新建与编辑页面，加载编辑数据并处理页面返回，字段草稿和保存交给 JobForm。
 * Job create/edit page; loads records and handles return navigation, leaving draft fields and saving to JobForm.
 */
export function JobEditorPage({
  id,
  workspaceId,
  search,
}: {
  id: string;
  workspaceId: string;
  search: JobListSearch;
}) {
  const isNew = id === "new";
  const router = useRouter();
  const masked = useLocation({ select: (location) => Boolean(location.maskedLocation) });
  const canGoBack = useCanGoBack();
  const backToList = masked && canGoBack;
  const { data, isPending, isFetching, refetch } = useQuery({
    ...jobDetailsQuery(workspaceId, id),
    enabled: !isNew,
  });
  const phase = useSkeletonPhase(!isNew && isPending);
  const onSuccess = () => {
    if (backToList && (!isNew || search.page === 1)) {
      router.history.back();
    } else {
      void router.navigate({
        params: { workspaceId },
        replace: true,
        search: { ...search, page: isNew ? 1 : search.page },
        to: "/w/$workspaceId/hub/jobs",
      });
    }
  };

  let content;
  if (phase === "skeleton") {
    content = <JobFormSkeleton />;
  } else if (phase === "ready") {
    if (isNew) {
      content = <JobForm workspaceId={workspaceId} onSuccess={onSuccess} />;
    } else if (data) {
      content = <JobForm job={data} workspaceId={workspaceId} onSuccess={onSuccess} />;
    } else {
      content = (
        <div className="flex flex-col items-start gap-4">
          <Alert variant="error">
            <AlertDescription>{m.ats_error()}</AlertDescription>
          </Alert>
          <Button
            variant="outline"
            loading={isFetching}
            onClick={() => {
              void refetch();
            }}
          >
            {m.ats_retry()}
          </Button>
        </div>
      );
    }
  }

  return (
    <>
      <PageHeaderContent>
        <Button
          size="sm"
          variant="ghost"
          onClick={backToList ? () => router.history.back() : undefined}
          render={
            backToList ? undefined : (
              <Link to="/w/$workspaceId/hub/jobs" params={{ workspaceId }} search={search} />
            )
          }
        >
          <IconArrowLeft aria-hidden="true" data-icon="inline-start" />
          {m.ats_back_jobs()}
        </Button>
      </PageHeaderContent>
      <div className="mx-auto flex w-full min-w-0 max-w-4xl flex-1 flex-col gap-6 pt-2 md:pt-4">
        <PageHeader
          title={isNew ? m.ats_create_job() : m.ats_edit_job()}
          description={m.ats_job_help()}
        />
        <SkeletonSuspense fallback={<JobFormSkeleton />}>{content}</SkeletonSuspense>
      </div>
    </>
  );
}
