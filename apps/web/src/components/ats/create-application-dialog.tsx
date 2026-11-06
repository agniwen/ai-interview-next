import { useMutation, useQuery } from "@tanstack/react-query";
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

function ApplicationForm({
  onClose,
  onSuccess,
  resumeId: fixedResumeId,
  workspaceId,
}: {
  onClose: () => void;
  onSuccess: () => Promise<void>;
  resumeId?: string;
  workspaceId: string;
}) {
  const [resume, setResume] = useState<ApplicationResumeOption | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const resumeId = fixedResumeId ?? resume?.id;
  const title = fixedResumeId ? m.ats_join_recruitment() : m.ats_create_application();
  const param = { workspaceId };
  const options = useQuery({
    queryFn: async () => readAts(await atsApi.applications.options.$get({ param })),
    queryKey: ["ats", workspaceId, "application-options"],
  });
  const mutation = useMutation({
    async mutationFn(input: { jobId: string; resumeId: string }) {
      const response = await atsApi.applications.$post({ json: { ...input, version: 1 }, param });
      if (response.status === 409) {
        const result = await response.json();
        if ("error" in result && result.error === "RESUME_CANDIDATE_REQUIRED") {
          throw new Error(m.ats_application_candidate_required());
        }
      }
      return readAts(response);
    },
    async onSuccess() {
      await onSuccess();
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
        {options.isPending && <ApplicationOptionsSkeleton jobOnly={Boolean(fixedResumeId)} />}
        {options.isError && (
          <Alert variant="error">
            <AlertDescription>{m.ats_error()}</AlertDescription>
          </Alert>
        )}
        {mutation.error && (
          <Alert variant="error">
            <AlertDescription>{mutation.error.message}</AlertDescription>
          </Alert>
        )}
        {options.data && (
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
              mutation.mutate({ jobId, resumeId });
            }
          }}
        >
          {title}
        </Button>
      </DialogFooter>
    </>
  );
}

export function CreateApplicationDialog({
  handle,
  onSuccess,
  resumeId,
  workspaceId,
}: {
  handle?: ReturnType<typeof createDialogHandle<string>>;
  onSuccess: () => Promise<void>;
  resumeId?: string;
  workspaceId: string;
}) {
  const localHandle = useMemo(() => createDialogHandle<string>(), []);
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
              key={payload ?? resumeId}
              onClose={() => dialog.close()}
              onSuccess={onSuccess}
              resumeId={payload ?? resumeId}
              workspaceId={workspaceId}
            />
          </DialogPopup>
        </>
      )}
    </Dialog>
  );
}
