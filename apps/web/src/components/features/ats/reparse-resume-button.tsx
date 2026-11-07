import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";
import * as m from "@/paraglide/messages";
import { atsApi, readAts, readResumeProfile } from "./client";
import { atsKeys } from "./query-keys";

export function ReparseResumeButton({ id, workspaceId }: { id: string; workspaceId: string }) {
  const client = useQueryClient();
  const { data, isPending } = useQuery({
    queryFn: () => readResumeProfile({ id, workspaceId }),
    queryKey: atsKeys.resumes(workspaceId)._ctx.profile(id).queryKey,
    refetchInterval: ({ state }) =>
      state.data?.parseStatus === "queued" || state.data?.parseStatus === "running" ? 3000 : false,
  });
  const parsing = data?.parseStatus === "queued" || data?.parseStatus === "running";
  const wasParsing = useRef(false);
  useEffect(() => {
    if (wasParsing.current && !parsing) {
      void Promise.all([
        client.invalidateQueries({ queryKey: atsKeys.resumes(workspaceId).queryKey }),
        client.invalidateQueries({ queryKey: atsKeys.applications(workspaceId).queryKey }),
        client.invalidateQueries({ queryKey: atsKeys.candidates(workspaceId).queryKey }),
      ]);
    }
    wasParsing.current = parsing;
  }, [client, parsing, workspaceId]);
  const mutation = useMutation({
    mutationFn: async () =>
      readAts(await atsApi.uploads[":id"].reparse.$post({ param: { id, workspaceId } })),
    onError: () => toastManager.add({ title: m.resume_reparse_error(), type: "error" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: atsKeys.resumes(workspaceId).queryKey });
      toastManager.add({ title: m.resume_reparse_started(), type: "success" });
    },
  });
  return (
    <Button
      disabled={isPending || !data}
      loading={mutation.isPending || parsing}
      onClick={() => mutation.mutate()}
      size="sm"
      variant="outline"
    >
      {parsing ? m.resume_reparsing() : m.resume_reparse()}
    </Button>
  );
}
