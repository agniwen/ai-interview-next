import { useState } from "react";
import { IconInfoCircle } from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from "@/components/ui/preview-card";
import * as m from "@/paraglide/messages";
import type { CandidateInterview } from "./client";

export function InterviewJobDescription({
  interview,
}: {
  interview: Pick<CandidateInterview, "jobDescription">;
}) {
  return interview.jobDescription ? (
    <div className="prose prose-sm max-w-none text-left leading-7 dark:prose-invert">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{interview.jobDescription}</ReactMarkdown>
    </div>
  ) : (
    <p className="text-sm leading-7 text-muted-foreground">{m.candidate_job_empty()}</p>
  );
}

export function InterviewRoleContext({ interview }: { interview: CandidateInterview }) {
  const [open, setOpen] = useState(false);
  return (
    <PreviewCard open={open} onOpenChange={setOpen}>
      <PreviewCardTrigger
        render={
          <button
            type="button"
            aria-label={interview.jobTitle}
            onClick={() => setOpen(true)}
            className="inline-flex min-w-0 items-center gap-1 rounded-sm text-foreground underline decoration-foreground/30 decoration-dotted underline-offset-4 outline-none hover:decoration-foreground/60 focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <span className="truncate">{interview.jobTitle}</span>
        <IconInfoCircle aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      </PreviewCardTrigger>
      <PreviewCardPopup className="max-h-[min(28rem,60dvh)] w-[min(26rem,calc(100vw-2rem))] text-left">
        <h3 className="mb-1 text-xs text-muted-foreground">{m.candidate_job_description()}</h3>
        <p className="mb-3 text-sm font-medium">{interview.jobTitle}</p>
        <InterviewJobDescription interview={interview} />
        <p className="mt-5 text-xs text-muted-foreground">{m.candidate_interview_team()}</p>
        <p className="mt-1 text-sm">{interview.workspaceName}</p>
      </PreviewCardPopup>
    </PreviewCard>
  );
}
