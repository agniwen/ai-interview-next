import { LocalTime } from "@/components/local-time";
import { resumeDetailLinkOptions } from "./detail-navigation";
import { Link } from "@tanstack/react-router";
import { TableFilterSelect } from "@/components/layout/table-filters";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { IconAlertCircle, IconFileCv } from "@tabler/icons-react";
import { ResumePreviewDialog } from "@/components/features/document-preview/resume-preview-dialog";
import {
  getResumeDocumentFileIconKind,
  ResumeDocumentFileIcon,
} from "@/components/resume-document-file-icon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCreateHandle as createDialogHandle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { UserColumn } from "@/components/user-column";
import * as m from "@/paraglide/messages";
import { atsKeys } from "./query-keys";
import { atsApi, atsStatus, getResumeCandidateDisplay, readAts } from "./client";
import { CreateApplicationDialog } from "./create-application-dialog";
import { AtsListPage } from "./list-page";
import type { AtsPageProps } from "./list-page";
import { listParams, resumeStatuses } from "./list-search";
import type { ResumeListSearch } from "./list-search";
import { ResumeCandidateDialog } from "./resume-candidate-dialog";
import { ResumeUploadDialog } from "./resume-upload-dialog";

const statusVariants: Partial<Record<string, BadgeProps["variant"]>> = {
  failed: "error",
  running: "info",
  succeeded: "success",
  upload_failed: "error",
};

/**
 * 简历库列表，协调上传、解析重试、候选人归属确认、预览和创建招聘记录。
 * Resume library list coordinating uploads, parsing retries, candidate resolution, previews and application creation.
 */
export function ResumesPage({ workspaceId, query, onQueryChange }: AtsPageProps<ResumeListSearch>) {
  const client = useQueryClient();
  const param = { workspaceId };
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: atsKeys.resumes(workspaceId).queryKey }),
      client.invalidateQueries({ queryKey: atsKeys.candidates(workspaceId).queryKey }),
    ]);
  }
  const candidateDialog = useMemo(() => createDialogHandle<string>(), []);
  const recruitmentDialog = useMemo(() => createDialogHandle<string>(), []);
  const previewDialog = useMemo(() => createDialogHandle<{ filename: string; id: string }>(), []);
  const { data, isError, refetch } = useQuery({
    queryFn: async ({ signal }) =>
      readAts(await atsApi.resumes.$get({ param, query: listParams(query) }, { init: { signal } })),
    queryKey: atsKeys.resumes(workspaceId)._ctx.list(query).queryKey,
    refetchInterval: ({ state }) =>
      state.data?.rows.some((row) => row.parseStatus === "queued" || row.parseStatus === "running")
        ? 5000
        : false,
  });
  const retry = useMutation({
    mutationFn: async (id: string) =>
      readAts(await atsApi.runs[":id"].retry.$post({ param: { ...param, id } })),
    onSuccess: refresh,
  });
  const recruitmentResumes = new Map(
    data?.rows
      .filter((row) => row.parseStatus === "succeeded")
      .map((row) => [row.id, row.resumeId]),
  );
  return (
    <AtsListPage
      title={m.ats_resumes()}
      icon={IconFileCv}
      action={
        <ResumeUploadDialog key={workspaceId} workspaceId={workspaceId} onSettled={refresh} />
      }
      filters={
        <>
          <TableFilterSelect
            label={m.ats_creator()}
            onChange={(owner) => onQueryChange({ owner: owner || undefined, page: 1 })}
            options={[
              { label: m.dashboard_all_uploaders(), value: "" },
              { label: m.dashboard_my_uploads(), value: "me" },
            ]}
            value={query.owner ?? ""}
          />
          <TableFilterSelect
            label={m.ats_status()}
            onChange={(status) => onQueryChange({ page: 1, status: status || undefined })}
            options={[
              { label: m.ats_all_statuses(), value: "" },
              ...resumeStatuses.map((status) => ({ label: atsStatus(status), value: status })),
            ]}
            value={query.status ?? ""}
          />
        </>
      }
      feedback={
        retry.isError && (
          <Alert variant="error">
            <AlertDescription>{m.ats_error()}</AlertDescription>
          </Alert>
        )
      }
      firstColumnClassName="w-120 min-w-40"
      hasRowActions
      headings={[
        m.ats_filename(),
        m.ats_name(),
        m.ats_candidate(),
        m.ats_status(),
        m.ats_source(),
        m.ats_creator(),
        m.ats_date(),
      ]}
      rows={data?.rows.map((row) => {
        const { runId } = row;
        const parsedIdentity = getResumeCandidateDisplay(workspaceId, row);
        const recruitmentResumeId = recruitmentResumes.get(row.id);
        const previewPayload = { filename: row.filename, id: row.id };
        const filename = (
          <>
            <ResumeDocumentFileIcon
              className="size-5 shrink-0"
              kind={getResumeDocumentFileIconKind({ fileName: row.filename })}
            />
            <span className="min-w-0 truncate">{row.filename}</span>
          </>
        );
        return {
          action: (
            <div className="flex justify-end gap-1">
              {runId && row.parseStatus === "failed" && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={retry.isPending}
                  onClick={() => retry.mutate(runId)}
                >
                  {m.ats_retry()}
                </Button>
              )}
              {row.status === "accepted" && (
                <DialogTrigger
                  handle={previewDialog}
                  payload={previewPayload}
                  render={<Button variant="outline" size="sm" />}
                >
                  {m.ats_view_resume()}
                </DialogTrigger>
              )}
              {recruitmentResumeId && (
                <DialogTrigger
                  handle={recruitmentDialog}
                  payload={recruitmentResumeId}
                  render={<Button variant="outline" size="sm" />}
                >
                  {m.ats_join_recruitment()}
                </DialogTrigger>
              )}
            </div>
          ),
          cells: [
            <div className="contain-inline-size" key="name">
              {row.status === "accepted" ? (
                <DialogTrigger
                  className="flex max-w-full items-center gap-2 rounded-sm text-left hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  handle={previewDialog}
                  payload={previewPayload}
                  title={row.filename}
                >
                  {filename}
                </DialogTrigger>
              ) : (
                <span className="flex max-w-full items-center gap-2" title={row.filename}>
                  {filename}
                </span>
              )}
            </div>,
            <UserColumn key="parsedName" user={parsedIdentity} />,
            row.identityStatus === "pending_review" ? (
              <Tooltip key="candidate">
                <TooltipTrigger
                  className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-warning-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  render={<span />}
                  tabIndex={0}
                >
                  {row.linkedCandidateName ?? m.ats_candidate_pending_review()}
                  <IconAlertCircle aria-hidden="true" className="size-4 shrink-0" />
                </TooltipTrigger>
                <TooltipPopup>{m.ats_review_in_resume_details()}</TooltipPopup>
              </Tooltip>
            ) : (
              <span
                key="candidate"
                className={row.linkedCandidateName ? undefined : "text-muted-foreground"}
              >
                {row.linkedCandidateName ?? "—"}
              </span>
            ),
            <Badge
              key="status"
              variant={statusVariants[row.parseStatus ?? row.status] ?? "outline"}
              render={
                <Link
                  {...resumeDetailLinkOptions(workspaceId, row.id, query)}
                  aria-label={`${atsStatus(row.parseStatus ?? row.status)} · ${m.resume_processing_title()} · ${row.filename}`}
                />
              }
              className="cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
            >
              {atsStatus(row.parseStatus ?? row.status)}
            </Badge>,
            {
              external_import: m.ats_source_external_import(),
              manual_upload: m.ats_source_manual_upload(),
            }[row.source],
            <UserColumn key="creator" user={row.creator} />,
            <LocalTime key="date" value={row.createdAt} format="date" />,
          ],
          id: row.id,
        };
      })}
      empty={m.ats_empty_resumes()}
      error={isError}
      query={query}
      searchPlaceholder={m.ats_search_resumes()}
      total={data?.total ?? 0}
      onQueryChange={onQueryChange}
      onRefresh={refetch}
    >
      <CreateApplicationDialog handle={recruitmentDialog} workspaceId={workspaceId} />
      <Dialog handle={previewDialog}>
        {({ payload }) => {
          if (!payload) {
            return null;
          }
          const resumeId = recruitmentResumes.get(payload.id);
          const row = data?.rows.find(({ id }) => id === payload.id);
          const reviewId = row?.identityStatus === "pending_review" ? row.submissionId : null;
          return (
            <ResumePreviewDialog
              actions={
                <>
                  <Dialog handle={candidateDialog}>
                    {({ payload: submissionId }) => (
                      <>
                        {reviewId && (
                          <DialogTrigger
                            payload={reviewId}
                            render={<Button variant="outline" size="sm" />}
                          >
                            {m.ats_review()}
                          </DialogTrigger>
                        )}
                        {submissionId && (
                          <ResumeCandidateDialog
                            key={submissionId}
                            submissionId={submissionId}
                            workspaceId={workspaceId}
                            onClose={() => candidateDialog.close()}
                            onSuccess={refresh}
                          />
                        )}
                      </>
                    )}
                  </Dialog>
                  {resumeId && (
                    <CreateApplicationDialog resumeId={resumeId} workspaceId={workspaceId} />
                  )}
                </>
              }
              key={`${workspaceId}/${payload.id}`}
              filename={payload.filename}
              id={payload.id}
              workspaceId={workspaceId}
            />
          );
        }}
      </Dialog>
    </AtsListPage>
  );
}
