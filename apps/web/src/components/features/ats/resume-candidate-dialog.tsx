import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import * as m from "@/paraglide/messages";
import { atsKeys } from "./query-keys";
import { atsApi, readAts } from "./client";

export function ResumeCandidateDialog({
  submissionId,
  workspaceId,
  onClose,
  onSuccess,
}: {
  submissionId: string;
  workspaceId: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [mode, setMode] = useState("existing");
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const param = { workspaceId };
  const { data, isError, isPending } = useQuery({
    enabled: mode === "existing",
    queryFn: async () => {
      const { rows } = await readAts(await atsApi.candidates.$get({ param, query: { page: "1" } }));
      return rows.map((candidate) => ({ label: candidate.name, value: candidate.id }));
    },
    queryKey: atsKeys.candidates(workspaceId)._ctx.resolveOptions.queryKey,
  });
  const phase = useSkeletonPhase(mode === "existing" && isPending);
  const mutation = useMutation({
    async mutationFn(selection: { candidateId: string } | { name: string }) {
      await readAts(
        await atsApi.submissions[":id"].resolve.$post({
          json: { ...selection, version: 1 },
          param: { ...param, id: submissionId },
        }),
      );
    },
    async onSuccess() {
      await onSuccess();
      onClose();
    },
  });
  const title = m.ats_review();
  const trimmedName = name.trim();
  const selection =
    mode === "existing" ? candidateId && { candidateId } : trimmedName && { name: trimmedName };
  return (
    <DialogPopup>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{m.ats_review_help()}</DialogDescription>
      </DialogHeader>
      <DialogPanel>
        <Tabs className="gap-4" onValueChange={(next) => setMode(String(next))} value={mode}>
          <TabsList aria-label={title} className="w-full">
            <TabsTab value="existing">{m.ats_link_existing_candidate()}</TabsTab>
            <TabsTab value="new">{m.ats_new_candidate()}</TabsTab>
          </TabsList>
          {mutation.isError && (
            <Alert variant="error">
              <AlertDescription>{m.ats_error()}</AlertDescription>
            </Alert>
          )}
          <TabsPanel value="existing">
            {isError ? (
              <Alert variant="error">
                <AlertDescription>{m.ats_error()}</AlertDescription>
              </Alert>
            ) : (
              <Field>
                <FieldLabel>{m.ats_candidate()}</FieldLabel>
                {phase === "skeleton" ? (
                  <Skeleton aria-busy="true" aria-label={m.ats_loading()} className="h-9 sm:h-8" />
                ) : (
                  <Select
                    disabled={!data?.length}
                    items={data}
                    onValueChange={setCandidateId}
                    value={candidateId}
                  >
                    <SelectTrigger aria-label={m.ats_candidate()}>
                      <SelectValue
                        placeholder={
                          data?.length === 0 ? m.ats_empty_candidates() : m.ats_select_candidate()
                        }
                      />
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectGroup>
                        {data?.map(({ label, value }) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectPopup>
                  </Select>
                )}
              </Field>
            )}
          </TabsPanel>
          <TabsPanel value="new">
            <Field>
              <FieldLabel>{m.ats_name()}</FieldLabel>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
          </TabsPanel>
        </Tabs>
      </DialogPanel>
      <DialogFooter>
        <Button
          onClick={() => selection && mutation.mutate(selection)}
          disabled={!selection}
          loading={mutation.isPending}
        >
          {m.ats_save()}
        </Button>
      </DialogFooter>
    </DialogPopup>
  );
}
