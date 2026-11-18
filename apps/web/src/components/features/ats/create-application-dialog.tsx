import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ApplicationOptionsSkeleton } from "@/components/skeletons/components/application-options-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCreateHandle as createDialogHandle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toastManager } from "@/components/ui/toast";
import * as m from "@/paraglide/messages";
import { ApplicationResumeField } from "./application-resume-field";
import type { ApplicationResumeOption } from "./application-resume-field";
import { atsKeys } from "./query-keys";
import { atsApi, readAts } from "./client";

function ApplicationOptionField({
  label,
  options,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: string }[];
  placeholder: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select items={options} value={value} onValueChange={onChange} disabled={!options.length}>
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectPopup>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectPopup>
      </Select>
    </Field>
  );
}

const applicationErrors = {
  APPLICATION_INPUT_UNAVAILABLE: m.ats_error,
  APPLICATION_RESUME_ALREADY_BOUND: m.ats_application_resume_already_bound,
  APPLICATION_SUBMISSION_REQUIRED: m.ats_application_submission_required,
  RESUME_CANDIDATE_REQUIRED: m.ats_application_candidate_required,
};

async function submitApplication(
  workspaceId: string,
  input: { jobId: string; resumeId: string; submissionId?: string | null },
) {
  const response = await atsApi.applications.$post({
    json: { ...input, submissionId: input.submissionId ?? undefined, version: 1 },
    param: { workspaceId },
  });
  if (response.status === 409) {
    const result = await response.json();
    if ("error" in result) {
      throw new Error(applicationErrors[result.error]());
    }
  }
  return readAts(response);
}

export interface ApplicationResumeSelection {
  resumeId: string;
  submissionId?: string | null;
}

function ApplicationForm({
  onClose,
  selection,
  workspaceId,
}: {
  onClose: () => void;
  selection?: ApplicationResumeSelection;
  workspaceId: string;
}) {
  const client = useQueryClient();
  const [resume, setResume] = useState<ApplicationResumeOption | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const fixedResumeId = selection?.resumeId;
  const resumeId = fixedResumeId ?? resume?.id;
  const submissionId = selection?.submissionId ?? resume?.submissionId;
  const title = fixedResumeId ? m.ats_join_recruitment() : m.ats_create_application();
  const param = { workspaceId };
  const options = useQuery({
    queryFn: async () => readAts(await atsApi.applications.options.$get({ param })),
    queryKey: atsKeys.jobs(workspaceId)._ctx.options.queryKey,
  });
  const phase = useSkeletonPhase(options.isPending);
  const mutation = useMutation({
    mutationFn: (input: { jobId: string; resumeId: string; submissionId?: string | null }) =>
      submitApplication(workspaceId, input),
    async onSuccess() {
      await Promise.all([
        client.invalidateQueries({ queryKey: atsKeys.applications(workspaceId).queryKey }),
        client.invalidateQueries({ queryKey: atsKeys.resumes(workspaceId)._ctx.list._def }),
      ]);
      onClose();
      if (fixedResumeId) {
        toastManager.add({ title: m.ats_joined_recruitment(), type: "success" });
      }
    },
  });
  const jobs = options.data?.jobs.map((row) => ({ label: row.title, value: row.id })) ?? [];

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {fixedResumeId ? m.ats_join_recruitment_help() : m.ats_create_application_help()}
        </DialogDescription>
      </DialogHeader>
      <DialogPanel className="flex flex-col gap-4">
        {phase === "skeleton" && <ApplicationOptionsSkeleton jobOnly={Boolean(fixedResumeId)} />}
        {phase === "ready" && options.isError && (
          <Alert variant="error">
            <AlertDescription>{m.ats_error()}</AlertDescription>
          </Alert>
        )}
        {mutation.error && (
          <Alert variant="error">
            <AlertDescription>{mutation.error.message}</AlertDescription>
          </Alert>
        )}
        {phase === "ready" && options.data && (
          <>
            {!fixedResumeId && (
              <ApplicationResumeField
                onChange={setResume}
                value={resume}
                workspaceId={workspaceId}
              />
            )}
            <ApplicationOptionField
              label={m.ats_job()}
              onChange={setJobId}
              options={jobs}
              placeholder={jobs.length ? m.ats_select_job() : m.ats_empty_jobs()}
              value={jobId}
            />
          </>
        )}
      </DialogPanel>
      <DialogFooter>
        <Button
          disabled={!resumeId || !jobId}
          loading={mutation.isPending}
          onClick={() => {
            if (resumeId && jobId) {
              mutation.mutate({ jobId, resumeId, submissionId });
            }
          }}
        >
          {title}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * 创建招聘记录的弹窗和表单，既支持预选简历，也支持在表单内选择简历与岗位。
 * Application creation dialog and form, accepting a preset resume or letting users choose a resume and job.
 */
export function CreateApplicationDialog({
  handle,
  resumeId,
  submissionId,
  workspaceId,
}: {
  handle?: ReturnType<typeof createDialogHandle<ApplicationResumeSelection>>;
  resumeId?: string;
  submissionId?: string | null;
  workspaceId: string;
}) {
  const localHandle = useMemo(() => createDialogHandle<ApplicationResumeSelection>(), []);
  const dialog = handle ?? localHandle;
  return (
    <Dialog handle={dialog}>
      {({ payload }) => (
        <>
          {!handle && (
            <DialogTrigger render={resumeId ? <Button size="sm" variant="outline" /> : <Button />}>
              {resumeId ? m.ats_join_recruitment() : m.ats_create_application()}
            </DialogTrigger>
          )}
          <DialogPopup>
            <ApplicationForm
              key={payload?.submissionId ?? payload?.resumeId ?? submissionId ?? resumeId}
              onClose={() => dialog.close()}
              selection={payload ?? (resumeId ? { resumeId, submissionId } : undefined)}
              workspaceId={workspaceId}
            />
          </DialogPopup>
        </>
      )}
    </Dialog>
  );
}
